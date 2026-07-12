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

// ── verify_claims tool ────────────────────────────────────────────────────────
assert.ok(tools.find(t => t.name === "verify_claims"), "ต้องมี tool verify_claims");

// เคส supported → pass true (citation ครบ, ไม่มี facts ให้เช็ค)
const vr1 = await client.callTool({ name: "verify_claims", arguments: {
  answer: "Revenue was 1.2M in Q1 [ev:1].",
  records: [{ date: "2026-03-31" }],
}});
const vout1 = JSON.parse(vr1.content[0].text);
console.log("✅ verify_claims(supported):", "verdict="+vout1.verdict, "pass="+vout1.pass);
assert.strictEqual(vout1.verdict, "supported");
assert.strictEqual(vout1.pass, true);

// เคส misquoted number → facts จับได้ → verdict misquoted_values, pass false
const vr2 = await client.callTool({ name: "verify_claims", arguments: {
  answer: "Revenue was 1.5M [ev:1].",
  records: [{ date: "2026-03-31", facts: { revenue: 1234500 } }],
}});
const vout2 = JSON.parse(vr2.content[0].text);
console.log("✅ verify_claims(misquote):", "verdict="+vout2.verdict, "misquoted="+vout2.stats.misquoted);
assert.strictEqual(vout2.verdict, "misquoted_values");
assert.strictEqual(vout2.pass, false);
assert.strictEqual(vout2.stats.misquoted, 1);
assert.strictEqual(vout2.misquotes[0].token, "1.5M");

// เคส phantom → verdict phantom_citations
const vr3 = await client.callTool({ name: "verify_claims", arguments: {
  answer: "Growth was 8% [ev:9].",
  records: [{ date: "2026-03-31" }],
}});
assert.strictEqual(JSON.parse(vr3.content[0].text).verdict, "phantom_citations");
console.log("✅ verify_claims(phantom): verdict=phantom_citations");

// digest join: check_evidence + verify_claims ด้วย records/id เดียวกัน → evidence digest ตรงกัน
const joinRecords = [{ date: "2026-06-01", qualityScore: 95 }, { date: "2026-05-01", qualityScore: 92 }];
const g = await client.callTool({ name: "check_evidence", arguments: {
  records: joinRecords, preset: "FINANCE", decision: { id: "req-join", at: "2026-07-11T00:00:00Z" },
}});
const v = await client.callTool({ name: "verify_claims", arguments: {
  answer: "Quality held at 95 [ev:1].", records: joinRecords,
  decision: { id: "req-join", at: "2026-07-11T00:00:01Z" },
}});
const gout = JSON.parse(g.content[0].text), vout = JSON.parse(v.content[0].text);
assert.strictEqual(vout.decision.schema, "evidence-gate.verification/1");
assert.strictEqual(vout.decision.id, "req-join");
assert.strictEqual(gout.decision.digests.evidence, vout.decision.digests.evidence);
console.log("✅ verify_claims(join): evidence digest ตรงกับ check_evidence (" + vout.decision.digests.evidence + ")");

// gate passthrough → freshness cross-check ยิง warning เมื่อ answer ฟังดู fresh แต่ gate stale
const vr4 = await client.callTool({ name: "verify_claims", arguments: {
  answer: "As of today, revenue is 1.2M [ev:1].",
  records: [{ date: "2020-01-01" }],
  gate: { freshness: "stale" },
}});
assert.ok(JSON.parse(vr4.content[0].text).warnings.some(w => w.code === "verify_stale_framing"),
  "gate stale + fresh wording → verify_stale_framing");
console.log("✅ verify_claims(gate stale): verify_stale_framing ยิง");

await client.close();
console.log("\n✅✅ MCP server ทำงานจริงครบ handshake + tools/list + tools/call (check_evidence + verify_claims) + decision join");
