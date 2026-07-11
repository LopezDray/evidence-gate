# Changelog

All notable changes to this project are documented here. This project adheres
to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
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

### Fixed
- Closed a port divergence: the JS gate silently treated a ruleset with
  missing numeric fields as permissive (everything looked fresh), while
  Python raised a bare `KeyError`. Both ports now reject incomplete rules
  identically — even when `records` is empty.

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

[0.2.0]: https://github.com/LopezDray/evidence-gate/releases/tag/v0.2.0
[0.1.0]: https://github.com/LopezDray/evidence-gate/releases/tag/v0.1.0
