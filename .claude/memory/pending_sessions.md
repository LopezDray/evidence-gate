# Pending — ดัชนีงานค้าง active เท่านั้น · สั้น + pointer · จบ session ต้องอัปเดต

## พร้อมทำ (เรียงตามลำดับ)

1. **P3-3 Release — เสร็จสมบูรณ์แล้ว เหลือแค่ case study**
   · v1.0.0 + v1.0.1 publish ครบทุกช่องทาง (npm, PyPI, tag, GitHub Release) ตรวจสอบแล้วว่า
   เนื้อหาตรงกับของจริง 100% — ดูรายละเอียดเหตุการณ์ v1.0.0/v1.0.1 mismatch ใน completed_features.md
   · **ยังค้าง**: `docs/case-study-daddyinvestor.md` = skeleton ต้องเจ้าของเติมเลขจริง (ห้าม
   Claude แต่ง) แล้วลิงก์จาก README
   · หมายเหตุ: ช่อง "วิธีใช้/บทเรียน" อ้าง `examples/thai-rag.mjs` ได้ (units + freshness
   localization pattern พิสูจน์แล้ว) — เหลือแค่ตัวเลข before/after ที่ติดเจ้าของ

## ติดเจ้าของล้วน (Claude ไม่ต้องแตะ)

- **P1-4 Launch** — โพสต์ Show HN / Reddit / X — ร่างพร้อมแล้ว (#6) รอเจ้าของโพสต์เอง

## รอ trigger (ห้ามเริ่มก่อนถึงเงื่อนไข)

- **P3-4 Dashboard self-host** — เริ่มได้เมื่อ: ผู้ใช้จริง ≥10 **หรือ** มีคนขอ ≥3 (#8)

## Follow-up เล็กที่จดไว้ (โมเดลไหนก็ทำได้ — MCP JS-only ไม่มี parity)

- ~~MCP tool `verify_claims`~~ ✅ เสร็จ (commit `3b13603`) — รับ `facts`/`gate`/`supporting`,
  digest join กับ `check_evidence`, mcp.test.mjs ครอบแล้ว · อยู่ใน CHANGELOG `[Unreleased]`
  (ออกพร้อม fact-checking — version bump ก้อนเดียวกัน)
- (ยังไม่มี follow-up เล็กค้าง)

_อัปเดตล่าสุด: 2026-07-13 (เพิ่ม `examples/thai-rag.mjs` — Thai RAG full-loop + doc 2 gotchas
(units/freshness localization) ใน README (sync python แล้ว) · npm test 317/317 ผ่าน · JS-only ไม่มี
parity Python · งานถัดไปยังเหมือนเดิม = case study เติมเลขจริง (ติดเจ้าของ) ไม่มีงานโค้ดค้าง)_
