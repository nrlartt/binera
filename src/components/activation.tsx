"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Clock3, LockKeyhole, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { formatUnits, parseEther } from "viem";
import type { Agent } from "@/lib/domain";
import type { SignedQuote } from "@/lib/quote";
import { hiringPermissions, NETWORK_FEE_CAP, SESSION_SECONDS } from "@/lib/permissions";
import { matchesJob } from "@/lib/job-match";
import { saveActivity, type ActivityRecord } from "@/lib/activity";
import { useMarket } from "./shell";
import { api, dateLabel, ErrorNotice, SourceLink } from "./ui";
import Link from "next/link";
import { newTask, taskText, taskSchema } from "@/lib/research-task";
import { ResearchTaskForm, ResearchPreview } from "./research-task";
import { useDialog } from "./use-dialog";

export function Activation({ agent }: { agent: Agent }) {
  const { wallet, client, openWallet } = useMarket();
  const [open, setOpen] = useState(false); const [draft, setDraft] = useState(() => newTask(agent.categories[0] ?? "yield"));
  const parsed = taskSchema.safeParse(draft); const task = parsed.success ? taskText(draft) : "";
  const [quote, setQuote] = useState<SignedQuote | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(""); const [approved, setApproved] = useState(false); const [record, setRecord] = useState<ActivityRecord | null>(null); const lock = useRef(false); const [now, setNow] = useState(0);
  const [service, setService] = useState<{ available: boolean; message: string; observedAt: string; responseMs: number } | null>(null);
  const [serviceCheck, setServiceCheck] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    api<NonNullable<typeof service>>(`/api/agents/${agent.id}/availability`, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setService(result); }).catch(() => { if (!controller.signal.aborted) setService({ available: false, message: "This service could not be checked. Inspect the provider page or retry.", observedAt: new Date().toISOString(), responseMs: 0 }); });
    return () => controller.abort();
  }, [agent.id, open, serviceCheck]);
  useDialog(open, () => { if (!busy) setOpen(false); });
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  async function getQuote() { if (lock.current) return; lock.current = true; setBusy("Checking the live seller and its signed quote…"); setError(""); setQuote(null); setApproved(false); try { const verifiedQuote = await api<SignedQuote>("/api/quote", { method: "POST", body: JSON.stringify({ id: agent.id, task }) }); setQuote(verifiedQuote); window.dispatchEvent(new CustomEvent("binera-quote", { detail: verifiedQuote })); } catch (e) { setError((e as Error).message); } finally { lock.current = false; setBusy(""); } }
  async function activate() {
    if (!wallet || !client) { openWallet(); return; }
    if (!quote || quote.task !== task || !approved || lock.current || record) return;
    lock.current = true; setError(""); let current: ActivityRecord | null = null;
    try {
      if (quote.expiresAt * 1000 <= Date.now() + 30000) throw new Error("Your quote expired. Request a fresh quote.");
      setBusy("Checking your account balance…");
      const sdk = await import("@altananetwork/sdk");
      const balances = await client.balances({ wallet, tokens: [quote.currency] });
      const tokenBalance = balances.tokens?.find(t => t.address.toLowerCase() === quote.currency.toLowerCase());
      if (balances.native < parseEther(NETWORK_FEE_CAP) || !tokenBalance?.ok || tokenBalance.raw < BigInt(quote.price)) throw new Error(`Fund your marketplace account with at least ${formatUnits(BigInt(quote.price), 18)} U and ${NETWORK_FEE_CAP} BNB for the fee allowance, then try again. Actual fees may be lower.`);
      // Ensure browser can retain public revocation handles before granting a key.
      localStorage.setItem("agentmarket-storage-check", "ok"); localStorage.removeItem("agentmarket-storage-check");
      const sessionSigner = sdk.createPrivateKeySigner();
      const preparedSession = { walletAddress: wallet.address, signer: sessionSigner, publicKey: sessionSigner.publicKey, permissions: hiringPermissions(BigInt(quote.price)), expiry: Math.floor(Date.now() / 1000) + SESSION_SECONDS };
      current = { id: preparedSession.publicKey, agentId: agent.id, agentName: agent.name, wallet: wallet.address, createdAt: new Date().toISOString(), session: sdk.serializeSession(preparedSession), quote: quote.description, price: quote.price, provider: quote.provider, task: quote.task, status: "pending" };
      // Retain the revocation reference BEFORE submission, including when a relay times out.
      saveActivity(current); setRecord(current);
      setBusy("Approve the limited session with your passkey…");
      const session = await client.grantSession({ wallet, signer: wallet.signer, sessionSigner, register: true, permissions: preparedSession.permissions, expiry: preparedSession.expiry });
      current = { id: session.publicKey, agentId: agent.id, agentName: agent.name, wallet: wallet.address, createdAt: new Date().toISOString(), session: sdk.serializeSession(session), grantTx: session.transactionHash, quote: quote.description, price: quote.price, provider: quote.provider, task: quote.task, status: "permission-granted" };
      setRecord(current); saveActivity(current);
      if (quote.expiresAt * 1000 <= Date.now() + 15000) throw new Error("The quote expired during approval. The permission remains visible in My agents; revoke it before requesting another quote.");
      setBusy("Funding your job within the approved limits…");
      const result = await sdk.hireErc8183Agent(session, { provider: quote.provider, task: quote.description, budget: BigInt(quote.price) }, { network: sdk.BNB, noWait: true });
      current = { ...current, callsId: result.callsId, jobId: result.jobId.toString(), fundingTx: result.transactionHash, status: "pending" };
      setRecord(current); saveActivity(current);
      let funded = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        try {
          const job = await api<{ client: string; provider: string; description: string; budget: string; statusName: string }>(`/api/jobs/${result.jobId}`);
          if (matchesJob(job, { wallet: wallet.address, provider: quote.provider, quote: quote.description, price: quote.price }) && ["FUNDED", "SUBMITTED", "COMPLETED"].includes(job.statusName)) { funded = true; break; }
        } catch { /* Keep the saved relay reference when chain reads are unavailable. */ }
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      if (!funded) throw new Error("The network has not confirmed funding. Check My agents before attempting another payment.");
      current = { ...current, status: "funded" }; saveActivity(current); setRecord(current);
      setBusy("Requesting delivery from the agent…");
      await api(`/api/jobs/${result.jobId}/notify`, { method: "POST", body: JSON.stringify({ agentId: agent.id }) });
    } catch (e) {
      const text = e instanceof Error ? e.message : "";
      const known = /Fund your marketplace|quote expired|network has not|permission remains/i.test(text);
      setError(known ? text : current ? "The next step could not be confirmed. Your request reference is saved in My agents. Check its onchain status before retrying; you can revoke access there." : "The request was not completed. Check your balance, approve the passkey request, and try again. No success has been assumed.");
    } finally { lock.current = false; setBusy(""); }
  }
  return <>
    <button className="button primary full" onClick={() => { try { const saved = JSON.parse(sessionStorage.getItem("binera-research-task") || "null"); if (saved?.agentId === agent.id) { setDraft(taskSchema.parse(saved.draft)); setQuote(null); setApproved(false); sessionStorage.removeItem("binera-research-task"); } } catch { /* Invalid task drafts are ignored. */ } setOpen(true); }}>Review activation <ArrowRight size={17} /></button><small className="activation-hint">See the scope and cost before you approve.</small>
    {open && <div className="modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="activation-title" className="modal activation-modal"><button className="icon-button modal-close" disabled={!!busy} aria-label="Close activation" onClick={() => setOpen(false)}><X size={20} /></button><div className="eyebrow small">ACTIVATE WITH INTENTION</div><h2 id="activation-title">Put expertise to work.</h2><p className="modal-subtitle">{agent.name}</p>{record ? <><div className="notice">{record.status === "funded" ? <Check size={20} /> : <Clock3 size={20} />}<div><strong>{record.status === "funded" ? "Your job is funded" : "Your request reference is saved"}</strong><p>Delivery and onchain status are tracked in My agents.</p></div></div>{record.fundingTx && <SourceLink href={`https://bscscan.com/tx/${record.fundingTx}`}>View funding transaction</SourceLink>}{error && <ErrorNotice message={error} />}<Link className="button primary full" href="/dashboard">Open my agents <ArrowRight size={17} /></Link></> : <><ResearchTaskForm value={draft} disabled={!!busy} onChange={v => { setDraft(v); setQuote(null); setApproved(false); }} /><ResearchPreview task={draft} />{!agent.categories.includes(draft.category) && <p role="status">Choose a category published by this agent before requesting a quote.</p>}<div className="notice subtle-notice"><LockKeyhole size={18} /><p>This hires a research task. The seller receives the task text, not access to your DeFi positions. Task and terms become public onchain.</p></div>{!quote && <div className="notice"><div><strong>{!service ? "Checking live activation?" : service.available ? "Research hiring available" : "In-app hiring unavailable"}</strong><p>{service?.message}</p>{service && <small>Checked {dateLabel(service.observedAt)} ? {service.responseMs} ms for this check</small>}{service && !service.available && <button className="text-button" onClick={() => { setService(null); setServiceCheck(value => value + 1); }}>Recheck service</button>}</div></div>}{!quote && <button className="button primary full" disabled={!!busy || task.length < 12 || !agent.categories.includes(draft.category) || !service?.available} onClick={getQuote}>Get a verified price quote <ArrowRight size={16} /></button>}{quote && <><div className="quote-price"><div><span>Agent fee</span><strong>{formatUnits(BigInt(quote.price), 18)} <small>U</small></strong></div><span className="badge verified"><ShieldCheck size={14} />Seller signature checked</span></div><div className="permission-list"><div><ShieldCheck size={18} /><div><strong>Escrow funding only</strong><p>The in-browser hiring key can create and fund jobs, and approve the payment token. It cannot trade your positions.</p></div></div><div><LockKeyhole size={18} /><div><strong>Spend limits</strong><p>{formatUnits(BigInt(quote.price), 18)} U for this job + up to {NETWORK_FEE_CAP} BNB in relay fees. Account setup and revocation fees are separate.</p></div></div><div><Clock3 size={18} /><div><strong>Permission expires in 15 minutes</strong><p>The key remains in this tab only. Revoke it from My agents at any time. Revocation does not cancel an already funded job.</p></div></div></div><details className="technical"><summary>Review exact contracts and agreed deliverable</summary><p>{quote.deliverables}</p><p>{quote.quality}</p><pre>{JSON.stringify(hiringPermissions(BigInt(quote.price)).calls, null, 2)}</pre><p>Seller: {quote.provider}</p><p>The session enforces contracts, function selectors, spend caps and expiry. Function arguments are set by this application; the policy does not pin the seller address. The token approval is for the exact quoted amount.</p></details><div className="notice">Escrow uses an optimistic dispute window. Monitor the delivered result and dispute it before that window closes if it does not meet the agreed terms. An unfulfilled job can be refunded after its deadline.</div><label className="consent"><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} />I approve this task, the fee, the limited permission and the escrow terms.</label><button className="button primary full" disabled={!!busy || !approved || quote.expiresAt * 1000 <= now} onClick={activate}>{wallet ? "Approve & activate agent" : "Connect account to activate"}<ArrowRight size={17} /></button><button className="text-button" disabled={!!busy} onClick={getQuote}>Refresh price quote</button><small>Quote expires {dateLabel(new Date(quote.expiresAt * 1000).toISOString())}</small></>}{error && <ErrorNotice message={error} />}</>}{busy && <div className="pending-status" role="status"><LoaderCircle size={18} className="spin" />{busy}</div>}</section></div>}
  </>;
}
