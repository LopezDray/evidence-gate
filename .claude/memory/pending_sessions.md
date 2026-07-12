# Pending — ดัชนีงานค้าง active เท่านั้น · สั้น + pointer · จบ session ต้องอัปเดต

## พร้อมทำ (เรียงตามลำดับ)

1. **P3-3 Release v1.0.0 — prep เสร็จหมดแล้ว เหลือ publish ล้วน (ติดเจ้าของ)**
   · เจ้าของเลือก (a) fold ทุกอย่างเข้า v1.0.0 แล้ว (2026-07-12) — CHANGELOG `[Unreleased]`
   → `[1.0.0]` (fact cross-checking + MCP verify_claims + ของเดิม), version 4 จุด = 1.0.0 ครบ,
   release notes + link ref พร้อม · **release prep รออยู่ใน PR ยังไม่ merge เข้า main** (ดู completed)
   · **เหลือเจ้าของล้วน** `release-checklist.md` ข้อ 8-11: `git tag v1.0.0` + `npm publish` (root)
   + `cd python && python -m build && twine upload dist/*` (ชื่อ PyPI = `evidence-gate-py`)
   + GitHub Release (body = `docs/release-notes-v1.0.md`)
   · **ยังค้าง**: `docs/case-study-daddyinvestor.md` = skeleton ต้องเจ้าของเติมเลขจริง (ห้าม Claude แต่ง) + ลิงก์จาก README

## ติดเจ้าของล้วน (Claude ไม่ต้องแตะ)

- **P1-4 Launch** — โพสต์ Show HN / Reddit / X — ร่างพร้อมแล้ว (#6) รอเจ้าของโพสต์เอง

## รอ trigger (ห้ามเริ่มก่อนถึงเงื่อนไข)

- **P3-4 Dashboard self-host** — เริ่มได้เมื่อ: ผู้ใช้จริง ≥10 **หรือ** มีคนขอ ≥3 (#8)

## Follow-up เล็กที่จดไว้ (โมเดลไหนก็ทำได้ — MCP JS-only ไม่มี parity)

- ~~MCP tool `verify_claims`~~ ✅ เสร็จ (commit `3b13603`) — รับ `facts`/`gate`/`supporting`,
  digest join กับ `check_evidence`, mcp.test.mjs ครอบแล้ว · อยู่ใน CHANGELOG `[Unreleased]`
  (ออกพร้อม fact-checking — version bump ก้อนเดียวกัน)
- (ยังไม่มี follow-up เล็กค้าง)

_อัปเดตล่าสุด: 2026-07-12 (fact cross-checking + MCP verify_claims merged (#16, #17) เข้า main แล้ว ·
เจ้าของเลือก fold เข้า v1.0.0 → release prep เสร็จ (CHANGELOG/version/release-notes) รอ merge + publish ล้วน)_
