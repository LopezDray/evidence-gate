"""Evidence Gate — core engine (Python).

Decide whether an LLM may speak about a set of records, BEFORE it generates
anything — based on evidence coverage, freshness, and quality.

No dependencies. Domain-agnostic: bring records + a ruleset (preset).

    record = {"date", "quality_score"?, "quality"?, "flags"?, "tier"?}
"""
import json
import math
from datetime import datetime, date, timezone

# ── Decision log primitives ──────────────────────────────────────────────────
# A decision record is the audit trail of one gate call: WHAT the gate decided,
# under WHICH rules, over WHICH evidence — without storing the evidence itself
# (records may be sensitive; only a digest of them is kept).
#
# Digests are FNV-1a 64-bit over canonical JSON. Deterministic and identical
# across the JS and Python ports; NOT cryptographic — they detect drift and
# correlate log entries, they don't prove integrity against an adversary.
# Cross-port equality is guaranteed for JSON-safe values (strings, booleans,
# null, integers, and floats with a plain decimal form); exotic floats
# (e.g. 1e-7) and NaN serialize differently per language — keep them out of
# records you intend to digest.

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


# ── Tamper-evident decision chain ────────────────────────────────────────────
# Turn a decision log into a hash chain: each record carries "prev", the
# evidence_digest() of the record written before it. Because a record's digest
# covers its own "prev", editing any past JSONL line changes its digest and
# breaks the "prev" of every record after it — cheap, zero-dependency
# tamper-evidence (NOT cryptographic; same stance as the digest note above).
# "prev" is an additive optional field: the record stays
# evidence-gate.decision/1, and records outside a chain simply omit it.


def chain_decision(decision, prev_digest=None):
    """chain_decision(decision, prev_digest?) -> {**decision, "prev": prev_digest}.

    Pass the previous chained record's evidence_digest() as prev_digest; the
    first record in a chain takes None (the default). Pure — the caller
    persists the returned record and threads its digest into the next call.
    """
    return {**decision, "prev": prev_digest}


def verify_decision_chain(records):
    """verify_decision_chain(records) -> {"valid", "broken_at"}.

    Replays a chain of decision records (in the order they were written) and
    reports the first record whose "prev" doesn't match the digest of the one
    before it — broken_at is that index, or None when the whole chain holds.
    The head must carry "prev": None. Never raises.
    """
    lst = records or []
    for i in range(len(lst)):
        rec = lst[i]
        if not isinstance(rec, dict):
            return {"valid": False, "broken_at": i}
        expected_prev = None if i == 0 else evidence_digest(lst[i - 1])
        if rec.get("prev") != expected_prev:
            return {"valid": False, "broken_at": i}
    return {"valid": True, "broken_at": None}


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


# ── Provenance ────────────────────────────────────────────────────────────────
# Opt-in per record: record["provenance"] = {"source": {"id"?, "type"?,
# "authority"?}, "retrieved_at"?, "content_hash"?, "chain"?}. The core never
# computes hashes — they are opaque "<alg>:<hex>" strings the app supplies.

AUTHORITY_LADDER = ["official", "licensed", "secondary", "unverified"]
_AUTHORITY_RANK = {"official": 3, "licensed": 2, "secondary": 1, "unverified": 0}


def _is_hash(v):
    return isinstance(v, str) and len(v) > 0


def validate_provenance(record):
    """Chain continuity (design doc §3): chain[0].input_hash must equal
    content_hash, and every chain[i].input_hash must equal
    chain[i-1].output_hash. Hashes are compared as opaque strings. Never
    raises, never changes gate status by itself — broken continuity surfaces
    as a gate warning."""
    problems = []
    p = record.get("provenance") if isinstance(record, dict) else None
    if p is None:
        return {"valid": True, "problems": problems}  # no provenance = nothing to validate
    if not isinstance(p, dict):
        return {"valid": False, "problems": ["invalid_provenance"]}
    if not isinstance(p.get("source"), dict):
        problems.append("missing_source")
    raw_chain = p.get("chain")
    if raw_chain is not None and not isinstance(raw_chain, list):
        problems.append("invalid_chain")
    chain = raw_chain if isinstance(raw_chain, list) else []
    if chain:
        first = chain[0] if isinstance(chain[0], dict) else {}
        if not _is_hash(p.get("content_hash")) or first.get("input_hash") != p.get("content_hash"):
            problems.append("chain_root_mismatch")
        for i in range(1, len(chain)):
            prev = chain[i - 1] if isinstance(chain[i - 1], dict) else {}
            cur = chain[i] if isinstance(chain[i], dict) else {}
            if not _is_hash(prev.get("output_hash")) or cur.get("input_hash") != prev.get("output_hash"):
                problems.append(f"chain_gap_at_{i}")
    return {"valid": not problems, "problems": problems}


def _authority_rank(record):
    """Rank of a record's source authority; unknown/missing ranks below the ladder."""
    p = record.get("provenance") if isinstance(record, dict) else None
    src = p.get("source") if isinstance(p, dict) else None
    if not isinstance(src, dict):
        return -1
    return _AUTHORITY_RANK.get(src.get("authority"), -1)


# ── validate_rules: fail fast on malformed rulesets ──────────────────────────
# Both ports validate rules at call time and throw the same way, so a bad
# ruleset can never silently pass one port (JS used to treat missing numeric
# fields as permissive) while crashing the other (Python raised KeyError).
# Explicit None is treated like an absent optional field, matching JS `null`.
_RULE_NUMBER_FIELDS = ("stale_days", "min_records", "quality_threshold")


def validate_rules(rules, caller="evidence_gate"):
    # `{}` is falsy in Python but not in JS — check identity/type, not truthiness,
    # so an empty dict gets the same "which field is missing" error as JS's `{}`
    if rules is None or not isinstance(rules, dict):
        raise ValueError(f"{caller}: `rules` (a preset) is required")
    for f in _RULE_NUMBER_FIELDS:
        v = rules.get(f)
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
            raise ValueError(f'{caller}: rules["{f}"] is required and must be a finite number')
    fa = rules.get("forbidden_actions")
    if fa is not None and not isinstance(fa, list):
        raise ValueError(f'{caller}: rules["forbidden_actions"] must be a list')
    m = rules.get("messages")
    if m is not None and not isinstance(m, dict):
        raise ValueError(f'{caller}: rules["messages"] must be a dict')
    label = rules.get("primary_label")
    if label is not None and not isinstance(label, str):
        raise ValueError(f'{caller}: rules["primary_label"] must be a string')
    prov = rules.get("provenance")
    if prov is not None:
        if not isinstance(prov, dict):
            raise ValueError(f'{caller}: rules["provenance"] must be a dict')
        ma = prov.get("min_authority")
        if ma is not None and ma not in AUTHORITY_LADDER:
            raise ValueError(f'{caller}: rules["provenance"]["min_authority"] must be one of {"|".join(AUTHORITY_LADDER)}')
    return rules


def classify_status(records, rules):
    """records[] + rules -> status of the primary evidence group.

    rules: {"stale_days", "min_records", "quality_threshold"}
    status: "available" | "quality_warning" | "fallback" | "missing"
    """
    validate_rules(rules, "classify_status")
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
    validate_rules(rules, "evidence_gate")

    primary = classify_status(records or [], rules)
    supporting_present = bool(supporting or [])
    allowed = derive_allowed_actions(primary["status"], supporting_present, rules.get("forbidden_actions"))

    warnings = []
    # `or` (not dict-default) so an explicit None behaves like the JS port's null
    m = rules.get("messages") or {}
    label = rules.get("primary_label") or "primary data"
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

    # Provenance (opt-in via rules["provenance"]; deliberate v1 scope cut:
    # these warnings NEVER change status or allowed_actions — only caveats).
    all_records = records or []
    prov_records = [r for r in all_records if isinstance(r, dict) and r.get("provenance") is not None]
    broken_chains = sum(1 for r in prov_records if not validate_provenance(r)["valid"])
    prov_rules = rules.get("provenance")
    # `{}` is falsy in Python but truthy in JS — an empty rules.provenance
    # still opts in (enables chain checks + attribution), so test identity
    if prov_rules is not None:
        missing = len(all_records) - len(prov_records)
        if prov_rules.get("require") and missing > 0:
            warnings.append({"level": "review", "code": "provenance_missing",
                             "message": m.get("provenance_missing", f"{missing} of {len(all_records)} record(s) lack provenance — the AI must not present them as verified sources.")})
        min_authority = prov_rules.get("min_authority")
        if min_authority is not None:
            # per-record comparison: one weak source taints the set with a caveat
            untrusted = sum(1 for r in prov_records if _authority_rank(r) < _AUTHORITY_RANK[min_authority])
            if untrusted > 0:
                warnings.append({"level": "review", "code": "provenance_untrusted",
                                 "message": m.get("provenance_untrusted", f'{untrusted} record(s) come from sources below "{min_authority}" authority — the AI must attribute them cautiously.')})
        if broken_chains > 0:
            warnings.append({"level": "review", "code": "provenance_broken_chain",
                             "message": m.get("provenance_broken_chain", f"{broken_chains} record(s) have a broken provenance chain — their lineage is not replay-verifiable.")})

    if not supporting_present:
        warnings.append({"level": "info", "code": "no_supporting",
                         "message": m.get("no_supporting", "No supporting evidence — primary source only.")})

    # Source-naming attribution (info, opt-in via rules["provenance"]): only
    # when every provenance-bearing record names its source, and there are at
    # most two distinct sources — silent beyond that (counts still land in
    # decision["provenance"]["sources"]).
    if prov_rules is not None and prov_records:
        def _source_of(r):
            p = r.get("provenance")
            s = p.get("source") if isinstance(p, dict) else None
            return s if isinstance(s, dict) else {}

        ids = [_source_of(r).get("id") for r in prov_records]
        if all(isinstance(i, str) and i != "" for i in ids):
            distinct = list(dict.fromkeys(ids))

            def auth_of(source_id):
                for r in prov_records:
                    if r["provenance"]["source"].get("id") == source_id:
                        a = r["provenance"]["source"].get("authority")
                        return a if isinstance(a, str) else "unknown"
                return "unknown"

            if len(distinct) == 1:
                retrieved = [r["provenance"].get("retrieved_at") for r in prov_records
                             if isinstance(r["provenance"].get("retrieved_at"), str) and r["provenance"].get("retrieved_at")]
                suffix = f", retrieved {max(retrieved)[:10]}" if retrieved else ""
                warnings.append({"level": "info", "code": "provenance_attribution",
                                 "message": m.get("provenance_attribution", f"{label} are based on {distinct[0]} ({auth_of(distinct[0])}){suffix}.")})
            elif len(distinct) == 2:
                warnings.append({"level": "info", "code": "provenance_attribution",
                                 "message": m.get("provenance_attribution", f"{label} are based on {distinct[0]} ({auth_of(distinct[0])}) and {distinct[1]} ({auth_of(distinct[1])}).")})

    result = {"status": st, "freshness": primary["freshness"], "allowed_actions": allowed,
              "warnings": warnings, "caveats": [w["message"] for w in warnings]}

    if decision:
        meta = {} if decision is True else decision
        # default timestamp matches the JS port's toISOString() shape: milliseconds + "Z"
        at = meta.get("at")
        if at is None:
            at = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        result["decision"] = {
            "schema": DECISION_SCHEMA,
            "id": meta.get("id"),
            "at": at,
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
        # Additive block (still evidence-gate.decision/1 — consumers must
        # ignore unknown fields): present whenever any record carries
        # provenance, independent of rules["provenance"]. Source ids DO appear
        # (auditors need them); no evidence values, no content excerpts.
        if prov_records:
            sources = []
            by_key = {}
            for r in prov_records:
                p = r.get("provenance")
                src = p.get("source") if isinstance(p, dict) else None
                src = src if isinstance(src, dict) else {}
                entry = {"id": src.get("id"), "type": src.get("type"), "authority": src.get("authority")}
                key = canonical_json([entry["id"], entry["type"], entry["authority"]])
                if key in by_key:
                    by_key[key]["records"] += 1
                else:
                    e = dict(entry, records=1)
                    by_key[key] = e
                    sources.append(e)
            result["decision"]["provenance"] = {
                "covered": len(prov_records),
                "total": len(all_records),
                "sources": sources,
                "broken_chains": broken_chains,
                # replay-verifiable exactly like the evidence digest: recompute
                # over the claimed provenance set (in record order), compare
                "digest": evidence_digest([r["provenance"] for r in prov_records]),
            }

    return result
