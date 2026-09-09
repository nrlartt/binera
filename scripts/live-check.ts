import { registry } from "../src/lib/server/registry";
import { pancakeSnapshot } from "../src/lib/server/chain";
import { negotiate } from "../src/lib/server/studio";
import { categories } from "../src/lib/domain";

const discovered = await registry.discover();
console.log("Registry", { count: discovered.agents.length, warnings: discovered.warnings, categories: Object.fromEntries(categories.map(c => [c.id, discovered.agents.filter(a => a.categories.includes(c.id)).length])) });
if (!discovered.agents.length || discovered.partial) process.exitCode = 1;
try { const market = await pancakeSnapshot(); console.log("PancakeSwap", { block: market.blockNumber, price: market.price, pool: market.pool, timestamp: market.timestamp }); } catch (e) { console.error("PancakeSwap", e instanceof Error ? e.message : "Unavailable"); process.exitCode = 1; }
// Explicitly opt into a read-only price negotiation with a selected real provider.
if (process.env.LIVE_AGENT_ID) {
  try { const quote = await negotiate(process.env.LIVE_AGENT_ID, "Research USDT yield on BNB Chain for a 5000 USDT deposit."); console.log("Verified live quote", { provider: quote.provider, price: quote.price, expiresAt: quote.expiresAt, negotiationHash: quote.negotiationHash }); } catch (e) { console.error("Quote", e instanceof Error ? e.message : "Unavailable"); process.exitCode = 1; }
}
