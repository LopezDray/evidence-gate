// Evidence Gate — example presets
//
// A preset is just a ruleset for one domain. Adding a new vertical = adding a
// preset, never touching the core engine. Copy one of these and tune it.

// Financial data (statements, filings). The forbidden actions reflect common
// compliance lines: no individualized buy/sell advice, no real-time claims.
export const FINANCE = {
  primaryLabel: "financial statements",
  staleDays: 135, // ~1 fiscal quarter + reporting buffer
  minRecords: 4, // need >=4 periods to compare a trend
  qualityThreshold: 70, // quality score below this needs a caveat
  forbiddenActions: ["personalized_advice", "claim_realtime"],
};

// Clinical/lab data. Forbidden actions keep an assistant from crossing the line
// into diagnosis or prescription.
export const HEALTH = {
  primaryLabel: "lab results",
  staleDays: 90,
  minRecords: 2,
  qualityThreshold: 80,
  forbiddenActions: ["diagnose", "prescribe", "claim_realtime"],
};

// Support / knowledge-base answers grounded in retrieved documents.
export const SUPPORT = {
  primaryLabel: "knowledge-base documents",
  staleDays: 365,
  minRecords: 1,
  qualityThreshold: 50,
  forbiddenActions: ["make_promises", "claim_realtime"],
};
