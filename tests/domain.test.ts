import assert from "node:assert/strict";
import test from "node:test";
import { classify, parseIntent, rankAgents, safeLink, type Agent } from "../src/lib/domain";
import { normalizeScan, AgentRegistry, type AgentProvider } from "../src/lib/server/registry";
import { publicIPv4, remoteJson, requestJson, sameOrigin } from "../src/lib/server/http";
import { hiringPermissions } from "../src/lib/permissions";

const fixture = (id: string, overrides: Partial<Agent> = {}): Agent => ({ id, tokenId: "1", chainId: 56, name: "TEST FIXTURE", description: "USDT yield research", categories: ["yield"], assets: ["USDT"], protocols: ["Venus"], capabilities: ["yield"], owner: null, agentWallet: null, registered: true, verified: false, feedbackCount: 0, feedbackAverage: null, risk: "unknown", pricing: null, performance: null, active: true, endpoint: null, website: null, interfaces: [], source: "8004scan", sourceUrl: "https://8004scan.io", updatedAt: null, fetchedAt: "2026-09-08T00:00:00Z", registrationTx: null, ...overrides });
test("all four user intents are classified", () => {
  for (const [text, category] of [["Manage my LP position", "rebalancing"], ["Automate a BTC/USDT grid", "grid"], ["I have 5,000 USDT and want low-risk yield.", "yield"], ["Protect my lending position", "health"]]) assert.equal(parseIntent(text).category, category);
  assert.equal(parseIntent("I have 5,000 USDT and want low-risk yield.").amount, 5000);
  assert.deepEqual(classify("General chat assistant"), []);
});
test("unknown risk and unsupported assets never satisfy eligibility", () => {
  const result = rankAgents([fixture("a")], parseIntent("low-risk USDT yield"));
  assert.equal(result[0].eligible, false); assert.match(result[0].missing.join(" "), /risk assessment/);
  assert.equal(rankAgents([fixture("a")], parseIntent("USDC yield"))[0].eligible, false);
});
test("ranking is deterministic and cannot manufacture agents", () => {
  const agents = [fixture("c"), fixture("b", { feedbackCount: 8 }), fixture("a")];
  const intent = parseIntent("USDT yield");
  assert.deepEqual(rankAgents(agents, intent, 1).map(a => a.id), rankAgents([...agents].reverse(), intent, 1).map(a => a.id));
  assert.equal(rankAgents([], intent).length, 0);
  assert.equal(rankAgents([fixture("x", { categories: ["grid"] })], intent).length, 0);
});
test("untrusted claims cannot create audited metrics", () => {
  const agent = normalizeScan({ token_id: "10", chain_id: 56, name: "TEST low-risk yield 900% APY", description: "USDT yield", total_feedbacks: 0, average_score: 100, is_verified: false, performance: 900, risk: "low" });
  assert.equal(agent.risk, "unknown"); assert.equal(agent.performance, null); assert.equal(agent.feedbackAverage, null); assert.equal(agent.verified, false);
});
test("registry preserves successful providers during upstream failure and deduplicates", async () => {
  const ok: AgentProvider = { name: "test-good", discover: async () => [fixture("a"), fixture("a")] };
  const bad: AgentProvider = { name: "test-failed", discover: async () => { throw new Error("unavailable"); } };
  const r = await new AgentRegistry([ok, bad]).discover(); assert.equal(r.agents.length, 1); assert.equal(r.partial, true); assert.equal(r.warnings.length, 1);
});
test("provider fetch blocks local, metadata and credential URLs", async () => {
  for (const ip of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "192.168.1.1", "172.16.0.1", "::1", "100.64.0.1"]) assert.equal(publicIPv4(ip), false);
  assert.equal(publicIPv4("8.8.8.8"), true);
  for (const url of ["http://example.com", "https://127.0.0.1", "https://user:password@example.com", "https://example.com:3000"]) await assert.rejects(remoteJson(url));
  assert.equal(safeLink("javascript:alert(1)"), null);
});
test("hiring permissions bound exact token budget, method selectors and expiry-period spend", () => {
  const policy = hiringPermissions(100n);
  assert.equal(policy.calls?.length, 5); assert.ok(policy.calls?.every(c => "to" in c && "signature" in c));
  assert.equal(policy.spend?.[0].limit, 100n); assert.equal(policy.spend?.[0].period, "day"); assert.throws(() => hiringPermissions(0n));
});
test("write requests reject cross-origin, malformed JSON and oversized bodies", async () => {
  assert.throws(() => sameOrigin(new Request("https://market.example/api/quote", { headers: { origin: "https://attacker.example" } })));
  await assert.rejects(requestJson(new Request("https://market.example", { method: "POST", body: "{" })));
  await assert.rejects(requestJson(new Request("https://market.example", { method: "POST", body: JSON.stringify({ text: "x".repeat(9000) }) })));
});
