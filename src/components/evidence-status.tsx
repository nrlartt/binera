"use client";
import { useEffect, useState } from "react";
import { agentEvidence, type Agent } from "@/lib/domain";
import { loadActivity } from "@/lib/activity";
import { matchesJob } from "@/lib/job-match";
import { api, dateLabel, SourceLink } from "./ui";
import { AgentEvidenceTrack } from "./agent-evidence";

export function EvidenceStatus({ agent }: { agent: Agent }) {
  const [service, setService] = useState<{ available: boolean; observedAt: string; message: string } | null>(null);
  const [error, setError] = useState(""); const [deliveries, setDeliveries] = useState<string[]>([]); const [checked, setChecked] = useState(false); const [busy, setBusy] = useState(false);
  const [quoteUntil, setQuoteUntil] = useState(0); const [now, setNow] = useState(0);
  useEffect(() => {
    const handle = (event: Event) => { const d = (event as CustomEvent).detail; if (d?.agentId === agent.id) { setQuoteUntil(d.expiresAt * 1000); setNow(Date.now()); } };
    window.addEventListener("binera-quote", handle); const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { window.removeEventListener("binera-quote", handle); clearInterval(timer); };
  }, [agent.id]);
  async function check() {
    setBusy(true); setError(""); setChecked(false); setDeliveries([]);
    const requests = loadActivity().filter(r => r.agentId === agent.id && r.jobId).slice(0, 10);
    const [availability, outcomes] = await Promise.all([
      api<NonNullable<typeof service>>(`/api/agents/${agent.id}/availability`).then(setService).catch(() => { setService(null); setError("Service check unavailable."); }),
      Promise.allSettled(requests.map(async r => { const job = await api<{ client: string; provider: string; description: string; budget: string; statusName: string; deliverableContent: string | null }>(`/api/jobs/${r.jobId}?deliverable=true`); return matchesJob(job, r) && job.statusName === "COMPLETED" && job.deliverableContent ? r.jobId! : null; })),
    ]);
    void availability;
    setDeliveries(outcomes.flatMap(r => r.status === "fulfilled" && r.value ? [r.value] : [])); setChecked(true); setBusy(false);
    if (outcomes.some(r => r.status === "rejected")) setError("Some saved delivery references could not be checked.");
  }
  const sourceEvidence = agentEvidence(agent);
  const evidence = { ...sourceEvidence,
    endpointLive: service ? service.available : sourceEvidence.endpointLive,
    hiringCompatible: service ? service.available : sourceEvidence.hiringCompatible,
    provenDelivery: deliveries.length > 0,
    observedAt: service?.observedAt ?? sourceEvidence.observedAt,
  };
  return <section><h2>Trust, one check at a time</h2><AgentEvidenceTrack agent={agent} evidence={evidence} /><div className="evidence-grid"><div><span>Identity</span><strong>{agent.registered ? "Registered identity" : "Registration not established"}</strong><p>{agent.verified ? "The source also reports verification." : "Registration is not an endorsement."}</p><SourceLink href={agent.sourceUrl}>Identity source</SourceLink></div><div><span>Service</span><strong>{service ? service.available ? "Live and hiring-compatible" : "Hiring unavailable" : sourceEvidence.endpointLive ? "Registry health check passed" : "Not checked here"}</strong><p>{service?.message || "A published endpoint does not establish Binera compatibility."}</p>{(service?.observedAt || sourceEvidence.observedAt) && <small>{dateLabel(service?.observedAt ?? sourceEvidence.observedAt)}</small>}</div><div><span>Signed quote</span><strong>{quoteUntil > now ? "Signature verified" : quoteUntil ? "Quote expired" : "Not requested here"}</strong><p>{quoteUntil ? `Valid until ${dateLabel(new Date(quoteUntil).toISOString())}` : "Request a quote in Review activation. Payment identity and signature are checked."}</p></div><div><span>Completed delivery</span><strong>{deliveries.length ? `${deliveries.length} verified saved jobs` : checked ? "No completed delivery verified" : "Not checked here"}</strong><p>Checks up to 10 saved references against onchain jobs and deliverable hashes. This is not a global success rate or a quality rating.</p>{deliveries.map(id => <span key={id}>Job #{id} </span>)}</div></div><button className="button" disabled={busy} onClick={check}>{busy ? "Checking evidence…" : "Check service & saved deliveries"}</button>{error && <p role="status">{error}</p>}</section>;
}
