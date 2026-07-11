# Design: Post-generation Claim Verification — `verifyClaims` (P3-2)

Status: **approved — ready to implement** (2026-07-02, #8: open questions
answered "ตามร่างทั้งหมด" — all per draft; see §12 for the resolutions).
Closes the loop that the gate opens: the gate decides *whether* the model may
speak; `verifyClaims` checks *whether what it said stands on the evidence it
was given*.

```
retrieve ──► evidenceGate ──► prompt (+ citation block) ──► LLM ──► verifyClaims
                 │ decision record                                     │ verification record
                 └────────────── same evidence digest links both ──────┘
```

## The honesty constraint that shapes this design

The core is pure, deterministic, dependency-free, and never calls a model. A
library like that **cannot judge semantic truth** — "revenue grew modestly" is
unverifiable without a judge. What it CAN do, exactly and reproducibly, is
verify a **citation protocol**:

1. We tell the model how to cite (a marker per evidence record, injected into
   the prompt next to the gate's caveats).
2. We parse the answer and check every citation resolves to a record that
   exists (**no phantom evidence**).
3. We check every claim-looking sentence carries a citation (**no naked claims**).
4. We check the answer's framing against the gate's verdict (**no "as of
   today" over stale data**).

That catches the failure modes that matter most in practice — invented
sources, uncited numbers, false freshness — while staying deterministic and
identical across the JS/Python ports. Semantic judging is a pluggable
extension (§9), never a core behavior.

## 1. Prompt side: `citationBlock(records, opts?)`

Pure helper that renders the evidence list the model must cite from:

```js
citationBlock(records)
// EVIDENCE (cite with its marker after every factual statement):
// [ev:1] 2026-03-31 — quality 92
// [ev:2] 2025-12-31 — quality 90
// [ev:3] 2025-09-30 — quality 91, flags: RESTATED
```

- Markers are **1-based indexes into the records array** — deterministic,
  collision-free, order-defined by the caller.
- If a record has an optional `id` (new, optional, also useful elsewhere),
  the marker becomes `[ev:acme-q1]` and index remains an accepted alias.
- `opts.header` / `opts.line` override the strings (same philosophy as
  `rules.messages`); nothing is locale-bound in the protocol itself.

## 2. Verify side: `verifyClaims(...)`

```js
verifyClaims({
  answer,              // the model's text
  records,             // the SAME array the prompt was built from (order matters)
  gate?,               // prior evidenceGate() result — enables freshness cross-checks
  rules?,              // verification knobs, see §5 (all optional)
  decision?,           // true | { id?, at? } — emit a verification record (§7)
})
→ {
  pass: boolean,                       // the one bit most apps need
  verdict: "supported" | "unsupported_claims" | "no_citations" | "phantom_citations",
  citations: [ { marker: "ev:2", ref: "2", record: 1, valid: true } ],   // record = resolved index | null
  claims:    [ { text, cited: true, markers: ["ev:2"] } ],               // claim-looking sentences only
  misquotes: [ { token: "1.5M", value: 1500000, sentence: "…" } ],       // §8 — empty unless facts caught a misquote
  stats: { claims: 4, cited: 3, uncited: 1, phantom: 0, misquoted: 0 },
  warnings: [ { level, code, message } ],   // same shape as gate warnings
  caveats: [ "…" ],                         // ready to feed a retry prompt or footer disclosure
  decision?                                  // evidence-gate.verification/1 (§7)
}
```

Same contract style as `evidenceGate`: never throws on messy input (a garbage
answer yields a verdict, not an exception); `rules`-overridable messages;
warnings→caveats mirroring.

## 3. Marker grammar & resolution

- Grammar: `[ev:<ref>]` where `<ref>` is `[A-Za-z0-9_.-]+`. Parsed with one
  shared regex, spec'd here so both ports match byte-for-byte:
  `\[ev:([A-Za-z0-9_.-]+)\]`.
- Resolution order: exact match on `record.id` → else, if `<ref>` is an
  integer `1..records.length`, that index. Anything else is **phantom**.
- A marker binds to the sentence it appears in. Multiple markers per sentence
  are fine.

## 4. Claim detection (deterministic heuristic, overridable)

A sentence is a *claim needing citation* if it matches any claim pattern.
Defaults (shared verbatim across ports):

| pattern | catches |
|---|---|
| `\d` | any ASCII digit — amounts, dates, counts, percents |
| `[๐-๙]` | Thai numerals (added with §8 — an explicit range, NOT Unicode `\d`) |
| `%|\$|€|£|฿` | symbols that imply a quantity even without digits nearby |

Sentence segmentation: split on `[.!?]` followed by whitespace, and on
newlines; trim empties. Deliberately simple — the goal is a stable, port-
identical partition, not linguistic perfection. Digit-based detection is
language-neutral (works for Thai/Japanese answers too, where sentence
punctuation differs — newline splitting carries those).

Override: `rules.verification.claimPatterns: [regexSource, …]` replaces the
defaults (regex *sources* as strings, compiled per port — never functions, so
rulesets stay JSON-serializable and digestable).

## 5. Verdict ladder & `pass`

Evaluated top-down, first hit wins:

1. **`phantom_citations`** — ≥1 marker fails to resolve. The model invented
   evidence; worst outcome, always `pass: false`.
2. **`misquoted_values`** — ≥1 cited number disagrees with the cited
   record's facts (§8, only when facts are attached). Always `pass: false`.
3. **`no_citations`** — ≥1 claim detected, zero valid markers in the whole
   answer. The protocol was ignored; `pass: false`.
4. **`unsupported_claims`** — some claims lack markers. `pass` depends on
   `rules.verification.requireFullCoverage` (default **true** → false).
5. **`supported`** — every claim carries ≥1 valid citation; `pass: true`.

An answer with no claims at all (e.g. a refusal, or "I don't have data on
NEWCO") is `supported` — refusing correctly must pass the loop.

## 6. Cross-checks against the gate result (when `gate` is passed)

| code | level | fires when |
|---|---|---|
| `verify_phantom_citation` | block | marker resolved to nothing |
| `verify_uncited_claim` | review | claim sentence without a valid marker |
| `verify_no_citations` | block | claims exist, protocol ignored |
| `verify_stale_framing` | review | `gate.freshness === "stale"` and the answer matches freshness-claim patterns (default `\b(today|as of now|currently|latest|real[- ]?time)\b/i`, overridable — English-only by default, apps localize via `rules.verification.freshnessPatterns`) |
| `verify_misquoted_value` | block | a number in a cited claim disagrees with the cited record's `facts` (§8 — no `gate` needed, fires whenever facts are attached) |
| `verify_forbidden_leak` | block | *(future, needs judge §9 — reserved code, not implemented)* |

All messages overridable via `rules.messages` exactly like gate warnings.

## 7. Verification record — `evidence-gate.verification/1`

Opt-in via `decision`, mirroring the gate's decision log:

```js
{
  schema: "evidence-gate.verification/1",
  id: "req-001",                      // caller-supplied — SAME id as the gate decision
  at: "2026-07-02T10:00:07Z",
  digests: {
    evidence: "fnv1a64:…",            // identical function+input as the gate record → the join key
    answer:   "fnv1a64:…",            // digest of the answer text; the text itself is NOT stored
  },
  verdict, pass,
  stats: { claims, cited, uncited, phantom },
  warnings: [ { level, code } ],
}
```

The audit story this completes: for one request id, the log now holds a gate
decision (what evidence, which rules, what was allowed) and a verification
record (what the model did with it) — joined by id and by an identical
evidence digest, each replay-verifiable, with neither the evidence nor the
answer stored. Additive versioning policy from `docs/design/provenance.md`
applies.

## 8. Fact cross-checking — `verify_misquoted_value`

Status: **full spec — approved 2026-07-11** (owner resolutions: strict
matching, exact equality, Thai numerals fully supported, new verdict rung —
see §12). Supersedes the v1 concept sketch that lived in this section.

Records today are metadata-only — the gate never sees values, so a correctly
cited but **misquoted number** passes §5. Apps opt in per record by attaching
`facts`:

```js
{ date: "2026-03-31", qualityScore: 92, facts: { revenue: 1234500, eps: 0.42 } }
```

Deterministic misquote detection with no model — no new rules knobs at all:
the strict + exact resolutions make the feature zero-config. Everything below
is normative and must be byte-identical across the JS and Python ports.

### 8.1 When a sentence is fact-checked

A sentence is fact-checked iff it is a **claim** (§4) **and** carries ≥1
**valid** citation. Its *fact pool* is the union of numeric fact values from
every validly cited record (primary and supporting alike) that has *usable
facts*:

- *usable facts* = `facts` is a plain object with **≥1 finite numeric value**
  (booleans excluded). An absent `facts`, `{}`, an array, or an all-string
  object is NOT usable — spelled out to dodge the `{}` truthiness port trap.
- Non-numeric and nested values inside `facts` are ignored (v1 of the
  feature is flat numbers only). `NaN`/`Infinity` are ignored (can't come
  from JSON anyway).

Empty pool → the sentence is **skipped silently**. No facts anywhere → the
whole feature is inert; `verifyClaims` behaves exactly as before (opt-in,
never a new failure mode for existing callers). Uncited claims are not
fact-checked — they are already flagged `verify_uncited_claim`.

### 8.2 Number extraction (byte-identical pipeline)

Runs on the **marker-stripped** sentence (same string claim detection sees),
in this exact order:

1. **Thai digit translation** — ๐–๙ (U+0E50–U+0E59) map to 0–9 via an
   explicit table in each port. Never rely on Unicode `\d` (the Python port
   compiles all patterns with `re.ASCII`).
2. **ISO date masking** — every match of `(?<![0-9])[0-9]{4}-[0-9]{2}-[0-9]{2}(?![0-9])`
   is replaced with a single space, so date components never leak into
   matching. Only ISO `YYYY-MM-DD` is masked; other date shapes are ordinary
   numbers under the strict rule.
3. **Token regex** — one source string, shared verbatim (Python compiles it
   with `re.ASCII`; every class is explicit so the flag is belt-and-braces):

   ```
   (?<![0-9.])(-?)([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)((?:\.[0-9]+)?)(?:[ \t]?(ล้านล้าน|แสนล้าน|หมื่นล้าน|พันล้าน|ล้าน|แสน|หมื่น|พัน|[KkMmBb](?![A-Za-z0-9])))?
   ```

   Groups: 1 = sign, 2 = integer part (comma thousands separators allowed),
   3 = `.fraction` or empty, 4 = magnitude suffix or none. The lookbehind
   keeps ranges positive (`3-5%` → `3`, `5` — never `-5`) and stops
   `v1.2.3`-style tails; the lookahead keeps `512MB`, `10Kg` from reading as
   magnitudes. A single space/tab may separate number and suffix
   (`1.5 ล้าน`). Comma is the only thousands separator. Scientific notation
   is unsupported by design (`1e6` reads as `1` and `6`).

4. **Magnitude table** (fixed constant, NOT overridable): `K`/`k` → 10³,
   `M`/`m` → 10⁶, `B`/`b` → 10⁹, `พัน` → 10³, `หมื่น` → 10⁴, `แสน` → 10⁵,
   `ล้าน` → 10⁶, `พันล้าน` → 10⁹, `หมื่นล้าน` → 10¹⁰, `แสนล้าน` → 10¹¹,
   `ล้านล้าน` → 10¹². Longest-first alternation in the regex resolves the
   compounds. Known accepted limitation: Thai has no word boundaries, so
   e.g. `1 ล้านนา` reads a magnitude — irrelevant in financial answers.

5. **Canonical value — decimal-point shift, never float multiply.**
   `1.2 * 1e6 === 1199999.9999999998…` in IEEE-754; a float multiply breaks
   exact matching identically in BOTH ports. Instead build the canonical
   decimal string by shifting the point, then parse **once**:

   - `I` = integer digits with separators stripped; `F` = fraction digits or
     empty; `e` = suffix exponent (0 if none)
   - `digits = I + F`, point position `p = len(I) + e`
   - `p ≥ len(digits)` → `whole = digits + "0" × (p − len(digits))`,
     `frac = ""`; else `whole = digits[:p]`, `frac = digits[p:]`
   - strip leading zeros of `whole` (empty → `"0"`); strip trailing zeros of
     `frac`
   - `canonical = sign + whole + ("." + frac if frac else "")`
   - `value = parseFloat(canonical)` / `float(canonical)` — string→double is
     correctly rounded and identical across ports

   `%` is **not** part of the token: `8%` → `8` (facts store percentages as
   displayed — `8`, not `0.08`). Currency symbols are never extracted.

### 8.3 Matching rule — strict, exact

**Every** extracted token in a fact-checked sentence must equal
(IEEE-754 double equality; Python int facts compare numerically) **some**
value in the sentence's fact pool. No tolerance of any kind: `1.2M`
(= 1,200,000 exactly) vs fact `1234500` is a misquote; so is `1.23M`.
Rounded prose must either match a rounded fact the app chose to publish, or
be rewritten with the exact number.

Consequence chosen deliberately: contextual numbers in a cited sentence —
years (`2026`), quarter ordinals, counts — must themselves appear in `facts`,
or the sentence blocks. Strictness is the product: the app controls both the
facts and (via retry) the wording. ISO dates are masked (§8.2) as the one
concession, because `record.date` is already first-class metadata.

Every failing token **occurrence** appends `{ token, value, sentence }` to
`misquotes` (token as written, matched text; value as parsed) and increments
`stats.misquoted`. Facts and stated values must live within the
double-exact range (|x| ≤ 2⁵³, no sub-ULP distinctions) — outside it the
ports may legitimately disagree and behavior is unspecified.

### 8.4 Result contract & verdict placement

- `misquotes: [ { token, value, sentence } ]` — always present (empty array
  when nothing failed or feature inert).
- `stats` gains `misquoted` (always present, additive).
- Verdict ladder (§5) gains rung 2: `phantom_citations` →
  **`misquoted_values`** → `no_citations` → `unsupported_claims` →
  `supported`. `pass: false` always. (`misquoted_values` needs a valid
  citation while `no_citations` needs zero, so rungs 2–3 can never compete.)
- Warning `verify_misquoted_value` (**block**) fires whenever
  `stats.misquoted > 0` — even when phantom wins the verdict — ordered after
  `verify_phantom_citation`, before the `verify_no_citations` /
  `verify_uncited_claim` slot. Message lists unique offending tokens in
  order of appearance; overridable via `rules.messages` as usual.
- The verification record (§7) stays schema `/1`: `stats.misquoted` is an
  additive field, and the verdict enum was always an open set — consumers
  must not exhaustively match it.
- Default claim patterns (§4) become `["\\d", "[๐-๙]", "%|\\$|€|£|฿"]` —
  Thai-numeral sentences now count as claims. This deliberately updates the
  vector that previously locked ๑๒ as a non-claim (a spec'd behavior change
  applied to both ports and the vector in the same commit — not a
  make-it-pass edit).

## 9. Out of core: the judge interface

Semantic entailment ("does the evidence *support* this wording?") needs a
model. The core defines only the contract so adapters can slot in above the
deterministic layer:

```js
judge: async (claim, records) => ({ supported: boolean, note?: string })
```

An adapter package may run it (LLM-as-judge, NLI model, human queue) and merge
results into `warnings` as `verify_judge_rejected`. The core never awaits
anything — `verifyClaims` stays synchronous in both ports.

## 10. Worked example

```js
const gate = evidenceGate({ records, rules: presets.FINANCE, decision: { id: "req-9" } });
const prompt = [sys, ...gate.caveats.map(c => "- " + c), citationBlock(records), question].join("\n");
const answer = await llm(prompt);
// "Revenue was 1.2M in Q1 [ev:1]. Growth vs Q4 was 8% [ev:9]. As of today, margins look strong."

const v = verifyClaims({ answer, records, gate, rules: presets.FINANCE, decision: { id: "req-9" } });
// verdict: "phantom_citations", pass: false
// warnings: verify_phantom_citation ([ev:9] — only 4 records exist),
//           verify_uncited_claim ("As of today, margins look strong."),
//           verify_stale_framing (gate said stale; answer says "as of today")
// → app retries with v.caveats appended, or ships the answer with a disclosure footer
```

## 11. Implementation plan (when picked up)

| # | task | effort |
|---|---|---|
| 1 | marker grammar, `citationBlock`, resolution — JS + Py + shared-vector tests | 1 AI-day |
| 2 | sentence split + claim detection + verdict ladder — JS + Py + tests | 1.5 AI-days |
| 3 | gate cross-checks (`verify_stale_framing` etc.) + messages overrides | 1 AI-day |
| 4 | verification record + digest-join test with gate decision + example (`examples/verified-loop.mjs`) | 1 AI-day |
| 5 | README "The proof loop" section | 0.5 AI-day |

Owner review ~6 hrs. No new dependencies; `record.id` addition is optional and
backward-compatible; MCP server gains a `verify_claims` tool for free in a
follow-up.

## 12. Open questions — RESOLVED (2026-07-02, #8: all per draft)

1. `requireFullCoverage` default **true** (strict) — the whole point is proof.
2. Marker syntax: **one grammar only**, `[ev:…]` — two grammars = two ways to
   fail.
3. `supporting` records are **citable**, tagged in `citations[].tier`
   (`"primary"` / `"supporting"`) so strict apps can reject. `verifyClaims`
   accepts `supporting` as a parameter — also required so its evidence digest
   equals the gate's (`digest({ records, supporting })`), the join key.

Review clarifications (WP1):

- Record `id`s must **not be purely numeric** (`^\d+$`) — numeric refs are
  reserved for index resolution, so a numeric id could never be told apart
  from an index. Invalid ids are silently ignored (the record falls back to
  its index marker), never an error.
- Markers/refs are **1-based** positions into the concatenation
  `[records..., supporting...]`; the resolved `citations[].record` field is
  the **0-based** index into that same concatenation (e.g. ref `"2"` →
  `record: 1`).

§8 fact cross-checking — RESOLVED (2026-07-11, owner):

1. **Checkability: strict** — every number in a cited claim sentence is
   checked (only ISO dates are masked). Years/counts must be in `facts` or
   the sentence blocks; the app owns that discipline.
2. **Tolerance: exact only** — `1.2M` must equal the fact exactly
   (1,200,000); no half-unit or percent tolerance. Zero config knobs.
3. **Thai numerals: full support** — `[๐-๙]` joins the default claim
   patterns and Thai digits are translated before extraction. The old
   vector locking ๑๒ as a non-claim is deliberately updated.
4. **Verdict: new rung** — `misquoted_values` sits between
   `phantom_citations` and `no_citations`; the verdict enum is an open set,
   schema stays `/1`.
