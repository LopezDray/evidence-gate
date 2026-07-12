# Completed — entry ใหม่บนสุด · เก็บ ≤30 entry เกินให้ย้ายไป archive/

- **2026-07-12 · MCP `verify_claims` tool** — MCP server เปิด proof loop ครบสองครึ่ง
  (`check_evidence` + `verify_claims`) · tool รับ `{answer, records, supporting?, gate?, preset?,
  rules?, decision?}` → verdict ladder (รวม `misquoted_values` เมื่อ record มี `facts`) ·
  digest join กับ decision record ของ check_evidence (id + evidence digest เดียวกัน) ·
  JS-only (MCP ไม่มี Python port) · `test/mcp.test.mjs` ครอบ supported/misquote/phantom/
  stale-framing/join · commit `3b13603` บน branch `claude/fable-fact-check-c7yt0b` (ยังไม่เปิด PR)
- **2026-07-11 · Fact cross-checking (design §8) [Fable]** — records รับ `facts` →
  `verifyClaims`/`verify_claims` เช็คทุกตัวเลขในประโยคที่ cite แบบ strict+exact ·
  verdict ใหม่ `misquoted_values` + warning `verify_misquoted_value` (block) + `misquotes`
  + `stats.misquoted` · เลขไทย ๐-๙ เข้า default claimPatterns (vector เดิมอัปเดตแบบตั้งใจ) ·
  magnitude K/M/B + พัน…ล้านล้าน ผ่าน decimal-point-shift (ห้ามคูณ float — parity #9 ใหม่) ·
  vectors ใหม่ 12 เคส + unit tests สองพอร์ต · design §8 → full spec (เจ้าของเคาะ 4 trade-off) ·
  **merged PR #16 (`f1a2985`)** · อยู่ใน CHANGELOG `[Unreleased]` — ยังไม่ bump version
- **2026-07-11 · Tamper-evident decision chain** — `chainDecision`/`verifyDecisionChain`
  (+ Python) · hash-chain decision log, `prev` additive (schema ยัง /1) · vectors
  `decisionChain` ล็อก digest สองพอร์ต · `examples/tamper-evident-log.mjs` ·
  design §7 → implemented · **fold เข้า 1.0.0 (PR #14)** ตาม constraint branch เดียว
- **2026-07-11 · P0-2 CI badge + P3-3 prep** — README badges (test/npm/PyPI/license, #2) ·
  bump version → 1.0.0 ครบ 4 จุด · CHANGELOG `[1.0.0]` + breaking note (rules validation) ·
  release notes + case study skeleton (`docs/`) · **เหลือเจ้าของ: publish + tag + เติม case study**
- **2026-07-11 · ระบบปฏิบัติงาน Claude** — CLAUDE.md + .claude/skills/ (4 ไฟล์) +
  .claude/memory/ + SessionStart hook · ปรับจาก MASTER_BOOTSTRAP_PROMPT ของ DaddyInvestor
  · merge แล้วใน PR #13 (`9fa5af0`) · drive-by: sync version 0.2.0 ที่ค้าง (`__init__.py`, mcp server)
- **2026-07-11 · P3-1 Provenance** — `validateProvenance`/chain rules + `rules.provenance`
  warnings + attribution + `decision.provenance` (digest replay ได้) + `examples/provenance.mjs`
  · merge แล้วใน PR #12 (`5a7d37b`)
- **2026-07-11 · P3-2 Claim verification** — `verifyClaims`/`citationBlock`, verdict ladder,
  `evidence-gate.verification/1` digest-join กับ decision log, `examples/verified-loop.mjs`,
  README "The proof loop" · merge แล้วใน PR #12 (`c9c7ae7`)
- **2026-07-11 · WP2** — `test/vectors.json` shared สองพอร์ต + `validateRules`/`validate_rules`
  (ปิด JS เงียบ-fresh vs Py KeyError) + MCP `check_evidence` รับ `decision`
  · merge แล้วใน PR #12 (`20001c4`) · vectors จับ divergence เพิ่มได้ 4 ตัวระหว่างทาง
- **2026-07-02 · WP1 spec close** — เจ้าของอนุมัติ open questions ทั้ง 9 ข้อ "ตามร่างทั้งหมด"
  ใน #8 · design docs ทั้งสองเป็น approved (สถานะในไฟล์อัปเดตจริงใน PR #12)
- **2026-07-10 · v0.2.0 released** — npm `evidence-gate@0.2.0` + PyPI `evidence-gate-py@0.2.0`
  · tag `v0.2.0` → `662a832` · decision log (`evidence-gate.decision/1`) เป็นฟีเจอร์หลักของรุ่น
- **ก่อนหน้า** — Phase 0-1 ทั้งหมด: core gate สองพอร์ต, presets, MCP server, CI, decision log
  (ดูรายละเอียด `docs/project-plan.md` §0 + CHANGELOG)
