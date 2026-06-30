"""Evidence Gate — core tests: python -m pytest  (or: python tests/test_core.py)"""
import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from evidence_gate.core import classify_status, derive_allowed_actions, evidence_gate
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


if __name__ == "__main__":
    test_classify(); test_allowed_actions(); test_date_validation(); test_domain_swap()
    print("all tests passed")
