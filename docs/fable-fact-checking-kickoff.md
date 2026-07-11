# Fable Kickoff — Fact cross-checking (`verify_misquoted_value`)

> เอกสารส่งต่องานสำหรับเปิด session ใหม่ให้ **Fable** ทำงานหลักตัวถัดไป
> อ่านไฟล์นี้ + `CLAUDE.md` + `.claude/skills/*` ก่อนแตะโค้ด (SessionStart hook พ่น pointer ให้แล้ว)

## สถานะ ณ 2026-07-11 (ปิด session ก่อนหน้า)

- **v1.0.0 พร้อมออก** — โค้ด + version + docs อยู่บน `main` (`f681773`) แล้วผ่าน PR #14
  · Phase 3 ครบ: gate + `verifyClaims` + provenance + tamper-evident decision chain
  · **เหลือเจ้าของล้วน**: publish npm/PyPI + tag `v1.0.0` + เติม `docs/case-study-daddyinvestor.md`
  (release-checklist.md ข้อ 8-11) — Fable **ไม่ต้องแตะ** งาน release
- ระบบปฏิบัติงานพร้อม: `CLAUDE.md` (กฎ 10 ข้อ) + `.claude/skills/` (4 ไฟล์) + `.claude/memory/`

## งานของ session นี้: claim-verification.md §8 — fact cross-checking

**ปัญหาที่ปิด**: ตอนนี้ `verifyClaims` จับ citation ผิด (phantom/naked/stale) ได้ แต่
**จับตัวเลขที่อ้างผิดทั้งที่ citation ถูกไม่ได้** — model เขียน "รายได้ 1.5M [ev:1]" ทั้งที่
record จริงคือ 1.23M → ผ่าน verdict `supported` ทุกวันนี้ นี่คือช่องโหว่ที่ใหญ่สุดที่เหลือ
และ spec เขียนเองว่า *"likely the single most differentiating feature of the loop"*

**เป้า** (ตาม §8): record แนบ `facts` → verifyClaims normalize ทุกตัวเลขในประโยคที่มี citation
แล้วเช็คว่าตรงกับ fact values ของ record ที่ cite → ไม่ตรง = `verify_misquoted_value` (block)

```js
{ date: "2026-03-31", qualityScore: 92, facts: { revenue: 1234500, eps: 0.42 } }
```

## ⚠️ จุดยากคือ DESIGN ก่อน CODE — ปิด open questions ให้ byte-identical ก่อน implement

number normalization คือกับดัก cross-port ตัวใหม่ (ดู `.claude/skills/cross-port-parity.md`
ข้อ 3, 5 — regex `\d` unicode, float formatting) **ห้ามเขียนโค้ดก่อนปิด spec ต่อไปนี้ลง
`docs/design/claim-verification.md` §8 (จาก concept → full spec):**

1. **การ extract "ตัวเลข" จากประโยค** — regex ตัวเดียว spec byte-for-byte สองพอร์ต
   ครอบ: ทศนิยม, เครื่องหมายลบ, `%`, สกุลเงิน `฿$€£`, **ตัวคั่นหลักพัน** (`1,234,500`),
   **เลขไทย ๑๒** (นับหรือไม่?), scientific notation (`1e6` — spec เดิมบอกให้เลี่ยง)
2. **magnitude suffix** — §8 ยกตัวอย่าง "1.2M" ต้อง match `1234500` ไหม? ถ้าใช่ต้องนิยาม
   ตาราง suffix (`K/M/B` + ไทย `พัน/ล้าน`) + **กติกา rounding/tolerance** ที่เท่ากันสองพอร์ต
   (1.2M = 1,200,000 ≠ 1,234,500 — ผ่านได้เฉพาะมี tolerance) — **นี่คือคำถามหินที่สุด**
3. **matching rule** — ทุกตัวเลขในประโยคต้อง match (strict) หรือแค่ตัวใดตัวหนึ่ง? ปีค.ศ.
   (2026), เปอร์เซ็นต์เทียบ, count นับเป็น claim number ไหม?
4. **normalize แล้วเทียบยังไง** — parse เป็น number แล้วเทียบ (เสี่ยง float divergence §5)
   หรือเทียบ canonical string? นิยามให้ไม่มีทางเบี่ยง JS↔Py
5. **verdict ladder** — `verify_misquoted_value` แทรกตรงไหน? (น่าจะ block เหนือ
   `unsupported_claims`) + ปฏิสัมพันธ์กับ `requireFullCoverage`
6. **facts ที่ไม่มี / record ไม่มี facts** — คำนวณไม่ได้ → เงียบ (opt-in) ไม่ใช่ fail

## Definition of Done (ตาม CLAUDE.md — ห้ามข้าม)

1. ปิด §8 เป็น full spec ก่อน (commit design ก่อน implement ก็ได้ ให้เจ้าของเคาะถ้ามี trade-off)
2. implement **JS (`src/verify.js`) + Python (`verify.py`)** logic ตรงกัน byte-for-byte
3. shared vectors section ใหม่ใน `test/vectors.json` — เคสเลขไทย/ตัวคั่น/suffix/tolerance/
   misquote ครบ + รันสองพอร์ต (workflow เต็มใน `.claude/skills/cross-port-parity.md`)
4. verify ครบ `.claude/skills/verify-playbook.md` (สองพอร์ต + vectors + `examples/verified-loop.mjs`
   ที่ควรโชว์ misquote catch)
5. docs: README "The proof loop" เพิ่ม fact-check + `cp README.md python/README.md`
6. จบ session: อัปเดต `.claude/memory/` 2 ไฟล์ + commit

## วิธีเริ่ม

1. อ่าน `docs/design/claim-verification.md` §8 + §4-5 (verdict ladder เดิม) + §12 (resolutions)
2. อ่าน `src/verify.js` + `python/evidence_gate/verify.py` (โครงที่ต้องต่อยอด)
3. แตก branch ใหม่จาก `main` (PR #14 merge แล้ว — restart:
   `git fetch origin main && git checkout -B claude/fable-fact-check origin/main`)
4. **ปิด design §8 ก่อน** แล้วค่อย implement

## อ้างอิง
- moat + เหตุผลเลือก Fable: `docs/project-plan.md` §0 + Phase 3 · Umbrella #8
- งานเล็กที่โมเดลไหนก็ทำได้ (ไม่ใช่ของ Fable): MCP `verify_claims` tool, `supporting` tier
  ใน MCP — ดู `.claude/memory/pending_sessions.md`
