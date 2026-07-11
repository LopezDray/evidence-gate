// Evidence Gate — decision log tests (no deps): node test/decision.test.mjs
import { evidenceGate, canonicalJson, fnv1a64, evidenceDigest, DECISION_SCHEMA, validateProvenance } from "../src/core.js";
import { FINANCE } from "../src/presets.js";

const iso = (daysAgo) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};
const rec = (qualityScore, daysAgo, extra = {}) => ({ date: iso(daysAgo), qualityScore, ...extra });

let pass = 0, fail = 0;
function ok(name, cond, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + detail}`);
  cond ? pass++ : fail++;
}

// ── fnv1a64: published FNV-1a 64-bit reference vectors ────────────────────────
ok("fnv1a64('')", fnv1a64("") === "cbf29ce484222325", fnv1a64(""));
ok("fnv1a64('a')", fnv1a64("a") === "af63dc4c8601ec8c", fnv1a64("a"));
ok("fnv1a64('foobar')", fnv1a64("foobar") === "85944171f73967e8", fnv1a64("foobar"));

// ── canonicalJson: key order, undefined handling, nesting ─────────────────────
ok("canonicalJson sorts keys recursively",
  canonicalJson({ b: 2, a: [1, "é", true], z: null }) === '{"a":[1,"é",true],"b":2,"z":null}',
  canonicalJson({ b: 2, a: [1, "é", true], z: null }));
ok("canonicalJson drops undefined object values",
  canonicalJson({ a: 1, b: undefined }) === '{"a":1}');
ok("canonicalJson is insertion-order independent",
  canonicalJson({ x: 1, y: 2 }) === canonicalJson({ y: 2, x: 1 }));

// ── cross-language vector: MUST equal the Python port's output for same input ─
ok("digest matches Python port for shared vector",
  evidenceDigest({ b: 2, a: [1, "é", true], z: null }) === "fnv1a64:2a4b821432ab8bcc",
  evidenceDigest({ b: 2, a: [1, "é", true], z: null }));

// ── decision record: opt-in, shape, privacy ───────────────────────────────────
const records = [rec(95, 5), rec(95, 5), rec(95, 5), rec(95, 5)];

const noDecision = evidenceGate({ records, rules: FINANCE });
ok("no decision record unless requested", noDecision.decision === undefined);

const g = evidenceGate({ records, rules: FINANCE, decision: { id: "req-42", at: "2026-07-02T10:00:00Z" } });
const d = g.decision;
ok("decision schema", d.schema === DECISION_SCHEMA);
ok("decision carries caller id + timestamp", d.id === "req-42" && d.at === "2026-07-02T10:00:00Z");
ok("decision counts", d.counts.records === 4 && d.counts.supporting === 0);
ok("decision outcome mirrors gate result",
  d.outcome.status === g.status && d.outcome.freshness === g.freshness &&
  JSON.stringify(d.outcome.caveats) === JSON.stringify(g.caveats));
ok("decision rules snapshot", d.rules.staleDays === FINANCE.staleDays && d.rules.minRecords === FINANCE.minRecords);
ok("decision warnings keep code+level only",
  d.outcome.warnings.every((w) => w.code && w.level && !("message" in w)));
ok("decision is JSONL-serializable (single line)", !JSON.stringify(d).includes("\n"));

// privacy: the record itself must not appear in the decision — only its digest
ok("decision does not embed evidence values", !JSON.stringify(d).includes(records[0].date));

// determinism + sensitivity of the evidence digest
const g2 = evidenceGate({ records, rules: FINANCE, decision: true });
ok("same evidence -> same digest", g2.decision.digests.evidence === d.digests.evidence);
const g3 = evidenceGate({ records: records.slice(0, 3), rules: FINANCE, decision: true });
ok("different evidence -> different digest", g3.decision.digests.evidence !== d.digests.evidence);
ok("rules digest is stable", g2.decision.digests.rules === d.digests.rules);

// decision: true generates a timestamp
ok("decision:true fills at + null id", typeof g2.decision.at === "string" && g2.decision.id === null);

// null records must behave like [] — no crash, and digest identical to the
// Python port's for the same (empty) evidence set
const gNull = evidenceGate({ records: null, rules: FINANCE, decision: true });
ok("records:null + decision does not throw", gNull.decision !== undefined);
ok("records:null digests as empty set (cross-port constant)",
  gNull.decision.digests.evidence === "fnv1a64:b154377d61167670",
  gNull.decision.digests.evidence);
ok("records:null counts as zero", gNull.decision.counts.records === 0);

// ── decision.provenance: additive block + replay ──────────────────────────────
const provRecords = [
  rec(95, 5, { provenance: { source: { id: "sec-edgar", type: "filing", authority: "official" } } }),
  rec(95, 5, { provenance: { source: { id: "sec-edgar", type: "filing", authority: "official" } } }),
  rec(95, 5), rec(95, 5),
];

ok("no provenance -> no decision.provenance block",
  evidenceGate({ records, rules: FINANCE, decision: true }).decision.provenance === undefined);

const gp = evidenceGate({ records: provRecords, rules: FINANCE, decision: true });
const dp = gp.decision.provenance;
ok("decision.provenance present without rules.provenance (block is not opt-in)", dp !== undefined);
ok("decision.provenance coverage", dp.covered === 2 && dp.total === 4 && dp.brokenChains === 0);
ok("decision.provenance groups sources",
  dp.sources.length === 1 && dp.sources[0].id === "sec-edgar" && dp.sources[0].records === 2);

// replay: recompute the digest over the claimed provenance set, in record
// order — exactly like the evidence digest
const replayed = evidenceDigest(provRecords.filter((r) => r.provenance).map((r) => r.provenance));
ok("provenance digest is replay-verifiable", replayed === dp.digest, dp.digest);

// schema stays /1 — the block is additive
ok("schema unchanged by provenance block", gp.decision.schema === DECISION_SCHEMA);

// warnings stay out unless rules.provenance opts in; status never changes
ok("no provenance warnings without rules.provenance",
  !gp.warnings.some((w) => w.code.startsWith("provenance_")));
{
  const strict = evidenceGate({
    records: provRecords,
    rules: { ...FINANCE, provenance: { require: true, minAuthority: "official" } },
  });
  ok("rules.provenance adds warnings but never changes status/actions",
    strict.warnings.some((w) => w.code === "provenance_missing") &&
    strict.status === gp.status &&
    JSON.stringify(strict.allowedActions) === JSON.stringify(gp.allowedActions));
}

// validateProvenance is exported and never throws on garbage
ok("validateProvenance(null record) is valid", validateProvenance(null).valid === true);
ok("validateProvenance(garbage) reports, not throws",
  validateProvenance({ provenance: 42 }).problems.includes("invalid_provenance"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
