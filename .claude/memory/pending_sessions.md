# Pending — ดัชนีงานค้าง active เท่านั้น · สั้น + pointer · จบ session ต้องอัปเดต

## พร้อมทำ (เรียงตามลำดับ)

1. **P3-3 Release v1.0** — prep เสร็จถึงข้อ 7 แล้ว (bump 1.0.0, CHANGELOG `[1.0.0]`,
   release notes `docs/release-notes-v1.0.md`) รอ merge PR แล้ว **ติดเจ้าของล้วน**:
   ข้อ 8-11 ของ `release-checklist.md` = tag `v1.0.0` + `npm publish` + PyPI + GitHub Release
   · **case study**: `docs/case-study-daddyinvestor.md` เป็น skeleton — เจ้าของเติมตัวเลขจริง
   (ห้ามแต่งเลข) แล้วค่อยลิงก์จาก README
2. ~~P0-2 CI badge~~ ✅ เสร็จ (README badges test/npm/PyPI/license)

## ติดเจ้าของล้วน (Claude ไม่ต้องแตะ)

- **P1-4 Launch** — โพสต์ Show HN / Reddit / X — ร่างพร้อมแล้ว (#6) รอเจ้าของโพสต์เอง

## รอ trigger (ห้ามเริ่มก่อนถึงเงื่อนไข)

- **P3-4 Dashboard self-host** — เริ่มได้เมื่อ: ผู้ใช้จริง ≥10 **หรือ** มีคนขอ ≥3 (#8)

## Follow-up เล็กที่จดไว้ (ทำเมื่อผ่านทางนั้น)

- MCP server ควรได้ tool `verify_claims` (spec §11 บอก "for free in a follow-up")
- `evidenceGate` ยังไม่รับ `supporting` ผ่าน MCP `check_evidence` แบบมี tier ใน docs — เช็คตอนทำ verify_claims tool

_อัปเดตล่าสุด: 2026-07-11 (Phase 3 implement ครบ + ระบบปฏิบัติงาน merge PR #13 · main = `9fa5af0`)_
