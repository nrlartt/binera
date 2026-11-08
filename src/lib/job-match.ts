type JobIdentity = { client: string; provider: string; description: string; budget: string };
type ExpectedJob = { wallet: string; provider?: string; quote: string; price: string };

export function matchesJob(job: JobIdentity, expected: ExpectedJob): boolean {
  return job.client.toLowerCase() === expected.wallet.toLowerCase()
    && (!expected.provider || job.provider.toLowerCase() === expected.provider.toLowerCase())
    && job.description === expected.quote && job.budget === expected.price;
}

export function jobActions(job: { statusName: string; submittedAt: bigint; expiredAt: bigint }, chainTime: bigint, disputeWindow: bigint) {
  const submitted = job.statusName === "SUBMITTED" && job.submittedAt > 0n;
  const deadline = job.submittedAt + disputeWindow;
  return { approve: submitted && chainTime >= deadline, dispute: submitted && chainTime < deadline, refund: ["OPEN", "FUNDED", "EXPIRED"].includes(job.statusName) && chainTime > job.expiredAt };
}

/** Single source of truth for the dashboard's "next step" copy. */
export function nextJobStep(
  job: { statusName: string; submittedAt: bigint; expiredAt: bigint } | null,
  chainTime: bigint,
  disputeWindow: bigint,
  hasVerifiedDeliverable: boolean,
): string {
  if (!job) return "Check payment submission or refresh chain status before paying again.";
  const actions = jobActions(job, chainTime, disputeWindow);
  if (actions.refund) return "The refund window is open. Review the job and claim its refund.";
  if (job.statusName === "SUBMITTED") {
    if (!hasVerifiedDeliverable) return "Delivery was submitted; its content is not verified yet. Refresh and inspect the evidence.";
    return actions.approve
      ? "The dispute window has closed. Review the verified output and settle the job."
      : "Review the verified output and decide before the dispute window closes.";
  }
  if (job.statusName === "FUNDED") return "Request delivery and monitor the job deadline.";
  if (job.statusName === "COMPLETED") return "The job is completed. Review its output and remove any remaining permission.";
  return "Inspect the current onchain state before taking another action.";
}
