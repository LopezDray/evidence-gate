# Pending — ดัชนีงานค้าง active เท่านั้น · สั้น + pointer · จบ session ต้องอัปเดต

## พร้อมทำ (เรียงตามลำดับ)

1. **Fact cross-checking — เปิด PR #16 แล้ว รอเจ้าของ review/merge** — โค้ด+design+vectors
   เสร็จครบบน branch `claude/fable-fact-check-c7yt0b` (design §8 = full spec แล้ว, เจ้าของเคาะ
   4 trade-off ในแชท 2026-07-11: strict ทุกตัวเลข / exact เท่านั้น / เลขไทยเต็มรูป / verdict ใหม่
   `misquoted_values`) · **PR #16 https://github.com/LopezDray/evidence-gate/pull/16**
   ยังไม่ได้ subscribe watch (เจ้าของยังไม่สั่ง) · merge main แล้ว = no-op (branch ตาม main อยู่)
2. **P3-3 Release v1.0** — โค้ด+version+docs อยู่บน main แล้ว (PR #14 merged, `f681773`)
   · **ติดเจ้าของล้วน**: `release-checklist.md` ข้อ 8-11 = tag `v1.0.0` + `npm publish` + PyPI
   + GitHub Release (ใช้ `docs/release-notes-v1.0.md`) · เติม `docs/case-study-daddyinvestor.md`
   (skeleton — ห้ามแต่งเลข) แล้วลิงก์จาก README
   · **หมายเหตุ**: fact cross-checking อยู่ใน CHANGELOG `[Unreleased]` — ถ้า merge ก่อน publish
   ต้องตัดสินใจว่าออกเป็น 1.0.0 เลยหรือ 1.1.0 (จุด bump version มี 4 ที่ ดู release-checklist)

## ติดเจ้าของล้วน (Claude ไม่ต้องแตะ)

- **P1-4 Launch** — โพสต์ Show HN / Reddit / X — ร่างพร้อมแล้ว (#6) รอเจ้าของโพสต์เอง

## รอ trigger (ห้ามเริ่มก่อนถึงเงื่อนไข)

- **P3-4 Dashboard self-host** — เริ่มได้เมื่อ: ผู้ใช้จริง ≥10 **หรือ** มีคนขอ ≥3 (#8)

## Follow-up เล็กที่จดไว้ (โมเดลไหนก็ทำได้ — MCP JS-only ไม่มี parity)

- MCP server ควรได้ tool `verify_claims` (spec §11 บอก "for free in a follow-up") — พอทำแล้ว
  จะได้ fact cross-checking ฟรีด้วย (records รับ `facts` ได้เลย)
- `evidenceGate` ยังไม่รับ `supporting` ผ่าน MCP `check_evidence` แบบมี tier ใน docs — เช็คตอนทำ verify_claims tool

_อัปเดตล่าสุด: 2026-07-11 (ปิด session · fact cross-checking (design §8) เสร็จครบสองพอร์ต ·
เปิด PR #16 รอเจ้าของ review/merge · main ยังอยู่ที่ `09e4be1`)_
