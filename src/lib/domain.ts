export const categories = [
  { id: "rebalancing", name: "Rebalancing", short: "Manage liquidity", description: "Keep liquidity positions aligned with your strategy.", prompt: "Find an agent to rebalance my PancakeSwap LP position.", icon: "rebalance" },
  { id: "grid", name: "Grid Trading", short: "Trade systematically", description: "Find agents that plan and manage systematic trading grids.", prompt: "Find a grid trading agent for BTC and USDT.", icon: "grid" },
  { id: "yield", name: "Yield Optimisation", short: "Put capital to work", description: "Discover agents that research and manage yield opportunities.", prompt: "I have 5,000 USDT and want low-risk yield.", icon: "yield" },
  { id: "health", name: "Health Factor Monitoring", short: "Watch your positions", description: "Monitor lending positions and understand liquidation exposure.", prompt: "Find an agent that protects my lending position.", icon: "health" },
] as const;
export type Category = typeof categories[number]["id"];
export type Risk = "low" | "medium" | "high" | "unknown";
export const assets = ["USDT", "USDC", "BNB", "WBNB", "BTC", "BTCB", "ETH", "CAKE", "DAI"] as const;
export const protocols = ["PancakeSwap", "Venus", "Aave", "Lista", "Alpaca", "Beefy"] as const;
export type Intent = { query: string; category: Category | null; assets: string[]; protocols: string[]; risk: Risk; amount: number | null; method: "rules" | "language-model" };
export type Agent = {
  id: string; tokenId: string; chainId: number; name: string; description: string;
  categories: Category[]; assets: string[]; protocols: string[]; capabilities: string[];
  owner: string | null; agentWallet: string | null; registered: boolean; verified: boolean;
  feedbackCount: number | null; feedbackAverage: number | null; risk: Risk;
  pricing: string | null; performance: null; active: boolean | null;
  endpoint: string | null; website: string | null; interfaces: string[];
  source: "8004scan" | "BNB Agent Studio"; sourceUrl: string;
  updatedAt: string | null; fetchedAt: string; registrationTx: string | null;
};
export type RankedAgent = Agent & { reasons: string[]; missing: string[]; eligible: boolean; rankPoints: number };
export type RegistryResult = { agents: Agent[]; fetchedAt: string; warnings: string[]; partial: boolean };

const patterns: Record<Category, RegExp> = {
  rebalancing: /rebalanc|liquidity\s+(?:position|management)|\blp\b|liquidity provider|manage.*range/i,
  grid: /\bgrid\b|market making/i,
  yield: /\byield\b|\bapy\b|\bapr\b|earn.*(?:interest|return)|staking/i,
  health: /health\s*factor|liquidat|lending.position|protect.*(?:loan|lending)|borrow.position/i,
};
export function classify(text: string): Category[] {
  return categories.filter(c => patterns[c.id].test(text)).map(c => c.id);
}
export function mentioned(text: string, options: readonly string[]): string[] {
  return options.filter(value => new RegExp(`\\b${value}\\b`, "i").test(text));
}
export function parseIntent(query: string): Intent {
  const amount = query.match(/(?:\$\s*)?(\d[\d,]*(?:\.\d+)?)\s*(?:USDT|USDC|BNB|BTC|ETH|dollars|USD)\b/i);
  return { query, category: classify(query)[0] ?? null, assets: mentioned(query, assets), protocols: mentioned(query, protocols),
    risk: /low.?risk|conservative|without.*(?:risk|loss)|capital preserv/i.test(query) ? "low" : /high.?risk|aggressive/i.test(query) ? "high" : /medium.?risk|moderate/i.test(query) ? "medium" : "unknown",
    amount: amount ? Number(amount[1].replaceAll(",", "")) : null, method: "rules" };
}
export function rankAgents(agents: Agent[], intent: Intent, now = Date.now()): RankedAgent[] {
  const words = intent.query.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? [];
  const unconstrained = !intent.category && !intent.assets.length && !intent.protocols.length && intent.risk === "unknown";
  const searchWords = words.filter(w => !["find", "me", "an", "a", "the", "agent", "agents", "for", "please", "show"].includes(w));
  return agents.filter(a => (!intent.category || a.categories.includes(intent.category)) && (!unconstrained || !searchWords.length || searchWords.every(w => `${a.name} ${a.description}`.toLowerCase().includes(w)))).map(a => {
    const reasons: string[] = []; const missing: string[] = []; let rankPoints = 0;
    if (intent.category && a.categories.includes(intent.category)) { rankPoints += 40; reasons.push("Publisher describes the requested capability"); }
    for (const asset of intent.assets) { if (a.assets.includes(asset)) { rankPoints += 10; reasons.push(`${asset} mentioned by the publisher`); } else missing.push(`${asset} support not published`); }
    for (const protocol of intent.protocols) { if (a.protocols.includes(protocol)) { rankPoints += 10; reasons.push(`${protocol} mentioned by the publisher`); } else missing.push(`${protocol} support not published`); }
    if (intent.risk !== "unknown") {
      const levels = { low: 0, medium: 1, high: 2, unknown: 3 };
      if (a.risk === "unknown") missing.push("Independent risk assessment unavailable");
      else if (levels[a.risk] > levels[intent.risk]) missing.push("Exceeds your risk preference");
      else { rankPoints += 10; reasons.push("Matches the requested risk level"); }
    }
    if (a.verified) { rankPoints += 5; reasons.push("Identity verified by the source"); }
    if ((a.feedbackCount ?? 0) > 0) { rankPoints += Math.min(5, Math.log2(a.feedbackCount! + 1)); reasons.push(`${a.feedbackCount} source feedback records`); }
    if (a.updatedAt && now - Date.parse(a.updatedAt) >= 0 && now - Date.parse(a.updatedAt) < 86400000) { rankPoints += 2; reasons.push("Registry metadata updated in the last 24 hours"); }
    if (a.active === false) missing.push("Publisher has marked this agent inactive");
    if (!reasons.length) reasons.push("Registered agent with a relevant published capability");
    return { ...a, rankPoints, reasons, missing, eligible: missing.length === 0 };
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.rankPoints - a.rankPoints || a.id.localeCompare(b.id));
}
export function safeLink(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function categoryName(id: Category) { return categories.find(c => c.id === id)!.name; }
