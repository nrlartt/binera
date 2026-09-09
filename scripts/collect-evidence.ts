import { readFile, stat, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { getErc8183Job, getErc8183DeliverableUrl } from "@altananetwork/sdk";
import { parseActivity } from "../src/lib/activity";
import { assertPaidDelivery, prepareEvidence } from "../src/lib/release-evidence";
import { publicClient, serverNetwork } from "../src/lib/server/chain";
import { remoteText } from "../src/lib/server/http";

// Read-only chain verification. Never signs, pays, settles or changes release.json.
try {
  const { values } = parseArgs({ options: { input: { type: "string" }, mapping: { type: "string" }, output: { type: "string" } } });
  if (!values.input || !values.mapping) throw new Error("Usage: npm run collect:evidence -- --input <activity.json> --mapping <job-categories.json> [--output <new-report.json>]");
  for (const path of [values.input, values.mapping]) if ((await stat(path)).size > 5_000_000) throw new Error("Input files must be smaller than 5 MB.");
  const records = parseActivity(JSON.parse((await readFile(values.input, "utf8")).replace(/^\uFEFF/, "")));
  if (!records.length) throw new Error("The export has no jobs. Export actual activity from My agents.");
  const mapping: unknown = JSON.parse((await readFile(values.mapping, "utf8")).replace(/^\uFEFF/, ""));
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) throw new Error("Mapping must be an object from job ID to category.");
  const categoryEvidence = []; const observations = [];
  for (const record of records) {
    const transactions = [];
    for (const [role, hash] of [["grant", record.grantTx], ["funding", record.fundingTx], ["revoke", record.revokeTx]] as const) {
      if (!hash) continue;
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: hash as `0x${string}` });
        transactions.push({ role, hash, status: receipt.status, block: receipt.blockNumber.toString(), gasUsed: receipt.gasUsed.toString(), effectiveGasPrice: receipt.effectiveGasPrice.toString(), notice: "Receipt gas is not necessarily the user's full relay charge. Transaction role comes from the export and requires semantic review." });
      } catch { transactions.push({ role, hash, status: "UNCONFIRMED" }); }
    }
    let detail = "No job ID in this record.";
    let verified = false;
    if (record.jobId) {
      try {
        const category = (mapping as Record<string, unknown>)[record.jobId];
        if (typeof category !== "string") throw new Error("Assign this job a reviewed category in the mapping file.");
        const draft = prepareEvidence(records, record.jobId, category);
        const job = await getErc8183Job(serverNetwork, BigInt(record.jobId));
        const url = await getErc8183DeliverableUrl(serverNetwork, BigInt(record.jobId));
        if (!url) throw new Error(`Job state ${job.statusName}; no delivery URL available.`);
        const manifest = await remoteText(url);
        assertPaidDelivery(job, draft, manifest);
        if (!transactions.some(t => t.role === "funding" && t.status === "success")) throw new Error("Funding receipt was not confirmed successful.");
        categoryEvidence.push({ ...draft, outputUrl: url });
        verified = true; detail = "Completed job identity, terms and delivery hash verified. Review output quality and receipt-to-job linkage before publishing.";
      } catch (error) { detail = error instanceof Error ? error.message : "Verification unavailable."; }
    }
    observations.push({ wallet: record.wallet, agentId: record.agentId, jobId: record.jobId ?? null, verified, detail, session: record.session, transactions });
  }
  const output = values.output || `submission/evidence/collected-${Date.now()}.json`;
  await writeFile(output, JSON.stringify({ observedAt: new Date().toISOString(), categoryEvidence, observations, notice: "Candidate evidence only. No seller-wallet ownership, paired advantage, semantic session proof or output-quality claim is inferred." }, null, 2) + "\n", { flag: "wx" });
  console.log(`Saved ${output}: ${categoryEvidence.length} verified delivered-job candidates from ${records.length} records.`);
  if (observations.some(item => !item.verified)) process.exitCode = 1;
} catch (error) { console.error(error instanceof Error ? error.message : "Evidence collection failed."); process.exitCode = 1; }
