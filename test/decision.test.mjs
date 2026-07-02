// Evidence Gate — decision log tests (no deps): node test/decision.test.mjs
import { evidenceGate, canonicalJson, fnv1a64, evidenceDigest, DECISION_SCHEMA } from "../src/core.js";
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
