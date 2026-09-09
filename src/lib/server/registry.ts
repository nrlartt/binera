import { z } from "zod";
import { assets, classify, mentioned, protocols, safeLink, type Agent, type Category, type RegistryResult } from "../domain";
import { cached, PublicError, remoteJson } from "./http";

const rowSchema = z.object({ token_id: z.string(), chain_id: z.number(), name: z.string().max(1000), description: z.string().nullable().optional(), owner_address: z.string().nullable().optional(), agent_wallet: z.string().nullable().optional(), is_verified: z.boolean().optional(), total_feedbacks: z.number().nullable().optional(), average_score: z.number().nullable().optional(), supported_protocols: z.array(z.string()).optional(), updated_at: z.string().nullable().optional(), is_active: z.boolean().optional(), a2a_endpoint: z.string().nullable().optional(), agent_url: z.string().nullable().optional(), created_tx_hash: z.string().nullable().optional() }).passthrough();
export function normalizeScan(input: unknown, fetchedAt = new Date().toISOString()): Agent {
  const a = rowSchema.parse(input); const text = `${a.name} ${a.description ?? ""}`;
  return { id: `scan-${a.chain_id}-${a.token_id}`, tokenId: a.token_id, chainId: a.chain_id, name: a.name, description: a.description ?? "No description published.", categories: classify(text), assets: mentioned(text, assets), protocols: mentioned(text, protocols), capabilities: classify(text), owner: a.owner_address ?? null, agentWallet: a.agent_wallet ?? null,
    registered: true, verified: a.is_verified === true, feedbackCount: a.total_feedbacks ?? null, feedbackAverage: (a.total_feedbacks ?? 0) > 0 ? a.average_score ?? null : null, risk: "unknown", pricing: null, performance: null, active: a.is_active ?? null, endpoint: safeLink(a.a2a_endpoint), website: safeLink(a.agent_url), interfaces: a.supported_protocols ?? [], source: "8004scan", sourceUrl: `https://8004scan.io/agents/${a.chain_id}/${a.token_id}`, updatedAt: a.updated_at ?? null, fetchedAt, registrationTx: typeof a.created_tx_hash === "string" && /^0x[0-9a-f]{64}$/i.test(a.created_tx_hash) ? a.created_tx_hash : null };
}
export interface AgentProvider { name: string; discover(): Promise<Agent[]>; }
const scanBase = "https://api.8004scan.io/api/v1";
const headers = (): Record<string, string> => process.env.SCAN_API_KEY ? { "X-API-Key": process.env.SCAN_API_KEY } : {};
export const categorySearch: Record<Category, string> = { rebalancing: "rebalanc", grid: "grid", yield: "yield", health: "health factor" };
class ScanProvider implements AgentProvider {
  name = "8004scan";
  async discover() {
    const pages = await Promise.allSettled(Object.values(categorySearch).flatMap(search => ["total_feedbacks", "updated_at"].map(sort => cached(`scan-list-${search}-${sort}`, async () => {
      const response = z.object({ items: z.array(z.unknown()) }).parse(await remoteJson(`${scanBase}/agents?chain_id=56&limit=40&search=${encodeURIComponent(search)}&sort_by=${sort}&sort_order=desc`, { headers: headers() }));
      return response.items.flatMap(row => { try { const a = normalizeScan(row); return a.chainId === 56 && a.categories.length ? [a] : []; } catch { return []; } });
    }))));
    const agents = pages.flatMap(p => p.status === "fulfilled" ? p.value : []);
    if (pages.some(p => p.status === "rejected")) throw new PartialRegistryError(agents);
    return agents;
  }
}
class PartialRegistryError extends Error { constructor(public agents: Agent[]) { super("Some categories could not be refreshed from 8004scan."); } }
class StudioProvider implements AgentProvider {
  name = "BNB Agent Studio";
  async discover() {
    const urls = (process.env.STUDIO_AGENT_URLS ?? "").split(",").filter(Boolean).slice(0, 8);
    const result = await Promise.allSettled(urls.map(async url => {
      const card = z.object({ name: z.string(), description: z.string(), url: z.string(), skills: z.array(z.object({ id: z.string(), name: z.string(), description: z.string().optional() })).optional() }).parse(await remoteJson(url));
      const text = `${card.name} ${card.description} ${JSON.stringify(card.skills)}`;
      return { id: `studio-${Buffer.from(url).toString("base64url")}`, tokenId: "", chainId: 56, name: card.name, description: card.description, categories: classify(text), assets: mentioned(text, assets), protocols: mentioned(text, protocols), capabilities: card.skills?.map(s => s.name) ?? [], owner: null, agentWallet: null, registered: false, verified: false, feedbackCount: null, feedbackAverage: null, risk: "unknown", pricing: null, performance: null, active: true, endpoint: safeLink(url), website: null, interfaces: ["A2A"], source: "BNB Agent Studio", sourceUrl: url, updatedAt: null, fetchedAt: new Date().toISOString(), registrationTx: null } satisfies Agent;
    }));
    if (result.some(r => r.status === "rejected")) throw new PartialRegistryError(result.flatMap(r => r.status === "fulfilled" ? [r.value] : []));
    return result.map(r => (r as PromiseFulfilledResult<Agent>).value);
  }
}
export class AgentRegistry {
  constructor(private providers: AgentProvider[] = [new ScanProvider(), new StudioProvider()]) {}
  async discover(): Promise<RegistryResult> {
    const results = await Promise.allSettled(this.providers.map(p => p.discover()));
    const warnings: string[] = []; const agents: Agent[] = [];
    results.forEach((r, i) => { if (r.status === "fulfilled") agents.push(...r.value); else { warnings.push(`${this.providers[i].name}: some data is unavailable. Retry to refresh.`); if (r.reason instanceof PartialRegistryError) agents.push(...r.reason.agents); } });
    return { agents: [...new Map(agents.map(a => [a.id, a])).values()], warnings, partial: warnings.length > 0, fetchedAt: agents.map(a => a.fetchedAt).sort()[0] ?? new Date().toISOString() };
  }
}
export const registry = new AgentRegistry();
export function getAgent(id: string): Promise<Agent> {
  return cached(`detail-${id}`, async () => {
    const match = id.match(/^scan-(56)-(\d{1,20})$/);
    if (!match) { const a = (await registry.discover()).agents.find(a => a.id === id); if (a) return a; throw new PublicError("This agent could not be found.", 404); }
    try { return normalizeScan(await remoteJson(`${scanBase}/agents/${match[1]}/${match[2]}`, { headers: headers() })); } catch { throw new PublicError("The registry could not load this agent. The record may be unavailable or the registry may be busy. Return to the research marketplace or retry shortly.", 503); }
  });
}
