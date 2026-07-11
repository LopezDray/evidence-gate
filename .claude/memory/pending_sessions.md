# Pending — ดัชนีงานค้าง active เท่านั้น · สั้น + pointer · จบ session ต้องอัปเดต

## พร้อมทำ (เรียงตามลำดับ)

1. **P3-3 Release** — โค้ด v1.0.0 + fact cross-checking (§8) อยู่บน main แล้ว
   (main = `f1a2985`, PR #16 merged) · **ติดเจ้าของล้วน**: `release-checklist.md` ข้อ 8-11
   = tag + `npm publish` + PyPI + GitHub Release · เติม `docs/case-study-daddyinvestor.md`
   (skeleton — ห้ามแต่งเลข) แล้วลิงก์จาก README
   · **ต้องเคาะก่อน publish**: fact cross-checking อยู่ใน CHANGELOG `[Unreleased]` ยังไม่ได้
   bump version — เจ้าของต้องเลือก (a) fold เข้า v1.0.0 = ย้าย `[Unreleased]` → `[1.0.0]`,
   หรือ (b) publish v1.0.0 ก่อนแล้วออก fact-checking เป็น v1.1.0 · จุด bump version 4 ที่
   (`package.json`, `pyproject.toml`, `__init__.py`, `mcp/server.mjs` — ดู release-checklist §version)

## ติดเจ้าของล้วน (Claude ไม่ต้องแตะ)

- **P1-4 Launch** — โพสต์ Show HN / Reddit / X — ร่างพร้อมแล้ว (#6) รอเจ้าของโพสต์เอง

## รอ trigger (ห้ามเริ่มก่อนถึงเงื่อนไข)

- **P3-4 Dashboard self-host** — เริ่มได้เมื่อ: ผู้ใช้จริง ≥10 **หรือ** มีคนขอ ≥3 (#8)

## Follow-up เล็กที่จดไว้ (โมเดลไหนก็ทำได้ — MCP JS-only ไม่มี parity)

- MCP server ควรได้ tool `verify_claims` (spec §11 บอก "for free in a follow-up") — พอทำแล้ว
  จะได้ fact cross-checking ฟรีด้วย (records รับ `facts` ได้เลย)
- `evidenceGate` ยังไม่รับ `supporting` ผ่าน MCP `check_evidence` แบบมี tier ใน docs — เช็คตอนทำ verify_claims tool

_อัปเดตล่าสุด: 2026-07-11 (ปิด session · fact cross-checking (§8) merged PR #16 · main = `f1a2985`
· งานถัดไป = release (ติดเจ้าของ) + ต้องเคาะ version bump ของ fact-checking ก่อน publish)_
