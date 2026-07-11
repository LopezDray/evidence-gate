// Evidence Gate — tamper-evident decision log.
//
// A decision log answers "why did the AI answer / refuse here?". But a plain
// JSONL file can be edited after the fact. chainDecision() links each record to
// the one before it by digest, so editing ANY past line breaks every record
// after it — cheap, zero-dependency tamper-evidence (not cryptographic; it
// detects after-the-fact edits, it doesn't stop a determined forger who rewrites
// the whole tail).
//
// Run it:  node examples/tamper-evident-log.mjs

import { appendFileSync, readFileSync, rmSync } from "node:fs";
import { evidenceGate, evidenceDigest, chainDecision, verifyDecisionChain, presets } from "../src/index.js";

const LOG = new URL("./audit-chain.jsonl", import.meta.url);
try { rmSync(LOG); } catch {}

// ── Append three gated decisions, each chained to the previous line ───────────
function gateAndAppend(requestId, records) {
  const gate = evidenceGate({ records, rules: presets.FINANCE, decision: { id: requestId, at: new Date().toISOString() } });
  // read the last line's digest (the chain head starts from null)
  let prev = null;
  try {
    const lines = readFileSync(LOG, "utf8").trim().split("\n").filter(Boolean);
    if (lines.length) prev = evidenceDigest(JSON.parse(lines[lines.length - 1]));
  } catch {}
  const record = chainDecision(gate.decision, prev);
  appendFileSync(LOG, JSON.stringify(record) + "\n");
}

gateAndAppend("req-001", [{ date: "2026-03-31", qualityScore: 92 }, { date: "2025-12-31", qualityScore: 90 }, { date: "2025-09-30", qualityScore: 91 }, { date: "2025-06-30", qualityScore: 88 }]);
gateAndAppend("req-002", []);                                   // refusal (no evidence)
gateAndAppend("req-003", [{ date: "2026-03-31", tier: "fallback" }]);

// ── Read the log back and verify the chain ────────────────────────────────────
const read = () => readFileSync(LOG, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);

const clean = read();
console.log("chain length:", clean.length);
console.log("verify (untouched):", JSON.stringify(verifyDecisionChain(clean)));
// → { valid: true, brokenAt: null }

// ── Now forge the first record — flip its outcome to look permissive ──────────
const forged = read();
forged[0].outcome.allowedActions.summarize = false; // "it refused req-001" — a lie
const check = verifyDecisionChain(forged);
console.log("verify (req-001 edited):", JSON.stringify(check));
// → { valid: false, brokenAt: 1 }  — record 0's digest changed, so record 1's
//   `prev` no longer matches: the tampering is caught at the very next link.
console.log(`\ntamper detected at record index ${check.brokenAt} (req-00${check.brokenAt + 1}) — every line after the edit is invalidated.`);

rmSync(LOG);
