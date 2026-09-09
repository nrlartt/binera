import { z } from "zod";
import { BNB } from "@altananetwork/sdk";
import { cached, remoteJson, PublicError, errorResponse } from "@/lib/server/http";
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params; if (!/^0x[0-9a-f]{2,512}$/i.test(id)) throw new PublicError("Invalid relay reference.", 400);
    return Response.json(await cached(`relay-${id}`, async () => {
      const data = z.object({ result: z.object({ status: z.union([z.number(), z.string()]), receipts: z.array(z.object({ transactionHash: z.string().regex(/^0x[0-9a-f]{64}$/i) })).optional() }).optional() }).parse(await remoteJson(BNB.relayUrl!, { body: { jsonrpc: "2.0", id: 1, method: "wallet_getCallsStatus", params: [id] } }));
      if (!data.result) throw new PublicError("The relay has not returned a status for this reference.");
      const code = Number(data.result.status);
      const status = data.result.status === "CONFIRMED" || (code >= 200 && code < 300) ? "confirmed" : data.result.status === "FAILED" || (code >= 300 && code < 700) ? "failed" : "pending";
      return { status, transactionHash: data.result.receipts?.[0]?.transactionHash ?? null, observedAt: new Date().toISOString() };
    }, 5000));
  } catch (e) { return errorResponse(e); }
}
