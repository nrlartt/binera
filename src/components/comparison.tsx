"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Columns3, ArrowUpRight, X, CircleHelp } from "lucide-react";
import { type Agent, categoryName } from "@/lib/domain";
import { useMarket } from "./shell";
import { api, CategoryIcon, dateLabel, ErrorNotice, TrustBadge } from "./ui";
export function Comparison() {
  const { compared, toggleCompare, clearCompare } = useMarket();
  const [result, setResult] = useState<{ ids: string; agents: Agent[]; error: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const ids = compared.map(a => a.id).join(",");
  useEffect(() => {
    const controller = new AbortController();
    if (ids.split(",").filter(Boolean).length < 2) return;
    Promise.all(ids.split(",").map(id => api<Agent>(`/api/agents/${id}`, { signal: controller.signal })))
      .then(agents => { if (!controller.signal.aborted) setResult({ ids, agents, error: "" }); })
      .catch(e => { if (!controller.signal.aborted) setResult({ ids, agents: [], error: e.message }); });
    return () => controller.abort();
  }, [ids, retry]);
  const agents = result?.ids === ids ? result.agents : [];
  const error = result?.ids === ids ? result.error : "";
  const rows: { name: string; get: (a: Agent) => React.ReactNode }[] = [
    { name: "Capabilities", get: a => a.categories.map(categoryName).join(", ") }, { name: "Assets mentioned", get: a => a.assets.join(", ") || "Not available" }, { name: "Protocols mentioned", get: a => a.protocols.join(", ") || "Not available" }, { name: "Identity", get: a => a.verified ? "Verified by source" : "Registered, not independently verified" }, { name: "Feedback records", get: a => a.feedbackCount ?? "Not available" }, { name: "Risk assessment", get: () => "Not available" }, { name: "Measured returns / APY", get: () => "Not available" }, { name: "Fee", get: () => "Live signed quote required" }, { name: "Activation", get: a => a.endpoint ? "Live endpoint published; compatibility checked at quote" : "Compatible endpoint not published" }, { name: "Permission scope", get: () => "Research hiring: exact fee cap, escrow calls, 15-minute expiry" }, { name: "Strategy activity", get: () => "Not available" }, { name: "Source updated", get: a => dateLabel(a.updatedAt) }, { name: "Retrieved", get: a => dateLabel(a.fetchedAt) },
  ];
  return <div className="page"><div className="eyebrow">THE EVIDENCE, SIDE BY SIDE</div><div className="page-heading"><div><h1>Find your better fit.</h1><p>Compare what is published. See what still needs an answer.</p></div>{compared.length > 0 && <button className="button" onClick={clearCompare}>Clear comparison</button>}</div>{error && <ErrorNotice message={error} />}{compared.length < 2 ? <div className="empty"><Columns3 size={36} /><h2>Bring a second perspective.</h2><p>Select two or three agents in the same category to compare their capabilities and evidence.</p><Link href={compared.length === 1 ? `/category/${compared[0].categories[0]}` : "/"} className="button primary">{compared.length === 1 ? "Choose a second agent" : "Explore agents"} <ArrowUpRight size={16} /></Link></div> : error ? <div className="empty"><h2>Comparison could not be refreshed.</h2><p>Your selection is saved. Retry to retrieve the latest evidence.</p><button className="button primary" onClick={() => { setResult(null); setRetry(value => value + 1); }}>Retry comparison</button></div> : agents.length !== compared.length ? <div className="empty" aria-busy="true">Refreshing comparison from the live registry…</div> : <><div className="notice"><CircleHelp size={18} /><p>Missing data stays missing. Identity does not establish investment safety, and a quote buys a research task rather than automatic trading access.</p></div><div className="comparison-scroll"><table className="comparison-table"><thead><tr><th scope="col">What matters to you</th>{agents.map(a => <th scope="col" key={a.id}><button className="icon-button remove-comparison" aria-label={`Remove ${a.name}`} onClick={() => toggleCompare(a)}><X size={16} /></button><span className={`agent-avatar ${a.categories[0]}`}><CategoryIcon category={a.categories[0]} /></span><h3>{a.name}</h3><TrustBadge verified={a.verified} /></th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.name}><th scope="row">{row.name}</th>{agents.map(a => <td key={a.id}>{row.get(a)}</td>)}</tr>)}<tr><th scope="row">Your next step</th>{agents.map(a => <td key={a.id}><Link className="button primary" href={`/agents/${a.id}`}>View agent <ArrowUpRight size={15} /></Link></td>)}</tr></tbody></table></div></>}</div>;
}
