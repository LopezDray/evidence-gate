# CLAUDE.md — กฎบังคับของ evidence-gate (อ่านก่อนแตะโค้ดทุกครั้ง)

Evidence Gate = zero-dependency library (npm `evidence-gate` + PyPI `evidence-gate-py`)
สองพอร์ต JS (`src/`) + Python (`python/`) ที่ logic ต้องตรงกัน **byte-for-byte**
เพราะ audit trail (digest) ข้ามพอร์ตคือ product หลัก — ความเหมือนคือฟีเจอร์ ไม่ใช่ nice-to-have

## กฎเหล็ก (ห้ามข้าม — ทุกข้อเคยมีบั๊กจริงหรือเป็นเส้นตายของ product)

1. **ทุก behavior change = แก้ทั้งสองพอร์ต + เทสต์ทั้งสองฝั่ง + shared vector**
   แตะ `src/core.js` แล้วไม่แตะ `python/evidence_gate/core.py` (หรือกลับกัน) = งานยังไม่เสร็จ
   อ่าน `.claude/skills/cross-port-parity.md` ก่อนเขียน — กับดัก JS↔Py มีลิสต์ไว้แล้วจากบั๊กจริง
2. **ห้ามแก้ค่า expected ใน `test/vectors.json` เพื่อให้พอร์ตเดียวผ่าน**
   vectors แดงข้างเดียว = เจอ divergence จริง → แก้พอร์ตที่ผิด ไม่ใช่แก้ vector
3. **core zero-dependency เสมอ** — no network, no file I/O, no hashing ในตัว core
   ของใหม่ที่ต้องมี dependency = แยก package/adapter
4. **ก่อนรายงานว่า "เสร็จ" ต้อง verify จริง** ตาม `.claude/skills/verify-playbook.md`
   (สองพอร์ต + vectors + examples ที่เกี่ยว) — อะไรเช็คเองไม่ได้ให้บอกตรงๆ ห้ามอ้างว่าเช็คแล้ว
5. **ห้ามทำเงียบ: publish npm/PyPI, `git tag`, push ตรงเข้า `main`** — ต้องให้เจ้าของเคาะ
   (branch งานของตัวเอง push ได้เลย) — เส้นแดงทั้งหมดดู `.claude/skills/model-handoff.md`
6. **เช็คก่อนสร้าง**: อ่าน `.claude/memory/pending_sessions.md` + `completed_features.md`
   ก่อนเริ่มทุกงาน — ห้าม rebuild ของที่เสร็จแล้ว
7. **แก้ root `README.md` → `cp README.md python/README.md` ทันที** (PyPI build แบบ isolated
   อ่าน root ไม่ได้ — ดู CONTRIBUTING §Releasing)
8. **decision/verification record schema = additive versioning**: เพิ่ม optional field ไม่ bump
   `/1`; ลบ/เปลี่ยนชื่อ field = bump เป็น `/2` — consumers must ignore unknown fields
9. **เรียนรู้อะไร reusable → เขียนลง `.claude/skills/` ทันที** ใน commit เดียวกับงานนั้น
   (skill = วิธีทำ · memory = สถานะ · ห้ามปน) และจบ session ให้อัปเดต memory 2 ไฟล์ + commit
10. **Release ต้องเดินตาม `.claude/skills/release-checklist.md` ทีละข้อ** — จุด bump version
    มี 4 ที่ พลาดง่าย (เคย stale มาแล้ว)

## แผนที่ (อ่านเมื่อจำโปรเจกต์ไม่ได้)

- ทำไม + แผนเต็ม: `docs/project-plan.md` (§0 = สถานะล่าสุด)
- specs ที่ approved: `docs/design/claim-verification.md`, `docs/design/provenance.md`
- Umbrella issue: #8 · กติกา contributor ภายนอก: `CONTRIBUTING.md`
- โครง: `src/` + `python/evidence_gate/` (สองพอร์ต) · `test/` + `python/tests/` (เทสต์)
  · `test/vectors.json` (ตัวล็อกสองพอร์ต) · `mcp/server.mjs` (MCP tool) · `examples/` (ต้องรันได้จริง)
