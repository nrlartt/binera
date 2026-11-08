import { browseRegistry } from "@/lib/server/registry";
import { cached, errorResponse } from "@/lib/server/http";
import { categories } from "@/lib/domain";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await cached("agent-leaderboard", async () => {
      const page = await browseRegistry({ offset: 0, limit: 100, sort: "feedback" });
      const ranked = page.agents
        .filter(agent => agent.chainId === 56)
        .sort((a, b) => (b.feedbackCount ?? 0) - (a.feedbackCount ?? 0) || (b.feedbackAverage ?? 0) - (a.feedbackAverage ?? 0) || a.id.localeCompare(b.id));
      const summarize = (agent: (typeof ranked)[number]) => ({
        id: agent.id, name: agent.name, categories: agent.categories, verified: agent.verified,
        feedbackCount: agent.feedbackCount, feedbackAverage: agent.feedbackAverage,
        endpointLive: agent.evidence?.endpointLive ?? false,
        hiringCompatible: agent.evidence?.hiringCompatible ?? false,
        updatedAt: agent.updatedAt, sourceUrl: agent.sourceUrl,
      });
      return {
        top: ranked.slice(0, 25).map((agent, index) => ({ rank: index + 1, ...summarize(agent) })),
        byCategory: categories.map(category => ({
          category: category.id,
          agents: ranked.filter(agent => agent.categories.includes(category.id)).slice(0, 3).map(summarize),
        })),
        observedAgents: ranked.length,
        sourceTotal: page.total,
        note: "Ranking uses registry feedback count, then average score, then a stable ID tie-break. Feedback is publisher-reported registry data, not verified delivery or investment performance. Identity, interface and hiring evidence remain separate.",
        observedAt: new Date().toISOString(),
        source: "https://8004scan.io/agents?chain=56",
      };
    }, 300000);
    return Response.json(data);
  } catch (error) { return errorResponse(error); }
}
