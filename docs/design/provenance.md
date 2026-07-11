# Design: Evidence Provenance (P3-1)

Status: **approved — ready to implement** (2026-07-02, #8: open questions
answered "ตามร่างทั้งหมด" — all per draft; see §9 for the resolutions).
Companion to the decision log (`evidence-gate.decision/1`, shipped) — together
they turn "the AI cited a ref" into "the system can prove what evidence the
answer stood on."

## Goal

Let a record answer three questions an auditor asks:

1. **Where did this observation come from?** (source + authority)
2. **What happened to it on the way here?** (transform chain, hash-linked)
3. **Is it the same bytes it claims to be?** (content hash, replay-verifiable)

And let the gate *use* those answers: caveats that name sources, warnings when
provenance is missing or broken, and a decision record that captures the
provenance picture at decision time.

## Non-goals

- **No hashing inside the core.** The core stays pure and zero-dependency; it
  treats hashes as opaque `"<alg>:<hex>"` strings. Apps/adapters compute them
  (Node `crypto`, Python `hashlib` — see the example that will ship with the
  implementation).
- **No fetching, no document parsing.** Provenance describes what the app did;
  the library never does it.
- **Not a cryptographic audit system.** Same stance as the decision log:
  deterministic and replay-verifiable, tamper-*evident* at best (see hash
  chain, §7), not adversary-proof.

## 1. Schema: `record.provenance`

Provenance is **opt-in per record**. A record without it behaves exactly as
today. JS uses camelCase, Python snake_case, same shape.

```js
record = {
  date, qualityScore?, quality?, flags?, tier?,          // unchanged
  provenance?: {
    source: {
      id:        "sec-edgar",            // stable identifier of the source system
      type:      "filing",               // open vocabulary, see §2
      authority: "official",             // "official" | "licensed" | "secondary" | "unverified"
    },
    retrievedAt: "2026-06-30T08:12:00Z", // when the app pulled it (ISO 8601)
    contentHash: "sha256:ab12…",         // hash of the RAW artifact, opaque to the core
    chain: [                             // optional transform lineage, ordered
      { step: "parse",     tool: "edgar-parser@2.1", at: "2026-06-30T08:12:05Z",
        inputHash: "sha256:ab12…", outputHash: "sha256:cd34…" },
      { step: "normalize", tool: "etl@0.9",
        inputHash: "sha256:cd34…", outputHash: "sha256:ef56…" },
    ],
  },
}
```

Only `source` is required inside `provenance`; everything else is optional.
Minimal useful provenance is one line: `provenance: { source: { id, type, authority } }`.

## 2. Vocabularies

**`source.type`** — open vocabulary; recommended values: `filing`, `api`,
`database`, `document`, `manual`, `derived`. Unknown values pass through
untouched (same philosophy as flags).

**`source.authority`** — closed ladder, ordered:

```
official > licensed > secondary > unverified
```

Relationship to `tier` (the existing coarse knob): `tier` stays authoritative
for status classification and is unchanged. Authority *refines* it — the
convention is `tier: "fallback"` ≈ `authority: "secondary"` or below. The gate
never silently maps one onto the other; §4 defines the explicit opt-in rule.

## 3. Chain continuity rules

The `chain` is verifiable by construction:

- `chain[0].inputHash` MUST equal `contentHash` (the chain starts at the raw artifact).
- `chain[i].inputHash` MUST equal `chain[i-1].outputHash` (no gaps).
- Hashes are compared as opaque strings; the core never re-computes them.

A pure validator ships with the implementation:

```js
validateProvenance(record) → { valid, problems: ["chain_gap_at_1", "chain_root_mismatch", …] }
```

Broken continuity never throws and never changes gate status by itself — it
surfaces as a warning (§4). Garbage in, caveat out.

## 4. Gate behavior (opt-in via `rules.provenance`)

Without `rules.provenance`, nothing changes — presets keep working as-is.
With it:

```js
rules.provenance = {
  require: true,              // records lacking provenance draw a warning
  minAuthority: "licensed",   // records below this draw a warning
}
```

New warning codes (existing levels; messages overridable via `rules.messages`):

| code | level | fires when |
|---|---|---|
| `provenance_missing` | review | `require: true` and ≥1 record has no provenance |
| `provenance_untrusted` | review | ≥1 record's authority < `minAuthority` |
| `provenance_broken_chain` | review | ≥1 record fails §3 continuity |

Deliberate scope cut for v1: provenance warnings **never change `status` or
`allowedActions`** — they add caveats. Promoting them to status-level signals
is a future rule (`escalate: true`) once real usage shows it's wanted.
Rationale: silently flipping `summarize` to `false` because of missing
metadata would break every existing integration the day they add one
provenance-bearing record.

**Source-naming caveats.** When all records that have provenance agree on a
source, the stale/quality caveat gains an attribution suffix, e.g.:

> financial statements are based on sec-edgar (official), retrieved 2026-06-30.

Emitted as its own `info` warning `provenance_attribution` so it composes with
existing messages instead of rewriting them.

## 5. Decision record additions (stays `evidence-gate.decision/1`)

**Versioning policy (new, applies from now on):** the `/1` suffix is a major
version. Adding optional fields is non-breaking and does NOT bump it;
consumers must ignore unknown fields. Removing/renaming fields bumps to `/2`.

When any input record carries provenance, the decision record gains one
additive block:

```js
decision.provenance = {
  covered: 3, total: 4,                      // records with provenance / all records
  sources: [ { id: "sec-edgar", type: "filing", authority: "official", records: 3 } ],
  brokenChains: 0,
  digest: "fnv1a64:…",                       // evidenceDigest() of all provenance objects, in record order
}
```

- Privacy stance is inherited: no evidence values, no content excerpts. Source
  ids DO appear (auditors need them); apps that consider ids sensitive omit
  `id` — it is optional everywhere.
- `digest` makes provenance replay-verifiable exactly like evidence:
  recompute over the claimed provenance set, compare with the log.

## 6. Worked examples

**Finance** — quarterly filing pipeline:

```js
{ date: "2026-03-31", qualityScore: 92,
  provenance: {
    source: { id: "sec-edgar", type: "filing", authority: "official" },
    retrievedAt: "2026-06-30T08:12:00Z",
    contentHash: "sha256:ab12…",
    chain: [
      { step: "parse-xbrl", tool: "edgar-parser@2.1", inputHash: "sha256:ab12…", outputHash: "sha256:cd34…" },
      { step: "normalize",  tool: "fin-etl@0.9",      inputHash: "sha256:cd34…", outputHash: "sha256:ef56…" },
    ] } }
```

**Support KB** — crawled doc, no chain, secondary authority:

```js
{ date: "2026-05-10",
  provenance: { source: { id: "help-center", type: "document", authority: "secondary" },
                retrievedAt: "2026-07-01T02:00:00Z" } }
```

With `rules.provenance = { minAuthority: "official" }` the second example
draws `provenance_untrusted`; without `rules.provenance` it draws nothing.

## 7. Tamper-evident log — **implemented (1.0.0)**

The decision log becomes a hash chain with two pure helpers:

```js
chainDecision(decision, prevDigest?) → { ...decision, prev: prevDigest ?? null }
verifyDecisionChain(records)         → { valid, brokenAt }
```

- `prevDigest = evidenceDigest(previousChainedRecord)`; the first record in a
  chain takes `null` (the default). Because a record's digest covers its own
  `prev`, editing any past JSONL line changes its digest and breaks the `prev`
  of **every** record after it — `verifyDecisionChain` reports the first broken
  index. Cheap, zero-dependency, and the reason `decision.at`/`decision.id`
  were caller-supplied from day one.
- `prev` is an **additive optional field**: the record stays
  `evidence-gate.decision/1` (§5 policy), and records outside a chain omit it.
- Not cryptographic (same stance as the digest note): it detects after-the-fact
  edits; it does not stop a forger who rewrites the entire tail. Snapshot the
  latest digest somewhere append-only (or sign it) if you need that.

See `examples/tamper-evident-log.mjs`. Python: `chain_decision` /
`verify_decision_chain`, byte-identical (locked by `test/vectors.json`
→ `decisionChain`).

## 8. Implementation plan (when picked up)

| # | task | effort |
|---|---|---|
| 1 | `validateProvenance` + chain rules, JS + Py + tests | 1 AI-day |
| 2 | `rules.provenance` warnings + attribution caveat, JS + Py + tests | 1.5 AI-days |
| 3 | `decision.provenance` block + digest + replay test | 1 AI-day |
| 4 | Example: hashing with `node:crypto`/`hashlib` in an adapter, README section | 0.5 AI-day |

Owner review: ~6 hrs total. Everything lands in the existing core files; no
new dependencies; MCP server inherits it for free (`check_evidence` already
passes `rules` through).

## 9. Open questions — RESOLVED (2026-07-02, #8: all per draft)

1. `minAuthority` compares **per-record** — one weak source taints the set
   with a caveat. A record whose authority is missing or outside the ladder
   ranks below `unverified` (always draws `provenance_untrusted` when
   `minAuthority` is set).
2. Attribution: named when the provenance-bearing records have **1 or 2
   distinct sources** (and every one of them has a string `id`); **silent
   when >2** or when any source is unnamed. Counts still land in
   `decision.provenance.sources`. The `retrieved <date>` suffix appears only
   for a single distinct source (latest `retrievedAt`, date part).
3. Python port accepts **snake_case only** (`retrieved_at`, `content_hash`,
   `input_hash`/`output_hash`), consistent with the existing port.
