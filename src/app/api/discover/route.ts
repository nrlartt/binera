import { researchCatalogue } from "@/lib/server/catalogue";
import { registry } from "@/lib/server/registry";
import { understand } from "@/lib/server/intent";
import { categories, rankAgents, type Category } from "@/lib/domain";
import { errorResponse, PublicError } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams; const query = params.get("q") ?? "";
    if (query.length > 500) throw new PublicError("Please keep your search under 500 characters.", 400);
    const broad = params.get("catalog") === "registry";
    const [result, intent] = await Promise.all([broad ? registry.discover() : researchCatalogue(), understand(query)]);
    const category = params.get("category");
    if (category && categories.some(c => c.id === category)) intent.category = category as Category;
    if (params.get("asset")) intent.assets = [params.get("asset")!.slice(0, 20)];
    if (params.get("protocol")) intent.protocols = [params.get("protocol")!.slice(0, 30)];
    if (["low", "medium", "high"].includes(params.get("risk") ?? "")) intent.risk = params.get("risk") as "low" | "medium" | "high";
    const ranked = rankAgents(result.agents, intent).filter(a => params.get("verified") !== "true" || a.verified);
    const sort = params.get("sort");
    if (sort === "updated" || sort === "feedback") ranked.sort((a, b) => Number(b.eligible) - Number(a.eligible) || (sort === "feedback" ? (b.feedbackCount ?? -1) - (a.feedbackCount ?? -1) : (Date.parse(b.updatedAt || "") || 0) - (Date.parse(a.updatedAt || "") || 0)) || a.id.localeCompare(b.id));
    const page = Math.max(1, Math.min(100, Math.floor(Number(params.get("page")) || 1))); const size = 12;
    const compatible = ranked.filter(a => a.eligible);
    return Response.json({ ...result, agents: ranked.slice((page - 1) * size, page * size), total: ranked.length, compatible: compatible.length, page, pages: Math.ceil(ranked.length / size), intent, counts: Object.fromEntries(categories.map(c => [c.id, result.agents.filter(a => a.categories.includes(c.id)).length])), scope: broad ? "Up to 40 most-reviewed and 40 recently-updated source results per category, deduplicated and ranked within this discovery window." : "Reviewed research providers with a successful recent service check. This is not a delivery guarantee. A fresh signed quote is required before payment." });
  } catch (e) { return errorResponse(e); }
}
