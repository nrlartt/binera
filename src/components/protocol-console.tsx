"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Coins, Gavel, Gift, LoaderCircle, RefreshCw, ShieldCheck, Star } from "lucide-react";
import { encodeFunctionData, erc20Abi, formatUnits, keccak256, parseUnits, toHex, type Abi } from "viem";
import { contractArtifacts } from "@/lib/contracts/artifacts";
import { useEvmWallet } from "./use-evm-wallet";
import { api, ErrorNotice, shortAddress } from "./ui";

type Position = { amount: string; unlockAt: string };
type Case = { id: string; buyer: string; provider: string; phase: number; evidenceDeadline: string; voteDeadline: string; votesForProvider: number; votesForBuyer: number; votesCast: number; providerUpheld: boolean; finalVerdict: boolean; evaluators: string[] };
type Slot = { index: number; provider: string; proof: string; status: number };
type Bounty = { id: string; creator: string; rewardPerSlot: string; slots: number; approvedSlots: number; deadline: string; cancelled: boolean; slotDetail: Slot[] };
type State = {
  configured: boolean;
  message?: string;
  addresses?: Record<string, string>;
  paymentToken?: string;
  token?: { symbol: string; decimals: number } | null;
  stake?: { totalStaked: string | null; position: Position | null };
  reputation?: { score: number | null; jobs: number; won: number; lost: number; updatedAt: string } | null;
  arbitration?: { caseCount: number; cases: Case[] };
  bounty?: { bountyCount: number; bounties: Bounty[] };
  observedAt?: string;
};

const phaseLabel = ["none", "evidence", "voting", "resolved"];
const slotStatus = ["empty", "claimed", "approved", "rejected"];
const abi = {
  stake: contractArtifacts.BineraStake.abi as Abi,
  vault: contractArtifacts.BineraBountyVault.abi as Abi,
  arbitration: contractArtifacts.BineraArbitration.abi as Abi,
  reputation: contractArtifacts.BineraReputation.abi as Abi,
};

export function ProtocolConsole() {
  const wallet = useEvmWallet();
  const [state, setState] = useState<State | null>(null);
  const [tab, setTab] = useState<"stake" | "reputation" | "arbitration" | "bounty">("stake");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [lookup, setLookup] = useState("");
  const [caseId, setCaseId] = useState("");
  const [bountyId, setBountyId] = useState("");
  const [amount, setAmount] = useState("");
  const [lockDays, setLockDays] = useState("30");
  const [proof, setProof] = useState("");
  const [slot, setSlot] = useState("0");

  const load = useCallback(async () => {
    const query = new URLSearchParams();
    if (lookup) query.set("account", lookup);
    else if (wallet.account) query.set("account", wallet.account);
    if (caseId) query.set("caseId", caseId);
    if (bountyId) query.set("bountyId", bountyId);
    const data = await api<State>(`/api/protocol/state${query.size ? `?${query}` : ""}`);
    setState(data);
  }, [lookup, wallet.account, caseId, bountyId]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => { load().catch(e => { if ((e as Error).name !== "AbortError") setError((e as Error).message); }); }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [load]);

  useEffect(() => {
    if (!wallet.account || lookup) return;
    const timer = setTimeout(() => setLookup(wallet.account!), 0);
    return () => clearTimeout(timer);
  }, [wallet.account, lookup]);

  async function act(label: string, work: () => Promise<unknown>) {
    setBusy(label); setError(""); setNotice("");
    try { await work(); await load(); } catch (e) { if (wallet.error) setError(wallet.error); else setError((e as Error).message); } finally { setBusy(""); }
  }

  const decimals = state?.token?.decimals ?? 18;

  function stakeData(): `0x${string}`[] {
    if (!state?.addresses) throw new Error("Protocol not configured.");
    const value = parseUnits(amount || "0", decimals);
    if (value <= 0n) throw new Error("Enter a positive stake amount.");
    const seconds = Math.max(0, Math.min(365, Number(lockDays) || 0)) * 86400;
    return [
      encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [state.addresses.stake as `0x${string}`, value] }),
      encodeFunctionData({ abi: abi.stake, functionName: "stake", args: [value, BigInt(seconds)] }),
    ];
  }

  async function stake() {
    if (!state?.addresses) return;
    await act("stake", async () => {
      const [approve, call] = stakeData();
      if (!wallet.account) throw new Error("Connect a wallet first.");
      await wallet.send(approve);
      await wallet.send(call);
      setNotice(`Staked ${amount} ${state.token?.symbol ?? "tokens"}.`);
    });
  }

  async function unstake() {
    if (!state?.addresses) return;
    await act("unstake", async () => {
      const value = parseUnits(amount || "0", decimals);
      if (value <= 0n) throw new Error("Enter a positive amount to unstake.");
      await wallet.send(encodeFunctionData({ abi: abi.stake, functionName: "unstake", args: [value] }));
      setNotice(`Unstaked ${amount}.`);
    });
  }

  async function vote(id: string, upheld: boolean) {
    await act(`vote-${id}`, async () => {
      await wallet.send(encodeFunctionData({ abi: abi.arbitration, functionName: "vote", args: [BigInt(id), upheld] }));
      setNotice(`Vote recorded for case #${id}.`);
    });
  }

  async function claim(bounty: Bounty) {
    await act(`claim-${bounty.id}`, async () => {
      if (!proof.trim()) throw new Error("Enter the delivery proof text; its hash is stored onchain.");
      const hash = keccak256(toHex(proof.trim()));
      await wallet.send(encodeFunctionData({ abi: abi.vault, functionName: "claimSlot", args: [BigInt(bounty.id), Number(slot), hash] }));
      setNotice(`Slot ${slot} claimed on bounty #${bounty.id}.`);
    });
  }

  async function bountyAction(bounty: Bounty, action: "approveSlot" | "rejectSlot" | "reopenSlot" | "cancelBounty") {
    await act(`${action}-${bounty.id}`, async () => {
      const data = action === "cancelBounty"
        ? encodeFunctionData({ abi: abi.vault, functionName: "cancelBounty", args: [BigInt(bounty.id)] })
        : encodeFunctionData({ abi: abi.vault, functionName: action, args: [BigInt(bounty.id), Number(slot)] });
      await wallet.send(data);
      setNotice(`${action} submitted for bounty #${bounty.id}.`);
    });
  }

  if (state && !state.configured) {
    return <div className="page protocol-page"><Link className="text-button" href="/protocol"><ArrowLeft size={14} />Protocol status</Link><div className="eyebrow" style={{ marginTop: 14 }}>PROTOCOL CONSOLE</div><h1>Contracts are not active yet.</h1><p>{state.message}</p><Link className="button primary" href="/protocol/deploy">Deploy with your wallet</Link></div>;
  }

  return <div className="page protocol-page console-page">
    <Link className="text-button" href="/protocol"><ArrowLeft size={14} />Protocol status</Link>
    <div className="eyebrow" style={{ marginTop: 14 }}>LIVE CONTRACT CONSOLE</div>
    <div className="page-heading"><div><h1>Use the protocol.</h1><p>Stake, inspect reputation, vote as an evaluator and manage bounty slots. Every write is signed by your wallet against the configured contracts; reads come from the chain.</p></div><div className="exchange-actions">{wallet.account ? <span className="badge subtle"><ShieldCheck size={13} />{shortAddress(wallet.account)}</span> : <button className="button" onClick={() => void wallet.connect()}><Coins size={15} />Connect wallet</button>}<button className="button" disabled={!!busy} onClick={() => void load().catch(e => setError((e as Error).message))}><RefreshCw size={15} />Refresh</button></div></div>
    {error && <ErrorNotice message={error} />}
    {wallet.error && <ErrorNotice message={wallet.error} />}
    {notice && <div className="notice" role="status"><div><strong>Onchain action confirmed</strong><p>{notice}</p></div></div>}

    <div className="exchange-tabs" role="tablist" aria-label="Protocol console views">
      <button role="tab" aria-selected={tab === "stake"} className={tab === "stake" ? "active" : ""} onClick={() => setTab("stake")}><Coins size={15} />Stake</button>
      <button role="tab" aria-selected={tab === "reputation"} className={tab === "reputation" ? "active" : ""} onClick={() => setTab("reputation")}><Star size={15} />Reputation</button>
      <button role="tab" aria-selected={tab === "arbitration"} className={tab === "arbitration" ? "active" : ""} onClick={() => setTab("arbitration")}><Gavel size={15} />Arbitration</button>
      <button role="tab" aria-selected={tab === "bounty"} className={tab === "bounty" ? "active" : ""} onClick={() => setTab("bounty")}><Gift size={15} />Bounties</button>
    </div>

    {tab === "stake" && <section className="research-card console-panel">
      <h3><Coins size={18} />Agent stake</h3>
      <div className="console-stats">
        <div><span>Total staked</span><strong>{state?.stake?.totalStaked ? formatUnits(BigInt(state.stake.totalStaked), decimals) : "—"} <small>{state?.token?.symbol ?? ""}</small></strong></div>
        <div><span>Your position</span><strong>{state?.stake?.position ? formatUnits(BigInt(state.stake.position.amount), decimals) : "—"}</strong><small>{state?.stake?.position && BigInt(state.stake.position.amount) > 0n ? `unlock ${new Date(Number(state.stake.position.unlockAt) * 1000).toLocaleString("en-GB", { timeZone: "UTC" })} UTC` : "no stake"}</small></div>
      </div>
      <div className="form-grid">
        <label>Amount<input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="100" /></label>
        <label>Lock days (0–365)<input value={lockDays} onChange={e => setLockDays(e.target.value)} inputMode="numeric" /></label>
      </div>
      <div className="console-actions"><button className="button primary" disabled={!!busy || !wallet.account} onClick={() => void stake()}>{busy === "stake" ? <LoaderCircle size={15} className="spin" /> : null}Approve &amp; stake</button><button className="button" disabled={!!busy || !wallet.account} onClick={() => void unstake()}>Unstake amount</button></div>
      <small>Stake is locked until the chosen unlock time. The arbiter can slash only the staked balance.</small>
    </section>}

    {tab === "reputation" && <section className="research-card console-panel">
      <h3><Star size={18} />Reputation record</h3>
      <label className="field-label">Agent address<input value={lookup} onChange={e => setLookup(e.target.value)} placeholder="0x…" spellCheck={false} /></label>
      {!state?.reputation ? <p>No record for this address yet. Unseen agents start at 5000; records are written only by the configured recorder.</p> : <div className="console-stats">
        <div><span>Score</span><strong>{state.reputation.score ?? 5000}<small> / 10,000</small></strong></div>
        <div><span>Jobs</span><strong>{state.reputation.jobs}</strong><small>{state.reputation.won} won · {state.reputation.lost} lost</small></div>
      </div>}
      <small>Reputation is append-only and recorder-controlled. It is not a delivery guarantee or investment performance.</small>
    </section>}

    {tab === "arbitration" && <section className="research-card console-panel">
      <h3><Gavel size={18} />Evaluator cases</h3>
      <div className="form-grid"><label>Load case ID<input value={caseId} onChange={e => setCaseId(e.target.value)} inputMode="numeric" placeholder={String(state?.arbitration?.caseCount ?? 0)} /></label></div>
      {!state?.arbitration?.cases.length ? <p>No cases loaded. Open a case through the arbitration contract, then load its ID here.</p> : <div className="console-cases">{state.arbitration.cases.map(item => {
        const seated = !!wallet.account && item.evaluators.some(evaluator => evaluator.toLowerCase() === wallet.account!.toLowerCase());
        return <article key={item.id} className="console-case"><div className="console-case-head"><strong>Case #{item.id}</strong><span className={`badge ${item.phase === 3 ? "verified" : "subtle"}`}>{phaseLabel[item.phase] ?? item.phase}</span></div><p>{shortAddress(item.buyer)} vs {shortAddress(item.provider)} · votes {item.votesForProvider}/{item.votesForBuyer} · {item.finalVerdict ? "final" : "open"}</p><p className="console-evaluators">Panel: {item.evaluators.map(evaluator => shortAddress(evaluator)).join(", ")}</p>{seated && item.phase !== 3 && <div className="console-actions"><button className="button" disabled={!!busy} onClick={() => void vote(item.id, true)}>Vote provider</button><button className="button" disabled={!!busy} onClick={() => void vote(item.id, false)}>Vote buyer</button></div>}</article>;
      })}</div>}
      <small>Only seated evaluators can vote, after the evidence deadline and before the voting deadline. The contract enforces both.</small>
    </section>}

    {tab === "bounty" && <section className="research-card console-panel">
      <h3><Gift size={18} />Bounty slots</h3>
      <div className="form-grid">
        <label>Bounty ID<input value={bountyId} onChange={e => setBountyId(e.target.value)} inputMode="numeric" placeholder={String(state?.bounty?.bountyCount ?? 0)} /></label>
        <label>Slot index<input value={slot} onChange={e => setSlot(e.target.value)} inputMode="numeric" /></label>
        <label className="span-two">Delivery proof text (hashed onchain)<textarea rows={2} value={proof} onChange={e => setProof(e.target.value)} placeholder="Describe the delivered artifact; only its keccak256 hash is stored." /></label>
      </div>
      {!state?.bounty?.bounties.length ? <p>No bounties loaded. Create one through the vault, then load its ID here.</p> : <div className="console-cases">{state.bounty.bounties.map(item => <article key={item.id} className="console-case"><div className="console-case-head"><strong>Bounty #{item.id}</strong><span className={`badge ${item.cancelled ? "subtle" : "verified"}`}>{item.cancelled ? "cancelled" : `${item.approvedSlots}/${item.slots} approved`}</span></div><p>{formatUnits(BigInt(item.rewardPerSlot), decimals)} {state.token?.symbol ?? ""} per slot · deadline {new Date(Number(item.deadline) * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC</p>{item.slotDetail.length > 0 && <ul className="console-slots">{item.slotDetail.map(entry => <li key={entry.index}>Slot {entry.index}: {slotStatus[entry.status]} {entry.provider !== "0x0000000000000000000000000000000000000000" ? `· ${shortAddress(entry.provider)}` : ""}</li>)}</ul>}{!item.cancelled && <div className="console-actions"><button className="button" disabled={!!busy || !wallet.account} onClick={() => void claim(item)}>{busy === `claim-${item.id}` ? "Claiming…" : "Claim slot"}</button><button className="button" disabled={!!busy || !wallet.account} onClick={() => void bountyAction(item, "approveSlot")}>Approve slot</button><button className="button" disabled={!!busy || !wallet.account} onClick={() => void bountyAction(item, "rejectSlot")}>Reject slot</button><button className="button" disabled={!!busy || !wallet.account} onClick={() => void bountyAction(item, "reopenSlot")}>Reopen slot</button></div>}</article>)}</div>}
      <small>Claim stores only the proof hash. The creator approves or rejects; rejected slots can be reopened before the deadline.</small>
    </section>}
  </div>;
}
