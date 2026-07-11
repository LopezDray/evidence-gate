// Evidence Gate — post-generation claim verification
//
// The gate decides WHETHER the model may speak; verifyClaims checks whether
// what it said stands on the evidence it was given. The core cannot judge
// semantic truth — it verifies a citation protocol, deterministically and
// identically across the JS and Python ports:
//
//   1. citationBlock() renders the markers the model must cite from.
//   2. verifyClaims() parses the answer: every citation must resolve to a
//      record that exists (no phantom evidence), every claim-looking sentence
//      must carry a citation (no naked claims), the framing must match the
//      gate's verdict (no "as of today" over stale data), and — when records
//      carry facts — every cited number must match them (no misquoted values).
//
// Spec: docs/design/claim-verification.md (approved). Zero dependencies.

import { evidenceDigest, canonicalJson } from "./core.js";

export const VERIFICATION_SCHEMA = "evidence-gate.verification/1";

// Marker grammar, shared verbatim with the Python port — one grammar only.
const MARKER_RE_SOURCE = "\\[ev:([A-Za-z0-9_.-]+)\\]";
// Default claim patterns: any digit (ASCII or Thai — the Thai range is
// explicit, never Unicode \d), or a quantity-implying symbol.
// Regex SOURCES (strings), never functions — rulesets stay JSON-digestable.
const DEFAULT_CLAIM_PATTERNS = ["\\d", "[๐-๙]", "%|\\$|€|£|฿"];
// English-only by default; apps localize via rules.verification.freshnessPatterns.
const DEFAULT_FRESHNESS_PATTERNS = ["\\b(today|as of now|currently|latest|real[- ]?time)\\b"];

const ID_RE = /^[A-Za-z0-9_.-]+$/;
const NUMERIC_RE = /^[0-9]+$/;

// A usable record id must fit the marker grammar and must NOT be purely
// numeric — numeric refs are reserved for index resolution, so a numeric id
// could never be told apart from an index. Invalid ids are ignored (the
// record falls back to its index marker), never an error.
function usableId(id) {
  return typeof id === "string" && ID_RE.test(id) && !NUMERIC_RE.test(id);
}

// ── citationBlock: render the evidence list the model must cite from ─────────
//   citationBlock(records, opts?) → string
//   opts: { header?, line?: (record, marker, index) => string, supporting? }
//   Markers are the record's id when usable, else the 1-based index into the
//   concatenation [records..., supporting...]. Supporting records are tagged.
export function citationBlock(records = [], opts = {}) {
  records = records || [];
  const supporting = opts.supporting || [];
  const header = opts.header ?? "EVIDENCE (cite with its marker after every factual statement):";
  const lines = [header];
  const all = [...records.map((r) => [r, "primary"]), ...supporting.map((r) => [r, "supporting"])];
  all.forEach(([r, tier], i) => {
    r = r || {};
    const marker = usableId(r.id) ? r.id : String(i + 1);
    if (typeof opts.line === "function") { lines.push(opts.line(r, marker, i)); return; }
    let line = `[ev:${marker}] ${r.date || "undated"}`;
    if (typeof r.qualityScore === "number") line += ` — quality ${canonicalJson(r.qualityScore)}`;
    const flags = Array.isArray(r.flags) ? r.flags : typeof r.flags === "string" && r.flags ? [r.flags] : [];
    if (flags.length) line += `, flags: ${flags.join(", ")}`;
    if (tier === "supporting") line += " (supporting)";
    lines.push(line);
  });
  return lines.join("\n");
}

// ── resolution: ref → 0-based index into [records..., supporting...] ─────────
// Order: exact id match (records first, then supporting) → else a numeric ref
// 1..N is that 1-based position. Anything else is phantom (null).
function resolveRef(ref, records, supporting) {
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r && usableId(r.id) && r.id === ref) return { record: i, tier: "primary" };
  }
  for (let j = 0; j < supporting.length; j++) {
    const r = supporting[j];
    if (r && usableId(r.id) && r.id === ref) return { record: records.length + j, tier: "supporting" };
  }
  if (NUMERIC_RE.test(ref)) {
    const n = parseInt(ref, 10);
    if (n >= 1 && n <= records.length + supporting.length)
      return { record: n - 1, tier: n <= records.length ? "primary" : "supporting" };
  }
  return null;
}

// ── fact cross-checking: deterministic misquote detection (spec §8) ───────────
// Extraction pipeline and matching rule are normative in the design doc and
// must stay byte-identical across ports: Thai digit translation → ISO date
// masking → one shared token regex → decimal-point-shift canonicalization.

// ISO dates are masked so date components never leak into strict matching.
const ISO_DATE_RE_SOURCE = "(?<![0-9])[0-9]{4}-[0-9]{2}-[0-9]{2}(?![0-9])";
// Groups: 1 = sign, 2 = integer part (comma separators), 3 = .fraction, 4 = suffix.
// The lookbehind keeps ranges positive (3-5% → 3, 5) and stops v1.2.3 tails;
// the lookahead keeps 512MB / 10Kg from reading as magnitudes.
const NUMBER_TOKEN_RE_SOURCE =
  "(?<![0-9.])(-?)([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)((?:\\.[0-9]+)?)" +
  "(?:[ \\t]?(ล้านล้าน|แสนล้าน|หมื่นล้าน|พันล้าน|ล้าน|แสน|หมื่น|พัน|[KkMmBb](?![A-Za-z0-9])))?";
// Fixed magnitude table (suffix → power of ten), NOT overridable.
const MAGNITUDES = {
  K: 3, k: 3, M: 6, m: 6, B: 9, b: 9,
  "พัน": 3, "หมื่น": 4, "แสน": 5, "ล้าน": 6,
  "พันล้าน": 9, "หมื่นล้าน": 10, "แสนล้าน": 11, "ล้านล้าน": 12,
};

// Thai numerals ๐-๙ (U+0E50–U+0E59) → 0-9 via an explicit offset, never
// Unicode \d (the Python port compiles every pattern with re.ASCII).
function translateThaiDigits(text) {
  return text.replace(/[๐-๙]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x0e50 + 48));
}

// Canonical value: shift the decimal point in the digit string, then parse
// ONCE. Never multiply by a float power of ten — 1.2 * 1e6 is NOT 1200000 in
// IEEE-754, and exact matching would break identically in both ports.
function tokenValue(sign, intPart, fracPart, suffix) {
  const I = intPart.replace(/,/g, "");
  const F = fracPart ? fracPart.slice(1) : "";
  const e = suffix ? MAGNITUDES[suffix] : 0;
  const digits = I + F;
  const p = I.length + e;
  let whole, frac;
  if (p >= digits.length) { whole = digits + "0".repeat(p - digits.length); frac = ""; }
  else { whole = digits.slice(0, p); frac = digits.slice(p); }
  whole = whole.replace(/^0+/, "") || "0";
  frac = frac.replace(/0+$/, "");
  return parseFloat(sign + whole + (frac ? "." + frac : ""));
}

// Usable facts = a plain object with ≥1 finite numeric value (booleans are
// not numbers; {} is NOT usable — spelled out to dodge the truthiness trap).
function factValues(record) {
  const f = record ? record.facts : null;
  if (!f || typeof f !== "object" || Array.isArray(f)) return [];
  const out = [];
  for (const k of Object.keys(f)) {
    if (typeof f[k] === "number" && Number.isFinite(f[k])) out.push(f[k]);
  }
  return out;
}

// ── sentence segmentation: a stable, port-identical partition ─────────────────
// Split on newlines, then after [.!?] followed by a space/tab. Explicit ASCII
// whitespace classes on purpose: JS \s and Python \s disagree on exotic
// Unicode whitespace, and this partition must be byte-identical across ports.
function splitSentences(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    for (const part of line.split(/(?<=[.!?])[ \t]+/)) {
      const s = part.replace(/^[ \t\r\f\v]+|[ \t\r\f\v]+$/g, "");
      if (s) out.push(s);
    }
  }
  return out;
}

// ── verifyClaims: the post-generation half of the proof loop ─────────────────
//   verifyClaims({ answer, records, supporting?, gate?, rules?, decision? })
//     → { pass, verdict, citations, claims, stats, warnings, caveats, decision? }
//   Never throws on messy input — a garbage answer yields a verdict, not an
//   exception. `rules` is optional here (only .verification and .messages are
//   read); pass the SAME records/supporting the prompt was built from, in the
//   same order, or resolution and the digest join are meaningless.
export function verifyClaims({ answer, records = [], supporting = [], gate, rules, decision } = {}) {
  answer = answer == null ? "" : String(answer);
  records = records || [];
  supporting = supporting || [];
  const V = (rules && rules.verification) || {};
  const M = (rules && rules.messages) || {};
  const requireFullCoverage = V.requireFullCoverage == null ? true : !!V.requireFullCoverage;
  // Pattern sources are compiled per port. The Python port compiles with
  // re.ASCII so \d, \b, \w mean the same thing in both languages.
  const claimRes = (V.claimPatterns || DEFAULT_CLAIM_PATTERNS).map((s) => new RegExp(s));
  const freshRes = (V.freshnessPatterns || DEFAULT_FRESHNESS_PATTERNS).map((s) => new RegExp(s, "i"));

  // every marker occurrence, in order of appearance
  const citations = [];
  for (const m of answer.matchAll(new RegExp(MARKER_RE_SOURCE, "g"))) {
    const ref = m[1];
    const resolved = resolveRef(ref, records, supporting);
    citations.push({
      marker: "ev:" + ref,
      ref,
      record: resolved ? resolved.record : null,
      valid: resolved !== null,
      tier: resolved ? resolved.tier : null,
    });
  }

  // claim-looking sentences; markers are stripped before pattern matching so
  // a digit inside [ev:1] can never make a sentence look like a claim
  const claims = [];
  const misquotes = [];
  let cited = 0, uncited = 0;
  for (const sentence of splitSentences(answer)) {
    const refs = [...sentence.matchAll(new RegExp(MARKER_RE_SOURCE, "g"))].map((m) => m[1]);
    const stripped = sentence.replace(new RegExp(MARKER_RE_SOURCE, "g"), "");
    if (!claimRes.some((re) => re.test(stripped))) continue;
    const hasValid = refs.some((ref) => resolveRef(ref, records, supporting) !== null);
    claims.push({ text: sentence, cited: hasValid, markers: refs.map((r) => "ev:" + r) });
    hasValid ? cited++ : uncited++;

    // fact cross-check (§8): pool = union of numeric facts of every validly
    // cited record; empty pool = opt-out, the sentence is skipped silently.
    if (!hasValid) continue;
    const pool = [];
    for (const ref of refs) {
      const resolved = resolveRef(ref, records, supporting);
      if (!resolved) continue;
      const rec = resolved.record < records.length
        ? records[resolved.record] : supporting[resolved.record - records.length];
      pool.push(...factValues(rec));
    }
    if (pool.length === 0) continue;
    const masked = translateThaiDigits(stripped).replace(new RegExp(ISO_DATE_RE_SOURCE, "g"), " ");
    for (const m of masked.matchAll(new RegExp(NUMBER_TOKEN_RE_SOURCE, "g"))) {
      const value = tokenValue(m[1], m[2], m[3], m[4]);
      if (!pool.includes(value)) misquotes.push({ token: m[0], value, sentence });
    }
  }

  const phantom = citations.filter((c) => !c.valid).length;
  const validCount = citations.length - phantom;
  const stats = { claims: claims.length, cited, uncited, phantom, misquoted: misquotes.length };

  // verdict ladder — top-down, first hit wins
  let verdict, pass;
  if (phantom > 0) { verdict = "phantom_citations"; pass = false; }
  else if (misquotes.length > 0) { verdict = "misquoted_values"; pass = false; }
  else if (claims.length > 0 && validCount === 0) { verdict = "no_citations"; pass = false; }
  else if (uncited > 0) { verdict = "unsupported_claims"; pass = !requireFullCoverage; }
  else { verdict = "supported"; pass = true; } // no claims at all (a refusal) passes

  const warnings = [];
  if (phantom > 0) {
    const seen = new Set(), list = [];
    for (const c of citations) if (!c.valid && !seen.has(c.marker)) { seen.add(c.marker); list.push(`[${c.marker}]`); }
    warnings.push({ level: "block", code: "verify_phantom_citation",
      message: M.verify_phantom_citation || `Citations resolve to no evidence record: ${list.join(", ")} — the model may have invented sources.` });
  }
  if (misquotes.length > 0) {
    const seen = new Set(), list = [];
    for (const q of misquotes) if (!seen.has(q.token)) { seen.add(q.token); list.push(q.token); }
    warnings.push({ level: "block", code: "verify_misquoted_value",
      message: M.verify_misquoted_value || `Cited numbers do not match the evidence facts: ${list.join(", ")} — the model may have misquoted values.` });
  }
  if (claims.length > 0 && validCount === 0)
    warnings.push({ level: "block", code: "verify_no_citations",
      message: M.verify_no_citations || "The answer makes claims but cites no evidence — the citation protocol was ignored." });
  else if (uncited > 0)
    warnings.push({ level: "review", code: "verify_uncited_claim",
      message: M.verify_uncited_claim || `${uncited} claim(s) lack a valid citation — treat them as unverified.` });
  if (gate && gate.freshness === "stale" && freshRes.some((re) => re.test(answer)))
    warnings.push({ level: "review", code: "verify_stale_framing",
      message: M.verify_stale_framing || `The answer uses fresh-sounding framing but the evidence is stale — the AI must not say "latest" or "today".` });

  const result = { pass, verdict, citations, claims, misquotes, stats, warnings, caveats: warnings.map((w) => w.message) };

  if (decision) {
    const meta = decision === true ? {} : decision;
    result.decision = {
      schema: VERIFICATION_SCHEMA,
      id: meta.id ?? null,
      at: meta.at ?? new Date().toISOString(),
      // evidence digest: identical function + input as the gate's decision
      // record → the join key. Neither the evidence nor the answer is stored.
      digests: { evidence: evidenceDigest({ records, supporting }), answer: evidenceDigest(answer) },
      verdict,
      pass,
      stats,
      warnings: warnings.map(({ level, code }) => ({ level, code })),
    };
  }

  return result;
}
