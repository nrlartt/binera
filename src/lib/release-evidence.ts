import { z } from "zod";
import { verifyErc8183ManifestText, type Erc8183Job } from "@altananetwork/sdk";
import { parseActivity } from "./activity";
import { matchesJob } from "./job-match";

export const evidenceCategory = z.enum(["rebalancing", "grid", "yield", "health"]);

export function prepareEvidence(input: unknown, jobId: string, category: string) {
  const selectedCategory = evidenceCategory.parse(category);
  if (!/^\d{1,15}$/.test(jobId)) throw new Error("Use the exact numeric job ID from My agents.");
  const records = parseActivity(input).filter(record => record.jobId === jobId);
  if (records.length !== 1) throw new Error("The export must contain exactly one reference for this job. Resolve missing or duplicate records first.");
  const record = records[0];
  if (!record.provider || !record.fundingTx || !record.quote.trim()) throw new Error("Provider, funding transaction and signed terms are required. Reconcile payment in My agents and export again.");
  return {
    category: selectedCategory, jobId, wallet: record.wallet, provider: record.provider,
    quote: record.quote, price: record.price, fundingTx: record.fundingTx, outputUrl: "",
  };
}

export function assertPaidDelivery(job: Erc8183Job, evidence: { jobId: string; wallet: string; provider: string; quote: string; price: string }, manifestText: string) {
  if (job.id.toString() !== evidence.jobId || !matchesJob({ ...job, budget: job.budget.toString() }, evidence) || job.statusName !== "COMPLETED" || job.submittedAt === 0n) {
    throw new Error("Onchain job does not match a completed, delivered task.");
  }
  if (!verifyErc8183ManifestText(manifestText, job.deliverable)) throw new Error("Output bytes do not match the onchain deliverable hash. Supply the original manifest URL or an exact copy.");
  z.object({ response: z.object({ content: z.string().trim().min(1) }) }).parse(JSON.parse(manifestText));
}
