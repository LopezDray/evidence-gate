# Evidence Gate

**Stop your AI from making up facts about your own data.**

A tiny, zero-dependency gate you call **before** an LLM generates anything. It looks at the records you actually have and returns whether the model may summarize, whether the data is stale or low-quality, and the exact caveats to inject into your prompt.

It is the missing step between "retrieve" and "generate" in most RAG and agent pipelines: a check that the evidence is actually good enough to speak from.

```js
import { evidenceGate, presets } from "evidence-gate";

const gate = evidenceGate({ records: myRecords, rules: presets.FINANCE });

if (!gate.allowedActions.summarize) {
  return gate.caveats.join(" ");   // e.g. "No financial statements available — the AI must not invent numbers."
}

const prompt = `${systemPrompt}\n\nDATA RULES:\n- ${gate.caveats.join("\n- ")}\n\n${userPrompt}`;
```

---

## The problem

LLMs answer confidently even when the underlying data is missing, stale, or partial. Over your own database that means a chatbot inventing a quarter that doesn't exist, quoting a number from a cached/secondary source as if it were authoritative, or saying "as of today" about data that's months old.

Content-safety guardrails (toxicity, PII) don't catch this. This is a **grounding** problem, and it needs a grounding gate.

## What it does

Given a set of evidence `records` and a `rules` preset, Evidence Gate returns:

```js
{
  status: "available" | "quality_warning" | "fallback" | "missing",
  freshness: "fresh" | "stale" | "unknown",
  allowedActions: { summarize, compare, /* + your forbidden actions forced to false */ },
  warnings: [{ level, code, message }],
  caveats: ["...strings ready to inject into the prompt..."]
}
```

- **`status`** — is there enough authoritative evidence to speak from at all?
- **`allowedActions`** — gate generation on `summarize`; forbidden actions (e.g. `personalized_advice`, `diagnose`, `claim_realtime`) are always `false`.
- **`caveats`** — drop straight into your system prompt so the model self-limits.

It is fully **domain-agnostic**. The same engine works for finance, healthcare, support, legal — a domain is just a preset.

## Install

```bash
npm install evidence-gate
# or
pip install evidence-gate-py
```

> The PyPI package is **`evidence-gate-py`** (the plain `evidence-gate` name on
> PyPI belongs to an unrelated project). The import name is unchanged —
> `from evidence_gate import evidence_gate, presets`.

## Records

Each record is one observation/period you have evidence for:

```js
{
  date: "2026-03-31",   // ISO date of the observation
  qualityScore: 92,     // optional 0-100
  quality: "clean",     // optional "clean" | "review"
  flags: ["RESTATED"],  // optional data-quality flags
  tier: "primary"       // optional "primary" (default) | "fallback" (cached/secondary)
}
```

## Presets

A preset is a ruleset. Adding a vertical = copying a preset, never touching the core.

```js
export const FINANCE = {
  primaryLabel: "financial statements",
  staleDays: 135,
  minRecords: 4,
  qualityThreshold: 70,
  forbiddenActions: ["personalized_advice", "claim_realtime"],
};
```

Ships with `FINANCE`, `HEALTH`, and `SUPPORT` examples. Override any message via `rules.messages`.

## Decision log — an audit trail for every gate call

AI answers today come with references, but no **proof**: nothing shows the
evidence behind an answer was complete, fresh, and authoritative when the
model spoke. The gate is where that decision happens — so the gate can log it.

Opt in with `decision` and every call also returns a JSONL-serializable
decision record: which ruleset ran, a digest of the evidence it saw (the
evidence itself is **not** stored — it may be sensitive), and the outcome.

```js
const gate = evidenceGate({
  records,
  rules: presets.FINANCE,
  decision: { id: "req-001", at: new Date().toISOString() },
});
appendFileSync("decisions.jsonl", JSON.stringify(gate.decision) + "\n");
```

Later, prove a decision was made over a given evidence set by replaying its
digest: `evidenceDigest({ records, supporting }) === logged.digests.evidence`.
Digests are FNV-1a 64 over canonical JSON — deterministic and identical across
the JS and Python ports (not cryptographic; they detect drift, not adversaries).
See `examples/decision-log.mjs` for the full flow.

## Use it as an MCP server

Give an agent a fact-checker it calls before it speaks. The package ships an MCP server exposing a `check_evidence` tool, so any MCP-compatible agent (Claude, IDE assistants, etc.) can gate itself.

```bash
npm install evidence-gate @modelcontextprotocol/sdk   # the SDK is an optional peer
```

Register it with your client:

```json
{
  "mcpServers": {
    "evidence-gate": { "command": "npx", "args": ["evidence-gate-mcp"] }
  }
}
```

The tool accepts `{ records, supporting?, preset?, rules? }` and returns the gate result. Instruct your agent to call it first and refuse to answer when `allowedActions.summarize` is `false`.

## Why trust it

The engine is intentionally small and pure — no network, no dependencies, all logic unit-tested. It runs in production today inside [DaddyInvestor](https://daddyinvestor.net), a Thai-language financial-data application, gating an LLM over real, messy, sometimes-missing SEC filings.

## License

MIT
