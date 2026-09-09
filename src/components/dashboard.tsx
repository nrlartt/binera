"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, ArrowUpRight, Clock3, Layers3, RefreshCw, ShieldCheck, Wallet, Download } from "lucide-react";
import { formatUnits } from "viem";
import { matchesJob } from "@/lib/job-match";
import { importActivity, loadActivity, saveActivity, type ActivityRecord } from "@/lib/activity";
import { useMarket } from "./shell";
import { api, CopyAddress, dateLabel, ErrorNotice, shortAddress, SourceLink } from "./ui";
import { useDialog } from "./use-dialog";
type AccountState = { native: string; payment: string; keys: { keyId: string; publicKey: string; valid: boolean }[]; observedAt: string; block: string; truncated: boolean; nextOffset: number | null };
type Job = { actions: { approve: boolean; dispute: boolean; refund: boolean }; disputeDeadline: string | null; id: string; client: string; provider: string; description: string; statusName: string; budget: string; expiredAt: string; submittedAt: string; deliverableContent: string | null; deliverableUrl: string | null; deliverableStatus: string; observedAt: string };
export function Dashboard() {
  const { wallet, client, openWallet } = useMarket(); const [records, setRecords] = useState<ActivityRecord[]>([]); const [account, setAccount] = useState<AccountState | null>(null); const [jobs, setJobs] = useState<Record<string, Job>>({}); const [error, setError] = useState(""); const [busy, setBusy] = useState(""); const [tab, setTab] = useState("agents"); const [now, setNow] = useState(0); const [confirm, setConfirm] = useState<{ record: ActivityRecord; action: "revoke" | "approve" | "dispute" | "refund" } | null>(null);
  const refreshVersion = useRef(0); const actionLock = useRef(false);
  useDialog(!!confirm, () => { if (!busy) setConfirm(null); });
  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current; setAccount(null); setJobs({}); setNow(Date.now()); const history = loadActivity(); setRecords(history); if (!wallet) return;
    setBusy("refresh"); setError("");
    try {
      const state = await api<AccountState>(`/api/account/${wallet.address}`); if (version !== refreshVersion.current) return;
      let next = state.nextOffset;
      for (let page = 1; next !== null && page < 20; page++) {
        const more = await api<AccountState>(`/api/account/${wallet.address}?offset=${next}&block=${state.block}`);
        if (version !== refreshVersion.current) return;
        state.keys.push(...more.keys); state.truncated = more.truncated; next = more.nextOffset;
      }
      setAccount(state);
      const result = await Promise.allSettled(history.filter(r => r.wallet.toLowerCase() === wallet.address.toLowerCase() && r.jobId).map(async r => {
        const job = await api<Job>(`/api/jobs/${r.jobId}?deliverable=true`);
        if (!matchesJob(job, r)) throw new Error("Stored job reference does not match the onchain task. Do not repeat the payment.");
        return [r.jobId!, job] as const;
      }));
      if (version !== refreshVersion.current) return;
      setJobs(Object.fromEntries(result.flatMap(r => r.status === "fulfilled" ? [r.value] : [])));
      if (result.some(r => r.status === "rejected")) setError("Some jobs could not be reconciled with the chain. Check their transaction links before taking another action.");
    } catch { if (version !== refreshVersion.current) return; setAccount(null); setError("We could not refresh your onchain status. Previously saved references are shown below; their current state is unconfirmed."); } finally { if (version === refreshVersion.current) setBusy(""); }
  }, [wallet]);
  const invalidateRefresh = useCallback(() => { refreshVersion.current++; }, []);
  useEffect(() => { const timer = setTimeout(() => void refresh(), 0); return () => { clearTimeout(timer); invalidateRefresh(); }; }, [refresh, invalidateRefresh]);
  useEffect(() => {
    if (!wallet) return;
    const timer = setInterval(() => { if (document.visibilityState === "visible" && !busy && !confirm) void refresh(); }, 30000);
    return () => clearInterval(timer);
  }, [wallet, busy, confirm, refresh]);
  async function runAction() {
    if (!confirm || !wallet || !client || actionLock.current || confirm.record.wallet.toLowerCase() !== wallet.address.toLowerCase()) return;
    actionLock.current = true;
    const { record, action } = confirm; setBusy(action); setError("");
    try {
      if (action !== "revoke") {
        const job = await api<Job>(`/api/jobs/${record.jobId}`);
        if (!job.actions[action] || !matchesJob(job, record)) throw new Error("Job does not match this account and task.");
      }
      const sdk = await import("@altananetwork/sdk");
      const result = action === "revoke" ? await client.revokeSession({ wallet, signer: wallet.signer, session: record.session.publicKey }) : action === "refund" ? await client.execute({ wallet, signer: wallet.signer, calls: [sdk.buildClaimRefundCall(56, BigInt(record.jobId!))] }) : await sdk.settleErc8183Job(wallet, wallet.signer, { jobId: BigInt(record.jobId!), action }, { network: sdk.BNB });
      if (result.status !== "CONFIRMED") throw new Error("The network has not confirmed this action. Check the chain before retrying.");
      if (action === "revoke") saveActivity({ ...record, status: "revoked", revokeTx: result.transactionHash });
      setConfirm(null); await refresh();
    } catch { setError("This action could not be confirmed. Check your balance, passkey approval and the job's current state, then refresh before retrying."); } finally { actionLock.current = false; setBusy(""); }
  }
  async function retryDelivery(record: ActivityRecord) { setBusy(record.id); setError(""); try { await api(`/api/jobs/${record.jobId}/notify`, { method: "POST", body: JSON.stringify({ agentId: record.agentId }) }); await refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(""); } }
  async function reconcileSubmission(record: ActivityRecord) {
    if (!record.callsId || actionLock.current) return;
    actionLock.current = true; setBusy("reconcile"); setError("");
    try {
      const relay = await api<{ status: string; transactionHash: string | null }>(`/api/submissions/${record.callsId}`);
      if (relay.transactionHash) saveActivity({ ...record, fundingTx: relay.transactionHash });
      if (relay.status !== "confirmed") setError(`Relay status: ${relay.status}. Inspect its transaction before attempting another payment.`);
      else await refresh();
    } catch { setError("Relay status is unavailable. Keep your saved reference and check the explorer before paying again."); }
    finally { actionLock.current = false; setBusy(""); }
  }
  async function restoreHistory(file?: File) {
    if (!file || !wallet) return;
    try { if (file.size > 2_000_000) throw new Error("Export is too large."); importActivity(JSON.parse(await file.text()), wallet.address); await refresh(); }
    catch { setError("Could not import this export. Choose a valid public activity export for the connected marketplace account, under 2 MB."); }
  }
  function exportHistory() { const blob = new Blob([JSON.stringify(mine, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "binera-public-activity.json"; link.click(); URL.revokeObjectURL(url); }
  const mine = wallet ? records.filter(r => r.wallet.toLowerCase() === wallet.address.toLowerCase()) : [];
  const active = mine.filter(r => account?.keys.some(k => k.publicKey === r.session.publicKey && k.valid));
  return <div className="page dashboard-page"><div className="eyebrow">YOUR GOALS, IN MOTION</div><div className="page-heading"><div><h1>Stay in the loop.</h1><p>Your agents, their work, and the permissions you control.</p></div>{wallet && <button className="button" disabled={!!busy} onClick={() => void refresh()}><RefreshCw size={16} className={busy === "refresh" ? "spin" : ""} />Refresh status</button>}</div>{!wallet ? <div className="empty account-empty"><span className="large-icon"><Wallet size={30} /></span><h2>Your workspace starts here.</h2><p>Connect your passkey account to see agent jobs, onchain activity and active permissions.</p><button className="button primary" onClick={openWallet}>Connect account <ArrowUpRight size={16} /></button><small>Browsing and comparing agents never requires an account.</small></div> : <>{error && <ErrorNotice message={error} />}<div className="dashboard-stats"><div><span><Layers3 size={17} />Agent jobs</span><strong>{mine.filter(r => r.jobId).length}</strong><small>Saved in this browser</small></div><div><span><ShieldCheck size={17} />Live permissions</span><strong>{account ? `${active.length}${account.truncated ? "+" : ""}` : "—"}</strong><small>{account ? "Confirmed by the registry" : "Waiting for onchain status"}</small></div><div><span><Wallet size={17} />Available balance</span><strong>{account ? Number(account.payment).toLocaleString("en-US", { maximumFractionDigits: 4 }) : "—"} <small>U</small></strong><small>{account ? `${Number(account.native).toFixed(6)} BNB for network fees` : "Not available"}</small></div></div><div className="account-line"><span>Account <SourceLink href={`https://bscscan.com/address/${wallet.address}`}>{shortAddress(wallet.address)}</SourceLink><CopyAddress address={wallet.address} label="marketplace account address" /></span>{account && <span>Block {account.block} · {dateLabel(account.observedAt)}</span>}<button className="text-button" onClick={exportHistory}><Download size={14} />Export public references</button></div><label className="account-import button">Import public references<input className="account-file-input" type="file" accept="application/json,.json" disabled={!!busy} onChange={e => { void restoreHistory(e.target.files?.[0]); e.target.value = ""; }} /></label><div className="tabs dashboard-tabs">{[["agents", "My agents"], ["activity", "Activity"], ["permissions", "Permissions"]].map(([id, label]) => <button className={tab === id ? "selected" : ""} key={id} onClick={() => setTab(id)}>{label}</button>)}</div>{!mine.length ? <div className="empty"><Layers3 size={34} /><h2>No agent jobs yet.</h2><p>Find a specialist, review the evidence, and choose what it can do.</p><Link className="button primary" href="/">Discover agents <ArrowUpRight size={16} /></Link></div> : <div className="job-list">{mine.map(record => {
      const job = record.jobId ? jobs[record.jobId] : null; const valid = account?.keys.some(k => k.publicKey === record.session.publicKey && k.valid); const expired = record.session.expiry * 1000 < now;
      const permissionStatus = !account ? "Status unconfirmed" : valid ? "Active" : expired ? "Expired" : account.truncated ? "Status unconfirmed: partial registry scan" : "Not active in registry";
      const nextStep = !job ? "Check payment submission or refresh chain status before paying again." : job.actions.refund ? "The refund window is open. Review the job and claim its refund." : job.statusName === "SUBMITTED" ? job.deliverableContent ? "Review the verified output and the dispute deadline before settlement." : "Delivery was submitted; its content is not verified yet. Refresh and inspect the evidence." : job.statusName === "FUNDED" ? "Request delivery and monitor the job deadline." : job.statusName === "COMPLETED" ? "The job is completed. Review its output and remove any remaining permission." : "Inspect the current onchain state before taking another action.";
      return <article className="job-card" key={record.id}><div className="job-card-header"><div><Link href={`/agents/${record.agentId}`}><h3>{record.agentName}</h3></Link><span>{record.jobId ? `Job #${record.jobId}` : "Request saved; funding not confirmed"} · {dateLabel(record.createdAt)}</span></div><span className={`badge ${valid ? "verified" : "subtle"}`}>{tab === "permissions" ? permissionStatus : job?.statusName ?? "Unconfirmed"}</span></div>{tab === "permissions" ? <><dl className="detail-facts"><div><dt>Scope</dt><dd>Research-job escrow functions only</dd></div><div><dt>Agent fee cap</dt><dd>{formatUnits(BigInt(record.price), 18)} U</dd></div><div><dt>Expiry</dt><dd>{dateLabel(new Date(record.session.expiry * 1000).toISOString())}</dd></div><div><dt>Onchain permission</dt><dd>{permissionStatus}</dd></div></dl><details className="technical"><summary>Exact stored permission policy</summary><pre>{JSON.stringify(record.session.permissions, null, 2)}</pre></details><button className="button danger" disabled={!!busy || !account || !valid} onClick={() => setConfirm({ record, action: "revoke" })}>Revoke access</button></> : tab === "activity" ? <div className="activity-links">{record.grantTx && <SourceLink href={`https://bscscan.com/tx/${record.grantTx}`}>Permission transaction</SourceLink>}{record.fundingTx && <SourceLink href={`https://bscscan.com/tx/${record.fundingTx}`}>Funding transaction</SourceLink>}{record.revokeTx && <SourceLink href={`https://bscscan.com/tx/${record.revokeTx}`}>Revocation transaction</SourceLink>}{record.callsId && <><p className="address">Relay reference: {record.callsId}</p><button className="button" disabled={!!busy} onClick={() => reconcileSubmission(record)}>Check payment submission</button></>}<p>{record.failureStage && `Last unconfirmed step: ${record.failureStage}. Reason: ${record.failureReason ?? "unconfirmed"}. `}Only reported transaction hashes are shown. Follow the explorer to inspect receipts.</p></div> : <><div className="next-action"><strong>Your next step</strong><p>{nextStep}</p><button className="text-button" onClick={() => setTab("activity")}>View transaction evidence</button></div><ol className="job-progress" aria-label="Job progress"><li>Request saved</li><li>{job && ["FUNDED", "SUBMITTED", "COMPLETED"].includes(job.statusName) ? "Funding confirmed" : "Funding unconfirmed"}</li><li>{job?.deliverableContent ? "Delivery hash verified" : "Delivery not verified"}</li><li>{job?.statusName === "COMPLETED" ? "Completed onchain" : "Settlement pending / not established"}</li></ol><p>{record.task}</p>{job && <div className="job-meta"><span><Clock3 size={14} />Deadline {dateLabel(new Date(Number(job.expiredAt) * 1000).toISOString())}</span><span>{formatUnits(BigInt(job.budget), 18)} U escrow</span></div>}{job?.disputeDeadline && <p>Dispute window ends {dateLabel(new Date(Number(job.disputeDeadline) * 1000).toISOString())}. Settlement becomes available after this window; refresh to check.</p>}{job?.deliverableContent && <details className="deliverable"><summary>Read verified deliverable</summary><small>{job.deliverableStatus}</small><pre>{job.deliverableContent}</pre>{job.deliverableUrl && <SourceLink href={job.deliverableUrl}>Original delivery manifest</SourceLink>}</details>}{job && !job.deliverableContent && <small>{job.deliverableStatus}</small>}<div className="job-actions">{job?.statusName === "FUNDED" && <button className="button" disabled={!!busy} onClick={() => retryDelivery(record)}>Request delivery</button>}{job?.statusName === "SUBMITTED" && <><button className="button" disabled={!!busy || !job.deliverableContent || !job.actions.approve} onClick={() => setConfirm({ record, action: "approve" })}>Approve settlement</button><button className="button danger" disabled={!!busy || !job.actions.dispute} onClick={() => setConfirm({ record, action: "dispute" })}>Dispute result</button></>}{job?.actions.refund && <button className="button" disabled={!!busy} onClick={() => setConfirm({ record, action: "refund" })}>Claim refund</button>}<button className="text-button" onClick={() => setTab("permissions")}>Manage access <ArrowUpRight size={14} /></button></div></>}</article>;
    })}</div>}<div className="notice"><Activity size={18} /><div><strong>Keep control after activation.</strong><p>Disconnecting or closing this page does not cancel an escrowed job. Session keys from this app stay in memory and expire after 15 minutes. Status refreshes every 30 seconds while this page is visible. Public references are saved in this browser; export them for recovery. Keep this page open to monitor delivery and dispute deadlines.</p></div></div><SourceLink href="https://explorer.altana.network">Inspect all account keys in the permission explorer</SourceLink></>}{confirm && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><h2 id="confirm-title">{confirm.action === "revoke" ? "Revoke this permission?" : `${confirm.action[0].toUpperCase()}${confirm.action.slice(1)} this job?`}</h2><p>{confirm.action === "revoke" ? "The key will lose its onchain authority after confirmation. Funds already in escrow and completed actions are unaffected." : "This submits an onchain action for the selected job. Settlement releases escrow; disputes and refunds are subject to the job's current state and deadline. Network fees apply."}</p><p>{confirm.record.agentName} · {confirm.record.jobId ? `Job #${confirm.record.jobId}` : "Permission"}</p>{error && <ErrorNotice message={error} />}<button className="button primary full" disabled={!!busy} onClick={runAction}>{busy ? "Waiting for confirmation…" : "Confirm with passkey"}</button><button className="button full" disabled={!!busy} onClick={() => setConfirm(null)}>Cancel</button></section></div>}</div>;
}
