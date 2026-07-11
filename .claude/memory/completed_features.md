# Completed — entry ใหม่บนสุด · เก็บ ≤30 entry เกินให้ย้ายไป archive/

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
