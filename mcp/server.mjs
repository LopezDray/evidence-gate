#!/usr/bin/env node
// Evidence Gate — MCP server
//
// Exposes a `check_evidence` tool over the Model Context Protocol so any
// MCP-compatible agent can fact-check itself before it speaks.
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
import * as presets from "../src/presets.js";

const server = new Server(
  { name: "evidence-gate", version: "0.2.0" }, // keep in sync — .claude/skills/release-checklist.md
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
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name !== "check_evidence") {
    throw new Error(`Unknown tool: ${req.params.name}`);
  }
  const { records = [], supporting = [], preset = "SUPPORT", rules, decision } = req.params.arguments || {};
  const ruleset = rules || presets[preset] || presets.SUPPORT;
  try {
    const result = evidenceGate({ records, supporting, rules: ruleset, decision });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    // e.g. an inline ruleset that fails validateRules — surface as a tool
    // error the agent can read, not a broken protocol response
    return { content: [{ type: "text", text: String(err?.message ?? err) }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
