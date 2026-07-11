"""Evidence Gate — post-generation claim verification (Python).

The gate decides WHETHER the model may speak; verify_claims checks whether
what it said stands on the evidence it was given. The core cannot judge
semantic truth — it verifies a citation protocol, deterministically and
identically across the JS and Python ports:

1. citation_block() renders the markers the model must cite from.
2. verify_claims() parses the answer: every citation must resolve to a
   record that exists (no phantom evidence), every claim-looking sentence
   must carry a citation (no naked claims), and the framing must match the
   gate's verdict (no "as of today" over stale data).

Spec: docs/design/claim-verification.md (approved). No dependencies.
"""
import re
from datetime import datetime, timezone

from .core import evidence_digest, canonical_json

VERIFICATION_SCHEMA = "evidence-gate.verification/1"

# Marker grammar, shared verbatim with the JS port — one grammar only.
_MARKER_RE = re.compile(r"\[ev:([A-Za-z0-9_.-]+)\]")
# Default claim patterns: any digit, or a quantity-implying symbol.
# Regex SOURCES (strings), never functions — rulesets stay JSON-digestable.
_DEFAULT_CLAIM_PATTERNS = ["\\d", "%|\\$|€|£|฿"]
# English-only by default; apps localize via rules["verification"]["freshness_patterns"].
_DEFAULT_FRESHNESS_PATTERNS = ["\\b(today|as of now|currently|latest|real[- ]?time)\\b"]

_ID_RE = re.compile(r"^[A-Za-z0-9_.-]+$")
_NUMERIC_RE = re.compile(r"^[0-9]+$")
# Explicit ASCII whitespace classes on purpose: JS \s and Python \s disagree
# on exotic Unicode whitespace, and the sentence partition must be
# byte-identical across ports.
_LINE_SPLIT = re.compile(r"\r?\n")
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])[ \t]+")
_STRIP_CHARS = " \t\r\f\v"


def _usable_id(record_id):
    """A usable record id must fit the marker grammar and must NOT be purely
    numeric — numeric refs are reserved for index resolution, so a numeric id
    could never be told apart from an index. Invalid ids are ignored (the
    record falls back to its index marker), never an error."""
    return (isinstance(record_id, str) and _ID_RE.match(record_id) is not None
            and _NUMERIC_RE.match(record_id) is None)


def citation_block(records=None, opts=None):
    """Render the evidence list the model must cite from.

    opts: {"header"?, "line"?: callable(record, marker, index) -> str, "supporting"?}
    Markers are the record's id when usable, else the 1-based index into the
    concatenation [records..., supporting...]. Supporting records are tagged.
    """
    records = records or []
    opts = opts or {}
    supporting = opts.get("supporting") or []
    header = opts.get("header")
    if header is None:
        header = "EVIDENCE (cite with its marker after every factual statement):"
    lines = [header]
    entries = [(r, "primary") for r in records] + [(r, "supporting") for r in supporting]
    for i, (r, tier) in enumerate(entries):
        r = r or {}
        marker = r.get("id") if _usable_id(r.get("id")) else str(i + 1)
        line_fn = opts.get("line")
        if callable(line_fn):
            lines.append(line_fn(r, marker, i))
            continue
        line = f'[ev:{marker}] {r.get("date") or "undated"}'
        q = r.get("quality_score")
        if isinstance(q, (int, float)) and not isinstance(q, bool):
            line += f" — quality {canonical_json(q)}"
        wf = r.get("flags")
        flags = wf if isinstance(wf, list) else ([wf] if isinstance(wf, str) and wf else [])
        if flags:
            line += f', flags: {", ".join(flags)}'
        if tier == "supporting":
            line += " (supporting)"
        lines.append(line)
    return "\n".join(lines)


def _resolve_ref(ref, records, supporting):
    """ref -> 0-based index into [records..., supporting...] or None (phantom).

    Order: exact id match (records first, then supporting) -> else a numeric
    ref 1..N is that 1-based position."""
    for i, r in enumerate(records):
        if r and _usable_id(r.get("id")) and r.get("id") == ref:
            return {"record": i, "tier": "primary"}
    for j, r in enumerate(supporting):
        if r and _usable_id(r.get("id")) and r.get("id") == ref:
            return {"record": len(records) + j, "tier": "supporting"}
    if _NUMERIC_RE.match(ref):
        n = int(ref)
        if 1 <= n <= len(records) + len(supporting):
            return {"record": n - 1, "tier": "primary" if n <= len(records) else "supporting"}
    return None


def _split_sentences(text):
    """A stable, port-identical partition: split on newlines, then after
    [.!?] followed by a space/tab."""
    out = []
    for line in _LINE_SPLIT.split(text):
        for part in _SENTENCE_SPLIT.split(line):
            s = part.strip(_STRIP_CHARS)
            if s:
                out.append(s)
    return out


def verify_claims(answer=None, records=None, supporting=None, gate=None, rules=None, decision=None):
    """The post-generation half of the proof loop.

    -> {pass, verdict, citations, claims, stats, warnings, caveats, decision?}

    Never raises on messy input — a garbage answer yields a verdict, not an
    exception. ``rules`` is optional here (only "verification" and "messages"
    are read); pass the SAME records/supporting the prompt was built from, in
    the same order, or resolution and the digest join are meaningless.
    """
    answer = "" if answer is None else str(answer)
    records = records or []
    supporting = supporting or []
    v = (rules or {}).get("verification") or {}
    m = (rules or {}).get("messages") or {}
    rfc = v.get("require_full_coverage")
    require_full_coverage = True if rfc is None else bool(rfc)
    # re.ASCII so \d, \b, \w mean the same thing as the JS port's regexes
    claim_res = [re.compile(s, re.ASCII) for s in (v.get("claim_patterns") or _DEFAULT_CLAIM_PATTERNS)]
    fresh_res = [re.compile(s, re.ASCII | re.IGNORECASE)
                 for s in (v.get("freshness_patterns") or _DEFAULT_FRESHNESS_PATTERNS)]

    # every marker occurrence, in order of appearance
    citations = []
    for match in _MARKER_RE.finditer(answer):
        ref = match.group(1)
        resolved = _resolve_ref(ref, records, supporting)
        citations.append({
            "marker": "ev:" + ref,
            "ref": ref,
            "record": resolved["record"] if resolved else None,
            "valid": resolved is not None,
            "tier": resolved["tier"] if resolved else None,
        })

    # claim-looking sentences; markers are stripped before pattern matching so
    # a digit inside [ev:1] can never make a sentence look like a claim
    claims = []
    cited = 0
    uncited = 0
    for sentence in _split_sentences(answer):
        refs = _MARKER_RE.findall(sentence)
        stripped = _MARKER_RE.sub("", sentence)
        if not any(p.search(stripped) for p in claim_res):
            continue
        has_valid = any(_resolve_ref(ref, records, supporting) is not None for ref in refs)
        claims.append({"text": sentence, "cited": has_valid, "markers": ["ev:" + r for r in refs]})
        if has_valid:
            cited += 1
        else:
            uncited += 1

    phantom = sum(1 for c in citations if not c["valid"])
    valid_count = len(citations) - phantom
    stats = {"claims": len(claims), "cited": cited, "uncited": uncited, "phantom": phantom}

    # verdict ladder — top-down, first hit wins
    if phantom > 0:
        verdict, passed = "phantom_citations", False
    elif claims and valid_count == 0:
        verdict, passed = "no_citations", False
    elif uncited > 0:
        verdict, passed = "unsupported_claims", not require_full_coverage
    else:
        verdict, passed = "supported", True  # no claims at all (a refusal) passes

    warnings = []
    if phantom > 0:
        seen, listed = set(), []
        for c in citations:
            if not c["valid"] and c["marker"] not in seen:
                seen.add(c["marker"])
                listed.append(f'[{c["marker"]}]')
        warnings.append({"level": "block", "code": "verify_phantom_citation",
                         "message": m.get("verify_phantom_citation",
                                          f'Citations resolve to no evidence record: {", ".join(listed)} — the model may have invented sources.')})
    if claims and valid_count == 0:
        warnings.append({"level": "block", "code": "verify_no_citations",
                         "message": m.get("verify_no_citations",
                                          "The answer makes claims but cites no evidence — the citation protocol was ignored.")})
    elif uncited > 0:
        warnings.append({"level": "review", "code": "verify_uncited_claim",
                         "message": m.get("verify_uncited_claim",
                                          f"{uncited} claim(s) lack a valid citation — treat them as unverified.")})
    if gate and gate.get("freshness") == "stale" and any(p.search(answer) for p in fresh_res):
        warnings.append({"level": "review", "code": "verify_stale_framing",
                         "message": m.get("verify_stale_framing",
                                          'The answer uses fresh-sounding framing but the evidence is stale — the AI must not say "latest" or "today".')})

    result = {"pass": passed, "verdict": verdict, "citations": citations, "claims": claims,
              "stats": stats, "warnings": warnings, "caveats": [w["message"] for w in warnings]}

    if decision:
        meta = {} if decision is True else decision
        at = meta.get("at")
        if at is None:
            at = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        result["decision"] = {
            "schema": VERIFICATION_SCHEMA,
            "id": meta.get("id"),
            "at": at,
            # evidence digest: identical function + input as the gate's decision
            # record -> the join key. Neither the evidence nor the answer is stored.
            "digests": {"evidence": evidence_digest({"records": records, "supporting": supporting}),
                        "answer": evidence_digest(answer)},
            "verdict": verdict,
            "pass": passed,
            "stats": stats,
            "warnings": [{"level": w["level"], "code": w["code"]} for w in warnings],
        }

    return result
