/**
 * Deadline math for a funded research job. Pure and chain-time driven so the
 * UI never has to guess which action is currently allowed.
 */
export type JobWindowState = "open" | "closed" | "done" | "not-applicable";
export type JobWindow = { id: "delivery" | "dispute"; label: string; endsAt: number | null; secondsLeft: number | null; state: JobWindowState };
export type JobWindowInput = { statusName: string; submittedAt: bigint; expiredAt: bigint; disputeWindow: bigint };

export function formatDuration(seconds: number): string {  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  const whole = Math.floor(seconds);
  const days = Math.floor(whole / 86400);
  const hours = Math.floor((whole % 86400) / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = whole % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${rest}s`;
  return `${rest}s`;
}

export function estimatedChainTime(chainTimestamp: bigint, observedAt: string, nowMs = Date.now()): bigint {
  const observed = Date.parse(observedAt);
  if (!Number.isFinite(observed)) return chainTimestamp;
  const elapsed = Math.max(0, Math.floor((nowMs - observed) / 1000));
  return chainTimestamp + BigInt(elapsed);
}

export function jobWindows(job: JobWindowInput, chainTime: bigint): JobWindow[] {
  const submitted = job.submittedAt > 0n;
  const deliveryEnds = job.expiredAt > 0n ? job.expiredAt : null;
  const delivery: JobWindow = submitted
    ? { id: "delivery", label: "Delivery submitted", endsAt: deliveryEnds === null ? null : Number(deliveryEnds) * 1000, secondsLeft: null, state: "done" }
    : deliveryEnds === null
      ? { id: "delivery", label: "Delivery deadline", endsAt: null, secondsLeft: null, state: "not-applicable" }
      : {
          id: "delivery",
          label: "Delivery deadline",
          endsAt: Number(deliveryEnds) * 1000,
          secondsLeft: Number(deliveryEnds - chainTime),
          state: chainTime < deliveryEnds ? "open" : "closed",
        };

  const disputeEnds = submitted && job.disputeWindow > 0n ? job.submittedAt + job.disputeWindow : null;
  const dispute: JobWindow = disputeEnds === null
    ? { id: "dispute", label: "Dispute window", endsAt: null, secondsLeft: null, state: "not-applicable" }
    : {
        id: "dispute",
        label: "Dispute window",
        endsAt: Number(disputeEnds) * 1000,
        secondsLeft: Number(disputeEnds - chainTime),
        state: chainTime < disputeEnds ? "open" : "closed",
      };

  return [delivery, dispute];
}

export function windowStatusLabel(window: JobWindow): string {
  if (window.state === "done") return "Submitted";
  if (window.state === "not-applicable") return "Not opened yet";
  if (window.state === "closed") return "Closed";
  return window.secondsLeft === null ? "Open" : `${formatDuration(window.secondsLeft)} left`;
}
