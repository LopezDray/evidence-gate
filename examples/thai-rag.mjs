// Evidence Gate — Thai-language financial RAG, end to end, with the two gotchas
// that bite every Thai deployment. Companion to rag-pipeline.mjs (gate only);
// this one runs the FULL loop over Thai text: gate → cite → generate → verify.
//
//   retrieve ─► evidenceGate ─► prompt (+ citation block) ─► LLM ─► verifyClaims
//
// The payoff is what verifyClaims catches AFTER a correct citation, on Thai
// input: a hallucinated number written in Thai numerals (๙๐๐๐๐๐), and a
// stale-data answer framed as "ปัจจุบัน". Getting there needs two things right:
//
//   GOTCHA 1 — units. verifyClaims reads "ล้าน"/"พันล้าน" as magnitude suffixes
//   (×10^6, ×10^9). So store `facts` in WHOLE baht and let the model speak in
//   "ล้านบาท"; the parser reconciles them. Store 850000 and let the model say
//   "850000 ล้านบาท" and it will mismatch (850000 vs 850000×10^6).
//
//   GOTCHA 2 — freshness patterns are English-only by default
//   (today|latest|currently|real-time). Thai "ปัจจุบัน/ล่าสุด/ตอนนี้" slips
//   through unless you localize rules.verification.freshnessPatterns.
//
// Data below is SYNTHETIC (fabricated numbers) — it demonstrates the mechanism,
// it is not real financial data. Run it:  node examples/thai-rag.mjs

import { evidenceGate, verifyClaims, citationBlock, presets } from "../src/index.js";

// FINANCE preset + localized freshness words (GOTCHA 2). Keep the English
// defaults and add Thai — a bilingual app sees both.
const FINANCE_TH = {
  ...presets.FINANCE,
  verification: {
    freshnessPatterns: [
      "today", "latest", "currently", "real[- ]?time",
      "ปัจจุบัน|ล่าสุด|ตอนนี้|วันนี้|ณ ขณะนี้|เรียลไทม์|เรียล[- ]?ไทม์",
    ],
  },
};

// Your vector store / DB stand-in. facts are in WHOLE baht (GOTCHA 1):
// 850,000 ล้านบาท = 850000e6 baht.
const STORE = {
  // Full 4 quarters, good quality, fresh → gate lets the model speak.
  PTT: [
    { date: "2026-03-31", id: "ptt-q1-2026", qualityScore: 93, facts: { revenue: 850000e6, netProfit: 32000e6 } },
    { date: "2025-12-31", id: "ptt-q4-2025", qualityScore: 91, facts: { revenue: 812000e6, netProfit: 29500e6 } },
    { date: "2025-09-30", id: "ptt-q3-2025", qualityScore: 90, facts: { revenue: 798000e6, netProfit: 28100e6 } },
    { date: "2025-06-30", id: "ptt-q2-2025", qualityScore: 89, facts: { revenue: 776000e6, netProfit: 26700e6 } },
  ],
  // Latest filing older than staleDays (135) → gate speaks but flags freshness.
  SCB: [
    { date: "2025-09-30", id: "scb-q3-2025", qualityScore: 88, facts: { revenue: 145000e6, netProfit: 12000e6 } },
    { date: "2025-06-30", id: "scb-q2-2025", qualityScore: 87, facts: { revenue: 141000e6, netProfit: 11500e6 } },
    { date: "2025-03-31", id: "scb-q1-2025", qualityScore: 86, facts: { revenue: 138000e6, netProfit: 11200e6 } },
    { date: "2024-12-31", id: "scb-q4-2024", qualityScore: 85, facts: { revenue: 136000e6, netProfit: 10900e6 } },
  ],
  // A just-IPO'd name we have nothing on yet — where models invent a quarter.
  NEWIPO: [],
};

// Stand-in for your LLM call. Answers are scripted so the example is
// deterministic; swap for Claude/OpenAI and the flow is identical.
async function callLLM(_prompt, scriptedAnswer) {
  return scriptedAnswer;
}

async function answer(ticker, question, scriptedAnswer) {
  console.log(`\n${"=".repeat(70)}\nQ (${ticker}): ${question}`);
  const records = STORE[ticker] || [];

  // 1. GATE — decide before generating.
  const gate = evidenceGate({ records, rules: FINANCE_TH, decision: { id: `req-${ticker}` } });
  console.log(`gate: status=${gate.status} freshness=${gate.freshness} summarize=${gate.allowedActions.summarize}`);

  // 2a. Not enough evidence → refuse WITHOUT calling the LLM (it can't invent).
  if (!gate.allowedActions.summarize) {
    console.log(`REFUSED (no LLM call): ${gate.caveats[0]}`);
    return;
  }

  // 2b. Enough → inject caveats + the citation block, then generate.
  const prompt = [
    "ตอบจากหลักฐานด้านล่างเท่านั้น อ้างอิง [ev:...] ทุกประโยคที่มีตัวเลข",
    ...gate.caveats.map((c) => "- " + c),
    citationBlock(records),
    `คำถาม: ${question}`,
  ].join("\n");
  const out = await callLLM(prompt, scriptedAnswer);
  console.log(`answer: ${out}`);

  // 3. VERIFY — does the answer stand on the evidence it was given?
  //    Pass the SAME records + rules (freshnessPatterns live here).
  const v = verifyClaims({ answer: out, records, gate, rules: FINANCE_TH, decision: { id: `req-${ticker}` } });
  console.log(`verify: verdict=${v.verdict} pass=${v.pass} (phantom=${v.stats.phantom} misquoted=${v.stats.misquoted} uncited=${v.stats.uncited})`);
  for (const w of v.warnings) console.log(`   [${w.level}] ${w.message}`);

  // The gate decision and the verification record join on one evidence digest —
  // neither stores the evidence or the answer text.
  console.log(`audit: evidence digest matches = ${gate.decision.digests.evidence === v.decision.digests.evidence}`);
}

// A: correct number, correct citation → supported.
await answer("PTT", "รายได้ไตรมาสล่าสุดเท่าไร",
  "รายได้ไตรมาสล่าสุดอยู่ที่ 850000 ล้านบาท [ev:ptt-q1-2026].");

// B: hallucinated number in THAI numerals (๙๐๐๐๐๐), citation still valid
//    → misquoted_values (block). Fact cross-checking catches it regardless.
await answer("PTT", "รายได้ไตรมาสล่าสุดเท่าไร",
  "รายได้พุ่งแตะ ๙๐๐๐๐๐ ล้านบาท [ev:ptt-q1-2026].");

// C: number is right, but the filing is stale and the answer says "ปัจจุบัน"
//    → localized freshness pattern raises a review-level stale-framing warning.
await answer("SCB", "ตอนนี้กำไรสุทธิเท่าไร",
  "กำไรสุทธิปัจจุบันอยู่ที่ 12000 ล้านบาท [ev:scb-q3-2025].");

// D: no evidence at all → gate refuses BEFORE the model is called.
await answer("NEWIPO", "สรุปผลประกอบการไตรมาสล่าสุดของ NEWIPO", "(model is never called)");

console.log(`\n${"=".repeat(70)}`);
console.log("Takeaway: D never reaches the model, so it can't invent a quarter.");
console.log("B and C are caught AFTER a valid citation — the number or the time");
console.log("framing did not match the evidence. Store facts in whole baht and");
console.log("localize freshnessPatterns, or both checks silently miss on Thai.");
