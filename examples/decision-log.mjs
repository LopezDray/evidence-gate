// Evidence Gate — decision log example: an audit trail for every gate call.
//
// The core stays pure: it RETURNS a decision record, it never writes anywhere.
// Persisting is your job — here we append JSONL to a file, but a DB insert or
// a log shipper works the same way.
//
// Why you want this: when an auditor (or your future self) asks "why did the
// AI answer / refuse here?", the log has the ruleset, the evidence digest, and
// the outcome — WITHOUT storing the evidence itself (records may be sensitive;
// only a digest of them is kept).
//
// Run it:  node examples/decision-log.mjs

import { appendFileSync, readFileSync } from "node:fs";
import { evidenceGate, evidenceDigest, presets } from "../src/index.js";

const LOG = new URL("./decisions.jsonl", import.meta.url);

function gateAndLog({ requestId, records, supporting = [], rules }) {
  const gate = evidenceGate({
    records,
    supporting,
    rules,
    decision: { id: requestId, at: new Date().toISOString() },
  });
  appendFileSync(LOG, JSON.stringify(gate.decision) + "\n");
  return gate;
}

// ── Two calls: one grounded, one that must refuse ─────────────────────────────
const ACME = [
  { date: "2026-03-31", qualityScore: 92 },
  { date: "2025-12-31", qualityScore: 90 },
  { date: "2025-09-30", qualityScore: 91 },
  { date: "2025-06-30", qualityScore: 88 },
];

gateAndLog({ requestId: "req-001", records: ACME, rules: presets.FINANCE });
gateAndLog({ requestId: "req-002", records: [], rules: presets.FINANCE }); // nothing on NEWCO

// ── Reading the trail back ────────────────────────────────────────────────────
const entries = readFileSync(LOG, "utf8").trim().split("\n").map(JSON.parse);
for (const e of entries.slice(-2)) {
  console.log(`${e.id}  status=${e.outcome.status}  summarize=${e.outcome.allowedActions.summarize}  evidence=${e.digests.evidence}`);
}

// ── Verifying a decision later ────────────────────────────────────────────────
// Re-compute the digest from the evidence you claim was used; if it matches the
// logged digest, the decision really was made over that evidence set.
const last = entries[entries.length - 2];
const replayed = evidenceDigest({ records: ACME, supporting: [] });
console.log(`\nreq-001 digest match on replay: ${replayed === last.digests.evidence}`);
