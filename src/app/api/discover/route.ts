import { researchCatalogue } from "@/lib/server/catalogue";
import { browseRegistry, categorySearch } from "@/lib/server/registry";
import { understand } from "@/lib/server/intent";
import { agentEvidence, categories, rankAgents, type Category } from "@/lib/domain";
import { errorResponse, PublicError } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams; const query = params.get("q") ?? "";
    if (query.length > 500) throw new PublicError("Please keep your search under 500 characters.", 400);
    const broad = params.get("catalog") === "registry";
    const intent = await understand(query);
    const category = params.get("category");
    if (category && categories.some(c => c.id === category)) intent.category = category as Category;
    if (params.get("asset")) intent.assets = [params.get("asset")!.slice(0, 20)];
    if (params.get("protocol")) intent.protocols = [params.get("protocol")!.slice(0, 30)];
    if (["low", "medium", "high"].includes(params.get("risk") ?? "")) intent.risk = params.get("risk") as "low" | "medium" | "high";
    const size = 12; const maxRegistryPage = Math.floor(10000 / size) + 1;
    const page = Math.max(1, Math.min(broad ? maxRegistryPage : 100, Math.floor(Number(params.get("page")) || 1)));
    const result = broad
      ? await browseRegistry({ offset: (page - 1) * size, limit: size, search: intent.category ? categorySearch[intent.category] : query, sort: params.get("sort") ?? undefined })
      : await researchCatalogue();
    const evaluated = rankAgents(result.agents, intent);
    const evaluatedById = new Map(evaluated.map(agent => [agent.id, agent]));
    const ranked = (broad ? result.agents.map(agent => evaluatedById.get(agent.id) ?? { ...agent, reasons: ["Returned by the source search"], missing: ["Requested capability is not explicit in the normalized identity metadata"], eligible: false, rankPoints: 0 }) : evaluated)
      .filter(a => params.get("verified") !== "true" || a.verified);
    const sort = params.get("sort");
    if (sort === "updated" || sort === "feedback") ranked.sort((a, b) => Number(b.eligible) - Number(a.eligible) || (sort === "feedback" ? (b.feedbackCount ?? -1) - (a.feedbackCount ?? -1) : (Date.parse(b.updatedAt || "") || 0) - (Date.parse(a.updatedAt || "") || 0)) || a.id.localeCompare(b.id));
    const matches = ranked.filter(a => a.eligible).length;
    const compatible = ranked.filter(a => agentEvidence(a).hiringCompatible).length;
    const total = broad && "total" in result && typeof result.total === "number" ? result.total : ranked.length;
    const pages = broad ? Math.min(maxRegistryPage, Math.max(1, Math.ceil(total / size))) : Math.max(1, Math.ceil(ranked.length / size));
    return Response.json({ ...result, agents: broad ? ranked : ranked.slice((page - 1) * size, page * size), total, returned: ranked.length, matches, compatible, page, pages, intent, counts: Object.fromEntries(categories.map(c => [c.id, result.agents.filter(a => a.categories.includes(c.id)).length])), scope: broad ? `Live BSC registry results from 8004scan. ${total > 10000 ? "The source reports more than 10,000 matches; this interface exposes the first 10,008 through bounded offset pagination." : "All source pages are available in this view."}` : "Reviewed research providers with a successful recent service check. This is not a delivery guarantee. A fresh signed quote is required before payment." });
  } catch (e) { return errorResponse(e); }
}
