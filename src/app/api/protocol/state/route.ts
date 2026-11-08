import { z } from "zod";
import { erc20Abi, isAddress, type Abi } from "viem";
import { contractArtifacts } from "@/lib/contracts/artifacts";
import { readProtocolConfig } from "@/lib/server/protocol-config";
import { protocolClient } from "@/lib/server/protocol-client";
import { cached, errorResponse, PublicError } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const addressSchema = z.string().refine(value => isAddress(value), "Invalid address.").transform(value => value as `0x${string}`);
const abi = {
  stake: contractArtifacts.BineraStake.abi as Abi,
  reputation: contractArtifacts.BineraReputation.abi as Abi,
  arbitration: contractArtifacts.BineraArbitration.abi as Abi,
  vault: contractArtifacts.BineraBountyVault.abi as Abi,
};

async function attempt<T>(work: () => Promise<T>): Promise<T | null> {
  try { return await work(); } catch { return null; }
}

function big(value: unknown): string { return typeof value === "bigint" ? value.toString() : String(value ?? ""); }

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const { config, source } = await readProtocolConfig();
    if (!config) return Response.json({ configured: false, observedAt: new Date().toISOString(), message: "Protocol contracts are not configured for this deployment." });
    let account: `0x${string}` | null = null;
    if (params.get("account")) {
      try { account = addressSchema.parse(params.get("account")); } catch { throw new PublicError("Enter a valid account address.", 400); }
    }
    const caseId = params.get("caseId") ? BigInt(params.get("caseId")!.replace(/\D/g, "").slice(0, 20) || "0") : null;
    const bountyId = params.get("bountyId") ? BigInt(params.get("bountyId")!.replace(/\D/g, "").slice(0, 20) || "0") : null;
    const key = `protocol-state-${config.addresses.stake}-${config.addresses.reputation}-${config.addresses.arbitration}-${config.addresses.vault}-${account ?? "none"}-${caseId ?? "none"}-${bountyId ?? "none"}`.toLowerCase();

    const state = await cached(key, async () => {
      const [tokenSymbol, tokenDecimals, totalStaked, position, reputation, score, caseCount, bountyCount] = await Promise.all([
        attempt(() => protocolClient.readContract({ address: config.paymentToken, abi: erc20Abi, functionName: "symbol" })),
        attempt(() => protocolClient.readContract({ address: config.paymentToken, abi: erc20Abi, functionName: "decimals" })),
        attempt(() => protocolClient.readContract({ address: config.addresses.stake, abi: abi.stake, functionName: "totalStaked" })),
        account ? attempt(() => protocolClient.readContract({ address: config.addresses.stake, abi: abi.stake, functionName: "positions", args: [account] })) : Promise.resolve(null),
        account ? attempt(() => protocolClient.readContract({ address: config.addresses.reputation, abi: abi.reputation, functionName: "stats", args: [account] })) : Promise.resolve(null),
        account ? attempt(() => protocolClient.readContract({ address: config.addresses.reputation, abi: abi.reputation, functionName: "scoreOf", args: [account] })) : Promise.resolve(null),
        attempt(() => protocolClient.readContract({ address: config.addresses.arbitration, abi: abi.arbitration, functionName: "caseCount" })),
        attempt(() => protocolClient.readContract({ address: config.addresses.vault, abi: abi.vault, functionName: "bountyCount" })),
      ]);

      const totalCases = Number(caseCount ?? 0n);
      const requestedCase = caseId !== null ? Number(caseId) : totalCases;
      const caseIds = requestedCase > 0 ? [requestedCase] : [];
      if (caseId === null && totalCases > 0) for (let index = Math.max(1, totalCases - 4); index < totalCases; index++) if (!caseIds.includes(index)) caseIds.push(index);
      const cases = (await Promise.all(caseIds.map(async id => {
        const data = await attempt(() => protocolClient.readContract({ address: config.addresses.arbitration, abi: abi.arbitration, functionName: "getCase", args: [BigInt(id)] }));
        if (!data) return null;
        const tuple = data as unknown as readonly [string, string, number, bigint, bigint, bigint, bigint, bigint, boolean, boolean, readonly string[]];
        return {
          id: String(id), buyer: tuple[0], provider: tuple[1], phase: Number(tuple[2]),
          evidenceDeadline: big(tuple[3]), voteDeadline: big(tuple[4]),
          votesForProvider: Number(tuple[5]), votesForBuyer: Number(tuple[6]), votesCast: Number(tuple[7]),
          providerUpheld: tuple[8], finalVerdict: tuple[9], evaluators: tuple[10],
        };
      }))).filter(Boolean);

      const totalBounties = Number(bountyCount ?? 0n);
      const requestedBounty = bountyId !== null ? Number(bountyId) : totalBounties;
      const bountyIds = requestedBounty > 0 ? [requestedBounty] : [];
      if (bountyId === null && totalBounties > 0) for (let index = Math.max(1, totalBounties - 4); index < totalBounties; index++) if (!bountyIds.includes(index)) bountyIds.push(index);
      const bounties = (await Promise.all(bountyIds.map(async id => {
        const data = await attempt(() => protocolClient.readContract({ address: config.addresses.vault, abi: abi.vault, functionName: "bounties", args: [BigInt(id)] }));
        if (!data) return null;
        const tuple = data as unknown as readonly [string, bigint, number, number, bigint, boolean];
        const slotCount = Number(tuple[2]);
        const slotIndexes = bountyId !== null ? Array.from({ length: Math.min(slotCount, 20) }, (_, index) => index) : [];
        const slots = (await Promise.all(slotIndexes.map(async index => {
          const slot = await attempt(() => protocolClient.readContract({ address: config.addresses.vault, abi: abi.vault, functionName: "slots", args: [BigInt(id), index] }));
          if (!slot) return null;
          const tupleSlot = slot as unknown as readonly [string, string, number];
          return { index, provider: tupleSlot[0], proof: tupleSlot[1], status: Number(tupleSlot[2]) };
        }))).filter(Boolean);
        return { id: String(id), creator: tuple[0], rewardPerSlot: big(tuple[1]), slots: slotCount, approvedSlots: Number(tuple[3]), deadline: big(tuple[4]), cancelled: tuple[5], slotDetail: slots };
      }))).filter(Boolean);

      return {
        configured: true,
        source,
        chainId: await protocolClient.getChainId().catch(() => 56),
        addresses: config.addresses,
        paymentToken: config.paymentToken,
        token: tokenSymbol ? { symbol: String(tokenSymbol), decimals: Number(tokenDecimals ?? 18) } : null,
        stake: { totalStaked: totalStaked === null ? null : big(totalStaked), position: position ? { amount: big((position as readonly [bigint, bigint])[0]), unlockAt: big((position as readonly [bigint, bigint])[1]) } : null },
        reputation: reputation ? { score: score === null ? null : Number(score), jobs: Number((reputation as readonly [bigint, bigint, bigint, number, bigint])[0]), won: Number((reputation as readonly [bigint, bigint, bigint, number, bigint])[1]), lost: Number((reputation as readonly [bigint, bigint, bigint, number, bigint])[2]), updatedAt: big((reputation as readonly [bigint, bigint, bigint, number, bigint])[4]) } : null,
        arbitration: { caseCount: totalCases, cases },
        bounty: { bountyCount: totalBounties, bounties },
        observedAt: new Date().toISOString(),
      };
    }, 10_000);
    return Response.json(state);
  } catch (error) { return errorResponse(error); }
}
