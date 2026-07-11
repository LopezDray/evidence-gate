# Pending — ดัชนีงานค้าง active เท่านั้น · สั้น + pointer · จบ session ต้องอัปเดต

## พร้อมทำ (เรียงตามลำดับ)

1. **[Fable] Fact cross-checking** (`verify_misquoted_value`) — งานหลักตัวถัดไป
   · kickoff เต็ม: **`docs/fable-fact-checking-kickoff.md`** (อ่านก่อน) · design ปิดก่อน code
2. **P3-3 Release v1.0** — โค้ด+version+docs อยู่บน main แล้ว (PR #14 merged, `f681773`)
   · **ติดเจ้าของล้วน**: `release-checklist.md` ข้อ 8-11 = tag `v1.0.0` + `npm publish` + PyPI
   + GitHub Release (ใช้ `docs/release-notes-v1.0.md`) · เติม `docs/case-study-daddyinvestor.md`
   (skeleton — ห้ามแต่งเลข) แล้วลิงก์จาก README
3. ~~P0-2 CI badge~~ ✅ เสร็จ

## ติดเจ้าของล้วน (Claude ไม่ต้องแตะ)

- **P1-4 Launch** — โพสต์ Show HN / Reddit / X — ร่างพร้อมแล้ว (#6) รอเจ้าของโพสต์เอง

## รอ trigger (ห้ามเริ่มก่อนถึงเงื่อนไข)

- **P3-4 Dashboard self-host** — เริ่มได้เมื่อ: ผู้ใช้จริง ≥10 **หรือ** มีคนขอ ≥3 (#8)

## Follow-up เล็กที่จดไว้ (โมเดลไหนก็ทำได้ — MCP JS-only ไม่มี parity)

- MCP server ควรได้ tool `verify_claims` (spec §11 บอก "for free in a follow-up")
- `evidenceGate` ยังไม่รับ `supporting` ผ่าน MCP `check_evidence` แบบมี tier ใน docs — เช็คตอนทำ verify_claims tool

_อัปเดตล่าสุด: 2026-07-11 (ปิด session · v1.0.0 prep + tamper-evident chain merged PR #14 ·
main = `f681773` · งานถัดไป = Fable fact-checking ดู `docs/fable-fact-checking-kickoff.md`)_
