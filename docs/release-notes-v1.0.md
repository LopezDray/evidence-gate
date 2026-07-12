# Release notes — v1.0.0

> Published as GitHub Release v1.0.0 on 2026-07-12 (`f1a2985`). This matches
> what actually shipped to npm/PyPI at that tag — it does NOT include the MCP
> `verify_claims` tool, which was merged to `main` afterward and ships in
> v1.0.1 instead. See `release-notes-v1.0.1.md`.

## Evidence Gate 1.0 — the proof loop is complete

Evidence Gate is the missing step between **retrieve** and **generate**: a tiny,
zero-dependency gate that decides whether an LLM may speak from your data — and
now, whether what it said actually stands on that data.

This 1.0 closes the loop end-to-end:

- **Gate** (`evidenceGate`) — before generation, decide `summarize` / `compare`
  from evidence coverage, freshness, and quality; get prompt-ready caveats.
- **Prove the answer** (`verifyClaims`) — after generation, check every citation
  resolves to a real record (no phantom evidence), every claim carries a citation
  (no naked claims), and the framing matches the verdict (no "as of today" over
  stale data). Deterministic, no model call.
- **Catch misquoted numbers** (`record.facts`) — opt in by attaching
  `facts: { revenue: 1234500 }` to a record, and every number in a sentence
  citing it must match exactly, or the answer fails with `misquoted_values`. A
  correctly cited but wrong figure — the failure mode a citation check alone
  misses — is now caught deterministically. Magnitude suffixes (`1.2M`,
  `1.5 ล้าน`), thousands separators, and Thai numerals all normalize identically
  across ports.
- **Prove the evidence** (`record.provenance`) — where each observation came
  from, hash-linked transform chain, source authority; surfaces as caveats and a
  replay-verifiable digest.
- **Audit trail** — decision and verification records join on the request id and
  an identical evidence digest, without storing the evidence or the answer.
- **MCP server** — a `check_evidence` tool so any MCP-compatible agent can gate
  itself before it speaks.

Everything is byte-identical across the JavaScript and Python ports, locked by a
shared vector file (`test/vectors.json`) that both test suites run.

### ⚠️ Breaking change

Rulesets are now validated at call time: `staleDays`, `minRecords`, and
`qualityThreshold` are required finite numbers. A ruleset missing one throws
instead of silently behaving as permissive. Presets are unaffected — only
hand-built rulesets need to ensure these three fields are set.

### Install

```bash
npm install evidence-gate
pip install evidence-gate-py
```

### Links

- Full changelog: [CHANGELOG.md](../CHANGELOG.md#100--2026-07-12)
- The proof loop, provenance, MCP usage: [README](../README.md)
- Design specs: [claim-verification](design/claim-verification.md) ·
  [provenance](design/provenance.md)

> Note: the GitHub Release body as published omits the "Draft for..." note
> above and the `verify_claims` mention in the MCP bullet — see the actual
> published text at
> https://github.com/LopezDray/evidence-gate/releases/tag/v1.0.0
