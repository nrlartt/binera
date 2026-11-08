"use client";
import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { estimatedChainTime, jobWindows, windowStatusLabel } from "@/lib/job-windows";

type JobView = { statusName: string; submittedAt: string; expiredAt: string; disputeDeadline: string | null; chainTimestamp: string; observedAt: string };

function safeBigInt(value: string | null | undefined): bigint {
  if (!value || !/^\d{1,30}$/.test(value)) return 0n;
  return BigInt(value);
}

export function JobWindows({ job }: { job: JobView }) {
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    const first = setTimeout(() => setNowMs(Date.now()), 0);
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, []);
  if (!nowMs) return null;
  const submittedAt = safeBigInt(job.submittedAt);
  const expiredAt = safeBigInt(job.expiredAt);
  const disputeDeadline = safeBigInt(job.disputeDeadline);
  const disputeWindow = submittedAt > 0n && disputeDeadline > submittedAt ? disputeDeadline - submittedAt : 0n;
  const observedChain = safeBigInt(job.chainTimestamp);
  const chainNow = observedChain > 0n ? estimatedChainTime(observedChain, job.observedAt, nowMs) : BigInt(Math.floor(nowMs / 1000));
  const windows = jobWindows({ statusName: job.statusName, submittedAt, expiredAt, disputeWindow }, chainNow);
  const active = windows.filter(w => w.state !== "not-applicable");
  if (!active.length) return null;
  return <div className="job-windows" aria-label="Onchain job deadlines">
    {active.map(w => <span key={w.id} className={`window-chip ${w.state}`}>
      <Clock3 size={12} />
      <span>{w.label}: <strong>{windowStatusLabel(w)}</strong></span>
    </span>)}
    <small>Countdowns are anchored to the observed block time and this device&apos;s elapsed time. Refresh before acting; the contract deadline is authoritative.</small>
  </div>;
}
