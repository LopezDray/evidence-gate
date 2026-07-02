// Evidence Gate — core engine
//
// Decide whether an LLM may speak about a set of records, BEFORE it generates
// anything — based on evidence coverage, freshness, and quality.
//
// Zero dependencies. Domain-agnostic: you bring the records + a ruleset (preset).
//
//   record = { date, qualityScore?, quality?, flags?, tier? }
//   - date         ISO "YYYY-MM-DD" of the observation
//   - qualityScore optional 0-100 numeric quality
//   - quality      optional "clean" | "review"
//   - flags        optional string[] of data-quality flags
//   - tier         optional "primary" (default) | "fallback" (cached/secondary source)

// ── Freshness primitives ──────────────────────────────────────────────────────
export function parseDate(value) {
  if (!value) return null;
  const m = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  // reject impossible dates that JS would silently roll over (e.g. 2026-13-01, 2026-02-31)
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export function daysSince(date) {
  if (!date) return null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((today - date.getTime()) / 86400000);
}

export function freshnessLabel(latest, thresholdDays) {
  const age = daysSince(latest);
  if (age === null) return "unknown";
  return age > thresholdDays ? "stale" : "fresh";
}

// ── classifyStatus: records[] + rules → status of the primary evidence group ──
//   rules: { staleDays, minRecords, qualityThreshold }
//   returns: { status, freshness, latest, count, qualityMin, flags }
//   status: "available" | "quality_warning" | "fallback" | "missing"
export function classifyStatus(records, rules) {
  const usable = records || [];
  if (!usable.length) {
    return { status: "missing", freshness: "unknown", latest: null, count: 0, qualityMin: null, flags: [] };
  }

  const dates = usable.map((r) => parseDate(r.date)).filter(Boolean);
  const latest = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
  const freshness = latest ? freshnessLabel(latest, rules.staleDays) : "unknown";
  const latestStr = latest ? latest.toISOString().slice(0, 10) : null;

  // Every record came from a fallback/cached source → not authoritative.
  if (usable.every((r) => r.tier === "fallback")) {
    return { status: "fallback", freshness, latest: latestStr, count: usable.length, qualityMin: null, flags: [] };
  }

  const scores = usable.map((r) => r.qualityScore).filter((v) => v !== null && v !== undefined);
  const qualityMin = scores.length ? Math.min(...scores) : null;
  let flags = [];
  for (const r of usable) {
    const wf = r.flags;
    if (Array.isArray(wf)) flags.push(...wf);
    else if (typeof wf === "string" && wf) flags.push(wf);
  }
  flags = [...new Set(flags)].sort();

  const reviewQuality = usable.some((r) => r.quality === "review");
  const hasQualityIssue = (qualityMin !== null && qualityMin < rules.qualityThreshold) || flags.length > 0 || reviewQuality;

  let status;
  if (usable.length < rules.minRecords) status = "quality_warning";
  else if (hasQualityIssue) status = "quality_warning";
  else status = "available";

  return { status, freshness, latest: latestStr, count: usable.length, qualityMin, flags };
}

// ── deriveAllowedActions: status + supporting evidence → what the AI may do ────
export function deriveAllowedActions({ primaryStatus, supportingPresent = false, forbiddenActions = [] } = {}) {
  const summarize = ["available", "quality_warning", "fallback"].includes(primaryStatus) || supportingPresent;
  const compare = ["available", "quality_warning"].includes(primaryStatus);
  const actions = { summarize, compare };
  for (const a of forbiddenActions) actions[a] = false; // hard rule: always false
  return actions;
}

// ── Decision log primitives ───────────────────────────────────────────────────
// A decision record is the audit trail of one gate call: WHAT the gate decided,
// under WHICH rules, over WHICH evidence — without storing the evidence itself
// (records may be sensitive; only a digest of them is kept).
//
// Digests are FNV-1a 64-bit over canonical JSON. Deterministic and identical
// across the JS and Python ports; NOT cryptographic — they detect drift and
// correlate log entries, they don't prove integrity against an adversary.
// Cross-port equality is guaranteed for JSON-safe values (strings, booleans,
// null, integers, and floats with a plain decimal form); exotic floats
// (e.g. 1e-7) and NaN serialize differently per language — keep them out of
// records you intend to digest.

export const DECISION_SCHEMA = "evidence-gate.decision/1";

export function canonicalJson(value) {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

export function fnv1a64(str) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(str)) {
    hash ^= BigInt(byte);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
}

export function evidenceDigest(value) {
  return "fnv1a64:" + fnv1a64(canonicalJson(value));
}

// ── evidenceGate: the one-call API ────────────────────────────────────────────
//   evidenceGate({ records, supporting, rules, decision? })
//     → { status, freshness, allowedActions, warnings, caveats, decision? }
//   `caveats` is a list of strings ready to inject into your prompt.
//   `decision` (opt-in): pass `true` or `{ id?, at? }` to also get a
//   JSONL-serializable decision record for your audit log. The core never
//   writes anywhere — persisting the record is the caller's job.
export function evidenceGate({ records = [], supporting = [], rules, decision } = {}) {
  if (!rules) throw new Error("evidenceGate: `rules` (a preset) is required");
  records = records || []; // null must behave like [] everywhere, incl. digests (Python port: `records or []`)
  supporting = supporting || [];

  const primary = classifyStatus(records, rules);
  const supportingPresent = supporting.length > 0;
  const allowedActions = deriveAllowedActions({
    primaryStatus: primary.status,
    supportingPresent,
    forbiddenActions: rules.forbiddenActions,
  });

  const warnings = [];
  const M = rules.messages || {};
  const label = rules.primaryLabel || "primary data";
  if (primary.status === "missing")
    warnings.push({ level: "block", code: "primary_missing", message: M.primary_missing || `No ${label} available — the AI must not invent numbers.` });
  else if (primary.status === "fallback")
    warnings.push({ level: "review", code: "primary_fallback", message: M.primary_fallback || `${label} is cached/fallback, not authoritative — the AI must say so.` });
  else if (primary.status === "quality_warning")
    warnings.push({ level: "review", code: "primary_quality", message: M.primary_quality || `${label} has a data-quality warning — the AI must add a caveat.` });
  if (primary.freshness === "stale")
    warnings.push({ level: "review", code: "primary_stale", message: M.primary_stale || `${label} is stale (older than ${rules.staleDays} days) — the AI must not say "latest" or "today".` });
  if (!supportingPresent)
    warnings.push({ level: "info", code: "no_supporting", message: M.no_supporting || "No supporting evidence — primary source only." });

  const result = { status: primary.status, freshness: primary.freshness, allowedActions, warnings, caveats: warnings.map((w) => w.message) };

  if (decision) {
    const meta = decision === true ? {} : decision;
    result.decision = {
      schema: DECISION_SCHEMA,
      id: meta.id ?? null,
      at: meta.at ?? new Date().toISOString(),
      digests: { evidence: evidenceDigest({ records, supporting }), rules: evidenceDigest(rules) },
      counts: { records: records.length, supporting: supporting.length },
      rules: {
        primaryLabel: label,
        staleDays: rules.staleDays ?? null,
        minRecords: rules.minRecords ?? null,
        qualityThreshold: rules.qualityThreshold ?? null,
        forbiddenActions: rules.forbiddenActions || [],
      },
      outcome: {
        status: primary.status,
        freshness: primary.freshness,
        allowedActions,
        warnings: warnings.map(({ level, code }) => ({ level, code })),
        caveats: result.caveats,
      },
    };
  }

  return result;
}
