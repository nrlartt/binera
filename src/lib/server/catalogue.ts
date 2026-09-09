import { getAgent } from "./registry";
import { activationReadiness } from "./studio";
import { cached } from "./http";
import { agentEvidence } from "../domain";

// Real registry identities observed in the service audit, not invented agents.
// Operators can expand this reviewed set after verifying the provider interface.
const initial = ["scan-56-265375", "scan-56-269224", "scan-56-341225", "scan-56-269228"];
export function researchCatalogue() {
  return cached("research-catalogue", async () => {
    const ids = [...new Set((process.env.MARKETPLACE_AGENT_IDS || initial.join(",")).split(",").map(id => id.trim()).filter(id => /^scan-56-\d{1,20}$/.test(id)))].slice(0, 20);
    const agents: Awaited<ReturnType<typeof getAgent>>[] = []; let unavailable = 0;
    for (let i = 0; i < ids.length; i += 2) {
      const results = await Promise.allSettled(ids.slice(i, i + 2).map(async id => {
        const agent = await getAgent(id); const readiness = await activationReadiness(id);
        if (!readiness.available) throw new Error("Service check did not pass");
        return { ...agent, evidence: { ...agentEvidence(agent), endpointLive: true, hiringCompatible: true, observedAt: readiness.observedAt } };
      }));
      for (const result of results) { if (result.status === "fulfilled") agents.push(result.value); else unavailable++; }
    }
    return { agents, fetchedAt: new Date().toISOString(), partial: unavailable > 0, warnings: unavailable ? [`${unavailable} reviewed services could not be reached or did not pass compatibility checks. They are temporarily excluded; retry later.`] : [] };
  }, 60000);
}
