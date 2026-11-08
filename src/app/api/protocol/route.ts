import { readProtocolConfig, protocolCacheKey } from "@/lib/server/protocol-config";
import { protocolClient } from "@/lib/server/protocol-client";
import { cached, errorResponse } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const slots = [
  { key: "stake", name: "Agent stake", purpose: "Locked agent stake; slashing only by the arbiter." },
  { key: "reputation", name: "Reputation", purpose: "Append-only outcome records and score." },
  { key: "arbitration", name: "Arbitration", purpose: "Three-seat evaluator verdicts; no fund movement." },
  { key: "vault", name: "Bounty vault", purpose: "Multi-slot reward escrow with creator approval." },
] as const;

export async function GET() {
  try {
    const { config, source } = await readProtocolConfig();
    const data = await cached(protocolCacheKey(config), async () => {
      const entries = await Promise.all(slots.map(async slot => {
        const address = config?.addresses[slot.key] ?? null;
        if (!address) return { key: slot.key, name: slot.name, purpose: slot.purpose, state: "not-configured" as const, address: null, codePresent: false };
        let codePresent = false;
        try {
          const code = await protocolClient.getCode({ address });
          codePresent = Boolean(code && code !== "0x");
        } catch { codePresent = false; }
        return { key: slot.key, name: slot.name, purpose: slot.purpose, state: codePresent ? "live" as const : "address-without-code" as const, address, codePresent };
      }));
      return {
        chainId: await protocolClient.getChainId().catch(() => 56),
        observedAt: new Date().toISOString(),
        source,
        contracts: entries,
        paymentToken: config?.paymentToken ?? null,
        note: "Status is read from operator configuration (environment or the activated deployment file) and on-chain bytecode only. An address without bytecode is reported as such; this server does not deploy contracts.",
        sourceDoc: "docs/contracts.md",
      };
    }, 120_000);
    return Response.json(data);
  } catch (error) { return errorResponse(error); }
}
