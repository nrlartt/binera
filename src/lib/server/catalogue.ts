import { getAgent, registry } from "./registry";
import { activationReadiness } from "./studio";
import { cached } from "./http";
import { agentEvidence } from "../domain";

// Real registry identities observed in the service audit, not invented agents.
// Operators can expand this reviewed set after verifying the provider interface.
const initial = ["scan-56-265375", "scan-56-269224", "scan-56-341225", "scan-56-269228"];
export function researchCatalogue() {
  return cached("research-catalogue", async () => {
    const discovered = await registry.discover();
    const candidates = discovered.agents.filter(a => a.endpoint && a.active !== false).sort((a, b) => Number(agentEvidence(b).endpointLive) - Number(agentEvidence(a).endpointLive) || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || a.id.localeCompare(b.id));
    const configured = (process.env.MARKETPLACE_AGENT_IDS || initial.join(",")).split(",").map(id => id.trim()).filter(id => /^scan-56-\d{1,20}$/.test(id));
    const ids = [...new Set([...configured, ...candidates.map(a => a.id)])].slice(0, 32);
    const agents: Awaited<ReturnType<typeof getAgent>>[] = []; let unavailable = 0;
    for (let i = 0; i < ids.length; i += 4) {
      const results = await Promise.allSettled(ids.slice(i, i + 4).map(async id => {
        const agent = await getAgent(id); const readiness = await activationReadiness(id);
        if (!readiness.available) throw new Error("Service check did not pass");
        return { ...agent, evidence: { ...agentEvidence(agent), endpointLive: true, hiringCompatible: true, observedAt: readiness.observedAt } };
      }));
      for (const result of results) { if (result.status === "fulfilled") agents.push(result.value); else unavailable++; }
    }
    return { agents, fetchedAt: new Date().toISOString(), partial: unavailable > 0 || discovered.partial, warnings: [...discovered.warnings, ...(unavailable ? [`${unavailable} candidate services could not be reached or did not pass hiring compatibility checks. They are temporarily excluded; retry later.`] : [])] };
  }, 300000);
}
