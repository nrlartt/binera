import { publicClient } from "@/lib/server/chain";
import { registry } from "@/lib/server/registry";
import { cached } from "@/lib/server/http";
export async function GET() {
  const health = await cached("health-dependencies", async () => {
    const [chain, discovery] = await Promise.allSettled([publicClient.getBlock(), registry.discover()]);
    const chainOk = chain.status === "fulfilled" && Math.abs(Date.now() / 1000 - Number(chain.value.timestamp)) < 180;
    const discoveryOk = discovery.status === "fulfilled" && !discovery.value.partial && discovery.value.agents.length > 0;
    return { status: chainOk && discoveryOk ? "ok" : "degraded", timestamp: new Date().toISOString(), dependencies: { chain: chainOk ? "ok" : "unavailable-or-stale", discovery: discoveryOk ? "ok" : "unavailable-or-partial" }, integrations: { intent: process.env.OPENAI_API_KEY ? "configured" : "rules", tokenSecurity: "goplus-public" } };
  }, 30000);
  return Response.json(health, { status: health.status === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
