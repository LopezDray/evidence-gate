# Completed — entry ใหม่บนสุด · เก็บ ≤30 entry เกินให้ย้ายไป archive/

- **2026-07-12 · `examples/thai-rag.mjs` — Thai RAG full-loop example + 2 localization gotchas**
  · เดโม gate→cite→generate→verify บนข้อมูลภาษาไทย (สมมติ ระบุชัด) 4 ซีน: ตอบถูก / แต่งเลขไทย
  (๙๐๐๐๐๐ → misquoted block) / งบ stale + "ปัจจุบัน" (stale-framing review) / ไม่มีข้อมูล (gate
  ปฏิเสธก่อนเรียก LLM) · **gotcha 1 (units)**: `ล้าน` เป็นตัวคูณ 10⁶ → ต้องเก็บ `facts` เป็นบาทเต็ม
  (`850000e6`) ไม่งั้น false-positive misquote · **gotcha 2 (freshness)**: `freshnessPatterns`
  default อังกฤษล้วน → คำไทย "ปัจจุบัน/ล่าสุด" หลุด ต้อง localize ผ่าน `rules.verification.
  freshnessPatterns` · README จุด 4+5 เสริม note สองข้อนี้ + อ้าง example (sync python/README แล้ว)
  · JS-only (เหมือน MCP ไม่มี parity Python) · verify: npm test 317/317 ผ่าน + example รันได้
- **2026-07-12 · v1.0.0 release prep (fold)** — เจ้าของเลือก (a) fold fact cross-checking +
  MCP verify_claims เข้า v1.0.0 · CHANGELOG `[Unreleased]` → `[1.0.0] — 2026-07-12` (รวม ladder
  ใหม่ misquoted_values), version 4 จุด = 1.0.0 ครบอยู่แล้ว, `docs/release-notes-v1.0.md` อัปให้
  ครอบ fact-check+MCP+anchor · release gate เขียว (2 พอร์ต + 4 examples + mcp.test) · **เหลือ
  เจ้าของล้วน**: tag/npm/PyPI/GitHub Release + เติมเลข case study
- **2026-07-12 · v1.0.0 + v1.0.1 release — publish/version-mismatch resolved end-to-end**
  · เจ้าของ publish npm/PyPI v1.0.0 จาก checkout ที่ยังไม่ pull main ล่าสุด → package จริงขาด
  MCP `verify_claims` tool (fact cross-checking มีอยู่) ทั้งที่ CHANGELOG/GitHub Release พูดถึง
  MCP tool ด้วย — ตรวจพบด้วย `npm pack evidence-gate@1.0.0` จริง (อย่าเชื่อ git log อย่างเดียว) ·
  แก้ด้วย v1.0.1 patch: CHANGELOG แยก `[1.0.0]` (ของจริงที่ publish) ออกจาก `[1.0.1]` (MCP tool) ·
  version 4 จุด bump → 1.0.1 (Python bump เพื่อ parity แม้ไม่มีโค้ดเปลี่ยน) · `release-notes-v1.0.1.md`
  ใหม่ · GitHub Release ทั้งสองตัว (v1.0.0, v1.0.1) แก้ข้อความให้ตรงของจริงแล้ว verify ผ่าน API จริง
  (ไม่มี `verify_claims` เท็จใน v1.0.0, ไม่มี draft-note/relative-link ใน v1.0.1) · **release เสร็จ
  สมบูรณ์ทุกช่องทาง: npm 1.0.1, PyPI 1.0.1, tag v1.0.0+v1.0.1, GitHub Release ทั้งสองถูกต้อง** ·
  บทเรียนบันทึกลง `release-checklist.md` แล้ว (pull ก่อน publish เสมอ, release notes ต้องไม่มี
  meta-note ปน, `rm -rf dist/` ก่อน build, ใช้ URL เต็มใน release body)
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
