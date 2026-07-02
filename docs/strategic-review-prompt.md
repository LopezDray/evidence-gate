# Strategic Review Prompt — Evidence Gate → "Palantir of Data Trust"

> ใช้ prompt นี้กับ LLM (Claude / GPT) โดยแนบ source ของ repo นี้ (หรือรัน `/review` ใน Claude Code)
> เพื่อรีวิวเชิงกลยุทธ์: หาเส้นทางจาก library เล็ก ๆ ไปสู่แพลตฟอร์มระดับ Palantir
> หรือหา "จุดเด่นเฉพาะตัว" ที่แก้ปัญหา data management ในยุค AI

---

## The Prompt

```
You are a principal product strategist + staff engineer doing a strategic review
of an open-source project called **Evidence Gate**.

## Context

Evidence Gate is a tiny, zero-dependency library (JS + Python, plus an MCP
server) that sits BETWEEN "retrieve" and "generate" in RAG/agent pipelines.
Given the evidence records an application actually has, it decides — before the
LLM generates anything — whether the model may summarize, whether the data is
stale/low-quality/non-authoritative, and returns caveat strings to inject into
the prompt. Domains are just presets (FINANCE, HEALTH, SUPPORT). It already
runs in production inside a financial-data application.

Key source files: src/core.js (pure decision engine: classifyStatus,
deriveAllowedActions, evidenceGate), src/presets.js, mcp/server.mjs
(check_evidence tool), python/ (identical port), examples/rag-pipeline.mjs.

Design constraints the maintainers will not break:
- Zero runtime dependencies in the core; core is pure logic (no I/O, no network).
- Verticals are presets; the core stays domain-agnostic.
- Every behavior change is test-backed, in both the JS and Python ports.

## Your task

Answer FIVE questions, grounded in the actual code (cite files/functions):

1. **Wedge analysis.** What is this project's true wedge today? Which single
   capability, if 10x deeper, becomes hard to replace? Be honest about what is
   trivially copyable (the ~120-line core) vs. what compounds (presets,
   integrations, decision logs, trust conventions).

2. **Palantir gap map.** Palantir's platform = data integration + ontology
   (semantic layer) + lineage/provenance + governance/access control +
   operational apps + AIP (governed LLM orchestration). For each pillar, state:
   what Evidence Gate has today (usually: nothing or a seed), what the minimal
   credible v1 of that pillar looks like for THIS project, and whether pursuing
   it strengthens or dilutes the wedge. Explicitly reject pillars that don't fit
   a bottom-up open-source motion.

3. **Future data-management pain.** Looking 2–5 years out (LLMs everywhere,
   EU AI Act / sector audits, agents acting on live enterprise data), which
   unsolved data-management problems is this project naturally positioned for?
   Consider at least: AI-decision audit trails, evidence provenance/lineage,
   staleness & quality SLOs for AI features, post-generation claim
   verification, policy-as-code for what AI may say per data state, and
   multi-agent trust handshakes (agent A refusing to consume agent B's
   ungated output). Rank them by (pain × willingness-to-pay × fit with the
   existing core).

4. **Moat & monetization.** For the top-ranked direction, what is the
   open-core split? What stays MIT (adoption engine) and what is the paid
   layer (compliance reports, hosted dashboard, SSO/RBAC, retention)? Name the
   2–3 competitors or adjacent tools (guardrails frameworks, LLM observability,
   data-quality tools) and the one-sentence positioning against each.

5. **Roadmap.** Produce a concrete phased roadmap (Phase 1: 0–3 months,
   Phase 2: 3–9 months, Phase 3: 9–24 months). Every item MUST follow the
   estimation rules below.

## Estimation rules (mandatory for every roadmap item)

- **Priority**: P0 = do now, defines the wedge; P1 = next quarter, needs P0
  signal; P2 = only after adoption traction; P3 = long-term vision bet.
- **Dev time**: person-days for ONE senior engineer, including tests in both
  the JS and Python ports and docs. Round to whole days. If an item exceeds
  20 person-days, split it.
- **Cost**: dev-days × a stated blended day-rate (state your assumption,
  e.g. USD 400/day or THB 8,000/day), plus any recurring infra cost/month for
  hosted components. Show the arithmetic.
- **Fit check**: one line on whether the item respects the zero-dependency /
  pure-core constraint, or explicitly moves the item OUT of core (adapter,
  separate package, hosted service).

## Output format

1. Wedge (½ page)
2. Palantir gap map (table: pillar | today | minimal v1 | pursue? why)
3. Ranked future problems (table with pain/WTP/fit scores 1–5)
4. Moat & open-core split (½ page)
5. Roadmap (table: item | phase | priority | dev-days | cost | fit check)
6. "Do NOT build" list — 3+ tempting items that would dilute the wedge, with
   one-line reasons.

Be specific and opinionated. Prefer one sharp recommendation over three hedged
ones. Ground every claim in the repo's actual code and constraints.
```

---

## หมายเหตุการใช้งาน

- แนบไฟล์ `src/core.js`, `src/presets.js`, `mcp/server.mjs`, `README.md`,
  `CONTRIBUTING.md` ไปกับ prompt (หรือรันในเครื่องมือที่เห็น repo ทั้งตัว)
- กฏ estimation (priority / dev-days / cost) ฝังอยู่ใน prompt แล้ว —
  ปรับ day-rate ให้ตรงกับทีมจริงก่อนใช้
- ผลลัพธ์ที่ดีควรจบด้วย roadmap ที่ item ละไม่เกิน 20 dev-days และมี
  "Do NOT build" list เสมอ
