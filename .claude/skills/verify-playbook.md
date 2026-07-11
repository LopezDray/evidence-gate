# Skill: Verify playbook — "เสร็จ" นิยามด้วยการรันจริง ไม่ใช่การอ่านโค้ดเอง

> รันก่อนรายงานว่าเสร็จทุกครั้ง · อะไร verify เองไม่ได้ (เช่น publish จริง, การใช้งานใน
> DaddyInvestor) ให้บอกเจ้าของตรงๆ ห้ามอ้างว่าเช็คแล้ว

## คำสั่งหลัก

```bash
npm test                          # JS ทั้ง 5 suite: core, edge, decision, verify, vectors
python3 python/tests/test_core.py # Python ทั้งหมด (รวม shared vectors — ไม่ต้องมี pytest)
```

CI (`.github/workflows/test.yml`) รันสองคำสั่งนี้ทุก push เข้า `main` + ทุก PR
— MCP test กับ examples **ไม่อยู่ใน CI** ต้องรันเองเมื่อแตะไฟล์ที่เกี่ยว

## ตาราง: แตะไฟล์ไหน → ต้องรันอะไร

| ไฟล์ที่แก้ | ต้องรัน |
|---|---|
| `src/core.js` / `python/evidence_gate/core.py` | ทั้งสองคำสั่งหลัก + `node examples/decision-log.mjs` + `node examples/provenance.mjs` |
| `src/verify.js` / `python/evidence_gate/verify.py` | ทั้งสองคำสั่งหลัก + `node examples/verified-loop.mjs` |
| `test/vectors.json` | ทั้งสองคำสั่งหลัก (สองพอร์ตต้องเขียวพร้อมกัน — ห้ามเขียวข้างเดียว) |
| `mcp/server.mjs` | `npm i --no-save @modelcontextprotocol/sdk && node test/mcp.test.mjs` (SDK เป็น optional peer — ไม่ได้ติดตั้งไว้) |
| `src/presets.js` / `presets.py` | ทั้งสองคำสั่งหลัก (presets ต้อง field ครบตาม `validateRules` ไม่งั้นระเบิดตอนเรียก) |
| `README.md` | `cp README.md python/README.md` แล้วเช็คว่า code block ใน README ยังตรง API จริง |
| `examples/*.mjs` | รันไฟล์นั้นตรงๆ — example ที่รันไม่ได้ = docs โกหก |
| `package.json` / `pyproject.toml` / `__init__.py` | ดู `release-checklist.md` §จุด version |

## หมายเหตุ environment

- examples บางตัวเขียนไฟล์ log (`examples/*.jsonl`) — ถูก gitignore แล้ว แต่อย่า commit ถ้าหลุดมา
- Python ต้อง ≥3.8 (ตาม pyproject) — อย่าใช้ syntax ใหม่กว่านั้นใน `evidence_gate/`
- เทสต์ Python รันแบบ standalone script ได้ (`__main__` block) — **ฟังก์ชันเทสต์ใหม่ต้อง
  ลงทะเบียนใน `__main__` ด้วย** ไม่งั้น CI ไม่รันมันเลย (CI ไม่ใช้ pytest)
- เทสต์ freshness ที่ deterministic: ใช้ `staleDays` ใหญ่มาก (1000000) = fresh เสมอ /
  วันเก่ามาก + `staleDays` เล็ก = stale เสมอ — ห้ามผูกกับวันที่ปัจจุบัน

## นิยาม "verify แล้ว" สำหรับรายงานผล

1. คำสั่งหลักทั้งสองเขียว (paste ตัวเลข `N passed, 0 failed` ได้)
2. examples ที่เกี่ยวรันจบไม่ error
3. ถ้าแตะ MCP: mcp.test.mjs ผ่าน
4. อะไรที่ยังไม่ได้รัน/รันไม่ได้ ระบุชัดในรายงาน
