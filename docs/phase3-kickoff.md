# Phase 3 Kickoff — สำหรับ session ใหม่ (Fable)

> เอกสารส่งต่องานสำหรับเปิด session ใหม่ให้ **Fable** วางแผน + ลงมือ Phase 3
> ("ref" → "proof"). อ่านไฟล์นี้ก่อน แล้วเริ่มตามลำดับด้านล่าง

## ✅ ความคืบหน้า (2026-07-11 — session Fable บน branch `claude/phase3-wp2-verify-hy71kk`)

- **WP2 เสร็จ** (`20001c4`) — shared vectors + rules validation + MCP decision
- **P3-2 เสร็จ** (`c9c7ae7`) — `verifyClaims`/`citationBlock` + verification record + proof loop
- **P3-1 เสร็จ** (`5a7d37b`) — `validateProvenance` + `rules.provenance` warnings + `decision.provenance`
- เหลือ **P3-3** (release v1.0 + case study — ต้องมีเจ้าของร่วม: publish + เนื้อหา) และ
  **P3-4** (รอ trigger) — สถานะเต็มดู [`project-plan.md`](project-plan.md) §0

## จุดที่ค้างอยู่ (ณ 2026-07-10)

- **Phase 0 + Phase 1 เสร็จแล้ว**: v0.2.0 ออกทั้ง npm (`evidence-gate`) + PyPI
  (`evidence-gate-py`) พร้อม decision log (`evidence-gate.decision/1`).
- เหลือ **P1-4 launch** (งานเจ้าของ — โพสต์เอง, ร่างพร้อมแล้ว) และ **P0-2 badge**
  (เล็ก) — ไม่บล็อก Phase 3.
- **main** อยู่ที่ release point, tag `v0.2.0` ชี้ commit ที่ถูกต้อง.

## กติกาเหล็ก (ห้ามข้าม — Definition of Done ทุก task)

1. ทุก behavior change ต้องมีทั้ง **JS (`src/`) + Python (`python/`)** และ **เทสต์ทั้งสองฝั่ง**.
2. Logic ต้องตรงกัน **byte-for-byte** ข้ามสองพอร์ต — โดยเฉพาะ regex, digest (FNV-1a 64),
   การ split ประโยค, ลำดับ verdict. ล็อกด้วย shared test vector.
3. **core zero-dependency เสมอ** — ของใหม่ที่มี dependency = แยก package.
4. docs อัปเดต (README + example ที่รันได้จริง).
5. **Packaging**: ถ้าแก้ root `README.md` ต้อง `cp README.md python/README.md` ก่อน publish
   (build PyPI แบบ isolated อ่าน root ไม่ได้ — ดู CONTRIBUTING §Releasing).

## ลำดับงาน (ทำตามนี้ ห้ามสลับ)

### 0. WP2 — ทำก่อนเป็นฐาน (~1 AI-day)
- `test/vectors.json` — shared test vectors ที่ทั้ง `test/*.mjs` และ `python/tests/test_core.py` โหลดร่วมกัน
- validate rules ตอนเรียก `evidenceGate()` — ปิด divergence เดิม (JS เงียบ ๆ ถือว่า fresh vs Python โยน KeyError) ให้ทั้งสองพอร์ตทำเหมือนกัน
- ส่ง `decision` ผ่าน MCP `check_evidence` (ตอนนี้ยังไม่ส่งผ่าน)

### 1. P3-2 — Claim verification (`verifyClaims`) — ตัวเอก/moat (~5 AI-days)
- spec: [`docs/design/claim-verification.md`](design/claim-verification.md) — **approved**, open questions ปิดครบแล้ว (#8)
- implement plan §11:
  1. marker grammar `\[ev:([A-Za-z0-9_.-]+)\]` + `citationBlock()` + resolution (id → index)
  2. sentence split + claim detection (`\d`, `%|\$|€|£|฿`) + verdict ladder (`phantom` → `no_citations` → `unsupported` → `supported`)
  3. gate cross-checks (`verify_stale_framing` ฯลฯ) + messages overrides
  4. verification record `evidence-gate.verification/1` + digest-join กับ decision + `examples/verified-loop.mjs`
  5. README "The proof loop"
- default: `requireFullCoverage: true`, grammar เดียว (`[ev:…]`), `supporting` citable แต่ tag `tier`

### 2. P3-1 — Provenance (~4 AI-days)
- spec: [`docs/design/provenance.md`](design/provenance.md) — **approved** (#8)
- implement plan §8: `validateProvenance` + chain rules → `rules.provenance` warnings + attribution caveat → `decision.provenance` block + digest → example (`node:crypto`/`hashlib`) + README
- scope cut v1: provenance warning **ไม่เปลี่ยน** `status`/`allowedActions` (แค่เพิ่ม caveat)

### 3. P3-3 — Release v1.0 + case study (~1 AI-day)
### 4. P3-4 — Dashboard self-host — **เฉพาะเมื่อถึง trigger** (ผู้ใช้จริง ≥10 หรือมีคนขอ ≥3)

## ทำไมงานนี้เหมาะกับ Fable วางแผน

จุดยากไม่ใช่โค้ด แต่คือ **cross-port determinism** — regex, FNV-1a digest, การ split ประโยค,
ลำดับ verdict ต้องเหมือนกันเป๊ะทั้ง JS/Py ไม่งั้น audit trail พัง. Spec ปิดหมดแล้ว
งานคือแปลง spec → implementation ที่สองพอร์ตตรงกัน + เทสต์ vector ล็อกไว้.

## วิธีเริ่ม session ใหม่

1. เปิด session ใหม่ เลือกโมเดล **Fable 5** (`claude-fable-5`)
2. แตก branch ใหม่จาก main (อย่าใช้ branch เดิมที่ merge แล้ว) เช่น `claude/phase3-wp2-verify`
3. Prompt เริ่ม: *"อ่าน docs/phase3-kickoff.md แล้วเริ่ม Phase 3 ตามลำดับ เริ่มที่ WP2 (test/vectors.json + rules validation + decision ผ่าน MCP) ทำ JS+Py+เทสต์ให้ครบตาม DoD"*

## อ้างอิง
- แผนเต็ม: [`docs/project-plan.md`](project-plan.md) (Phase 3 = §4)
- Umbrella issue: #8 · Tracking: #9
