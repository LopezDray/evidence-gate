# Skill: Model handoff — เส้นแดง + สัญญาณหลงทาง (ทุก session ทุกโมเดล อ่านก่อนรับงาน)

> โปรเจกต์นี้สลับโมเดลบ่อย (Fable ↔ Opus ↔ Sonnet) — ไฟล์นี้คือสัญญาใจร่วมกัน
> ทุกข้ออ้างไฟล์/คำสั่งจริง ไม่มีคำสั่งลอยๆ แบบ "จงระมัดระวัง"

## เส้นแดง — ห้ามทำเงียบ ต้องให้เจ้าของเคาะก่อนเสมอ

| # | ห้าม | เพราะ | ที่เกี่ยว |
|---|---|---|---|
| 1 | `npm publish` / `twine upload` / `git tag v*` | ของ irreversible ออกสู่ registry สาธารณะ ลบไม่ได้จริง | `release-checklist.md` ข้อ 8-11 |
| 2 | push ตรงเข้า `main` / merge PR เอง | เจ้าของ review ก่อน main เสมอ (เว้นแต่สั่งชัดเจนใน turn นั้น) | branch งานตัวเอง push ได้ปกติ |
| 3 | แก้ค่า expected ใน `test/vectors.json` เพื่อดับไฟเทสต์พอร์ตเดียว | นั่นคือการลบหลักฐาน divergence — ตัว product คือความตรงกันข้ามพอร์ต | header ของ vectors.json เขียนห้ามไว้แล้ว |
| 4 | เพิ่ม dependency ใน core (`src/`, `python/evidence_gate/`) | zero-dep คือจุดยืน — มี dep = แยก package | `CONTRIBUTING.md` |
| 5 | ลบ/เปลี่ยนชื่อ field ใน decision/verification record โดยไม่ bump schema `/1`→`/2` | consumers parse log เก่าอยู่ — additive versioning policy | `docs/design/provenance.md` §5 |
| 6 | แก้พอร์ตเดียวแล้วรายงานเสร็จ | งานครึ่งเดียว = divergence รอระเบิด | `cross-port-parity.md` |
| 7 | publish ชื่อ `evidence-gate` บน PyPI | ชื่อนั้นเป็น package คนอื่น — ของเราคือ `evidence-gate-py` | `release-checklist.md` |

## สัญญาณว่ากำลังหลงทาง — หยุด แล้วถามหรือถอยกลับ

- เทสต์ vectors **แดงข้างเดียว** แล้วเริ่มอยากแก้ vector/harness แทนโค้ด → นั่นแหละ divergence จริง กลับไปอ่าน `cross-port-parity.md` ตาราง #1-8
- อยากใส่ `if (isPython)` / behavior แตกต่างต่อพอร์ต "ชั่วคราว" → ไม่มีชั่วคราวใน audit trail
- แก้ `core.js`/`core.py` แล้วเทสต์เดิม (ไม่ใช่เทสต์ใหม่) เริ่มแดง → เช็คว่ากำลัง break public API หรือเปล่า ก่อนจะ "ซ่อม" เทสต์
- อยากเพิ่ม field ใหม่ใน gate result/record โดย spec ไม่ได้สั่ง → เช็ค `docs/design/*.md` ก่อน มี design doc approved อยู่แล้วสำหรับเกือบทุกอย่าง
- ไม่แน่ใจว่างานนี้เคยทำแล้วหรือยัง → `.claude/memory/completed_features.md` + `git log --oneline -20` ก่อนเขียนสักบรรทัด

## การแบ่งงานตามโมเดล (แนวทาง ไม่ใช่กฎ)

- **งานตามสเปคที่ approved แล้ว** (implement ตาม design doc, เพิ่มเทสต์, แก้บั๊กมี repro):
  โมเดลไหนก็ทำได้ — ยึด playbook + vectors เป็นตาข่าย
- **งานออกแบบ/ตัดสินใจ trade-off** (spec ใหม่, เปลี่ยน API, resolve open questions):
  ใช้โมเดลใหญ่ + สรุปข้อสรุปลง design doc ก่อน implement เสมอ
- ทุกโมเดล: จบ session อัปเดต `.claude/memory/` แล้ว commit — session ถัดไปอาจเป็นคนละโมเดล
