// Evidence Gate — provenance: prove where the evidence came from.
//
// The core never computes hashes (zero-dependency, stays pure) — it treats
// them as opaque "<alg>:<hex>" strings. The APP hashes its artifacts, here
// with node:crypto (Python apps: hashlib — same idea, same strings).
//
// What this buys you:
//   1. Where did this observation come from?  source + authority
//   2. What happened to it on the way here?   transform chain, hash-linked
//   3. Is it the same bytes it claims to be?  content hash, replay-verifiable
//
// Run it:  node examples/provenance.mjs

import { createHash } from "node:crypto";
import { evidenceGate, validateProvenance, evidenceDigest, presets } from "../src/index.js";

const sha256 = (data) => "sha256:" + createHash("sha256").update(data).digest("hex");

// ── The app's pipeline: raw filing → parse → normalize (each step hashed) ─────
const rawFiling = "<xbrl>…raw quarterly filing bytes…</xbrl>";
const parsed = JSON.stringify({ revenue: 1234500, eps: 0.42 });
const normalized = JSON.stringify({ revenue_thb: 1234500, eps: 0.42 });

const record = {
  date: "2026-03-31",
  qualityScore: 92,
  provenance: {
    source: { id: "sec-edgar", type: "filing", authority: "official" },
    retrievedAt: "2026-06-30T08:12:00Z",
    contentHash: sha256(rawFiling),
    chain: [
      { step: "parse-xbrl", tool: "edgar-parser@2.1", inputHash: sha256(rawFiling), outputHash: sha256(parsed) },
      { step: "normalize", tool: "fin-etl@0.9", inputHash: sha256(parsed), outputHash: sha256(normalized) },
    ],
  },
};

// a crawled doc from a weaker source, no chain
const kbRecord = {
  date: "2026-05-10",
  qualityScore: 80,
  provenance: {
    source: { id: "help-center", type: "document", authority: "secondary" },
    retrievedAt: "2026-07-01T02:00:00Z",
  },
};

// ── 1. The chain is verifiable by construction ────────────────────────────────
console.log("filing chain:", JSON.stringify(validateProvenance(record)));
const tampered = structuredClone(record);
tampered.provenance.chain[1].inputHash = "sha256:not-what-parse-produced";
console.log("tampered chain:", JSON.stringify(validateProvenance(tampered)));

// ── 2. The gate uses provenance (opt-in via rules.provenance) ─────────────────
const rules = { ...presets.FINANCE, minRecords: 2, provenance: { require: true, minAuthority: "official" } };
const gate = evidenceGate({ records: [record, kbRecord], rules, decision: { id: "req-7" } });
console.log("\ncaveats:");
for (const c of gate.caveats) console.log("  -", c);
// → help-center is below "official" → provenance_untrusted caveat;
//   attribution names both sources. Status/allowedActions are UNCHANGED —
//   provenance warnings only add caveats in v1.

// ── 3. The decision record captures the provenance picture ───────────────────
const dp = gate.decision.provenance;
console.log("\ndecision.provenance:", JSON.stringify(dp, null, 2));

// replay: recompute over the claimed provenance set → must match the log
const replayed = evidenceDigest([record.provenance, kbRecord.provenance]);
console.log("\nprovenance digest match on replay:", replayed === dp.digest);
