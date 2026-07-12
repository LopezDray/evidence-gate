#!/usr/bin/env node
// Evidence Gate — MCP server
//
// Exposes two tools over the Model Context Protocol so any MCP-compatible
// agent can run the full proof loop against itself:
//   • check_evidence — before answering, may the model speak at all?
//   • verify_claims  — after answering, does what it said stand on the
//                      evidence (citations resolve, claims cited, numbers
//                      match the records' facts)?
//
//   npm install @modelcontextprotocol/sdk
//   node mcp/server.mjs
//
// Then register it with your client (e.g. Claude Desktop / an IDE assistant):
//   { "mcpServers": { "evidence-gate": { "command": "node", "args": ["mcp/server.mjs"] } } }

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { evidenceGate } from "../src/core.js";
import { verifyClaims } from "../src/verify.js";
import * as presets from "../src/presets.js";

const server = new Server(
  { name: "evidence-gate", version: "1.0.1" }, // keep in sync — .claude/skills/release-checklist.md
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "check_evidence",
      description:
        "Before answering from data, check whether the evidence is good enough. " +
        "Returns whether you may summarize, the data status (available/quality_warning/fallback/missing), " +
        "and caveats you must respect. Call this first; if summarize is false, say you cannot answer.",
      inputSchema: {
        type: "object",
        properties: {
          records: {
            type: "array",
            description: "Evidence records: { date, qualityScore?, quality?, flags?, tier? }",
            items: { type: "object" },
          },
          supporting: {
            type: "array",
            description: "Optional supporting evidence (non-primary).",
            items: { type: "object" },
          },
          preset: {
            type: "string",
            description: "Preset name: FINANCE | HEALTH | SUPPORT (defaults to SUPPORT).",
          },
          rules: {
            type: "object",
            description: "Optional inline ruleset; overrides `preset` if provided.",
          },
          decision: {
            type: ["boolean", "object"],
            description:
              "Opt in to a JSONL-serializable decision record for your audit log: " +
              "pass true, or { id?, at? } to attach a caller id / timestamp. " +
              "The record comes back as `decision` in the result; persisting it is your job.",
            properties: {
              id: { type: ["string", "number", "null"], description: "Caller-supplied correlation id." },
              at: { type: "string", description: "ISO 8601 timestamp; defaults to now." },
            },
          },
        },
        required: ["records"],
      },
    },
    {
      name: "verify_claims",
      description:
        "After you draft an answer, check whether it stands on the evidence you were given. " +
        "Returns pass and a verdict (supported | misquoted_values | unsupported_claims | " +
        "no_citations | phantom_citations): every [ev:N] citation must resolve to a real record, " +
        "every claim-looking sentence must carry a citation, and — when records carry `facts` — " +
        "every number in a cited sentence must match those facts exactly (misquoted numbers block). " +
        "Pass the SAME records array you gave check_evidence, in the same order. If pass is false, " +
        "fix the answer using `caveats` and try again before you speak.",
      inputSchema: {
        type: "object",
        properties: {
          answer: {
            type: "string",
            description: "The answer text to verify (the model's drafted response).",
          },
          records: {
            type: "array",
            description:
              "The SAME evidence records passed to check_evidence, same order — resolution and " +
              "the audit digest join depend on it. Attach `facts: { name: number }` to enable " +
              "misquoted-number detection.",
            items: { type: "object" },
          },
          supporting: {
            type: "array",
            description: "Optional supporting evidence, same array/order as check_evidence.",
            items: { type: "object" },
          },
          gate: {
            type: "object",
            description:
              "Optional: the result object returned by check_evidence. Passing it enables the " +
              "freshness cross-check (warns when the answer sounds fresh but the evidence is stale).",
          },
          preset: {
            type: "string",
            description: "Preset name for verification knobs/messages: FINANCE | HEALTH | SUPPORT.",
          },
          rules: {
            type: "object",
            description: "Optional inline ruleset (only .verification and .messages are read); overrides `preset`.",
          },
          decision: {
            type: ["boolean", "object"],
            description:
              "Opt in to a JSONL-serializable verification record (evidence-gate.verification/1) " +
              "for your audit log: pass true, or { id?, at? }. Use the SAME id as the check_evidence " +
              "decision — the two records join on it and on an identical evidence digest.",
            properties: {
              id: { type: ["string", "number", "null"], description: "Caller-supplied correlation id (match the gate decision)." },
              at: { type: "string", description: "ISO 8601 timestamp; defaults to now." },
            },
          },
        },
        required: ["answer", "records"],
      },
    },
  ],
}));

function ok(result) {
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}
function fail(err) {
  // e.g. an inline ruleset that fails validateRules — surface as a tool
  // error the agent can read, not a broken protocol response
  return { content: [{ type: "text", text: String(err?.message ?? err) }], isError: true };
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = req.params.arguments || {};

  if (req.params.name === "check_evidence") {
    const { records = [], supporting = [], preset = "SUPPORT", rules, decision } = args;
    const ruleset = rules || presets[preset] || presets.SUPPORT;
    try {
      return ok(evidenceGate({ records, supporting, rules: ruleset, decision }));
    } catch (err) {
      return fail(err);
    }
  }

  if (req.params.name === "verify_claims") {
    const { answer, records = [], supporting = [], gate, preset = "SUPPORT", rules, decision } = args;
    // Only .verification and .messages are read; a preset supplies those when
    // no inline ruleset is given. verifyClaims never throws on messy input.
    const ruleset = rules || presets[preset] || presets.SUPPORT;
    try {
      return ok(verifyClaims({ answer, records, supporting, gate, rules: ruleset, decision }));
    } catch (err) {
      return fail(err);
    }
  }

  throw new Error(`Unknown tool: ${req.params.name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
