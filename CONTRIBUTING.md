# Contributing

Thanks for considering a contribution! Evidence Gate is intentionally small and dependency-free — please keep it that way.

## Principles

- **Zero runtime dependencies** in the core. The MCP server's SDK is an optional peer dependency only.
- **The core is pure logic.** No network, no file I/O, no global state. You bring the records; the gate decides.
- **Behavior changes need tests.** Every rule lives behind a test in `test/`.

## Develop

```bash
git clone <this repo>
cd evidence-gate
npm test                          # JS (core + edge + decision suites)
python python/tests/test_core.py  # Python
```

The JS (`src/`) and Python (`python/`) ports implement the same logic. If you change a rule, change both and update both test suites.

## What's welcome

- New presets for domains we don't cover (legal, insurance, etc.)
- Adapters that turn common data shapes into records
- Edge cases that the gate gets wrong (open an issue with a failing example)
- Docs and examples

## What to avoid

- Adding dependencies to the core
- Fetching/parsing data inside the library (that belongs in your app or an adapter)
- Breaking the public API without a version bump

Open an issue first for anything substantial. Small PRs with a test are easiest to merge.
