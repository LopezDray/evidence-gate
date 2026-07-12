# Changelog

All notable changes to this project are documented here. This project adheres
to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **MCP `verify_claims` tool** — the MCP server now exposes the post-generation
  half of the loop alongside `check_evidence`: an agent calls it after drafting
  an answer to get the verdict ladder (incl. `misquoted_values` when records
  carry `facts`). Accepts `{ answer, records, supporting?, gate?, preset?,
  rules?, decision? }`; with the same `decision.id` and records, its
  verification record joins the `check_evidence` decision record on an
  identical evidence digest.
- **Fact cross-checking** — records may carry `facts: { name: number, … }`;
  `verifyClaims` / `verify_claims` then checks every number in a sentence
  citing that record against those values, exactly (design §8). A correctly
  cited but misquoted number now fails with new verdict `misquoted_values`
  and block warning `verify_misquoted_value`; details in the new `misquotes`
  result field and `stats.misquoted`. Magnitude suffixes (`K/M/B`, Thai
  `พัน หมื่น แสน ล้าน` and compounds up to `ล้านล้าน`), thousands separators,
  decimals, percents, and Thai numerals ๐-๙ all normalize deterministically
  and byte-identically across both ports; ISO dates are masked. Opt-in per
  record — without `facts` nothing changes.

### Changed
- Thai numerals ๐-๙ now count as claim digits in the default
  `claimPatterns` — a sentence like "กำไร ๑๒ ล้าน" needs a citation. Override
  `rules.verification.claimPatterns` to restore the old behavior.

## [1.0.0] — 2026-07-11

First stable release. The proof loop is complete: the gate decides whether the
model may speak, `verifyClaims` checks that what it said stands on the evidence,
and provenance records where that evidence came from — all deterministic and
byte-identical across the JS and Python ports, locked by a shared vector file.

### Changed
- **BREAKING: rulesets are validated at call time.** `staleDays`, `minRecords`,
  and `qualityThreshold` are now required finite numbers. A ruleset missing one
  throws instead of silently behaving as permissive (the old JS behavior) or
  raising an opaque `KeyError` (the old Python behavior). If you pass a
  hand-built ruleset rather than a preset, ensure these three fields are set.

### Added
- **Tamper-evident decision log** — `chainDecision` / `chain_decision` links
  each decision record to the previous one by digest (`prev` field);
  `verifyDecisionChain` / `verify_decision_chain` replays a log and reports the
  first broken link. Editing any past JSONL line invalidates every record after
  it. `prev` is additive (schema stays `evidence-gate.decision/1`); zero
  dependency, byte-identical across ports. Not cryptographic — detects
  after-the-fact edits, not a full-tail rewrite. See
  `examples/tamper-evident-log.mjs`.
- **Evidence provenance** (P3-1) — records can opt in to a `provenance`
  block (`source` id/type/authority, `retrievedAt`, `contentHash`, hash-linked
  transform `chain`). `validateProvenance` / `validate_provenance` checks
  chain continuity by construction (never throws, never changes status).
  Opt-in `rules.provenance` (`require`, `minAuthority`) adds
  `provenance_missing` / `provenance_untrusted` / `provenance_broken_chain`
  caveats plus a source-naming `provenance_attribution` caveat — by design
  these never change `status` or `allowedActions` in v1. Decision records
  gain an additive `decision.provenance` block (coverage, per-source tallies,
  broken chains, replay-verifiable digest) — schema stays
  `evidence-gate.decision/1`; adding optional fields never bumps the version.
  The core never computes hashes — see `examples/provenance.mjs`
  (`node:crypto` / `hashlib`).
- **Post-generation claim verification** (P3-2) — `verifyClaims` /
  `verify_claims` closes the proof loop: every citation in the answer must
  resolve to a real evidence record (no phantom evidence), every
  claim-looking sentence must carry a citation (no naked claims), and the
  framing must match the gate's verdict (no "as of today" over stale data).
  Verdict ladder `phantom_citations` → `no_citations` →
  `unsupported_claims` → `supported`; strict by default
  (`rules.verification.requireFullCoverage`). Deterministic, no model call,
  byte-identical across both ports (locked by shared vectors).
- `citationBlock` / `citation_block` — renders the evidence markers
  (`[ev:1]`, `[ev:acme-q1]`) the model must cite from; records gain an
  optional non-numeric `id`. Supporting records are citable and tagged
  `tier: "supporting"` in `citations[]`.
- **Verification record** (`evidence-gate.verification/1`) — opt-in via
  `decision`, mirrors the gate's decision log and joins it on the request id
  and an identical evidence digest; adds an answer digest. Neither the
  evidence nor the answer text is stored. See `examples/verified-loop.mjs`
  and README "The proof loop".
- **Shared cross-port test vectors** (`test/vectors.json`) — one file of gate
  cases, canonical-JSON strings, and FNV-1a digests that BOTH the JS suite
  (`test/vectors.test.mjs`) and the Python suite (`python/tests/test_core.py`)
  run, locking the two ports together byte-for-byte.
- **Rules validation at call time** — `validateRules` (JS) /
  `validate_rules` (Python), also exported. `staleDays`, `minRecords`, and
  `qualityThreshold` are now required finite numbers; optional fields are
  type-checked; both ports throw the same clear error naming the offending
  field.
- MCP `check_evidence` now accepts a `decision` argument (`true` or
  `{ id?, at? }`) and returns the decision record in the tool result, same as
  the library API. Invalid inline rulesets come back as a readable tool error
  (`isError: true`) instead of a protocol failure.

## [0.2.0] — 2026-07-10

### Added
- **Decision log / audit trail** — every `evidenceGate()` call can now emit an
  opt-in, JSONL-serializable decision record (evidence digest, ruleset digest +
  snapshot, outcome, caller-supplied id/timestamp). The core stays pure: it
  returns the record for the app to persist rather than writing files itself.
  Digests use FNV-1a 64 over canonical JSON, deterministic and identical across
  the JS and Python ports. See `examples/decision-log.mjs`.
- CI (GitHub Actions) runs the full JS suite (`core` + `edge` + `decision`) and
  the Python suite on every PR.

### Changed
- **PyPI package renamed to `evidence-gate-py`.** The plain `evidence-gate`
  name on PyPI belongs to an unrelated project; installing our package now uses
  `pip install evidence-gate-py`. The import name is unchanged
  (`from evidence_gate import ...`). The npm package remains `evidence-gate`.

### Fixed
- Null / missing `records` no longer crash the decision log; JS and Python
  ports now handle empty and malformed input identically.

## [0.1.0]

- Initial release: pre-generation evidence gate (status, freshness,
  `allowedActions`, warnings, caveats), `FINANCE` / `HEALTH` / `SUPPORT`
  presets, and an MCP server exposing a `check_evidence` tool. JS and Python
  ports, zero runtime dependencies.

[1.0.0]: https://github.com/LopezDray/evidence-gate/releases/tag/v1.0.0
[0.2.0]: https://github.com/LopezDray/evidence-gate/releases/tag/v0.2.0
[0.1.0]: https://github.com/LopezDray/evidence-gate/releases/tag/v0.1.0
