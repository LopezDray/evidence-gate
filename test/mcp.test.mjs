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

// เคส decision passthrough → ได้ decision record กลับมาใน result
const r3 = await client.callTool({ name: "check_evidence", arguments: {
  records: [{ date: "2026-06-01", qualityScore: 95 }, { date: "2026-05-01", qualityScore: 92 }],
  preset: "HEALTH",
  decision: { id: "req-mcp-1", at: "2026-07-11T00:00:00Z" }
}});
const out3 = JSON.parse(r3.content[0].text);
console.log("✅ call(decision):", "schema="+out3.decision?.schema, "id="+out3.decision?.id);
assert.strictEqual(out3.decision.schema, "evidence-gate.decision/1");
assert.strictEqual(out3.decision.id, "req-mcp-1");
assert.strictEqual(out3.decision.at, "2026-07-11T00:00:00Z");
assert.ok(out3.decision.digests.evidence.startsWith("fnv1a64:"));
assert.strictEqual(out3.decision.outcome.status, out3.status);

// decision: true → server เติม timestamp ให้
const r4 = await client.callTool({ name: "check_evidence", arguments: { records: [], preset: "FINANCE", decision: true } });
const out4 = JSON.parse(r4.content[0].text);
assert.strictEqual(out4.decision.id, null);
assert.ok(typeof out4.decision.at === "string" && out4.decision.at.endsWith("Z"));
console.log("✅ call(decision:true): at="+out4.decision.at);

// ไม่ส่ง decision → ไม่มี decision ใน result (opt-in เท่านั้น)
const r5 = await client.callTool({ name: "check_evidence", arguments: { records: [], preset: "FINANCE" } });
assert.strictEqual(JSON.parse(r5.content[0].text).decision, undefined);
console.log("✅ call(no decision): ไม่มี decision record");

// inline rules ที่ไม่ครบ → tool error ที่อ่านรู้เรื่อง ไม่ใช่ protocol พัง
const r6 = await client.callTool({ name: "check_evidence", arguments: { records: [], rules: { staleDays: 30 } } });
assert.strictEqual(r6.isError, true);
assert.ok(r6.content[0].text.includes("rules.minRecords"), r6.content[0].text);
console.log("✅ call(bad rules): isError + ข้อความบอก field ที่ขาด");

await client.close();
console.log("\n✅✅ MCP server ทำงานจริงครบ handshake + tools/list + tools/call + decision passthrough");
