import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { getErc8183Job } from "@altananetwork/sdk";
import { serverNetwork, publicClient } from "../src/lib/server/chain";
import { remoteJson, remoteText } from "../src/lib/server/http";
import { matchesJob } from "../src/lib/job-match";

const evidenceSchema = z.object({ category: z.enum(["rebalancing", "grid", "yield", "health"]), jobId: z.string().regex(/^\d{1,15}$/), wallet: z.string().regex(/^0x[0-9a-f]{40}$/i), provider: z.string().regex(/^0x[0-9a-f]{40}$/i), quote: z.string().min(1), price: z.string().regex(/^\d{1,78}$/), fundingTx: z.string().regex(/^0x[0-9a-f]{64}$/i), outputUrl: z.url() });
const manifestSchema = z.object({ publicUrl: z.string(), repositoryUrl: z.string(), videoUrl: z.string(), tracks: z.array(z.enum(["main", "altana", "termix", "pancake"])), categoryEvidence: z.array(evidenceSchema), sessionEvidence: z.array(z.object({ wallet: z.string(), grantTx: z.string(), executionTx: z.string(), revokeTx: z.string(), explanationUrl: z.url() })), advantageReportUrl: z.string(), pancakeEvidenceUrl: z.string(), reviewedBy: z.string() });
const checks: { name: string; passed: boolean; detail: string }[] = [];
async function check(name: string, fn: () => Promise<string>) {
  try { checks.push({ name, passed: true, detail: await fn() }); } catch (e) { checks.push({ name, passed: false, detail: e instanceof Error ? e.message : "Unavailable" }); }
}
function https(value: string) { const url = new URL(value); if (url.protocol !== "https:" || url.username || url.password) throw new Error("A public HTTPS URL is required."); return url; }
try {
  const m = manifestSchema.parse(JSON.parse(await readFile("submission/release.json", "utf8")));
  await check("Public application", async () => { const u = https(m.publicUrl); const health = z.object({ status: z.literal("ok") }).parse(await remoteJson(new URL("/api/health", u).href)); await remoteText(u.href); return `Public application and dependencies: ${health.status}`; });
  await check("Repository", async () => {
    https(m.repositoryUrl);
    try { await remoteText(m.repositoryUrl); }
    catch { throw new Error("Anonymous repository access could not be verified. A private repository needs explicit reviewer access or a later visibility change; a network error can also fail this check."); }
    return "Repository URL responds publicly; review source/version separately.";
  });
  for (const category of ["rebalancing", "grid", "yield", "health"]) await check(`${category} paid delivery`, async () => {
    const e = m.categoryEvidence.find(e => e.category === category); if (!e) throw new Error("Completed job evidence is missing.");
    const job = await getErc8183Job(serverNetwork, BigInt(e.jobId));
    if (!matchesJob({ ...job, budget: job.budget.toString() }, e) || job.statusName !== "COMPLETED" || job.submittedAt === 0n) throw new Error("Onchain job does not match a completed, delivered task.");
    const receipt = await publicClient.getTransactionReceipt({ hash: e.fundingTx as `0x${string}` });
    if (receipt.status !== "success") throw new Error("The supplied funding receipt is not successful.");
    https(e.outputUrl); await remoteText(e.outputUrl);
    return `Completed job ${e.jobId} and successful receipt checked. Reviewer must verify the receipt belongs to this job and the output proves the claimed category service.`;
  });
  if (m.tracks.includes("altana")) await check("Altana session evidence", async () => {
    if (!m.sessionEvidence.length) throw new Error("Grant, scoped execution and revoke evidence is missing.");
    for (const e of m.sessionEvidence) { for (const hash of [e.grantTx, e.executionTx, e.revokeTx]) { if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error("Invalid receipt hash."); const receipt = await publicClient.getTransactionReceipt({ hash: hash as `0x${string}` }); if (receipt.status !== "success") throw new Error("Session receipt failed."); } https(e.explanationUrl); await remoteText(e.explanationUrl); }
    return "Mainnet receipts exist. A reviewer must confirm agent ownership, scopes and receipt semantics. For testnet evidence use a separately documented verification; this checker targets BSC mainnet.";
  });
  if (m.tracks.includes("termix")) await check("Agent Advantage Report", async () => { https(m.advantageReportUrl); await remoteText(m.advantageReportUrl); return "Report accessible; reviewer must verify three paired experiments, outputs and measurements."; });
  if (m.tracks.includes("pancake")) await check("PancakeSwap benefit", async () => { https(m.pancakeEvidenceUrl); await remoteText(m.pancakeEvidenceUrl); return "Evidence accessible; reviewer must assess the demonstrated benefit."; });
  await check("Human evidence review", async () => { if (!m.reviewedBy.trim()) throw new Error("No reviewer recorded. Automated checks do not evaluate output quality or prove session semantics."); return "Reviewer recorded; this is an attestation, not an independent audit."; });
} catch (e) { checks.push({ name: "Evidence manifest", passed: false, detail: e instanceof z.ZodError ? "submission/release.json does not match the required schema." : String(e) }); }
const report = { checkedAt: new Date().toISOString(), automatedChecksPass: checks.length > 0 && checks.every(c => c.passed), notice: "This checklist is not an organizer eligibility decision or a security audit. Inspect service quality, receipt-to-job links, key scopes and manual review evidence.", checks };
await writeFile("submission/evidence/release-check.json", JSON.stringify(report, null, 2) + "\n");
for (const c of checks) console.log(`${c.passed ? "PASS" : "BLOCKED"} ${c.name}: ${c.detail}`);
if (!report.automatedChecksPass) process.exitCode = 1;
