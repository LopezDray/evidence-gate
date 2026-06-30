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
  { name: "evidence-gate", version: "0.1.0" },
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
  const { records = [], supporting = [], preset = "SUPPORT", rules } = req.params.arguments || {};
  const ruleset = rules || presets[preset] || presets.SUPPORT;
  const result = evidenceGate({ records, supporting, rules: ruleset });
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
