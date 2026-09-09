import { mkdir, writeFile } from "node:fs/promises";
import { getAgent, registry } from "../src/lib/server/registry";
import { activationReadiness, negotiate } from "../src/lib/server/studio";
import { categories } from "../src/lib/domain";

const discovery = await registry.discover();
const selected = categories.flatMap(category => {
  const items = discovery.agents.filter(a => a.categories.includes(category.id) && a.active !== false);
  return [...items.slice(0, 1), ...[...items].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || b.tokenId.localeCompare(a.tokenId, "en", { numeric: true })).slice(0, 6)];
});
const extraIds = (process.env.AUDIT_AGENT_IDS ?? "").split(",").filter(id => /^scan-56-\d{1,20}$/.test(id)).slice(0, 4);
for (const id of extraIds) { try { selected.push(await getAgent(id)); } catch { console.log(`Extra identity ${id} could not be retrieved.`); } }
const candidates = [...new Map(selected.map(a => [a.id, a])).values()];
const checks: { id: string; name: string; categories: string[]; source: string; available: boolean; state: string; message: string; observedAt: string; responseMs: number }[] = [];
let cursor = 0;
await Promise.all(Array.from({ length: 1 }, async () => {
  while (cursor < candidates.length) {
    const agent = candidates[cursor++];
    const check = await activationReadiness(agent.id);
    checks.push({ id: agent.id, name: agent.name, categories: agent.categories, source: agent.sourceUrl, available: check.available, state: check.state, message: check.message, observedAt: check.observedAt, responseMs: check.responseMs });
    await new Promise(resolve => setTimeout(resolve, 1800));
    console.log(`${checks.length}/${candidates.length} ${agent.id}: ${check.available ? "protocol available" : "unavailable"}`);
  }
}));
checks.sort((a, b) => a.id.localeCompare(b.id));
const tasks = {
  rebalancing: "Research PancakeSwap WBNB/USDT LP range management on BNB Chain. Include observed pool data, time, fee assumptions and risks. Do not move funds.",
  grid: "Research a BNB/USDT grid strategy on BNB Chain. Include observed market data, fees, range assumptions and downside risks. Do not place orders.",
  yield: "Research USDT yield opportunities on BNB Chain. Compare sources, timestamps, fees and risk flags. Do not move funds.",
  health: "Research Venus lending health factor and liquidation thresholds on BNB Chain. Include observed market data and risk explanations. Do not move funds.",
};
const coverage = [];
for (const category of categories) {
  const available = checks.filter(c => c.available && c.categories.includes(category.id));
  const quotes = [];
  for (const agent of available.slice(0, 2)) {
    try {
      const quote = await negotiate(agent.id, tasks[category.id]);
      quotes.push({ agentId: agent.id, provider: quote.provider, price: quote.price, currency: quote.currency, negotiationHash: quote.negotiationHash, fetchedAt: quote.fetchedAt, expiresAt: quote.expiresAt, deliverables: quote.deliverables });
      break;
    } catch (e) { console.log(`${category.id} ${agent.id} quote unavailable: ${e instanceof Error ? e.message : "unknown"}`); }
  }
  coverage.push({ category: category.id, listed: discovery.agents.filter(a => a.categories.includes(category.id)).length, protocolAvailable: available.length, task: tasks[category.id], quotes, paidExecution: "NOT_TESTED", categoryAutomation: "NOT_VERIFIED" });
}
const report = { observedAt: new Date().toISOString(), discoveryCount: discovery.agents.length, warnings: discovery.warnings, scope: "Bounded registry discovery; up to seven identities per category (one most-reviewed plus six recently updated), plus up to four explicitly supplied real registry identities, deduplicated; details checked sequentially with 1.8-second spacing. Rate-limited or failed reads are unconfirmed, not proof of a dead service. These checks and quotes do not verify paid delivery or strategy execution.", checks, coverage };
await mkdir("submission/evidence", { recursive: true });
await writeFile("submission/evidence/service-audit.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(coverage.map(c => ({ category: c.category, available: c.protocolAvailable, signedQuote: c.quotes.length > 0, paidExecution: c.paidExecution })), null, 2));
