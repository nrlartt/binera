"use client";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { Columns3, ArrowUpRight, X, CircleHelp } from "lucide-react";
import { type Agent, categoryName } from "@/lib/domain";
import { useMarket } from "./shell";
import { api, CategoryIcon, dateLabel, ErrorNotice, TrustBadge } from "./ui";
import { formatUnits } from "viem";
import { newTask, taskText, taskSchema, type ResearchTask } from "@/lib/research-task";
import type { SignedQuote } from "@/lib/quote";
import { ResearchTaskForm, ResearchPreview } from "./research-task";
export function Comparison() {
  const { compared, toggleCompare, clearCompare, replaceCompared } = useMarket();
  const [result, setResult] = useState<{ ids: string; agents: Agent[]; error: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const [draft, setDraft] = useState<ResearchTask>(() => newTask());
  const [quotes, setQuotes] = useState<Record<string, { quote?: SignedQuote; error?: string }>>({});
  const [quoting, setQuoting] = useState(false); const [notice, setNotice] = useState(""); const [now, setNow] = useState(0); const version = useRef(0);
  const validTask = taskSchema.safeParse(draft); const text = validTask.success ? taskText(draft) : "";
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("ids")?.split(",");
    if (!requested || requested.length < 2 || requested.length > 3 || requested.some(id => !/^(scan-56-\d{1,20}|studio-[\w-]+)$/.test(id))) return;
    const controller = new AbortController();
    Promise.all([...new Set(requested)].map(id => api<Agent>(`/api/agents/${id}`, { signal: controller.signal }))).then(items => {
      if (!controller.signal.aborted && items.length >= 2 && items[0].categories.some(c => items.every(a => a.categories.includes(c)))) replaceCompared(items);
    }).catch(() => { if (!controller.signal.aborted) setNotice("Shared comparison could not be loaded. Your saved selection is still available."); });
    return () => controller.abort();
    // Restore the shared selection once, without reacting to local edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function getQuotes() {
    const current = ++version.current; setQuoting(true); setQuotes({});
    const outcomes = await Promise.allSettled(agents.map(async a => [a.id, await api<SignedQuote>("/api/quote", { method: "POST", body: JSON.stringify({ id: a.id, task: text }) })] as const));
    if (current !== version.current) return;
    setQuotes(Object.fromEntries(outcomes.map((r, i) => [agents[i].id, r.status === "fulfilled" ? { quote: r.value[1] } : { error: r.reason instanceof Error ? r.reason.message : "Quote unavailable" }]))); setQuoting(false);
  }
  async function share() { const url = new URL("/compare", location.origin); url.searchParams.set("ids", ids); try { await navigator.clipboard.writeText(url.href); setNotice("Comparison link copied. Task inputs are not included."); } catch { setNotice(url.href); } }

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
  useEffect(() => { version.current++; const timer = setTimeout(() => { setQuotes({}); setQuoting(false); }, 0); return () => clearTimeout(timer); }, [ids]);
  const error = result?.ids === ids ? result.error : "";
  const rows: { name: string; get: (a: Agent) => React.ReactNode }[] = [

    { name: "Quoted agent fee", get: a => quotes[a.id]?.quote ? `${formatUnits(BigInt(quotes[a.id].quote!.price), 18)} U` : quotes[a.id]?.error || "Not requested" },
    { name: "Agreed output", get: a => quotes[a.id]?.quote?.deliverables || "Not quoted" },
    { name: "Estimated delivery", get: a => quotes[a.id]?.quote?.estimatedSeconds != null ? `${quotes[a.id].quote!.estimatedSeconds} seconds (seller estimate)` : "Not provided" },
    { name: "Quote expiry", get: a => quotes[a.id]?.quote ? `${dateLabel(new Date(quotes[a.id].quote!.expiresAt * 1000).toISOString())}${quotes[a.id].quote!.expiresAt * 1000 <= now ? " - expired; request again" : ""}` : "Not quoted" },
    { name: "Capabilities", get: a => a.categories.map(categoryName).join(", ") }, { name: "Assets mentioned", get: a => a.assets.join(", ") || "Not available" }, { name: "Protocols mentioned", get: a => a.protocols.join(", ") || "Not available" }, { name: "Identity", get: a => a.verified ? "Verified by source" : "Registered, not independently verified" }, { name: "Feedback records", get: a => a.feedbackCount ?? "Not available" }, { name: "Risk assessment", get: () => "Not available" }, { name: "Measured returns / APY", get: () => "Not available" }, { name: "Fee", get: () => "Live signed quote required" }, { name: "Activation", get: a => a.endpoint ? "Live endpoint published; compatibility checked at quote" : "Compatible endpoint not published" }, { name: "Permission scope", get: () => "Research hiring: exact fee cap, escrow calls, 15-minute expiry" }, { name: "Strategy activity", get: () => "Not available" }, { name: "Source updated", get: a => dateLabel(a.updatedAt) }, { name: "Retrieved", get: a => dateLabel(a.fetchedAt) },
  ];
  return <div className="page"><div className="eyebrow">THE EVIDENCE, SIDE BY SIDE</div><div className="page-heading"><div><h1>Find your better fit.</h1><p>Compare what is published. See what still needs an answer.</p></div>{compared.length > 0 && <button className="button" onClick={clearCompare}>Clear comparison</button>}</div>{notice && <p role="status">{notice}</p>}{error && <ErrorNotice message={error} />}{compared.length < 2 ? <div className="empty"><Columns3 size={36} /><h2>Bring a second perspective.</h2><p>Select two or three agents in the same category to compare their capabilities and evidence.</p><Link href={compared.length === 1 ? `/category/${compared[0].categories[0]}` : "/"} className="button primary">{compared.length === 1 ? "Choose a second agent" : "Explore agents"} <ArrowUpRight size={16} /></Link></div> : error ? <div className="empty"><h2>Comparison could not be refreshed.</h2><p>Your selection is saved. Retry to retrieve the latest evidence.</p><button className="button primary" onClick={() => { setResult(null); setRetry(value => value + 1); }}>Retry comparison</button></div> : agents.length !== compared.length ? <div className="empty" aria-busy="true">Refreshing comparison from the live registry…</div> : <><div className="notice"><CircleHelp size={18} /><p>Missing data stays missing. Identity does not establish investment safety, and a quote buys a research task rather than automatic trading access.</p></div><section className="quote-comparison"><h2>Compare quotes for the same task</h2><ResearchTaskForm value={draft} disabled={quoting} onChange={v => { version.current++; setDraft(v); setQuotes({}); setQuoting(false); }} /><ResearchPreview task={draft} /><p>The same exact task goes to each seller. Each quote is checked independently. Agent fees are separate from strategy capital and network fees.</p>{!agents.every(a => a.categories.includes(draft.category)) && <p>Select a category supported by every agent in this comparison.</p>}<button className="button primary" disabled={quoting || !text || !agents.every(a => a.categories.includes(draft.category))} onClick={getQuotes}>{quoting ? "Checking seller quotes..." : "Get comparable quotes"}</button><button className="button" onClick={share}>Copy comparison link</button></section><div className="comparison-scroll"><table className="comparison-table"><thead><tr><th scope="col">What matters to you</th>{agents.map(a => <th scope="col" key={a.id}><button className="icon-button remove-comparison" aria-label={`Remove ${a.name}`} onClick={() => toggleCompare(a)}><X size={16} /></button><span className={`agent-avatar ${a.categories[0]}`}><CategoryIcon category={a.categories[0]} /></span><h3>{a.name}</h3><TrustBadge verified={a.verified} /></th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.name}><th scope="row">{row.name}</th>{agents.map(a => <td key={a.id}>{row.get(a)}</td>)}</tr>)}<tr><th scope="row">Your next step</th>{agents.map(a => <td key={a.id}><Link className="button primary" href={`/agents/${a.id}`} onClick={() => { if (validTask.success) { try { sessionStorage.setItem("binera-research-task", JSON.stringify({ agentId: a.id, draft })); } catch { /* Activation still permits manual input. */ } } }}>View agent <ArrowUpRight size={15} /></Link></td>)}</tr></tbody></table></div></>}</div>;
}
