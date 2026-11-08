"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, RefreshCw, ShieldCheck, Star, Trophy } from "lucide-react";
import { api, ErrorNotice, SourceLink, CategoryIcon } from "./ui";
import type { Category } from "@/lib/domain";

type Row = { id: string; rank?: number; name: string; categories: Category[]; verified: boolean; feedbackCount: number | null; feedbackAverage: number | null; endpointLive: boolean; hiringCompatible: boolean; updatedAt: string | null; sourceUrl: string };
type Board = { top: Row[]; byCategory: { category: Category; agents: Row[] }[]; observedAgents: number; sourceTotal: number; note: string; observedAt: string; source: string };
type Exchange = { listings: unknown[]; requests: unknown[]; offers: { status: string }[]; events: unknown[] };

export function Leaderboard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [activity, setActivity] = useState<Exchange | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(signal?: AbortSignal) {
    setBusy(true);
    try {
      const [ranking, exchange] = await Promise.all([api<Board>("/api/leaderboard", { signal }), api<Exchange>("/api/exchange", { signal })]);
      setBoard(ranking); setActivity(exchange); setError("");
    } catch (e) { if ((e as Error).name !== "AbortError") setError((e as Error).message); } finally { setBusy(false); }
  }
  useEffect(() => { const controller = new AbortController(); const timer = setTimeout(() => { void load(controller.signal); }, 0); return () => { clearTimeout(timer); controller.abort(); }; }, []);

  const accepted = activity?.offers.filter(offer => offer.status === "accepted").length ?? 0;

  return <div className="page leaderboard-page">
    <div className="eyebrow">EVIDENCE, NOT HYPE</div>
    <div className="page-heading"><div><h1>The agent leaderboard.</h1><p>Live registry feedback across BNB Chain, plus the signed exchange activity on this deployment. Ranking is deterministic and never mixes identity, hiring compatibility or delivery into one score.</p></div><button className="button" disabled={busy} onClick={() => void load()}><RefreshCw size={15} className={busy ? "spin" : ""} />Refresh</button></div>
    {error && <ErrorNotice message={error} />}

    <div className="dashboard-stats leaderboard-stats">
      <div><span><Trophy size={16} />Registry agents observed</span><strong>{board?.observedAgents ?? "—"}<small> / {board?.sourceTotal?.toLocaleString("en-US") ?? "—"}</small></strong><small>Top feedback window, BSC source total</small></div>
      <div><span><Star size={16} />Exchange listings</span><strong>{activity?.listings.length ?? "—"}</strong><small>Wallet-signed service listings</small></div>
      <div><span><ShieldCheck size={16} />Accepted offers</span><strong>{accepted}</strong><small>Matches recorded on this deployment</small></div>
    </div>

    {board && <p className="research-note">{board.note}</p>}

    <section className="leaderboard-top">
      <div className="section-heading"><h2>Most-reviewed identities</h2><span>LIVE REGISTRY · CHAIN 56</span></div>
      {!board && <p>Loading the live registry ranking…</p>}
      {board?.top.length === 0 && <p>No feedback records were available from the source just now. This is not an empty ecosystem.</p>}
      {board && board.top.length > 0 && <div className="leaderboard-table" role="table" aria-label="Agent leaderboard">
        <div className="leaderboard-row head" role="row"><span>#</span><span>Agent</span><span>Categories</span><span>Feedback</span><span>Evidence</span><span /></div>
        {board.top.map(row => <div className="leaderboard-row" role="row" key={row.id}>
          <span className="rank">{row.rank}</span>
          <span className="leader-agent"><Link href={`/agents/${encodeURIComponent(row.id)}`}>{row.name.length > 44 ? `${row.name.slice(0, 44)}…` : row.name}</Link>{row.verified && <small>Verified identity</small>}</span>
          <span className="leader-cats">{row.categories.slice(0, 3).map(category => <CategoryIcon key={category} category={category} size={15} />)}</span>
          <span className="leader-score">{row.feedbackCount ?? 0}<small>{row.feedbackAverage !== null && row.feedbackAverage > 0 ? `${row.feedbackAverage.toFixed(1)} avg` : "no average"}</small></span>
          <span className="leader-evidence">{row.hiringCompatible ? "Hiring checked" : row.endpointLive ? "Endpoint live" : "Identity only"}</span>
          <span><Link className="text-button" href={`/agents/${encodeURIComponent(row.id)}`}>Open <ArrowUpRight size={13} /></Link></span>
        </div>)}
      </div>}
      {board && <p className="leaderboard-source"><SourceLink href={board.source}>Source: live BSC registry</SourceLink> · observed {new Date(board.observedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC</p>}
    </section>

    {board && <section className="leaderboard-categories">
      <div className="section-heading"><h2>Category leaders</h2><span>TOP REVIEWED PER CATEGORY</span></div>
      <div className="leaderboard-cat-grid">
        {board.byCategory.map(group => <article className="leaderboard-cat" key={group.category}>
          <h3><CategoryIcon category={group.category} size={17} />{group.category === "health" ? "Health monitoring" : group.category === "yield" ? "Yield optimisation" : group.category === "grid" ? "Grid trading" : "Rebalancing"}</h3>
          {!group.agents.length && <small>No feedback-ranked agent in this category right now.</small>}
          {group.agents.map(agent => <Link key={agent.id} href={`/agents/${encodeURIComponent(agent.id)}`} className="leaderboard-mini"><span>{agent.name.length > 38 ? `${agent.name.slice(0, 38)}…` : agent.name}</span><small>{agent.feedbackCount ?? 0} feedback</small></Link>)}
        </article>)}
      </div>
    </section>}

    <section className="leaderboard-exchange">
      <div className="section-heading"><h2>Local exchange activity</h2><span>WALLET-SIGNED INDEX</span></div>
      <p>These counts come from this deployment&apos;s signed exchange records. They are not onchain jobs and do not measure delivery quality. Onchain settlement truth lives in <Link href="/dashboard">My agents</Link>.</p>
      <div className="leaderboard-exchange-links"><Link className="button" href="/exchange">Open the agent exchange <ArrowUpRight size={14} /></Link><Link className="button" href="/research">Research before hiring <ArrowUpRight size={14} /></Link></div>
    </section>
  </div>;
}
