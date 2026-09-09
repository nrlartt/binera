import { getErc8183Job, getErc8183DeliverableUrl, verifyErc8183ManifestText, erc8183Addresses } from "@altananetwork/sdk";
import { parseAbi } from "viem";
import { jobActions } from "@/lib/job-match";
import { z } from "zod";
import { publicClient, serverNetwork } from "@/lib/server/chain";
import { errorResponse, PublicError, remoteText, cached } from "@/lib/server/http";
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params; if (!/^\d{1,15}$/.test(id)) throw new PublicError("Invalid job reference.", 400);
    const [job, block, windowSeconds] = await Promise.all([
      getErc8183Job(serverNetwork, BigInt(id)), publicClient.getBlock(),
      publicClient.readContract({ address: erc8183Addresses(56).policy, abi: parseAbi(["function disputeWindow() view returns (uint64)"]), functionName: "disputeWindow" }),
    ]);
    const actions = jobActions(job, block.timestamp, BigInt(windowSeconds));
    const disputeDeadline = job.submittedAt > 0n ? (job.submittedAt + BigInt(windowSeconds)).toString() : null;
    let deliverable: string | null = null; let deliverableStatus = "Not submitted";
    if (job.submittedAt > 0n && new URL(request.url).searchParams.get("deliverable") === "true") {
      try {
        deliverable = await cached(`deliverable-${id}-${job.deliverable}`, async () => {
          const url = await getErc8183DeliverableUrl(serverNetwork, BigInt(id));
          if (!url) throw new Error("unavailable");
          const text = await remoteText(url);
          if (!verifyErc8183ManifestText(text, job.deliverable)) throw new Error("integrity");
          return z.object({ response: z.object({ content: z.string() }) }).parse(JSON.parse(text)).response.content;
        }, 300000);
        deliverableStatus = "Hash verified against the onchain commitment";
      } catch { deliverableStatus = "Unable to retrieve or verify this deliverable. Do not approve it yet."; }
    }
    return Response.json(JSON.parse(JSON.stringify({ ...job, actions, disputeDeadline, observedBlock: block.number.toString(), deliverableContent: deliverable, deliverableStatus, observedAt: new Date().toISOString() }, (_, v) => typeof v === "bigint" ? v.toString() : v)));
  } catch (e) { return errorResponse(e); }
}
