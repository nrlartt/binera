"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Boxes, CircleHelp, Code2, FlaskConical, ShieldCheck } from "lucide-react";
import { api, CopyAddress, ErrorNotice } from "./ui";

type Entry = { key: string; name: string; purpose: string; state: "not-configured" | "live" | "address-without-code"; address: string | null; codePresent: boolean };
type Status = { chainId: number; observedAt: string; contracts: Entry[]; paymentToken: string | null; note: string; source: string };

const stateLabel: Record<Entry["state"], string> = {
  live: "Live bytecode",
  "not-configured": "Not configured",
  "address-without-code": "Address without code",
};

export function Protocol() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => { api<Status>("/api/protocol", { signal: controller.signal }).then(setStatus).catch(e => { if ((e as Error).name !== "AbortError") setError((e as Error).message); }); }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, []);

  return <div className="page protocol-page">
    <div className="eyebrow">THE LAYER ABOVE ESCROW</div>
    <div className="page-heading"><div><h1>Marketplace protocol.</h1><p>Stake, reputation, evaluator verdicts and bounty escrow — written, tested and deployment-ready. This page shows the real configuration and bytecode status; nothing here is presented as live until an operator deploys it.</p></div></div>
    {error && <ErrorNotice message={error} />}
    <div className="protocol-grid">
      {(status?.contracts ?? []).map(entry => <article className={`protocol-card ${entry.state}`} key={entry.key}>
        <div className="protocol-card-head"><h3>{entry.name}</h3><span className={`badge ${entry.state === "live" ? "verified" : "subtle"}`}>{stateLabel[entry.state]}</span></div>
        <p>{entry.purpose}</p>
        {entry.address ? <div className="protocol-address"><code>{entry.address}</code><CopyAddress address={entry.address} label={`${entry.name} address`} /></div> : <small>Set the matching operator env value after an audited deployment.</small>}
      </article>)}
      {!status && !error && <p>Reading operator configuration and BSC bytecode…</p>}
    </div>
    {status && <p className="research-note">{status.note}</p>}
    {status && <p className="research-note">Payment token: {status.paymentToken ? <code>{status.paymentToken}</code> : "not configured"} · chain {status.chainId} · observed {new Date(status.observedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</p>}

    <div className="protocol-grid protocol-info">
      <section className="research-card"><h3><ShieldCheck size={18} />Bounded authority</h3><p>Stake can only leave through <code>unstake</code> or an arbiter slash. Bounty funds only through slot approval or a post-deadline refund. There is no owner withdraw, proxy admin or upgrade path.</p></section>
      <section className="research-card"><h3><FlaskConical size={18} />Tested locally</h3><p>10 Hardhat tests cover lock expiry, slashing limits, score caps, panel composition, duplicate votes, split-vote timeout and bounty accounting. Passing tests are not an audit.</p><Link className="text-button" href="/docs#protocol">Read the protocol notes <ArrowUpRight size={13} /></Link></section>
      <section className="research-card"><h3><CircleHelp size={18} />Not wired yet</h3><p>This deployment does not read these contracts in hiring, scoring or settlement. Jobs still settle through ERC-8183, and exchange records remain off-chain. Wiring a verdict to escrow or slashing is a separate operator action.</p></section>
      <section className="research-card"><h3><Code2 size={18} />Operator deploy</h3><p>Deployment needs a funded wallet, the payment token address and an arbiter multisig. You can deploy all four contracts from this browser with your own wallet — Binera never receives your key.</p><Link className="text-button" href="/protocol/deploy">Open the wallet deployer <ArrowUpRight size={13} /></Link></section>
    </div>

    <section className="protocol-next"><Boxes size={20} /><div><strong>Deployment checklist</strong><p>Fund a dedicated deployer, configure the arbiter multisig, deploy to BSC testnet, verify each address, run a funded dispute and bounty scenario, then set the operator env values. Until then this page stays honest.</p><p><Link className="text-button" href="/protocol/console">Open the live contract console</Link></p></div></section>
  </div>;
}
