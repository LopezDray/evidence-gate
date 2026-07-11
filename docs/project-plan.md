# Evidence Gate — Project Plan (Solo + Claude Code)

> แผนงานละเอียดสำหรับพัฒนา Evidence Gate จาก library v0.1.0 ไปสู่
> **"verifiable evidence layer สำหรับ AI"** — ทำงานแบบ solo founder + Claude Code
> (cash cost ≈ ค่า subscription รายเดือน) เติบโตตาม signal จริง ไม่ overbuild
>
> Tracking: GitHub Issues ของ repo นี้ (แต่ละ task ในแผนมี issue คู่กัน)

---

## 0. สถานะล่าสุด (2026-07-11)

| งาน | สถานะ |
|---|---|
| P0-1 PyPI name collision | ✅ เสร็จ — publish `evidence-gate-py` แล้ว, repo + README ตรงกัน (README เตือนว่า import ยังเป็น `from evidence_gate import ...`) |
| P0-2 CI + badge | ✅ เสร็จ — workflow รันครบทุก suite + README badges (test/npm/PyPI/license) (#2) |
| P1-1 Decision log / audit trail | ✅ เสร็จ + ซ่อม null-records crash และ align สองพอร์ต (#3) |
| P1-2 Release v0.2.0 | ✅ เสร็จ — npm `evidence-gate@0.2.0` + PyPI `evidence-gate-py@0.2.0`, CHANGELOG, merge เข้า main, tag `v0.2.0` → `662a832` (#4) |
| P1-4 Launch | 📝 ร่างโพสต์ Show HN / Reddit (r/LocalLLaMA, r/RAG) / X พร้อมแล้ว — รอเจ้าของโพสต์ + ตอบคอมเมนต์ 48 ชม. (#6) |
| WP2 test vectors + rules validation + MCP decision | ✅ เสร็จ (2026-07-11) — `test/vectors.json` ใช้ร่วมสองพอร์ต, `validateRules`/`validate_rules` ปิด divergence JS-เงียบ vs Py-KeyError, MCP `check_evidence` รับ `decision` — commit `20001c4` |
| P3-2 verifyClaims — claim verification | ✅ เสร็จ (2026-07-11) — `verifyClaims`/`citationBlock` + verdict ladder + `evidence-gate.verification/1` digest-join กับ decision log, `examples/verified-loop.mjs`, README "The proof loop" — commit `c9c7ae7` |
| P3-1 Provenance | ✅ เสร็จ (2026-07-11) — `validateProvenance` chain rules + `rules.provenance` warnings + attribution caveat + `decision.provenance` block (digest replay ได้), `examples/provenance.mjs` — commit `5a7d37b` |
| Logic review รอบ Fable 5 | ✅ เจอ+ซ่อมบั๊ก 3 จุด, พบ divergence เดิม 1 จุด (rules validation) และช่องว่าง spec 6 ข้อ — ปิดหมดแล้วใน WP2/P3-1/P3-2 (vectors จับ divergence เพิ่มได้อีก 4 จุดระหว่างทาง: Python `{}` rules falsy ×2, JS `forbiddenActions: null` crash, Python explicit-`None` optional fields) |
| Tamper-evident decision chain | ✅ เสร็จ (2026-07-11) — `chainDecision`/`verifyDecisionChain` (+Python), `prev` additive (schema ยัง /1), vectors `decisionChain` ล็อกสองพอร์ต, `examples/tamper-evident-log.mjs` — provenance.md §7 implemented |
| **P3-3 Release v1.0** | 🚀 โค้ด+version(1.0.0)+docs อยู่บน main แล้ว (PR #14, `f681773`) — **ติดเจ้าของ**: publish npm/PyPI + tag `v1.0.0` + เติม case study (`release-checklist.md` ข้อ 8-11) |

**Phase 3 implementation ปิดครบ** (gate + verifyClaims + provenance + tamper-evident chain).
งานหลักถัดไป = **fact cross-checking** (Fable) ดู [`docs/fable-fact-checking-kickoff.md`](fable-fact-checking-kickoff.md)

**Phase 3 implement ครบสามงานหลักแล้ว (WP2 → P3-2 → P3-1)** — เหลือ **P3-3 release v1.0 + case study**
(รอเจ้าของ: publish npm/PyPI + เนื้อหา case study) และ **P3-4 dashboard** (ยังไม่ถึง trigger:
ผู้ใช้จริง ≥10 หรือมีคนขอ ≥3) — ดู [`docs/phase3-kickoff.md`](phase3-kickoff.md)

**งานจากผลรีวิว (ปิดแล้ว):**

| ID | งาน | สถานะ |
|---|---|---|
| WP1 | ปิด open questions ทั้งหมดของสอง design docs + spec gaps จากรีวิว (supporting ใน verifyClaims, provenance digest placeholder, กติกา attribution เดียว, ห้าม id ตัวเลขล้วน, 0-based index) | ✅ อนุมัติใน #8 (2026-07-02) — design docs อัปเดตเป็น approved พร้อม resolutions ครบใน §12/§9 ของแต่ละ doc |
| WP2 | Shared test vectors (`test/vectors.json` ใช้ร่วมสองพอร์ต), validate rules ตอนเรียก (แก้ JS เงียบ-fresh vs Py KeyError), ส่ง `decision` ผ่าน MCP `check_evidence` | ✅ เสร็จ — commit `20001c4` |

## 1. วิสัยทัศน์และจุดยืน

**ปัญหา**: ทุกวันนี้ AI ตอบโดยมีแค่ "ref" — ลิงก์อ้างอิง — แต่ไม่มี**การพิสูจน์เชิงข้อมูล**ว่า
หลักฐานที่ใช้ตอบนั้น ครบ, สด, มีคุณภาพพอ, และมาจากแหล่งที่เชื่อถือได้จริงหรือไม่
ผู้ใช้แยกไม่ออกระหว่างคำตอบที่ grounded กับคำตอบที่โมเดลแต่งขึ้นทั้งที่มี ref ประกอบ

**เดิมพันอนาคต**: องค์กรและภาครัฐจะสร้าง AI ของตัวเองบนข้อมูลของตัวเอง (sovereign AI)
เพราะไม่ต้องการส่งข้อมูลให้ frontier model — สภาพแวดล้อมแบบนั้นต้องการชั้นตรวจหลักฐานที่:

- รันในเครื่อง / air-gapped ได้ (Evidence Gate: pure logic, zero dependency ✓)
- ไม่ผูกกับโมเดลค่ายไหน (✓ ทำงานก่อน LLM ถูกเรียกด้วยซ้ำ)
- ให้ audit trail ที่ตรวจสอบย้อนหลังได้ (→ สิ่งที่จะสร้างใน Phase 1)

**จุดยืน**: ไม่ใช่การเป็น Palantir — แต่เป็น "ชิ้นส่วน data trust สำหรับ AI"
แบบ bottom-up, open-source, ติดตั้งได้ใน 5 นาที

## 2. โหมดการทำงานและกฏประเมิน

- ทีม: เจ้าของโปรเจค 1 คน + Claude Code (Max plan)
- **Cash cost**: ค่า subscription ~3,500–7,200 ฿/เดือน + โดเมน/เพจ ~500 ฿/เดือน
- **Effort** วัดเป็น 2 หน่วย: `AI-days` (เวลาที่ Claude Code ใช้พัฒนา ถ้าเทียบเป็นวันงาน dev)
  และ `review-hrs` (ชั่วโมงที่เจ้าของต้องรีวิว/ตัดสินใจ/ทดสอบเอง — คอขวดจริง)
- **Definition of Done ทุก task** (ตาม CONTRIBUTING.md): logic เหมือนกันทั้ง JS และ Python port,
  มีเทสต์ทั้งสองฝั่ง, docs อัปเดต, core ยังคง zero-dependency
- **Priority**: P0 ทำทันที / P1 ทำเมื่อ P0 เสร็จ / P2 ทำเมื่อถึง trigger ที่กำหนด

## 3. North-star metrics และ decision triggers

| Metric | เป้า 3 เดือน | เป้า 6 เดือน |
|---|---|---|
| npm weekly downloads | 100+ | 500+ |
| GitHub stars | 100+ | 500+ |
| Issue/PR จากคนนอก | 3+ | 15+ |
| ผู้ใช้จริงที่คุยด้วยได้ | 5 คน | 20 คน |

**Triggers** (ยังไม่ถึง = ยังไม่ทำ):
- Dashboard / hosted service → เมื่อมีผู้ใช้จริง ≥10 ราย หรือมีคนขอ ≥3 ครั้ง
- Enterprise tier (SSO/RBAC/compliance report) → เมื่อมีองค์กรถามหาเรื่อง audit/compliance จริง ≥2 ราย
- Ontology layer → เมื่อ provenance ถูกใช้จริงและผู้ใช้ชนข้อจำกัด

## 4. แผนงานราย Phase

### Phase 0 — ซ่อมฐานราก (สัปดาห์ที่ 1)

| ID | งาน | Acceptance criteria | Priority | Effort | Cash |
|---|---|---|---|---|---|
| P0-1 | แก้ปัญหาชื่อ PyPI ชนกับแพ็กเกจคนอื่น (`evidence-gate` บน PyPI เป็นของ blazingRadar) — เลือกชื่อใหม่ เช่น `evidence-gate-py` อัปเดต pyproject + README | `pip install <ชื่อใหม่>` ติดตั้งของเราได้จริง README ไม่ชี้ไปแพ็กเกจคนอื่น | P0 | 0.5 AI-day / 1 review-hr | 0 |
| P0-2 | ตั้ง CI (GitHub Actions) รันเทสต์ JS + Python ทุก PR | badge เขียวบน README, PR ที่เทสต์พังถูก block | P0 | 0.5 AI-day / 0.5 review-hr | 0 |
| P0-3 | นิยาม metric baseline — จด stars/downloads วันนี้ไว้ใน issue tracking | มี tracking issue อัปเดตรายสัปดาห์ | P0 | 0.1 AI-day / 0.5 review-hr | 0 |

### Phase 1 — Decision log + เปิดตัว (เดือนที่ 1)

| ID | งาน | Acceptance criteria | Priority | Effort | Cash |
|---|---|---|---|---|---|
| P1-1 | **Decision log / audit trail** — ทุกการเรียก `evidenceGate()` สร้าง decision record (input digest, ruleset, status, warnings, timestamp ที่ผู้เรียกส่งเข้ามา) แบบ opt-in, serialize เป็น JSONL ได้; core ยังคง pure (ไม่เขียนไฟล์เอง — คืน object ให้แอปเก็บ) | มีทั้ง JS+Py, เทสต์ครอบ, example การเก็บ log ลงไฟล์/DB, docs อธิบาย use case audit | P0 | 3 AI-days / 4 review-hrs | 0 |
| P1-2 | ปล่อย v0.2.0 — npm + PyPI (ชื่อใหม่จาก P0-1) พร้อม CHANGELOG | ติดตั้งได้จริงทั้งสองฝั่ง, tag v0.2.0 | P0 | 0.5 AI-day / 1 review-hr | 0 |
| P1-3 | ขัด docs site (`docs/index.html` → GitHub Pages) + demo GIF + ตัวอย่าง "with gate vs without gate" | หน้าเว็บอธิบายจบใน 1 หน้าจอ มี demo เห็นภาพ | P1 | 1 AI-day / 2 review-hrs | ~500 ฿ (โดเมน ถ้าต้องการ) |
| P1-4 | **เปิดตัว** — ร่างโพสต์ Show HN / Reddit (r/LocalLLaMA, r/RAG) / X โดยชูมุม "refs ≠ proof" และ sovereign AI | โพสต์ออกจริง ≥3 ช่องทาง เจ้าของตอบคอมเมนต์เอง 48 ชม.แรก | P0 | 0.5 AI-day / 6 review-hrs | 0 |

### Phase 2 — ลดแรงเสียดทาน ตามเสียงผู้ใช้ (เดือนที่ 2–3)

| ID | งาน | Acceptance criteria | Priority | Effort | Cash |
|---|---|---|---|---|---|
| P2-1 | Middleware: Vercel AI SDK + LangChain/LlamaIndex callback (แยก package, core ไม่แตะ) | ใส่ gate ได้ใน ≤3 บรรทัดต่อ framework, มี example รันได้ | P1 | 4 AI-days / 5 review-hrs | 0 |
| P2-2 | Adapters: SQL rows / vector-store hits (pgvector, Pinecone shape) → records | adapter package + เทสต์, README สั้นต่อ adapter | P1 | 3 AI-days / 3 review-hrs | 0 |
| P2-3 | Presets ใหม่ (LEGAL, INSURANCE) + preset validator + template สำหรับ community PR | validator จับ preset ผิดรูป, มี CONTRIBUTING section ชวนส่ง preset | P1 | 1.5 AI-days / 2 review-hrs | 0 |
| P2-4 | เก็บ feedback รอบเปิดตัว → จัดลำดับ backlog ใหม่ | สรุปใน tracking issue, ปรับแผน Phase 3 | P1 | – / 3 review-hrs | 0 |

### Phase 3 — สร้าง moat: จาก "ref" สู่ "proof" (เดือนที่ 4–6)

| ID | งาน | Acceptance criteria | Priority | Effort | Cash |
|---|---|---|---|---|---|
| P3-1 | **Evidence provenance** — record ระบุ source chain + content hash; gate รายงานได้ว่าหลักฐานแต่ละชิ้นมาจากไหน ผ่านการแปลงอะไรมา | schema provenance ใน record, caveat อ้าง source ได้, JS+Py+เทสต์ | P1 | 5 AI-days / 6 review-hrs | 0 |
| P3-2 | **Post-generation claim verification** — เช็คว่าคำตอบของ LLM อ้างอิง record ที่มีอยู่จริง (ปิด loop: gate ก่อน + verify หลัง) | API `verifyClaims(answer, records)`, เทสต์กรณีอ้างมั่ว/อ้างถูก, example | P1 | 5 AI-days / 6 review-hrs | 0 |
| P3-3 | ปล่อย v1.0 + เขียน case study การใช้จริง 1 ชิ้น | v1.0 บน npm/PyPI, case study บน docs site | P1 | 1 AI-day / 4 review-hrs | 0 |
| P3-4 | (ถ้าถึง trigger) Dashboard self-host แสดง decision log | dashboard อ่าน JSONL แสดง refusal rate / staleness | P2 | 6 AI-days / 6 review-hrs | infra ~2,000 ฿/เดือน |

## 5. จังหวะการทำงาน (operating rhythm)

- **รายสัปดาห์**: 1 เซสชัน Claude Code เพื่อดันงาน + อัปเดต tracking issue (metrics, งานเสร็จ, งานถัดไป)
- **ราย Phase**: รีวิวกับ trigger ในข้อ 3 — ถึงค่อยไปต่อ ไม่ถึงก็ปรับ
- **กฏเหล็ก**: ไม่เริ่ม P2/P3 item ก่อน P0/P1 ของ phase นั้นปิด และไม่สร้างของที่ยังไม่มี trigger รองรับ

## 6. ความเสี่ยงหลัก

| ความเสี่ยง | ทางกัน |
|---|---|
| เปิดตัวแล้วเงียบ | มุมชูต้องแคบและเจ็บจริง ("refs ≠ proof"), ตอบทุกคอมเมนต์, ลองซ้ำ ≥2 ช่องทาง ก่อนสรุปว่าไม่เวิร์ค |
| ถูกโปรเจคใหญ่ (guardrails framework) ทำฟีเจอร์ทับ | ยึดความแคบ+ลึก: decision log / provenance / claim verify คือของที่เขาไม่โฟกัส |
| เวลาเจ้าของไม่พอ | ทุก task ระบุ review-hrs ไว้แล้ว — จัดสัปดาห์ละ ~5 ชม. พอขับเคลื่อน Phase ตามแผน |
| PyPI ชื่อชน (เกิดแล้ว) | P0-1 แก้ก่อนเปิดตัว |
