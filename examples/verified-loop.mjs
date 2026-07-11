// Evidence Gate — the full proof loop: gate → cite → generate → verify.
//
//   retrieve ──► evidenceGate ──► prompt (+ citation block) ──► LLM ──► verifyClaims
//                    │ decision record                                     │ verification record
//                    └────────────── same evidence digest links both ──────┘
//
// The gate decides WHETHER the model may speak; verifyClaims checks whether
// what it said stands on the evidence it was given: every citation must
// resolve to a real record (no phantom evidence), every claim-looking
// sentence must carry a citation (no naked claims), the framing must match
// the gate's verdict (no "as of today" over stale data), and — because the
// records below carry `facts` — every cited number must match them exactly
// (no misquoted values).
//
// Run it:  node examples/verified-loop.mjs

import { appendFileSync, readFileSync } from "node:fs";
import { evidenceGate, verifyClaims, citationBlock, presets } from "../src/index.js";

const LOG = new URL("./proof-loop.jsonl", import.meta.url);

const records = [
  { date: "2026-03-31", qualityScore: 92, id: "q1-2026", facts: { revenue: 1234500, growth: 8 } },
  { date: "2025-12-31", qualityScore: 90 },
  { date: "2025-09-30", qualityScore: 91, flags: ["RESTATED"] },
  { date: "2025-06-30", qualityScore: 88 },
];

// ── 1. Gate: may the model speak at all? ──────────────────────────────────────
const gate = evidenceGate({ records, rules: presets.FINANCE, decision: { id: "req-9" } });
appendFileSync(LOG, JSON.stringify(gate.decision) + "\n");
console.log(`gate: status=${gate.status} summarize=${gate.allowedActions.summarize}`);

// ── 2. Prompt: caveats + the citation block the model must cite from ──────────
const prompt = [
  "Answer ONLY from the evidence below.",
  ...gate.caveats.map((c) => "- " + c),
  citationBlock(records),
  "Q: How did revenue develop?",
].join("\n");
console.log("\n--- prompt ---\n" + prompt + "\n--------------\n");

// ── 3. "LLM" answers (simulated: correct citation, misquoted number) ──────────
// The citation resolves fine — but the record says revenue was 1,234,500,
// not 1.5M. Before §8 this passed as `supported`; now the facts catch it.
const answer = "Revenue was 1.5M [ev:q1-2026]. Growth versus Q4 was 8% [ev:9].";

// ── 4. Verify: does the answer stand on the evidence? ─────────────────────────
const v = verifyClaims({ answer, records, gate, decision: { id: "req-9" } });
appendFileSync(LOG, JSON.stringify(v.decision) + "\n");
console.log(`verify: verdict=${v.verdict} pass=${v.pass} misquoted=${v.stats.misquoted}`);
for (const w of v.warnings) console.log(`  [${w.level}] ${w.message}`);
// → phantom_citations ([ev:9] resolves to nothing) AND verify_misquoted_value
//   (1.5M is not the record's 1234500) — retry with v.caveats appended.

// ── 4b. Retry with the caveats: exact number, real citation ───────────────────
// Matching is strict: EVERY number in a cited sentence must be in the facts,
// so the retry keeps ordinals like "Q1"/"Q4" out of cited sentences (or the
// app adds them to facts). That discipline is the feature, not a bug.
const retry = "Revenue was 1,234,500 [ev:q1-2026]. Quarterly growth was 8% [ev:q1-2026].";
const v2 = verifyClaims({ answer: retry, records, gate, decision: { id: "req-9" } });
appendFileSync(LOG, JSON.stringify(v2.decision) + "\n");
console.log(`retry:  verdict=${v2.verdict} pass=${v2.pass}`);

// ── 5. The audit trail: one request id, two joined records ────────────────────
// The gate decision says what evidence and rules were in play; the
// verification record says what the model did with it. They join on the id
// AND on an identical evidence digest — with neither the evidence nor the
// answer text stored.
const entries = readFileSync(LOG, "utf8").trim().split("\n").map(JSON.parse).slice(-3);
const [gd, , vd] = entries;
console.log(`\naudit join for req-9:`);
console.log(`  ${gd.schema}  evidence=${gd.digests.evidence}`);
console.log(`  ${vd.schema}  evidence=${vd.digests.evidence}  answer=${vd.digests.answer}`);
console.log(`  digests match: ${gd.digests.evidence === vd.digests.evidence}`);
