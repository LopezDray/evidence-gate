"""Evidence Gate — core tests: python -m pytest  (or: python tests/test_core.py)"""
import json
import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from evidence_gate.core import (
    classify_status, derive_allowed_actions, evidence_gate, validate_rules,
    canonical_json, fnv1a64, evidence_digest, DECISION_SCHEMA,
)
from evidence_gate.presets import FINANCE, HEALTH
from evidence_gate.verify import verify_claims, citation_block, VERIFICATION_SCHEMA

# Shared cross-port vectors (test/vectors.json) are written in the JS port's
# camelCase convention; these maps translate to this port's snake_case.
VECTORS_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "test", "vectors.json")
RULES_KEY_MAP = {
    "staleDays": "stale_days",
    "minRecords": "min_records",
    "qualityThreshold": "quality_threshold",
    "primaryLabel": "primary_label",
    "forbiddenActions": "forbidden_actions",
    "messages": "messages",
}
RECORD_KEY_MAP = {"qualityScore": "quality_score"}
VERIFICATION_KEY_MAP = {
    "requireFullCoverage": "require_full_coverage",
    "claimPatterns": "claim_patterns",
    "freshnessPatterns": "freshness_patterns",
}


def _map_keys(obj, key_map):
    """Translate top-level dict keys only; values (incl. nested dicts) pass through."""
    if isinstance(obj, dict):
        return {key_map.get(k, k): v for k, v in obj.items()}
    return obj


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
    # default timestamp matches the JS port's toISOString() shape
    assert g2["decision"]["at"].endswith("Z") and "+00:00" not in g2["decision"]["at"]

    # None records must behave like [] — digest identical to the JS port's
    # for the same (empty) evidence set
    g_none = evidence_gate(records=None, rules=FINANCE, decision=True)
    assert g_none["decision"]["digests"]["evidence"] == "fnv1a64:b154377d61167670"
    assert g_none["decision"]["counts"]["records"] == 0


def test_rules_validation():
    # explicit None for optional fields behaves like the JS port's null (absent)
    ok_rules = {"stale_days": 30, "min_records": 1, "quality_threshold": 50,
                "forbidden_actions": None, "messages": None, "primary_label": None}
    g = evidence_gate(records=[{"date": "2026-01-01"}], rules=ok_rules)
    assert g["status"] == "available"
    assert validate_rules(ok_rules) is ok_rules  # returns rules for chaining

    # classify_status validates too — incomplete rules can never silently pass
    try:
        classify_status([{"date": "2026-01-01"}], {"stale_days": 30})
        raise AssertionError("classify_status must reject incomplete rules")
    except ValueError as err:
        assert "min_records" in str(err)

    # validation fires even with empty records (the old JS silent-fresh hole)
    try:
        evidence_gate(records=[], rules={"stale_days": 30})
        raise AssertionError("evidence_gate must reject incomplete rules")
    except ValueError:
        pass


def test_shared_vectors():
    """Run test/vectors.json — the same file the JS suite runs. A failure here
    (with the JS side green) means the two ports have diverged."""
    with open(VECTORS_PATH, encoding="utf-8") as f:
        vectors = json.load(f)

    for v in vectors["fnv1a64"]:
        assert fnv1a64(v["input"]) == v["expected"], v["input"]

    for v in vectors["canonicalJson"]:
        assert canonical_json(v["value"]) == v["expected"], v["name"]

    for v in vectors["digest"]:
        assert evidence_digest(v["value"]) == v["expected"], v["name"]

    for c in vectors["gate"]:
        name = c["name"]
        records = [_map_keys(r, RECORD_KEY_MAP) for r in c["records"]]
        supporting = [_map_keys(r, RECORD_KEY_MAP) for r in c["supporting"]]
        rules = _map_keys(c["rules"], RULES_KEY_MAP)
        g = evidence_gate(records=records, supporting=supporting, rules=rules, decision=True)
        e = c["expected"]
        assert g["status"] == e["status"], name
        assert g["freshness"] == e["freshness"], name
        assert g["allowed_actions"] == e["allowedActions"], name
        got_warnings = [{"level": w["level"], "code": w["code"]} for w in g["warnings"]]
        assert got_warnings == e["warnings"], name
        if "caveats" in e:
            assert g["caveats"] == e["caveats"], name
        if "evidenceDigest" in e:
            # byte-identical digest across ports — the audit-trail guarantee
            assert g["decision"]["digests"]["evidence"] == e["evidenceDigest"], name

    for c in vectors["citationBlock"]:
        records = [_map_keys(r, RECORD_KEY_MAP) for r in c["records"]]
        supporting = [_map_keys(r, RECORD_KEY_MAP) for r in c.get("supporting") or []]
        got = citation_block(records, {"supporting": supporting})
        assert got == c["expected"], (c["name"], got)

    for c in vectors["verify"]:
        name = c["name"]
        records = [_map_keys(r, RECORD_KEY_MAP) for r in c["records"]]
        supporting = [_map_keys(r, RECORD_KEY_MAP) for r in c.get("supporting") or []]
        rules = c.get("rules")
        if rules and "verification" in rules:
            rules = dict(rules)
            rules["verification"] = _map_keys(rules["verification"], VERIFICATION_KEY_MAP)
        v = verify_claims(answer=c["answer"], records=records, supporting=supporting,
                          gate=c.get("gate"), rules=rules, decision=True)
        e = c["expected"]
        assert v["pass"] == e["pass"], name
        assert v["verdict"] == e["verdict"], name
        assert v["stats"] == e["stats"], name
        got_warnings = [{"level": w["level"], "code": w["code"]} for w in v["warnings"]]
        assert got_warnings == e["warnings"], name
        if "citations" in e:
            assert v["citations"] == e["citations"], (name, v["citations"])
        if "claims" in e:
            assert v["claims"] == e["claims"], (name, v["claims"])
        if "caveats" in e:
            assert v["caveats"] == e["caveats"], (name, v["caveats"])
        if "evidenceDigest" in e:
            assert v["decision"]["digests"]["evidence"] == e["evidenceDigest"], name
        if "answerDigest" in e:
            # byte-identical answer digest across ports
            assert v["decision"]["digests"]["answer"] == e["answerDigest"], name

    for c in vectors["invalidRules"]:
        rules = _map_keys(c["rules"], RULES_KEY_MAP)
        try:
            evidence_gate(records=[], rules=rules)
            raise AssertionError(f"invalid rules case {c['name']} did not raise")
        except ValueError as err:
            if c["errorField"] is not None:
                field = RULES_KEY_MAP[c["errorField"]]
                assert f'rules["{field}"]' in str(err), (c["name"], str(err))


def test_verification_record():
    records = [{"date": "2026-03-31"}, {"date": "2025-12-31"}]
    answer = "Revenue was 1.2M [ev:1]. Cash was 3M [ev:2]."

    # opt-in only
    assert "decision" not in verify_claims(answer=answer, records=records)

    v = verify_claims(answer=answer, records=records,
                      decision={"id": "req-9", "at": "2026-07-11T10:00:00Z"})
    d = v["decision"]
    assert d["schema"] == VERIFICATION_SCHEMA == "evidence-gate.verification/1"
    assert d["id"] == "req-9" and d["at"] == "2026-07-11T10:00:00Z"
    assert d["verdict"] == v["verdict"] and d["pass"] == v["pass"]
    assert d["stats"] == v["stats"]
    assert all("message" not in w for w in d["warnings"])

    # the digest join: same records -> gate decision and verification record
    # carry the SAME evidence digest; the answer digest is separate
    g = evidence_gate(records=records, rules=FINANCE, decision={"id": "req-9"})
    assert g["decision"]["digests"]["evidence"] == d["digests"]["evidence"]
    assert d["digests"]["answer"] != d["digests"]["evidence"]

    # privacy: neither the answer nor the evidence appears in the record
    blob = json.dumps(d)
    assert "Revenue" not in blob and "2026-03-31" not in blob
    assert "\n" not in blob  # JSONL-serializable

    # messy input never raises
    assert verify_claims(answer=None, records=None)["verdict"] == "supported"
    assert verify_claims(answer=12345, records=records)["verdict"] == "no_citations"

    # marker binds to its sentence: a valid citation in one sentence does not
    # cover a claim in another
    v2 = verify_claims(answer="Revenue was 1.2M [ev:1]. Cash was 3M.", records=records)
    assert v2["verdict"] == "unsupported_claims" and v2["stats"]["uncited"] == 1

    # duplicate markers are counted per occurrence in citations[]
    v3 = verify_claims(answer="Revenue 1M [ev:1] [ev:1].", records=records)
    assert len(v3["citations"]) == 2 and v3["stats"]["cited"] == 1


def test_citation_block_overrides():
    records = [{"date": "2026-03-31", "quality_score": 92}]
    block = citation_block(records, {"header": "HDR:", "line": lambda r, marker, i: f"* {marker} -> {r['date']}"})
    assert block == "HDR:\n* 1 -> 2026-03-31"
    # empty evidence -> header only
    assert citation_block([]) == "EVIDENCE (cite with its marker after every factual statement):"


if __name__ == "__main__":
    test_classify(); test_allowed_actions(); test_date_validation(); test_domain_swap()
    test_digest_primitives(); test_decision_record()
    test_rules_validation(); test_shared_vectors()
    test_verification_record(); test_citation_block_overrides()
    print("all tests passed")
