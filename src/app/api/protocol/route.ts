import { publicClient } from "@/lib/server/chain";
import { cached, errorResponse } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const slots = [
  { key: "stake", env: "BINERA_STAKE_ADDRESS", name: "Agent stake", purpose: "Locked agent stake; slashing only by the arbiter." },
  { key: "reputation", env: "BINERA_REPUTATION_ADDRESS", name: "Reputation", purpose: "Append-only outcome records and score." },
  { key: "arbitration", env: "BINERA_ARBITRATION_ADDRESS", name: "Arbitration", purpose: "Three-seat evaluator verdicts; no fund movement." },
  { key: "vault", env: "BINERA_BOUNTY_VAULT_ADDRESS", name: "Bounty vault", purpose: "Multi-slot reward escrow with creator approval." },
] as const;

const isAddress = (value: string | undefined): value is `0x${string}` => Boolean(value && /^0x[0-9a-f]{40}$/i.test(value));

export async function GET() {
  try {
    const data = await cached("protocol-status", async () => {
      const entries = await Promise.all(slots.map(async slot => {
        const address = process.env[slot.env];
        if (!isAddress(address)) return { key: slot.key, name: slot.name, purpose: slot.purpose, state: "not-configured" as const, address: null, codePresent: false };
        let codePresent = false;
        try {
          const code = await publicClient.getCode({ address });
          codePresent = Boolean(code && code !== "0x");
        } catch { codePresent = false; }
        return { key: slot.key, name: slot.name, purpose: slot.purpose, state: codePresent ? "live" as const : "address-without-code" as const, address, codePresent };
      }));
      return {
        chainId: 56,
        observedAt: new Date().toISOString(),
        contracts: entries,
        paymentToken: isAddress(process.env.BINERA_PAYMENT_TOKEN_ADDRESS) ? process.env.BINERA_PAYMENT_TOKEN_ADDRESS : null,
        note: "Status is read from operator configuration and BSC bytecode only. Contracts are not deployed by this application; an address without code is reported as such, never assumed live.",
        source: "docs/contracts.md",
      };
    }, 120000);
    return Response.json(data);
  } catch (error) { return errorResponse(error); }
}
