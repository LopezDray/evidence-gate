// Evidence Gate — core tests (no deps): node test/core.test.mjs
import { evidenceGate, classifyStatus, deriveAllowedActions } from "../src/core.js";
import { FINANCE, HEALTH } from "../src/presets.js";

const iso = (daysAgo) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};
const rec = (qualityScore, daysAgo, extra = {}) => ({ date: iso(daysAgo), qualityScore, ...extra });

let pass = 0, fail = 0;
function check(name, got, exp) {
  const ok = Object.entries(exp).every(([k, v]) => JSON.stringify(got[k]) === JSON.stringify(v));
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) { console.log("   exp:", JSON.stringify(exp)); console.log("   got:", JSON.stringify(got)); fail++; } else pass++;
}

// classifyStatus
check("4 clean recent -> available", classifyStatus([rec(95, 5), rec(95, 5), rec(95, 5), rec(95, 5)], FINANCE), { status: "available", freshness: "fresh", count: 4 });
check("2 records (<4) -> quality_warning", classifyStatus([rec(95, 5), rec(95, 5)], FINANCE), { status: "quality_warning", count: 2 });
check("low quality -> quality_warning", classifyStatus([rec(95, 5), rec(95, 5), rec(95, 5), rec(40, 5)], FINANCE), { status: "quality_warning", qualityMin: 40 });
check("flag present -> quality_warning", classifyStatus([rec(95, 5), rec(95, 5), rec(95, 5), rec(95, 5, { flags: ["RESTATED"] })], FINANCE), { status: "quality_warning", flags: ["RESTATED"] });
check("no records -> missing", classifyStatus([], FINANCE), { status: "missing", count: 0 });
check("all fallback -> fallback", classifyStatus([rec(95, 5, { tier: "fallback" }), rec(95, 5, { tier: "fallback" })], FINANCE), { status: "fallback" });
check("clean but old -> available + stale", classifyStatus([rec(95, 200), rec(95, 200), rec(95, 200), rec(95, 200)], FINANCE), { status: "available", freshness: "stale" });

// deriveAllowedActions
check("available -> summarize+compare", deriveAllowedActions({ primaryStatus: "available", forbiddenActions: ["personalized_advice", "claim_realtime"] }), { summarize: true, compare: true, personalized_advice: false, claim_realtime: false });
check("missing, no supporting -> no summarize", deriveAllowedActions({ primaryStatus: "missing" }), { summarize: false, compare: false });
check("missing + supporting -> summarize", deriveAllowedActions({ primaryStatus: "missing", supportingPresent: true }), { summarize: true, compare: false });
check("fallback -> summarize, no compare", deriveAllowedActions({ primaryStatus: "fallback" }), { summarize: true, compare: false });

// evidenceGate end-to-end + domain swap
check("finance missing -> block + no summarize", evidenceGate({ records: [], rules: FINANCE }), { status: "missing" });
{
  const r = evidenceGate({ records: [], rules: FINANCE });
  const ok = r.allowedActions.summarize === false && r.warnings.some((w) => w.code === "primary_missing" && w.level === "block");
  console.log(`${ok ? "PASS" : "FAIL"}  finance missing -> summarize=false + block warning`);
  ok ? pass++ : fail++;
}
check("health available (different domain, same core)", evidenceGate({ records: [rec(95, 5), rec(95, 5)], rules: HEALTH }), { status: "available" });
{
  const r = evidenceGate({ records: [rec(95, 5), rec(95, 5)], rules: HEALTH });
  const ok = r.allowedActions.diagnose === false && r.allowedActions.prescribe === false;
  console.log(`${ok ? "PASS" : "FAIL"}  health forbids diagnose/prescribe`);
  ok ? pass++ : fail++;
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
