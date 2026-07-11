# Skill: Cross-port parity — เขียน JS + Python ให้ตรงกัน byte-for-byte

> อ่านก่อนแตะ `src/*.js` หรือ `python/evidence_gate/*.py` ทุกครั้ง
> ทุกข้อในตารางนี้คือบั๊กจริงที่เคยเกิด (Phase 3, 2026-07-11) ไม่ใช่ทฤษฎี

## กับดัก JS ↔ Python (เรียงตามที่เจอบ่อย)

| # | กับดัก | JS | Python | วิธีที่ถูก |
|---|---|---|---|---|
| 1 | **`{}` truthiness** | `if (obj)` → `{}` = truthy | `if obj:` → `{}` = falsy | Python ใช้ `is not None` เสมอเมื่อเทียบ opt-in object (บั๊กจริง 2 ครั้ง: `validate_rules` rules=`{}`, `rules["provenance"]={}`) |
| 2 | **default ไม่ครอบ null/None** | default param (`x = []`) ครอบเฉพาะ `undefined` ไม่ครอบ `null` | `dict.get(k, default)` ไม่ครอบ explicit `None` | JS ใช้ `x \|\| []` · Python ใช้ `x or []` / เช็ค `is None` (บั๊กจริง: `deriveAllowedActions` crash กับ `forbiddenActions: null`; Python `messages=None` diverge) |
| 3 | **regex `\d` `\b` `\w`** | ASCII เสมอ (`\d` = [0-9]) | unicode by default (`\d` จับเลขไทย ๑๒ ด้วย!) | Python compile ด้วย `re.ASCII` (ดู `verify.py`) — ต้องการเลขไทยให้ใช้ explicit class `[๐-๙]` + ตารางแปลง ๐-๙→0-9 (fact-check §8 ทำแบบนี้) ห้ามพึ่ง unicode `\d` |
| 4 | **`\s` / trim / split** | `\s` และ `trim()` รวม unicode whitespace คนละชุดกับ Python | `\s` / `strip()` ต่างจาก JS ที่ขอบ (﻿ ฯลฯ) | partition ที่ต้อง byte-identical ให้ใช้ explicit class `[ \t]` + strip `" \t\r\f\v"` (ดู `splitSentences` / `_split_sentences`) |
| 5 | **ตัวเลข float** | ไม่มี int/float แยก — `92.0` คือ `92` → `"92"` | `92.0` → `"92.0"` | ค่าที่จะเข้า digest/string ที่ล็อกข้ามพอร์ต: ใช้ int หรือ float ที่มีทศนิยมจริง ห้าม `x.0` · format ตัวเลขผ่าน `canonicalJson`/`canonical_json` |
| 6 | **key naming ต่างพอร์ต** | `qualityScore`, `staleDays`, `retrievedAt`, `contentHash`, `inputHash/outputHash`, `requireFullCoverage`, `brokenChains` | `quality_score`, `stale_days`, `retrieved_at`, `content_hash`, `input_hash/output_hash`, `require_full_coverage`, `broken_chains` | digest ที่จะล็อกข้ามพอร์ตต้องมาจากโครงสร้างที่ใช้เฉพาะ **key กลาง** เท่านั้น: `date, tier, flags, quality, id, source, type, authority, chain, step, tool, at, records, supporting` |
| 7 | **error type/message** | `throw new Error(\`caller: rules.field ...\`)` | `raise ValueError(f'caller: rules["field"] ...')` | ข้อความเหมือนกันยกเว้นรูปแบบ key ต่อพอร์ต — vectors เก็บ `errorField` เป็น camelCase แล้ว harness Python แปลงเอง (dotted path ได้: `provenance.minAuthority`) |
| 8 | **การเข้าถึง key ที่ไม่มี** | `r.provenance.source` บน string → `undefined` เฉยๆ | `r["provenance"].get(...)` บน string → `AttributeError`! | Python guard ด้วย `isinstance(x, dict)` ทุกครั้งที่ JS พึ่ง "undefined ไหลผ่าน" |
| 9 | **scale เลขด้วย 10^n** | `1.2 * 1e6` = `1199999.9999999998` (IEEE-754) | เหมือนกันเป๊ะ — พังพร้อมกันสองพอร์ต | ห้ามคูณ float กับ power of ten เมื่อผลต้อง exact: เลื่อนจุดทศนิยมบน **string** แล้ว parse ครั้งเดียว (`_token_value` / `tokenValue` ใน verify) — string→double correctly rounded เหมือนกันสองพอร์ต · vector `fact-suffix-exact-no-float-multiply` ล็อกไว้ |

## Workflow มาตรฐานเวลาเพิ่ม behavior ใหม่ (ทำตามลำดับ ห้ามสลับ)

1. implement **JS ก่อน** (`src/`) → เขียน scratch script คำนวณ expected values
   (digest, canonical strings, ผลลัพธ์เต็ม) จาก JS จริง — ใช้ scratchpad ไม่ commit
2. **hand-write** เคสลง `test/vectors.json` section ที่เกี่ยว โดยเอาค่าจาก (1)
   — status/warnings/caveats เขียนจากความเข้าใจ spec ไม่ใช่ copy ผลลัพธ์มั่วๆ
3. อัปเดต harness **สองฝั่ง** ถ้าเพิ่ม section ใหม่:
   - JS: `test/vectors.test.mjs`
   - Python: `python/tests/test_core.py` — key maps อยู่บนสุดของไฟล์
     (`RULES_KEY_MAP`, `RECORD_KEY_MAP`, `VERIFICATION_KEY_MAP`, `PROVENANCE_KEY_MAP`,
     `CHAIN_KEY_MAP` + helpers `_map_record` / `_map_rules`)
4. port ไป Python → รัน `python3 python/tests/test_core.py`
   **โดยไม่แตะ expected values** — ถ้าแดง แปลว่าพอร์ตเบี่ยง แก้โค้ด Python (หรือ JS ถ้า JS ผิด spec)
5. รันครบตาม verify-playbook แล้วค่อยรายงานเสร็จ

## เส้นแดงของไฟล์ vectors

- `test/vectors.json` มี comment header เขียนไว้แล้ว: *"Do not edit expected values to
  make a port pass — a mismatch here means the ports have diverged."* — ถือเป็นกฎเหล็ก
- vectors จับ divergence จริงมาแล้ว 4 ตัวในวันเดียว (ดูตาราง #1, #2) — มันทำงาน อย่า bypass

## สถานที่จริงของ pattern ตัวอย่าง

- validation + error ตรงกัน: `validateRules` (`src/core.js`) ↔ `validate_rules` (`core.py`)
- regex + sentence split ตรงกัน: `src/verify.js` ↔ `python/evidence_gate/verify.py`
- timestamp default ตรงกัน: `datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00","Z")` ↔ `new Date().toISOString()`
