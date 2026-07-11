// Evidence Gate — shared cross-port vectors: node test/vectors.test.mjs
//
// Runs every case in test/vectors.json against the JS port. The Python suite
// (python/tests/test_core.py) runs the SAME file, so any divergence between
// the two ports shows up as a failure on one side. Never edit an expected
// value to make a single port pass.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { evidenceGate, canonicalJson, fnv1a64, evidenceDigest } from "../src/core.js";
import { verifyClaims, citationBlock } from "../src/verify.js";

const vectors = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "vectors.json"), "utf8"));

let pass = 0, fail = 0;
function ok(name, cond, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + detail}`);
  cond ? pass++ : fail++;
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── fnv1a64 string vectors ────────────────────────────────────────────────────
for (const v of vectors.fnv1a64) {
  ok(`fnv1a64(${JSON.stringify(v.input)})`, fnv1a64(v.input) === v.expected, fnv1a64(v.input));
}

// ── canonical JSON: byte-identical across ports ───────────────────────────────
for (const v of vectors.canonicalJson) {
  ok(`canonicalJson: ${v.name}`, canonicalJson(v.value) === v.expected, canonicalJson(v.value));
}

// ── digests over arbitrary values ─────────────────────────────────────────────
for (const v of vectors.digest) {
  ok(`digest: ${v.name}`, evidenceDigest(v.value) === v.expected, evidenceDigest(v.value));
}

// ── full gate behavior ────────────────────────────────────────────────────────
for (const c of vectors.gate) {
  const g = evidenceGate({ records: c.records, supporting: c.supporting, rules: c.rules, decision: true });
  const e = c.expected;
  ok(`gate ${c.name}: status`, g.status === e.status, g.status);
  ok(`gate ${c.name}: freshness`, g.freshness === e.freshness, g.freshness);
  ok(`gate ${c.name}: allowedActions`, eq(g.allowedActions, e.allowedActions), JSON.stringify(g.allowedActions));
  ok(`gate ${c.name}: warnings (level+code, in order)`,
    eq(g.warnings.map(({ level, code }) => ({ level, code })), e.warnings),
    JSON.stringify(g.warnings));
  if (e.caveats) ok(`gate ${c.name}: caveats`, eq(g.caveats, e.caveats), JSON.stringify(g.caveats));
  if (e.evidenceDigest)
    ok(`gate ${c.name}: evidence digest (cross-port)`,
      g.decision.digests.evidence === e.evidenceDigest, g.decision.digests.evidence);
}

// ── citationBlock: exact prompt-block strings ─────────────────────────────────
for (const c of vectors.citationBlock) {
  const got = citationBlock(c.records, { supporting: c.supporting });
  ok(`citationBlock ${c.name}`, got === c.expected, JSON.stringify(got));
}

// ── verifyClaims: full verification behavior ──────────────────────────────────
for (const c of vectors.verify) {
  const v = verifyClaims({
    answer: c.answer, records: c.records, supporting: c.supporting,
    gate: c.gate, rules: c.rules, decision: true,
  });
  const e = c.expected;
  ok(`verify ${c.name}: pass`, v.pass === e.pass, String(v.pass));
  ok(`verify ${c.name}: verdict`, v.verdict === e.verdict, v.verdict);
  ok(`verify ${c.name}: stats`, eq(v.stats, e.stats), JSON.stringify(v.stats));
  ok(`verify ${c.name}: warnings (level+code, in order)`,
    eq(v.warnings.map(({ level, code }) => ({ level, code })), e.warnings),
    JSON.stringify(v.warnings));
  if (e.citations) ok(`verify ${c.name}: citations`, eq(v.citations, e.citations), JSON.stringify(v.citations));
  if (e.claims) ok(`verify ${c.name}: claims`, eq(v.claims, e.claims), JSON.stringify(v.claims));
  if (e.caveats) ok(`verify ${c.name}: caveats`, eq(v.caveats, e.caveats), JSON.stringify(v.caveats));
  if (e.evidenceDigest)
    ok(`verify ${c.name}: evidence digest (cross-port)`,
      v.decision.digests.evidence === e.evidenceDigest, v.decision.digests.evidence);
  if (e.answerDigest)
    ok(`verify ${c.name}: answer digest (cross-port)`,
      v.decision.digests.answer === e.answerDigest, v.decision.digests.answer);
}

// ── invalid rules must throw, naming the offending field ──────────────────────
for (const c of vectors.invalidRules) {
  let msg = null;
  try { evidenceGate({ records: [], rules: c.rules }); } catch (err) { msg = err.message; }
  if (c.errorField === null) {
    ok(`invalid rules ${c.name}: throws`, msg !== null);
  } else {
    ok(`invalid rules ${c.name}: throws naming rules.${c.errorField}`,
      msg !== null && msg.includes(`rules.${c.errorField}`), String(msg));
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
