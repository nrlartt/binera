"use client";
import { useEffect, useState } from "react";
import { Activity, ShieldCheck, Droplets, HeartPulse, ArrowUpRight, LoaderCircle, SearchCheck } from "lucide-react";
import { api, ErrorNotice, SourceLink, dateLabel } from "./ui";
import { XonaServices } from "./xona-services";
import type { Agent } from "@/lib/domain";

type RegistryStats = { registered: number; publishedA2A: number; publishedMCP: number; observedAt: string; source: string; note: string };
type PoolSnapshot = { pool: string; pair: string; price: number; feePercent: number; wbnbBalance: string; usdtBalance: string; blockNumber: string; timestamp: string; source: string; note: string };
type SecurityFinding = { tokenAddress: string; content: string; observedAt: string; source: string; sourceUrl: string; note: string };
type ResearchFacts = { title: string; facts: Record<string, string>; block: string; observedAt: string; source: string; note: string };
type Discovery = { agents: Agent[]; warnings: string[] };
const addressPattern = /^0x[0-9a-f]{40}$/i;

function Facts({ facts }: { facts: Record<string, string> }) {
  return <dl className="research-facts">{Object.entries(facts).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>;
}

export function ResearchToolkit() {
  const [stats, setStats] = useState<RegistryStats | null>(null);
  const [pool, setPool] = useState<PoolSnapshot | null>(null);
  const [refs, setRefs] = useState<Discovery | null>(null);
  const [overviewError, setOverviewError] = useState("");
  const [token, setToken] = useState("");
  const [security, setSecurity] = useState<SecurityFinding | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState("");
  const [kind, setKind] = useState<"pool" | "health">("pool");
  const [address, setAddress] = useState("");
  const [facts, setFacts] = useState<ResearchFacts | null>(null);
  const [factsBusy, setFactsBusy] = useState(false);
  const [factsError, setFactsError] = useState("");
  const [overviewKey, setOverviewKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api<RegistryStats>("/api/registry/stats", { signal: controller.signal }).then(setStats).catch(e => { if (!controller.signal.aborted) setOverviewError(e.message); });
    api<PoolSnapshot>("/api/market", { signal: controller.signal }).then(s => { setPool(s); setAddress(s.pool); }).catch(e => { if (!controller.signal.aborted) setOverviewError(e.message); });
    api<Discovery>("/api/discover", { signal: controller.signal }).then(setRefs).catch(e => { if (!controller.signal.aborted) setOverviewError(e.message); });
    return () => controller.abort();
  }, [overviewKey]);

  async function runScan() {
    setScanBusy(true); setScanError(""); setSecurity(null);
    try {
      if (!addressPattern.test(token.trim())) throw new Error("Enter a valid BNB Chain token address.");
      setSecurity(await api<SecurityFinding>(`/api/research/security?token=${encodeURIComponent(token.trim())}`));
    } catch (e) { setScanError((e as Error).message); } finally { setScanBusy(false); }
  }

  async function runResearch() {
    setFactsBusy(true); setFactsError(""); setFacts(null);
    try {
      if (!addressPattern.test(address.trim())) throw new Error("Enter a valid BNB Chain address.");
      setFacts(await api<ResearchFacts>(`/api/research/context?kind=${kind}&address=${encodeURIComponent(address.trim())}`));
    } catch (e) { setFactsError((e as Error).message); } finally { setFactsBusy(false); }
  }

  return <div className="page research-toolkit">
    <div className="eyebrow">FINDINGS BEFORE ACTION</div>
    <div className="page-heading"><div><h1>Research desk.</h1><p>Everything the marketplace can read onchain, in one place. Verify a token, inspect a pool or a lending account, then hire a research seller with a signed quote.</p></div></div>

    <div className="research-stats">
      <div className="stat-tile"><span><Activity size={16} />Agents indexed on BSC</span><strong>{stats ? stats.registered.toLocaleString("en-US") : "—"}<small> registry</small></strong><small>{stats ? `${stats.publishedA2A} publish A2A · ${stats.publishedMCP} publish MCP · ${dateLabel(stats.observedAt)}` : "Reading the live registry"}</small></div>
      <div className="stat-tile"><span><Droplets size={16} />PancakeSwap v3 spot</span><strong>{pool ? `${pool.price.toPrecision(8)}` : "—"}<small> {pool ? pool.pair.replace("WBNB / USDT", "WBNB/USDT") : ""}</small></strong><small>{pool ? `${pool.feePercent}% fee tier · block ${pool.blockNumber} · ${dateLabel(pool.timestamp)}` : "Reading the factory"}</small></div>
      <div className="stat-tile"><span><ShieldCheck size={16} />Reviewed sellers here</span><strong>{refs ? refs.agents.length : "—"}<small> in catalogue</small></strong><small>{refs ? "Live seller checks happen before any quote" : "Loading the research catalogue"}</small></div>
    </div>
    {overviewError && <div className="notice error" role="alert"><div><strong>Some live reads did not complete</strong><p>{overviewError}</p><button className="text-button" onClick={() => { setOverviewError(""); setStats(null); setPool(null); setRefs(null); setOverviewKey(value => value + 1); }}>Retry live reads</button></div></div>}
    {stats && <p className="research-note">{stats.note}</p>}
    {pool && <p className="research-note">{pool.note}</p>}

    <div className="research-grid">
      <section className="research-card">
        <h3><SearchCheck size={18} />Token scan</h3>
        <p>Run token-level security research through the public GoPlus token-security API. Output is untrusted publisher data, rendered as text — never a guarantee that a token is safe.</p>
        <label className="field-label">Token contract address
          <input className="research-input" value={token} onChange={e => { setToken(e.target.value); setSecurity(null); setScanError(""); }} placeholder="0x… BSC token" spellCheck={false} inputMode="text" />
        </label>
        <button className="button primary full" disabled={scanBusy} onClick={() => void runScan()}>{scanBusy ? <LoaderCircle size={15} className="spin" /> : <ShieldCheck size={15} />}{scanBusy ? "Scanning…" : "Scan token"}</button>
        {scanError && <ErrorNotice message={scanError} />}
        {security && <div className="notice"><div><strong>Findings received · {dateLabel(security.observedAt)}</strong><pre className="scan-result">{security.content}</pre><small>{security.note}</small></div></div>}
        <small>If the provider is rate-limited or unavailable, the scan reports that instead of inventing findings.</small>
      </section>

      <section className="research-card">
        <h3>{kind === "pool" ? <Droplets size={18} /> : <HeartPulse size={18} />}{kind === "pool" ? "PancakeSwap pool research" : "Venus Core account research"}</h3>
        <p>{kind === "pool" ? "Confirm a pool is registered at the official factory and read its spot price, fee tier and tokens at a single real block." : "Read a Venus Core account's liquidity and shortfall at a single real block. This is a liquidity calculation, not a health-factor ratio."}</p>
        <div className="research-kinds" role="group" aria-label="Research type">
          <button type="button" className={kind === "pool" ? "active" : ""} onClick={() => { setKind("pool"); setFacts(null); setFactsError(""); }}>Pool</button>
          <button type="button" className={kind === "health" ? "active" : ""} onClick={() => { setKind("health"); setFacts(null); setFactsError(""); }}>Account health</button>
        </div>
        <label className="field-label">{kind === "pool" ? "Pool address" : "Account address"}
          <input className="research-input" value={address} onChange={e => setAddress(e.target.value)} placeholder="0x…" spellCheck={false} />
        </label>
        <button className="button primary full" disabled={factsBusy} onClick={() => void runResearch()}>{factsBusy ? <LoaderCircle size={15} className="spin" /> : null}{factsBusy ? "Reading chain…" : "Read onchain"}</button>
        {factsError && <ErrorNotice message={factsError} />}
        {facts && <div className="notice"><div><strong>{facts.title} · block {facts.block} · {dateLabel(facts.observedAt)}</strong><Facts facts={facts.facts} /><small>{facts.note}</small><p className="research-source"><SourceLink href={facts.source}>Open in explorer</SourceLink></p></div></div>}
        <small>Pool previews can be pre-filled from the validated flagship pool once the market read completes.</small>
      </section>

      <section className="research-card research-wide">
        <h3>Paid agent services · x402</h3>
        <p>Browse pay-per-request services published by independent agents. Binera can read live payment requirements; the payment itself stays on the provider&apos;s own wallet flow.</p>
        <XonaServices />
      </section>
    </div>

    <section className="research-catalogue">
      <div className="section-heading"><h2>In the research catalogue</h2><span>LIVE REGISTRY CHECKS</span></div>
      <p>These are reviewed registry identities with a checked live service path inside this marketplace. Availability, signed quotes and delivered work remain separate checks.</p>
      {refs && <div className="research-refs">
        {refs.agents.slice(0, 8).map(a => <div className="ref-card" key={a.id}>
          <div className="ref-head"><strong>{a.name.length > 40 ? `${a.name.slice(0, 40)}…` : a.name}</strong>{a.verified && <span className="badge verified"><ShieldCheck size={11} />Verified</span>}</div>
          <p>{a.description.length > 130 ? `${a.description.slice(0, 130)}…` : a.description}</p>
          <div className="ref-foot"><span>{a.evidence?.endpointLive ? "Live endpoint checked" : a.evidence?.interfacePublished ? "Interface published" : "Identity registered"}</span><a className="text-button" href={`/agents/${encodeURIComponent(a.id)}`}>Open agent <ArrowUpRight size={13} /></a></div>
        </div>)}
      </div>}
      {refs && refs.warnings.length > 0 && <ErrorNotice message={refs.warnings.join(" ")} />}
    </section>
  </div>;
}
