// Evidence Gate — claim verification tests (no deps): node test/verify.test.mjs
// Cross-port behavior is locked by test/vectors.json (run by vectors.test.mjs
// and the Python suite); this file covers the JS-specific API surface.
import { verifyClaims, citationBlock, VERIFICATION_SCHEMA } from "../src/verify.js";
import { evidenceGate } from "../src/core.js";
import { FINANCE } from "../src/presets.js";

let pass = 0, fail = 0;
function ok(name, cond, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + detail}`);
  cond ? pass++ : fail++;
}

const records = [{ date: "2026-03-31" }, { date: "2025-12-31" }];
const answer = "Revenue was 1.2M [ev:1]. Cash was 3M [ev:2].";

// ── verification record: opt-in, shape, digest join, privacy ──────────────────
ok("no decision record unless requested", verifyClaims({ answer, records }).decision === undefined);

const v = verifyClaims({ answer, records, decision: { id: "req-9", at: "2026-07-11T10:00:00Z" } });
const d = v.decision;
ok("verification schema", d.schema === VERIFICATION_SCHEMA && d.schema === "evidence-gate.verification/1");
ok("record carries caller id + timestamp", d.id === "req-9" && d.at === "2026-07-11T10:00:00Z");
ok("record mirrors verdict/pass/stats",
  d.verdict === v.verdict && d.pass === v.pass && JSON.stringify(d.stats) === JSON.stringify(v.stats));
ok("record warnings keep code+level only", d.warnings.every((w) => w.code && w.level && !("message" in w)));

// the digest join: the SAME records give the gate decision and the
// verification record the SAME evidence digest — the audit-trail join key
const g = evidenceGate({ records, rules: FINANCE, decision: { id: "req-9" } });
ok("evidence digest joins gate decision and verification record",
  g.decision.digests.evidence === d.digests.evidence);
ok("answer digest is separate from evidence digest", d.digests.answer !== d.digests.evidence);

// privacy: neither the answer text nor the evidence appears in the record
const blob = JSON.stringify(d);
ok("record does not embed the answer or evidence", !blob.includes("Revenue") && !blob.includes("2026-03-31"));
ok("record is JSONL-serializable (single line)", !blob.includes("\n"));

// decision: true fills defaults
const v2 = verifyClaims({ answer, records, decision: true });
ok("decision:true fills at + null id", v2.decision.id === null && typeof v2.decision.at === "string" && v2.decision.at.endsWith("Z"));

// ── never throws on messy input ───────────────────────────────────────────────
ok("null answer + null records -> supported, no crash",
  verifyClaims({ answer: null, records: null }).verdict === "supported");
ok("non-string answer is coerced", verifyClaims({ answer: 12345, records }).verdict === "no_citations");
ok("no args at all", verifyClaims().verdict === "supported");

// ── marker binding & duplicates ───────────────────────────────────────────────
{
  const r = verifyClaims({ answer: "Revenue was 1.2M [ev:1]. Cash was 3M.", records });
  ok("a citation in one sentence does not cover another",
    r.verdict === "unsupported_claims" && r.stats.uncited === 1, JSON.stringify(r.stats));
}
{
  const r = verifyClaims({ answer: "Revenue 1M [ev:1] [ev:1].", records });
  ok("duplicate markers counted per occurrence", r.citations.length === 2 && r.stats.cited === 1);
}

// ── strictness knob ───────────────────────────────────────────────────────────
{
  const partial = "Revenue was 1.2M [ev:1]. Cash was 3M.";
  ok("requireFullCoverage defaults to strict",
    verifyClaims({ answer: partial, records }).pass === false);
  ok("requireFullCoverage: false is lenient",
    verifyClaims({ answer: partial, records, rules: { verification: { requireFullCoverage: false } } }).pass === true);
}

// ── stale framing needs BOTH a stale gate and fresh-sounding words ────────────
ok("stale gate + fresh wording -> verify_stale_framing",
  verifyClaims({ answer: "As of today, revenue is 1.2M [ev:1].", records, gate: { freshness: "stale" } })
    .warnings.some((w) => w.code === "verify_stale_framing"));
ok("fresh gate + fresh wording -> no stale warning",
  !verifyClaims({ answer: "As of today, revenue is 1.2M [ev:1].", records, gate: { freshness: "fresh" } })
    .warnings.some((w) => w.code === "verify_stale_framing"));
ok("stale gate + neutral wording -> no stale warning",
  !verifyClaims({ answer: "Revenue was 1.2M [ev:1].", records, gate: { freshness: "stale" } })
    .warnings.some((w) => w.code === "verify_stale_framing"));

// ── custom claim patterns replace the defaults ────────────────────────────────
{
  const r = verifyClaims({ answer: "Revenue grew strongly.", records,
    rules: { verification: { claimPatterns: ["\\bgrew\\b"] } } });
  ok("custom claimPatterns replace defaults", r.verdict === "no_citations" && r.stats.claims === 1);
}

// ── citationBlock overrides ───────────────────────────────────────────────────
ok("citationBlock header + line overrides",
  citationBlock([{ date: "2026-03-31", qualityScore: 92 }],
    { header: "HDR:", line: (r, marker) => `* ${marker} -> ${r.date}` }) === "HDR:\n* 1 -> 2026-03-31");
ok("citationBlock with no records -> header only",
  citationBlock([]) === "EVIDENCE (cite with its marker after every factual statement):");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
