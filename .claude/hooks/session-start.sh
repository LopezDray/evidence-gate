#!/usr/bin/env bash
# SessionStart hook — พ่นสถานะโปรเจกต์ + pointer เข้า context ทุก session
# อย่าพึ่งดวงว่า AI จะอ่านเอง ให้ hook การันตี (หลักคิดจาก MASTER_BOOTSTRAP_PROMPT ข้อ 4)
set -euo pipefail
cd "$(dirname "$0")/../.."

# สร้างเนื้อหา context: กฎ → งานค้าง → skills ที่มี
CONTEXT_FILE="$(mktemp)"
trap 'rm -f "$CONTEXT_FILE"' EXIT
{
  echo "== evidence-gate session bootstrap =="
  echo "กฎบังคับ: อ่าน CLAUDE.md ก่อนแตะโค้ด · เส้นแดง: .claude/skills/model-handoff.md"
  echo ""
  echo "-- งานค้าง (.claude/memory/pending_sessions.md) --"
  cat .claude/memory/pending_sessions.md
  echo ""
  echo "-- skills ที่มีแล้ว (อ่านก่อนทำงานประเภทนั้น — ห้ามสร้างซ้ำ) --"
  ls -1 .claude/skills/
  echo ""
  echo "-- งานเสร็จล่าสุด (กัน rebuild) --"
  head -12 .claude/memory/completed_features.md
} > "$CONTEXT_FILE"

# ห่อเป็น hook JSON output (additionalContext) — ใช้ python3 encode กัน escaping พัง
python3 - "$CONTEXT_FILE" <<'PY'
import json, sys
text = open(sys.argv[1], encoding="utf-8").read()
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": text,
    },
    "suppressOutput": True,
}, ensure_ascii=False))
PY
