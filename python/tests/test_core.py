"""Evidence Gate — core tests: python -m pytest  (or: python tests/test_core.py)"""
import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from evidence_gate.core import (
    classify_status, derive_allowed_actions, evidence_gate,
    canonical_json, fnv1a64, evidence_digest, DECISION_SCHEMA,
)
from evidence_gate.presets import FINANCE, HEALTH


def iso(days_ago):
    return (date.today() - timedelta(days=days_ago)).isoformat()


def rec(q, days_ago, **extra):
    return {"date": iso(days_ago), "quality_score": q, **extra}


def test_classify():
    assert classify_status([rec(95, 5)] * 4, FINANCE)["status"] == "available"
    assert classify_status([rec(95, 5)] * 2, FINANCE)["status"] == "quality_warning"
    assert classify_status([rec(95, 5), rec(95, 5), rec(95, 5), rec(40, 5)], FINANCE)["status"] == "quality_warning"
    assert classify_status([], FINANCE)["status"] == "missing"
    assert classify_status([rec(95, 5, tier="fallback")] * 2, FINANCE)["status"] == "fallback"
    assert classify_status([rec(95, 200)] * 4, FINANCE)["freshness"] == "stale"


def test_allowed_actions():
    a = derive_allowed_actions("available", forbidden_actions=["personalized_advice"])
    assert a["summarize"] and a["compare"] and a["personalized_advice"] is False
    assert derive_allowed_actions("missing")["summarize"] is False
    assert derive_allowed_actions("missing", supporting_present=True)["summarize"] is True


def test_date_validation():
    from evidence_gate.core import parse_date
    assert parse_date(None) is None
    assert parse_date("not-a-date") is None
    assert parse_date("2026-13-01") is None   # impossible month
    assert parse_date("2026-02-31") is None   # impossible day
    assert parse_date("2024-02-29") is not None  # valid leap day


def test_domain_swap():
    g = evidence_gate(records=[rec(95, 5), rec(95, 5)], rules=HEALTH)
    assert g["status"] == "available"
    assert g["allowed_actions"]["diagnose"] is False
    assert g["allowed_actions"]["prescribe"] is False


def test_digest_primitives():
    # published FNV-1a 64-bit reference vectors
    assert fnv1a64("") == "cbf29ce484222325"
    assert fnv1a64("a") == "af63dc4c8601ec8c"
    assert fnv1a64("foobar") == "85944171f73967e8"
    # canonical form: sorted keys, compact, non-ASCII kept
    assert canonical_json({"b": 2, "a": [1, "é", True], "z": None}) == '{"a":[1,"é",true],"b":2,"z":null}'
    # cross-language vector: MUST equal the JS port's output for the same input
    assert evidence_digest({"b": 2, "a": [1, "é", True], "z": None}) == "fnv1a64:2a4b821432ab8bcc"


def test_decision_record():
    records = [rec(95, 5)] * 4

    assert "decision" not in evidence_gate(records=records, rules=FINANCE)

    g = evidence_gate(records=records, rules=FINANCE,
                      decision={"id": "req-42", "at": "2026-07-02T10:00:00Z"})
    d = g["decision"]
    assert d["schema"] == DECISION_SCHEMA
    assert d["id"] == "req-42" and d["at"] == "2026-07-02T10:00:00Z"
    assert d["counts"] == {"records": 4, "supporting": 0}
    assert d["outcome"]["status"] == g["status"]
    assert d["outcome"]["caveats"] == g["caveats"]
    assert d["rules"]["stale_days"] == FINANCE["stale_days"]
    assert all("message" not in w for w in d["outcome"]["warnings"])

    # privacy: evidence values never appear in the decision — only a digest
    import json as _json
    assert records[0]["date"] not in _json.dumps(d)
    assert "\n" not in _json.dumps(d)  # JSONL-serializable

    # determinism + sensitivity
    g2 = evidence_gate(records=records, rules=FINANCE, decision=True)
    assert g2["decision"]["digests"]["evidence"] == d["digests"]["evidence"]
    assert g2["decision"]["digests"]["rules"] == d["digests"]["rules"]
    g3 = evidence_gate(records=records[:3], rules=FINANCE, decision=True)
    assert g3["decision"]["digests"]["evidence"] != d["digests"]["evidence"]
    assert g2["decision"]["id"] is None and isinstance(g2["decision"]["at"], str)


if __name__ == "__main__":
    test_classify(); test_allowed_actions(); test_date_validation(); test_domain_swap()
    test_digest_primitives(); test_decision_record()
    print("all tests passed")
