# Pending — ดัชนีงานค้าง active เท่านั้น · สั้น + pointer · จบ session ต้องอัปเดต

## พร้อมทำ (เรียงตามลำดับ)

1. **P3-3 Release v1.0 + case study** — CHANGELOG `[Unreleased]` มีเนื้อครบแล้ว
   · Claude เตรียมได้ถึงข้อ 7 ของ `.claude/skills/release-checklist.md`
   · **ติดเจ้าของ**: publish npm/PyPI + tag + เนื้อหา case study จาก DaddyInvestor
   · อย่าลืม: bump version 4 จุด (ดู checklist — sync เป็น 0.2.0 ครบแล้ว 2026-07-11)
2. **P0-2 CI badge** — เพิ่ม badge บน README (#2) — งานเล็ก ทำแทรกได้

## ติดเจ้าของล้วน (Claude ไม่ต้องแตะ)

- **P1-4 Launch** — โพสต์ Show HN / Reddit / X — ร่างพร้อมแล้ว (#6) รอเจ้าของโพสต์เอง

## รอ trigger (ห้ามเริ่มก่อนถึงเงื่อนไข)

- **P3-4 Dashboard self-host** — เริ่มได้เมื่อ: ผู้ใช้จริง ≥10 **หรือ** มีคนขอ ≥3 (#8)

## Follow-up เล็กที่จดไว้ (ทำเมื่อผ่านทางนั้น)

- MCP server ควรได้ tool `verify_claims` (spec §11 บอก "for free in a follow-up")
- `evidenceGate` ยังไม่รับ `supporting` ผ่าน MCP `check_evidence` แบบมี tier ใน docs — เช็คตอนทำ verify_claims tool

_อัปเดตล่าสุด: 2026-07-11 (Phase 3 implement ครบ + ระบบปฏิบัติงาน merge PR #13 · main = `9fa5af0`)_
