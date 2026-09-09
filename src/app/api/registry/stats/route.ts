import { z } from "zod";
import { cached, remoteJson, errorResponse, PublicError } from "@/lib/server/http";

const chain = z.object({ chain_id: z.number(), total_agents: z.number().int().nonnegative(), a2a_agents: z.number().int().nonnegative(), mcp_agents: z.number().int().nonnegative() });
export async function GET() {
  try {
    const data = await cached("bsc-registry-stats", async () => {
      const result = z.object({ chain_stats: z.array(chain) }).parse(await remoteJson("https://api.8004scan.io/api/v1/stats/global", { headers: process.env.SCAN_API_KEY ? { "X-API-Key": process.env.SCAN_API_KEY } : {} }));
      const bsc = result.chain_stats.find(c => c.chain_id === 56);
      if (!bsc) throw new PublicError("BNB Chain registry statistics are unavailable.", 503);
      return { registered: bsc.total_agents, publishedA2A: bsc.a2a_agents, publishedMCP: bsc.mcp_agents, observedAt: new Date().toISOString(), source: "https://8004scan.io/agents?chain=56", note: "Registration and published interfaces do not prove service availability, payment compatibility or delivery. Binera's reviewed catalogue is a separate subset." };
    }, 900000);
    return Response.json(data);
  } catch (error) { return errorResponse(error); }
}
