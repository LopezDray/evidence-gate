"""Evidence Gate — core engine (Python).

Decide whether an LLM may speak about a set of records, BEFORE it generates
anything — based on evidence coverage, freshness, and quality.

No dependencies. Domain-agnostic: bring records + a ruleset (preset).

    record = {"date", "quality_score"?, "quality"?, "flags"?, "tier"?}
"""
import json
from datetime import datetime, date, timezone

# ── Decision log primitives ──────────────────────────────────────────────────
# A decision record is the audit trail of one gate call: WHAT the gate decided,
# under WHICH rules, over WHICH evidence — without storing the evidence itself
# (records may be sensitive; only a digest of them is kept).
#
# Digests are FNV-1a 64-bit over canonical JSON. Deterministic and identical
# across the JS and Python ports; NOT cryptographic — they detect drift and
# correlate log entries, they don't prove integrity against an adversary.

DECISION_SCHEMA = "evidence-gate.decision/1"


def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def fnv1a64(s):
    h = 0xCBF29CE484222325
    for b in s.encode("utf-8"):
        h ^= b
        h = (h * 0x100000001B3) & 0xFFFFFFFFFFFFFFFF
    return format(h, "016x")


def evidence_digest(value):
    return "fnv1a64:" + fnv1a64(canonical_json(value))


def parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def days_since(d):
    if not d:
        return None
    return (date.today() - d).days


def freshness_label(latest, threshold_days):
    age = days_since(latest)
    if age is None:
        return "unknown"
    return "stale" if age > threshold_days else "fresh"


def classify_status(records, rules):
    """records[] + rules -> status of the primary evidence group.

    rules: {"stale_days", "min_records", "quality_threshold"}
    status: "available" | "quality_warning" | "fallback" | "missing"
    """
    usable = records or []
    if not usable:
        return {"status": "missing", "freshness": "unknown", "latest": None,
                "count": 0, "quality_min": None, "flags": []}

    dates = [d for d in (parse_date(r.get("date")) for r in usable) if d]
    latest = max(dates) if dates else None
    freshness = freshness_label(latest, rules["stale_days"]) if latest else "unknown"
    latest_str = latest.isoformat() if latest else None

    if all(r.get("tier") == "fallback" for r in usable):
        return {"status": "fallback", "freshness": freshness, "latest": latest_str,
                "count": len(usable), "quality_min": None, "flags": []}

    scores = [r["quality_score"] for r in usable if r.get("quality_score") is not None]
    quality_min = min(scores) if scores else None
    flags = []
    for r in usable:
        wf = r.get("flags")
        if isinstance(wf, list):
            flags.extend(wf)
        elif isinstance(wf, str) and wf:
            flags.append(wf)
    flags = sorted(set(flags))

    review_quality = any(r.get("quality") == "review" for r in usable)
    has_quality_issue = (
        (quality_min is not None and quality_min < rules["quality_threshold"])
        or bool(flags)
        or review_quality
    )

    if len(usable) < rules["min_records"]:
        status = "quality_warning"
    elif has_quality_issue:
        status = "quality_warning"
    else:
        status = "available"

    return {"status": status, "freshness": freshness, "latest": latest_str,
            "count": len(usable), "quality_min": quality_min, "flags": flags}


def derive_allowed_actions(primary_status, supporting_present=False, forbidden_actions=None):
    summarize = primary_status in ("available", "quality_warning", "fallback") or supporting_present
    compare = primary_status in ("available", "quality_warning")
    actions = {"summarize": summarize, "compare": compare}
    for a in (forbidden_actions or []):
        actions[a] = False
    return actions


def evidence_gate(records=None, supporting=None, rules=None, decision=None):
    """records + rules -> {status, freshness, allowed_actions, warnings, caveats, decision?}.

    ``decision`` (opt-in): pass ``True`` or ``{"id": ..., "at": ...}`` to also
    get a JSONL-serializable decision record for your audit log. The core never
    writes anywhere — persisting the record is the caller's job.
    """
    if not rules:
        raise ValueError("evidence_gate: `rules` (a preset) is required")

    primary = classify_status(records or [], rules)
    supporting_present = bool(supporting or [])
    allowed = derive_allowed_actions(primary["status"], supporting_present, rules.get("forbidden_actions"))

    warnings = []
    m = rules.get("messages", {})
    label = rules.get("primary_label", "primary data")
    st = primary["status"]
    if st == "missing":
        warnings.append({"level": "block", "code": "primary_missing",
                         "message": m.get("primary_missing", f"No {label} available — the AI must not invent numbers.")})
    elif st == "fallback":
        warnings.append({"level": "review", "code": "primary_fallback",
                         "message": m.get("primary_fallback", f"{label} is cached/fallback, not authoritative — the AI must say so.")})
    elif st == "quality_warning":
        warnings.append({"level": "review", "code": "primary_quality",
                         "message": m.get("primary_quality", f"{label} has a data-quality warning — the AI must add a caveat.")})
    if primary["freshness"] == "stale":
        warnings.append({"level": "review", "code": "primary_stale",
                         "message": m.get("primary_stale", f'{label} is stale (older than {rules["stale_days"]} days) — the AI must not say "latest" or "today".')})
    if not supporting_present:
        warnings.append({"level": "info", "code": "no_supporting",
                         "message": m.get("no_supporting", "No supporting evidence — primary source only.")})

    result = {"status": st, "freshness": primary["freshness"], "allowed_actions": allowed,
              "warnings": warnings, "caveats": [w["message"] for w in warnings]}

    if decision:
        meta = {} if decision is True else decision
        result["decision"] = {
            "schema": DECISION_SCHEMA,
            "id": meta.get("id"),
            "at": meta.get("at") or datetime.now(timezone.utc).isoformat(),
            "digests": {"evidence": evidence_digest({"records": records or [], "supporting": supporting or []}),
                        "rules": evidence_digest(rules)},
            "counts": {"records": len(records or []), "supporting": len(supporting or [])},
            "rules": {
                "primary_label": label,
                "stale_days": rules.get("stale_days"),
                "min_records": rules.get("min_records"),
                "quality_threshold": rules.get("quality_threshold"),
                "forbidden_actions": rules.get("forbidden_actions") or [],
            },
            "outcome": {
                "status": st,
                "freshness": primary["freshness"],
                "allowed_actions": allowed,
                "warnings": [{"level": w["level"], "code": w["code"]} for w in warnings],
                "caveats": result["caveats"],
            },
        }

    return result
