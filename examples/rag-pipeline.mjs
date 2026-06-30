// Evidence Gate — end-to-end example: where the gate sits in a real LLM pipeline.
//
//   user question
//        │
//        ▼
//   1. retrieve the records YOU have      (your DB / vector store — you do this)
//        │
//        ▼
//   2. evidenceGate({ records, rules })   (this library — the new step)
//        │
//        ├─ summarize == false ──► refuse / return caveat   (NO LLM call, no made-up answer)
//        │
//        └─ summarize == true  ──► inject gate.caveats into the prompt ──► call the LLM
//
// Run it:  node examples/rag-pipeline.mjs

import { evidenceGate, presets } from "../src/index.js";

// ── A tiny stand-in for YOUR data source (DB rows / vector hits / API) ─────────
// In real life you'd query Postgres / a vector store here. Each record is one
// observation you actually have evidence for.
const DB = {
  ACME: [
    { date: "2026-03-31", qualityScore: 92 },
    { date: "2025-12-31", qualityScore: 90 },
    { date: "2025-09-30", qualityScore: 91 },
    { date: "2025-06-30", qualityScore: 88 },
  ],
  NEWCO: [], // we have NOTHING on NEWCO yet — this is where models usually hallucinate
};

// ── A stand-in for your LLM call (swap for Claude / OpenAI / etc.) ─────────────
async function callLLM(prompt) {
  // pretend the model answers; the point is WHAT we allow it to see/do, not the model
  return `…model answer generated under the rules above…`;
}

// ── The pipeline. The only new line vs. a normal RAG flow is step 2. ───────────
async function answerAbout(company, question) {
  console.log(`\n=== Q: "${question}" (${company}) ===`);

  // 1. retrieve what you have
  const records = DB[company] || [];

  // 2. THE GATE — decide before generating
  const gate = evidenceGate({ records, rules: presets.FINANCE });
  console.log(`   gate: status=${gate.status}  summarize=${gate.allowedActions.summarize}`);

  // 3a. not enough evidence → refuse instead of inventing
  if (!gate.allowedActions.summarize) {
    const reply = gate.caveats[0];
    console.log(`   ⛔ refused (no LLM call): ${reply}`);
    return reply;
  }

  // 3b. enough evidence → inject caveats so the model self-limits, then generate
  const prompt = [
    `You are a financial assistant. Answer ONLY from the provided data.`,
    `DATA RULES (must obey):`,
    ...gate.caveats.map((c) => `- ${c}`),
    ``,
    `Question: ${question}`,
  ].join("\n");

  console.log(`   ✅ generating with ${gate.caveats.length} caveat(s) injected. Prompt sent to model:`);
  console.log(prompt.split("\n").map((l) => "      | " + l).join("\n"));

  const answer = await callLLM(prompt);
  console.log(`   → ${answer}`);
  return answer;
}

// ── Two scenarios: data present vs. absent ────────────────────────────────────
await answerAbout("ACME", "How did revenue trend over the last year?");
await answerAbout("NEWCO", "Summarize NEWCO's latest quarter.");

console.log(`\nThe difference: for NEWCO the model is never called — so it can't invent a quarter.`);
