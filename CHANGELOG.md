# Changelog

All notable changes to this project are documented here. This project adheres
to [Semantic Versioning](https://semver.org/).

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
