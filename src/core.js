// Evidence Gate — core engine
//
// Decide whether an LLM may speak about a set of records, BEFORE it generates
// anything — based on evidence coverage, freshness, and quality.
//
// Zero dependencies. Domain-agnostic: you bring the records + a ruleset (preset).
//
//   record = { date, qualityScore?, quality?, flags?, tier? }
//   - date         ISO "YYYY-MM-DD" of the observation
//   - qualityScore optional 0-100 numeric quality
//   - quality      optional "clean" | "review"
//   - flags        optional string[] of data-quality flags
//   - tier         optional "primary" (default) | "fallback" (cached/secondary source)

// ── Freshness primitives ──────────────────────────────────────────────────────
export function parseDate(value) {
  if (!value) return null;
  const m = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  // reject impossible dates that JS would silently roll over (e.g. 2026-13-01, 2026-02-31)
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export function daysSince(date) {
  if (!date) return null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((today - date.getTime()) / 86400000);
}

export function freshnessLabel(latest, thresholdDays) {
  const age = daysSince(latest);
  if (age === null) return "unknown";
  return age > thresholdDays ? "stale" : "fresh";
}

// ── validateRules: fail fast on malformed rulesets ────────────────────────────
// Both ports validate rules at call time and throw the same way, so a bad
// ruleset can never silently pass one port (JS used to treat missing numeric
// fields as permissive: `age > undefined` is false → everything looked fresh)
// while crashing the other (Python raised KeyError). Explicit null is treated
// like an absent optional field, matching Python's `None`.
const RULE_NUMBER_FIELDS = ["staleDays", "minRecords", "qualityThreshold"];

export function validateRules(rules, caller = "evidenceGate") {
  if (!rules || typeof rules !== "object" || Array.isArray(rules))
    throw new Error(`${caller}: \`rules\` (a preset) is required`);
  for (const f of RULE_NUMBER_FIELDS) {
    const v = rules[f];
    if (typeof v !== "number" || !Number.isFinite(v))
      throw new Error(`${caller}: rules.${f} is required and must be a finite number`);
  }
  if (rules.forbiddenActions != null && !Array.isArray(rules.forbiddenActions))
    throw new Error(`${caller}: rules.forbiddenActions must be an array`);
  if (rules.messages != null && (typeof rules.messages !== "object" || Array.isArray(rules.messages)))
    throw new Error(`${caller}: rules.messages must be an object`);
  if (rules.primaryLabel != null && typeof rules.primaryLabel !== "string")
    throw new Error(`${caller}: rules.primaryLabel must be a string`);
  if (rules.provenance != null) {
    if (typeof rules.provenance !== "object" || Array.isArray(rules.provenance))
      throw new Error(`${caller}: rules.provenance must be an object`);
    const ma = rules.provenance.minAuthority;
    if (ma != null && !AUTHORITY_LADDER.includes(ma))
      throw new Error(`${caller}: rules.provenance.minAuthority must be one of ${AUTHORITY_LADDER.join("|")}`);
  }
  return rules;
}

// ── Provenance ────────────────────────────────────────────────────────────────
// Opt-in per record: record.provenance = { source: { id?, type?, authority? },
// retrievedAt?, contentHash?, chain? }. The core never computes hashes — they
// are opaque "<alg>:<hex>" strings the app supplies (see examples/provenance.mjs).

export const AUTHORITY_LADDER = ["official", "licensed", "secondary", "unverified"];
const AUTHORITY_RANK = { official: 3, licensed: 2, secondary: 1, unverified: 0 };

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isHash = (v) => typeof v === "string" && v.length > 0;

// Chain continuity (§3 of the design doc): chain[0].inputHash must equal
// contentHash, and every chain[i].inputHash must equal chain[i-1].outputHash.
// Hashes are compared as opaque strings. Never throws, never changes gate
// status by itself — broken continuity surfaces as a gate warning.
export function validateProvenance(record) {
  const problems = [];
  const p = record == null ? null : record.provenance;
  if (p == null) return { valid: true, problems }; // no provenance = nothing to validate
  if (!isPlainObject(p)) return { valid: false, problems: ["invalid_provenance"] };
  if (!isPlainObject(p.source)) problems.push("missing_source");
  if (p.chain != null && !Array.isArray(p.chain)) problems.push("invalid_chain");
  const chain = Array.isArray(p.chain) ? p.chain : [];
  if (chain.length) {
    const first = isPlainObject(chain[0]) ? chain[0] : {};
    if (!isHash(p.contentHash) || first.inputHash !== p.contentHash) problems.push("chain_root_mismatch");
    for (let i = 1; i < chain.length; i++) {
      const prev = isPlainObject(chain[i - 1]) ? chain[i - 1] : {};
      const cur = isPlainObject(chain[i]) ? chain[i] : {};
      if (!isHash(prev.outputHash) || cur.inputHash !== prev.outputHash) problems.push(`chain_gap_at_${i}`);
    }
  }
  return { valid: problems.length === 0, problems };
}

// rank of a record's source authority; unknown/missing ranks below the ladder
function authorityRank(record) {
  const p = record == null ? null : record.provenance;
  const src = isPlainObject(p) && isPlainObject(p.source) ? p.source : null;
  const rank = src ? AUTHORITY_RANK[src.authority] : undefined;
  return rank === undefined ? -1 : rank;
}

// ── classifyStatus: records[] + rules → status of the primary evidence group ──
//   rules: { staleDays, minRecords, qualityThreshold }
//   returns: { status, freshness, latest, count, qualityMin, flags }
//   status: "available" | "quality_warning" | "fallback" | "missing"
export function classifyStatus(records, rules) {
  validateRules(rules, "classifyStatus");
  const usable = records || [];
  if (!usable.length) {
    return { status: "missing", freshness: "unknown", latest: null, count: 0, qualityMin: null, flags: [] };
  }

  const dates = usable.map((r) => parseDate(r.date)).filter(Boolean);
  const latest = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
  const freshness = latest ? freshnessLabel(latest, rules.staleDays) : "unknown";
  const latestStr = latest ? latest.toISOString().slice(0, 10) : null;

  // Every record came from a fallback/cached source → not authoritative.
  if (usable.every((r) => r.tier === "fallback")) {
    return { status: "fallback", freshness, latest: latestStr, count: usable.length, qualityMin: null, flags: [] };
  }

  const scores = usable.map((r) => r.qualityScore).filter((v) => v !== null && v !== undefined);
  const qualityMin = scores.length ? Math.min(...scores) : null;
  let flags = [];
  for (const r of usable) {
    const wf = r.flags;
    if (Array.isArray(wf)) flags.push(...wf);
    else if (typeof wf === "string" && wf) flags.push(wf);
  }
  flags = [...new Set(flags)].sort();

  const reviewQuality = usable.some((r) => r.quality === "review");
  const hasQualityIssue = (qualityMin !== null && qualityMin < rules.qualityThreshold) || flags.length > 0 || reviewQuality;

  let status;
  if (usable.length < rules.minRecords) status = "quality_warning";
  else if (hasQualityIssue) status = "quality_warning";
  else status = "available";

  return { status, freshness, latest: latestStr, count: usable.length, qualityMin, flags };
}

// ── deriveAllowedActions: status + supporting evidence → what the AI may do ────
export function deriveAllowedActions({ primaryStatus, supportingPresent = false, forbiddenActions = [] } = {}) {
  const summarize = ["available", "quality_warning", "fallback"].includes(primaryStatus) || supportingPresent;
  const compare = ["available", "quality_warning"].includes(primaryStatus);
  const actions = { summarize, compare };
  for (const a of forbiddenActions || []) actions[a] = false; // hard rule: always false; `|| []` because a default param doesn't cover null (Python: `or []`)
  return actions;
}

// ── Decision log primitives ───────────────────────────────────────────────────
// A decision record is the audit trail of one gate call: WHAT the gate decided,
// under WHICH rules, over WHICH evidence — without storing the evidence itself
// (records may be sensitive; only a digest of them is kept).
//
// Digests are FNV-1a 64-bit over canonical JSON. Deterministic and identical
// across the JS and Python ports; NOT cryptographic — they detect drift and
// correlate log entries, they don't prove integrity against an adversary.
// Cross-port equality is guaranteed for JSON-safe values (strings, booleans,
// null, integers, and floats with a plain decimal form); exotic floats
// (e.g. 1e-7) and NaN serialize differently per language — keep them out of
// records you intend to digest.

export const DECISION_SCHEMA = "evidence-gate.decision/1";

export function canonicalJson(value) {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

export function fnv1a64(str) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(str)) {
    hash ^= BigInt(byte);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
}

export function evidenceDigest(value) {
  return "fnv1a64:" + fnv1a64(canonicalJson(value));
}

// ── evidenceGate: the one-call API ────────────────────────────────────────────
//   evidenceGate({ records, supporting, rules, decision? })
//     → { status, freshness, allowedActions, warnings, caveats, decision? }
//   `caveats` is a list of strings ready to inject into your prompt.
//   `decision` (opt-in): pass `true` or `{ id?, at? }` to also get a
//   JSONL-serializable decision record for your audit log. The core never
//   writes anywhere — persisting the record is the caller's job.
export function evidenceGate({ records = [], supporting = [], rules, decision } = {}) {
  validateRules(rules, "evidenceGate");
  records = records || []; // null must behave like [] everywhere, incl. digests (Python port: `records or []`)
  supporting = supporting || [];

  const primary = classifyStatus(records, rules);
  const supportingPresent = supporting.length > 0;
  const allowedActions = deriveAllowedActions({
    primaryStatus: primary.status,
    supportingPresent,
    forbiddenActions: rules.forbiddenActions,
  });

  const warnings = [];
  const M = rules.messages || {};
  const label = rules.primaryLabel || "primary data";
  if (primary.status === "missing")
    warnings.push({ level: "block", code: "primary_missing", message: M.primary_missing || `No ${label} available — the AI must not invent numbers.` });
  else if (primary.status === "fallback")
    warnings.push({ level: "review", code: "primary_fallback", message: M.primary_fallback || `${label} is cached/fallback, not authoritative — the AI must say so.` });
  else if (primary.status === "quality_warning")
    warnings.push({ level: "review", code: "primary_quality", message: M.primary_quality || `${label} has a data-quality warning — the AI must add a caveat.` });
  if (primary.freshness === "stale")
    warnings.push({ level: "review", code: "primary_stale", message: M.primary_stale || `${label} is stale (older than ${rules.staleDays} days) — the AI must not say "latest" or "today".` });

  // Provenance (opt-in via rules.provenance; deliberate v1 scope cut: these
  // warnings NEVER change status or allowedActions — they only add caveats).
  const provRecords = records.filter((r) => r != null && r.provenance != null);
  const brokenChains = provRecords.filter((r) => !validateProvenance(r).valid).length;
  const P = rules.provenance;
  if (P) {
    const missing = records.length - provRecords.length;
    if (P.require && missing > 0)
      warnings.push({ level: "review", code: "provenance_missing", message: M.provenance_missing || `${missing} of ${records.length} record(s) lack provenance — the AI must not present them as verified sources.` });
    if (P.minAuthority != null) {
      // per-record comparison: one weak source taints the set with a caveat
      const untrusted = provRecords.filter((r) => authorityRank(r) < AUTHORITY_RANK[P.minAuthority]).length;
      if (untrusted > 0)
        warnings.push({ level: "review", code: "provenance_untrusted", message: M.provenance_untrusted || `${untrusted} record(s) come from sources below "${P.minAuthority}" authority — the AI must attribute them cautiously.` });
    }
    if (brokenChains > 0)
      warnings.push({ level: "review", code: "provenance_broken_chain", message: M.provenance_broken_chain || `${brokenChains} record(s) have a broken provenance chain — their lineage is not replay-verifiable.` });
  }

  if (!supportingPresent)
    warnings.push({ level: "info", code: "no_supporting", message: M.no_supporting || "No supporting evidence — primary source only." });

  // Source-naming attribution (info, opt-in via rules.provenance): only when
  // every provenance-bearing record names its source, and there are at most
  // two distinct sources — silent beyond that (counts still land in
  // decision.provenance.sources).
  if (P && provRecords.length > 0) {
    const ids = provRecords.map((r) => (isPlainObject(r.provenance.source) ? r.provenance.source.id : undefined));
    if (ids.every((id) => typeof id === "string" && id !== "")) {
      const distinct = [...new Set(ids)];
      const authOf = (id) => {
        const src = provRecords.find((r) => r.provenance.source.id === id).provenance.source;
        return typeof src.authority === "string" ? src.authority : "unknown";
      };
      if (distinct.length === 1) {
        const retrieved = provRecords.map((r) => r.provenance.retrievedAt).filter((v) => typeof v === "string" && v !== "");
        const suffix = retrieved.length ? `, retrieved ${retrieved.reduce((a, b) => (a > b ? a : b)).slice(0, 10)}` : "";
        warnings.push({ level: "info", code: "provenance_attribution", message: M.provenance_attribution || `${label} are based on ${distinct[0]} (${authOf(distinct[0])})${suffix}.` });
      } else if (distinct.length === 2) {
        warnings.push({ level: "info", code: "provenance_attribution", message: M.provenance_attribution || `${label} are based on ${distinct[0]} (${authOf(distinct[0])}) and ${distinct[1]} (${authOf(distinct[1])}).` });
      }
    }
  }

  const result = { status: primary.status, freshness: primary.freshness, allowedActions, warnings, caveats: warnings.map((w) => w.message) };

  if (decision) {
    const meta = decision === true ? {} : decision;
    result.decision = {
      schema: DECISION_SCHEMA,
      id: meta.id ?? null,
      at: meta.at ?? new Date().toISOString(),
      digests: { evidence: evidenceDigest({ records, supporting }), rules: evidenceDigest(rules) },
      counts: { records: records.length, supporting: supporting.length },
      rules: {
        primaryLabel: label,
        staleDays: rules.staleDays ?? null,
        minRecords: rules.minRecords ?? null,
        qualityThreshold: rules.qualityThreshold ?? null,
        forbiddenActions: rules.forbiddenActions || [],
      },
      outcome: {
        status: primary.status,
        freshness: primary.freshness,
        allowedActions,
        warnings: warnings.map(({ level, code }) => ({ level, code })),
        caveats: result.caveats,
      },
    };
    // Additive block (still evidence-gate.decision/1 — consumers must ignore
    // unknown fields): present whenever any record carries provenance,
    // independent of rules.provenance. Source ids DO appear (auditors need
    // them); no evidence values, no content excerpts.
    if (provRecords.length > 0) {
      const sources = [];
      const byKey = new Map();
      for (const r of provRecords) {
        const src = isPlainObject(r.provenance.source) ? r.provenance.source : {};
        const entry = { id: src.id ?? null, type: src.type ?? null, authority: src.authority ?? null };
        const key = canonicalJson([entry.id, entry.type, entry.authority]);
        if (byKey.has(key)) byKey.get(key).records += 1;
        else { const e = { ...entry, records: 1 }; byKey.set(key, e); sources.push(e); }
      }
      result.decision.provenance = {
        covered: provRecords.length,
        total: records.length,
        sources,
        brokenChains,
        // replay-verifiable exactly like the evidence digest: recompute over
        // the claimed provenance set (in record order), compare with the log
        digest: evidenceDigest(provRecords.map((r) => r.provenance)),
      };
    }
  }

  return result;
}
