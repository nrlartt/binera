import { timingSafeEqual, createHash } from "node:crypto";
import { z } from "zod";
import { writeProtocolConfig } from "@/lib/server/protocol-config";
import { clientKey, rateLimit } from "@/lib/server/marketplace-auth";
import { errorResponse, PublicError, requestJson, sameOrigin } from "@/lib/server/http";
export const runtime = "nodejs";

const body = z.object({
  addresses: z.object({ stake: z.string(), reputation: z.string(), arbitration: z.string(), vault: z.string() }),
  paymentToken: z.string(),
});

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const expected = process.env.OPERATOR_TOKEN;
    if (!expected || expected.length < 16) throw new PublicError("Server activation is not enabled. Set OPERATOR_TOKEN on the server or use the environment block.", 404);
    if (!rateLimit(clientKey(request, "protocol-configure"), 5, 60_000)) throw new PublicError("Too many activation attempts. Wait a minute.", 429);
    const provided = request.headers.get("x-operator-token") ?? "";
    const digest = (value: string) => createHash("sha256").update(value).digest();
    if (!timingSafeEqual(digest(provided), digest(expected))) throw new PublicError("The operator token is not valid.", 401);
    const config = await writeProtocolConfig(body.parse(await requestJson(request)));
    return Response.json({ configured: true, addresses: config.addresses, paymentToken: config.paymentToken, note: "Activated for this deployment. Protocol status is re-read from bytecode on BSC." });
  } catch (error) { return errorResponse(error); }
}
