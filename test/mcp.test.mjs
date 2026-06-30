// เทส MCP server จริง — spawn server + handshake + เรียก tool
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import assert from "node:assert";

const transport = new StdioClientTransport({ command: "node", args: ["mcp/server.mjs"] });
const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
await client.connect(transport);
console.log("✅ connect + initialize handshake สำเร็จ");

const { tools } = await client.listTools();
console.log("✅ tools/list:", tools.map(t => t.name).join(", "));
assert.ok(tools.find(t => t.name === "check_evidence"), "ต้องมี tool check_evidence");

// เคส missing → summarize false
const r1 = await client.callTool({ name: "check_evidence", arguments: { records: [], preset: "FINANCE" } });
const out1 = JSON.parse(r1.content[0].text);
console.log("✅ call(missing):", "status="+out1.status, "summarize="+out1.allowedActions.summarize);
assert.strictEqual(out1.status, "missing");
assert.strictEqual(out1.allowedActions.summarize, false);

// เคส health available + forbidden
const r2 = await client.callTool({ name: "check_evidence", arguments: {
  records: [{ date: "2026-06-01", qualityScore: 95 }, { date: "2026-05-01", qualityScore: 92 }],
  preset: "HEALTH"
}});
const out2 = JSON.parse(r2.content[0].text);
console.log("✅ call(health):", "status="+out2.status, "diagnose="+out2.allowedActions.diagnose);
assert.strictEqual(out2.status, "available");
assert.strictEqual(out2.allowedActions.diagnose, false);

await client.close();
console.log("\n✅✅ MCP server ทำงานจริงครบ handshake + tools/list + tools/call");
