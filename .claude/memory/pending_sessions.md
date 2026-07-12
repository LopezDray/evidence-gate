# Pending — ดัชนีงานค้าง active เท่านั้น · สั้น + pointer · จบ session ต้องอัปเดต

## พร้อมทำ (เรียงตามลำดับ)

1. **⚠️ v1.0.0 publish แล้ว "ขาด" MCP verify_claims — v1.0.1 คือ patch ที่แก้** (2026-07-12)
   · เจ้าของ publish npm/PyPI `1.0.0` จาก commit `f1a2985` (หลัง PR #16 fact-check, **ก่อน**
   PR #17 MCP tool + PR #18 CHANGELOG fold merge) → package จริงมี fact cross-checking
   แต่**ไม่มี** MCP `verify_claims` tool (verify แล้วด้วย `npm pack` จริง) · tag `v1.0.0` ตรงกับของ
   ที่ publish (ถูกต้อง ไม่ต้องแก้) · GitHub Release v1.0.0 **แก้ข้อความให้เจ้าของแล้ว** (ตัด
   `verify_claims` ออกจากบูลเล็ต MCP + ลบ draft-blockquote) — เจ้าของต้องกด "Update release" เอง
   ด้วยข้อความที่ให้ไปในแชท (ยังไม่ยืนยันว่ากดแล้ว — **เช็คตอนเปิด session ถัดไป**)
   · **แก้แล้วรอ merge**: CHANGELOG แยก `[1.0.0]` (ของจริงที่ publish) ออกจาก `[1.0.1]` (MCP tool)
   · version 4 จุด bump → `1.0.1` ครบ (Python ไม่มีโค้ดเปลี่ยน แต่ bump เพื่อ parity ตาม convention
   โปรเจกต์) · `docs/release-notes-v1.0.1.md` ใหม่ + `release-notes-v1.0.md` แก้ให้ตรงของจริง
   + note ชี้ไป v1.0.1 · release gate เขียวครบ · **PR รอเปิด/merge** (เช็ค PR ล่าสุดตอนเปิด session)
   · **เหลือเจ้าของล้วนหลัง merge**: `git tag v1.0.1` + `npm publish` + PyPI build/upload
   + GitHub Release v1.0.1 (body = `docs/release-notes-v1.0.1.md`)
   · **บทเรียน**: publish npm/PyPI ต้อง `git pull origin main` ให้ชัวร์ก่อนรันเสมอ — ไม่งั้น
   package กับ tag/main อาจไม่ตรงกันแบบนี้อีก (จดเป็น skill ใหม่?)
   · **ยังค้างต่อ**: `docs/case-study-daddyinvestor.md` = skeleton ต้องเจ้าของเติมเลขจริง (ห้าม
   Claude แต่ง) + ลิงก์จาก README

## ติดเจ้าของล้วน (Claude ไม่ต้องแตะ)

- **P1-4 Launch** — โพสต์ Show HN / Reddit / X — ร่างพร้อมแล้ว (#6) รอเจ้าของโพสต์เอง

## รอ trigger (ห้ามเริ่มก่อนถึงเงื่อนไข)

- **P3-4 Dashboard self-host** — เริ่มได้เมื่อ: ผู้ใช้จริง ≥10 **หรือ** มีคนขอ ≥3 (#8)

## Follow-up เล็กที่จดไว้ (โมเดลไหนก็ทำได้ — MCP JS-only ไม่มี parity)

- ~~MCP tool `verify_claims`~~ ✅ เสร็จ (commit `3b13603`) — รับ `facts`/`gate`/`supporting`,
  digest join กับ `check_evidence`, mcp.test.mjs ครอบแล้ว · อยู่ใน CHANGELOG `[Unreleased]`
  (ออกพร้อม fact-checking — version bump ก้อนเดียวกัน)
- (ยังไม่มี follow-up เล็กค้าง)

_อัปเดตล่าสุด: 2026-07-12 (เจ้าของ publish v1.0.0 ไปจาก commit เก่ากว่า main — ขาด MCP verify_claims
tool · แก้ CHANGELOG/version/release-notes เป็น v1.0.1 patch แล้ว รอ merge + publish + confirm ว่า
เจ้าของแก้ GitHub Release v1.0.0 body ตามที่แนะนำหรือยัง)_
