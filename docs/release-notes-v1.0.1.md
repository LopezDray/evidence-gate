# Release notes — v1.0.1

> Draft for the GitHub Release body. Owner: create the release from tag `v1.0.1`
> (release-checklist.md step 11) after publishing npm + PyPI. Adjust the date if
> you publish on a different day.

## MCP server: `verify_claims` tool

v1.0.0 shipped the MCP server with `check_evidence` only — the `verify_claims`
tool was still on `main` mid-merge when v1.0.0 was tagged and published. This
patch adds it, so the MCP server now exposes **both halves of the proof loop**:

- **`check_evidence`** — before generation, may the model speak at all?
- **`verify_claims`** *(new)* — after generation, does the answer stand on the
  evidence: every citation resolves to a real record, every claim carries a
  citation, and — when records carry `facts` — every cited number matches them
  exactly (`misquoted_values`).

Accepts `{ answer, records, supporting?, gate?, preset?, rules?, decision? }`.
With the same `decision.id` and records as the `check_evidence` call, its
verification record joins that decision record on an identical evidence
digest — the audit trail is complete over MCP, not just the direct API.

No other changes. The Python package (`evidence-gate-py`) has no code changes
in this release — its version bump is for parity across the four version
points (npm, PyPI, `__init__.py`, MCP server), per this project's convention.

### Install

```bash
npm install evidence-gate@1.0.1
pip install evidence-gate-py==1.0.1
```

### Links

- Full changelog: [CHANGELOG.md](../CHANGELOG.md#101--2026-07-12)
- MCP usage: [README](../README.md#use-it-as-an-mcp-server)
