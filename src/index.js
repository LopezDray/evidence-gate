// Evidence Gate — public entry point
export { evidenceGate, classifyStatus, deriveAllowedActions, validateRules, validateProvenance, AUTHORITY_LADDER, parseDate, daysSince, freshnessLabel, canonicalJson, fnv1a64, evidenceDigest, chainDecision, verifyDecisionChain, DECISION_SCHEMA } from "./core.js";
export { verifyClaims, citationBlock, VERIFICATION_SCHEMA } from "./verify.js";
export * as presets from "./presets.js";
