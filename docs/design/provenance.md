# Design: Evidence Provenance (P3-1)

Status: **approved 2026-07-02** (all open questions resolved, see §9) — ready to implement. Companion to the decision log
(`evidence-gate.decision/1`, shipped) — together they turn "the AI cited a ref"
into "the system can prove what evidence the answer stood on."

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

`minAuthority` is compared **per record** — one weak source taints the set
with a caveat. It applies only to records that HAVE provenance (records
without any are `provenance_missing` territory); a provenance block whose
`source.authority` is absent counts as `"unverified"`.

Deliberate scope cut for v1: provenance warnings **never change `status` or
`allowedActions`** — they add caveats. Promoting them to status-level signals
is a future rule (`escalate: true`) once real usage shows it's wanted.
Rationale: silently flipping `summarize` to `false` because of missing
metadata would break every existing integration the day they add one
provenance-bearing record.

**Source-naming caveats.** One rule: when the provenance-bearing records span
**at most 2 distinct sources**, an attribution caveat names them, e.g.:

> financial statements are based on sec-edgar (official), retrieved 2026-06-30.

With 3+ distinct sources the caveat is omitted (an unreadable list helps no
one) — the full per-source breakdown still lands in
`decision.provenance.sources` (§5) for auditors. Emitted as its own `info`
warning `provenance_attribution` so it composes with existing messages
instead of rewriting them.

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
  digest: "fnv1a64:…",                       // evidenceDigest() of the provenance array, see below
}
```

The digest input is an array **positionally aligned with `records`**: element
i is record i's provenance object, or `null` when record i has none. This
keeps replay unambiguous — skipping provenance-less records would let two
different evidence sets share a digest.

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

## 7. Future: tamper-evident log (v1.x candidate, not in this scope)

The decision log becomes a hash chain with one pure helper:

```js
chainDecision(decision, prevDigest) → { ...decision, prev: prevDigest }
```

where `prevDigest = evidenceDigest(previousDecisionRecord)`. Any edit to a
past JSONL line breaks every digest after it. Cheap, zero-dependency, and the
reason `decision.at`/`decision.id` were caller-supplied from day one.

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

## 9. Resolved decisions (2026-07-02, owner-approved)

1. `minAuthority` compares **per record** — one weak source taints the set
   with a caveat. Missing `source.authority` counts as `"unverified"` (§4).
2. Attribution caveat names sources only when there are **≤2 distinct
   sources**; silent otherwise, full breakdown always in
   `decision.provenance.sources` (§4, §5).
3. Python port accepts **snake_case only**, consistent with the existing port.
4. *(from the logic review)* `decision.provenance.digest` hashes a
   positionally-aligned array with `null` placeholders (§5).
