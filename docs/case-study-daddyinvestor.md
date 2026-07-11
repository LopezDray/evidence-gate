# Case study — Evidence Gate in production at DaddyInvestor

> **Status: SKELETON — เจ้าของเติมข้อมูลจริง (ตัวเลข/เหตุการณ์) ในช่อง `[…]`**
> P3-3 ต้องการ case study การใช้จริง 1 ชิ้น. โครงด้านล่างเขียนจากสิ่งที่ยืนยันได้
> จาก README ("runs in production today inside DaddyInvestor, a Thai-language
> financial-data application, gating an LLM over real, messy, sometimes-missing
> SEC filings"). ห้ามแต่งตัวเลข — ที่ยังไม่รู้ให้คงเป็น `[…]` ไว้.

## บริบท

DaddyInvestor เป็นแอปข้อมูลการเงินภาษาไทย ที่สร้างบทวิเคราะห์/ตอบคำถามด้วย LLM
บนงบการเงินจริงจาก SEC ซึ่ง **ไม่ครบ ไม่สด และคุณภาพไม่เท่ากัน** เป็นปกติ.

- โดเมน: [ตลาดหุ้นไทย / งบการเงิน — ระบุขอบเขต]
- ปริมาณ: [กี่บริษัท / กี่ไตรมาส / ผู้ใช้จ่ายเงินจริงกี่ราย]
- โมเดลที่ gate: [เช่น Claude — ใช้สร้างอะไร]

## ปัญหาที่ Evidence Gate แก้

ก่อนมี gate: [อาการจริง — เช่น โมเดลตอบไตรมาสที่ยังไม่มีข้อมูล / อ้าง "ล่าสุด"
กับงบเก่า / พูดตัวเลขจากแหล่ง fallback เหมือนเป็นทางการ]. content-safety
guardrails จับเรื่องนี้ไม่ได้ เพราะมันเป็นปัญหา **grounding** ไม่ใช่ toxicity/PII.

## วิธีใช้ในระบบจริง

- Preset / rules ที่ใช้: [FINANCE ปรับค่าอะไร — staleDays/minRecords/quality]
- จุดที่เรียก gate ใน pipeline: [ก่อน generate ตรงไหน]
- ใช้ decision log ไหม / เก็บที่ไหน: [Supabase? JSONL?]
- ใช้ verifyClaims / provenance หรือยัง: [ถ้ายัง — แผนจะเปิดเมื่อไหร่]

## ผลลัพธ์

> ตัวเลข before/after — เติมเท่าที่วัดได้จริง ห้ามประมาณลอยๆ

- อัตราการตอบผิด/แต่งข้อมูล: [ก่อน X% → หลัง Y%] หรือ [เชิงคุณภาพถ้ายังไม่วัดเป็นเลข]
- เคสที่ gate บล็อกแล้วถูกต้อง: [ตัวอย่าง 1 เคสจริง]
- ต้นทุน/ความเร็ว: [gate เป็น pure function — เพิ่ม latency ~0; ระบุถ้ามีตัวเลข]

## บทเรียน

- [สิ่งที่ปรับ rules หลังเจอ data จริง]
- [ข้อจำกัดที่เจอ / อยากได้ feature อะไรต่อ]

---

*ลิงก์กลับจาก README ได้เมื่อเนื้อหาเสร็จ · live: https://daddyinvestor.net*
