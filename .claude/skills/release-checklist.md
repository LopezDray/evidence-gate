# Skill: Release checklist — ลำดับออก release ห้ามข้ามข้อ

> การ publish จริง (npm/PyPI/tag) เป็น**เส้นแดง** — เจ้าของเคาะ/ทำเองเท่านั้น
> Claude เตรียมทุกอย่างก่อนหน้านั้นได้หมด

## จุด bump version — มี 4 ที่ ต้องตรงกันทุกที่ (เคย stale มาแล้วจริง)

| ที่ | ไฟล์ | field |
|---|---|---|
| 1 | `package.json` | `"version"` |
| 2 | `python/pyproject.toml` | `version` |
| 3 | `python/evidence_gate/__init__.py` | `__version__` ← ตัวนี้เคยค้างที่ 0.1.0 ตอน package เป็น 0.2.0 |
| 4 | `mcp/server.mjs` | version string ใน `new Server({ name, version })` ← เคยค้างเหมือนกัน |

เช็คเร็ว: `grep -rn "0\.\d\.\d" package.json python/pyproject.toml python/evidence_gate/__init__.py mcp/server.mjs`

## ลำดับงาน (Claude ทำได้ถึงข้อ 7)

1. สองพอร์ตเขียวครบตาม `verify-playbook.md` + examples ทุกตัวรันได้
2. bump version ทั้ง 4 จุด (ดูตาราง) — semver: breaking API = major, feature = minor, fix = patch
   (จำไว้: rules validation ทำให้ ruleset ที่ไม่ครบ throw — ถ้าเปลี่ยนพฤติกรรมแบบนี้อีก = breaking)
3. `CHANGELOG.md`: เปลี่ยน `[Unreleased]` → `[X.Y.Z] — YYYY-MM-DD` + เพิ่ม link ref ท้ายไฟล์
   (`[X.Y.Z]: https://github.com/LopezDray/evidence-gate/releases/tag/vX.Y.Z`)
4. `cp README.md python/README.md` (บังคับ — PyPI isolated build อ่าน root ไม่ได้)
5. commit + push branch + เปิด PR เข้า `main` (หรือเจ้าของสั่ง merge)
6. รอ CI เขียวบน `main`
7. ร่าง release notes จาก CHANGELOG ให้เจ้าของ **ไฟล์ต้องพร้อมวางตรงๆ ห้ามมี meta-note ปนเนื้อหา
   จริง** — ไฟล์ที่มี blockquote แบบ "Draft for the GitHub Release body. Owner: ..." เจ้าของมักจะ
   copy ทั้งไฟล์รวมบรรทัดนั้นไปด้วย (เกิดจริงแล้ว 2 ครั้งติด v1.0.0 และ v1.0.1) — ให้เขียน
   release notes เป็นเนื้อหา publish-ready ล้วนๆ ถ้าจะใส่ note คั่นให้ใส่ไว้นอก markdown บล็อกที่
   ตั้งใจให้ copy หรือบอกเจ้าของแยกเป็นข้อความในแชทแทนไฟล์
8. **[เจ้าของ]** ก่อนสั่ง publish ใดๆ **ต้อง `git pull origin <default-branch>` ใน checkout
   ที่จะ publish ก่อนเสมอ** — เคยเกิดจริง (v1.0.0, 2026-07-12): publish จาก Codespace checkout
   ที่ยังไม่ pull PR ล่าสุด (MCP tool) → package จริงที่ publish ขาดฟีเจอร์ทั้งที่ CHANGELOG/tag
   metadata อ้างว่ามี ต้องแก้ด้วย patch release ทีหลัง (v1.0.1) — เช็คเร็ว: หลัง publish ให้
   `npm pack <pkg>@<version>` แล้ว grep หา symbol ของฟีเจอร์ล่าสุดใน tarball จริง ไม่ใช่เชื่อ
   git log เฉยๆ
9. **[เจ้าของ]** `git tag vX.Y.Z && git push origin vX.Y.Z`
10. **[เจ้าของ]** `npm publish` (จาก root — `files` ใน package.json คุม content แล้ว: src, mcp, README, LICENSE)
11. **[เจ้าของ]** `cd python && python -m build && twine upload dist/*`
    (⚠️ `python -m build` ไม่ล้าง `dist/` เก่า — ถ้ามีไฟล์เวอร์ชันก่อนหน้าค้างอยู่ `twine upload dist/*`
    จะพยายามอัปซ้ำด้วย เผื่อสับสน ให้ `rm -rf dist/` ก่อน build ทุกรอบ)
12. **[เจ้าของ]** สร้าง GitHub Release จาก tag + notes ข้อ 7 — วางแล้ว**พรีวิวก่อนกด publish**
    ว่าไม่มี meta-note/relative link (`../README.md`) หลงเหลือ (relative path ใช้ได้เฉพาะตอนไฟล์
    อยู่ใน repo — release body ต้องเป็น URL เต็ม `https://github.com/.../blob/main/...`)

## Post-release เช็ค

- `npm view evidence-gate version` และ `pip index versions evidence-gate-py` ตรงกับที่ตั้งใจ
- ติดตั้งจริง 1 รอบ: `npm i evidence-gate` + `pip install evidence-gate-py` แล้ว import/run ตัวอย่าง README
- อัปเดต `docs/project-plan.md` §0 + `.claude/memory/completed_features.md`

## บริบท release ที่ผ่านมา

- v0.2.0 (2026-07-10): npm + PyPI (`evidence-gate-py` — ชื่อ `evidence-gate` บน PyPI เป็นของคนอื่น
  **ห้าม** พยายาม publish ชื่อนั้น) · tag ชี้ `662a832`
- v1.0 (แผน = P3-3): เนื้อหาอยู่ใน CHANGELOG `[Unreleased]` ครบแล้ว (WP2 + P3-2 + P3-1)
  + ต้องมี case study การใช้จริง 1 ชิ้น (เนื้อหาจากเจ้าของ — DaddyInvestor)
