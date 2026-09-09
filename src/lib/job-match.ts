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
