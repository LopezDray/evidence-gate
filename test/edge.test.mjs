// Evidence Gate — edge-case hardening: node test/edge.test.mjs
import { evidenceGate, classifyStatus, deriveAllowedActions, parseDate } from "../src/core.js";
import { FINANCE } from "../src/presets.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log(`PASS  ${name}`); pass++; }
  catch (e) { console.log(`FAIL  ${name}\n   ${e.message}`); fail++; }
}
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || ""} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); }

const R = { staleDays: 100, minRecords: 4, qualityThreshold: 70 };

// ── parseDate robustness ──────────────────────────────────────────────────────
t("parseDate: null/empty/garbage -> null", () => {
  eq(parseDate(null), null); eq(parseDate(""), null); eq(parseDate("not-a-date"), null);
  eq(parseDate(undefined), null); eq(parseDate("2026/01/01"), null);
});
t("parseDate: impossible month/day -> null (no silent overflow)", () => {
  eq(parseDate("2026-13-01"), null, "month 13");
  eq(parseDate("2026-02-31"), null, "Feb 31");
  eq(parseDate("2026-00-10"), null, "month 0");
});
t("parseDate: valid leap day ok", () => {
  if (parseDate("2024-02-29") === null) throw new Error("2024-02-29 should be valid");
});

// ── qualityScore edge values ──────────────────────────────────────────────────
t("qualityScore=0 counts (not treated as missing) -> quality_warning", () => {
  const r = classifyStatus([{ date: "2026-06-01", qualityScore: 0 }, { date: "2026-05-01", qualityScore: 90 },
    { date: "2026-04-01", qualityScore: 90 }, { date: "2026-03-01", qualityScore: 90 }], R);
  eq(r.qualityMin, 0); eq(r.status, "quality_warning");
});
t("no qualityScore at all -> qualityMin null, still available if enough records", () => {
  const recent = (n) => Array.from({length:n}, (_,i)=>({ date: `2026-0${(i%6)+1}-01` }));
  const r = classifyStatus(recent(4), { staleDays: 100000, minRecords: 4, qualityThreshold: 70 });
  eq(r.qualityMin, null); eq(r.status, "available");
});

// ── tier behavior ─────────────────────────────────────────────────────────────
t("mixed tier (not all fallback) -> NOT fallback status", () => {
  const r = classifyStatus([{ date: "2026-06-01", qualityScore: 90, tier: "fallback" },
    { date: "2026-05-01", qualityScore: 90 }, { date: "2026-04-01", qualityScore: 90 },
    { date: "2026-03-01", qualityScore: 90 }], { staleDays: 100000, minRecords: 4, qualityThreshold: 70 });
  if (r.status === "fallback") throw new Error("mixed tier must not be fallback");
});

// ── flags: string vs array ────────────────────────────────────────────────────
t("flags as string is handled", () => {
  const r = classifyStatus([{ date: "2026-06-01", qualityScore: 90, flags: "RESTATED" },
    { date: "2026-05-01", qualityScore: 90 }, { date: "2026-04-01", qualityScore: 90 },
    { date: "2026-03-01", qualityScore: 90 }], { staleDays: 100000, minRecords: 4, qualityThreshold: 70 });
  eq(r.flags, ["RESTATED"]); eq(r.status, "quality_warning");
});

// ── freshness boundary ────────────────────────────────────────────────────────
t("freshness boundary: exactly threshold = fresh, +1 = stale", () => {
  const iso = (d) => { const x = new Date(); x.setUTCDate(x.getUTCDate() - d); return x.toISOString().slice(0,10); };
  const mk = (days) => classifyStatus([{date:iso(days),qualityScore:90},{date:iso(days),qualityScore:90},
    {date:iso(days),qualityScore:90},{date:iso(days),qualityScore:90}], { staleDays: 100, minRecords: 4, qualityThreshold: 70 });
  eq(mk(100).freshness, "fresh", "exactly 100 days");
  eq(mk(101).freshness, "stale", "101 days");
});

// ── guards ────────────────────────────────────────────────────────────────────
t("evidenceGate without rules throws", () => {
  let threw = false; try { evidenceGate({ records: [] }); } catch { threw = true; }
  if (!threw) throw new Error("should throw without rules");
});
t("classifyStatus without rules throws clearly (not undefined-crash)", () => {
  let threw = false; try { classifyStatus([{date:"2026-01-01"}]); } catch { threw = true; }
  if (!threw) throw new Error("should throw without rules");
});
t("incomplete rules throw naming the missing field (no silent-fresh)", () => {
  let msg = "";
  try { classifyStatus([{ date: "2026-01-01" }], { staleDays: 30 }); } catch (e) { msg = e.message; }
  if (!msg.includes("rules.minRecords")) throw new Error(`expected rules.minRecords in error, got: ${msg}`);
  msg = "";
  try { evidenceGate({ records: [], rules: { staleDays: 30 } }); } catch (e) { msg = e.message; }
  if (!msg.includes("rules.minRecords")) throw new Error(`validation must fire even with empty records, got: ${msg}`);
});
t("explicit null optional rule fields behave like absent", () => {
  const r = evidenceGate({ records: [{ date: "2026-01-01" }],
    rules: { staleDays: 30, minRecords: 1, qualityThreshold: 50, forbiddenActions: null, messages: null, primaryLabel: null } });
  eq(r.status, "available");
});
t("null records / undefined args safe", () => {
  eq(classifyStatus(null, R).status, "missing");
  eq(evidenceGate({ rules: FINANCE }).status, "missing");
});

// ── scale ─────────────────────────────────────────────────────────────────────
t("large input (5000 records) works", () => {
  const big = Array.from({ length: 5000 }, (_, i) => ({ date: "2026-06-01", qualityScore: 80 + (i % 20) }));
  const r = classifyStatus(big, R); eq(r.count, 5000); eq(r.status, "available");
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
