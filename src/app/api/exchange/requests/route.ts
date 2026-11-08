import { marketplaceStore } from "@/lib/server/marketplace-store";
import { clientKey, rateLimit, verifySignedWrite } from "@/lib/server/marketplace-auth";
import { errorResponse, PublicError, sameOrigin } from "@/lib/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (!rateLimit(clientKey(request, "request"), 10)) throw new PublicError("Too many marketplace writes. Wait a minute and retry.", 429);
    const { envelope, payload } = await verifySignedWrite(request, "request.create");
    return Response.json(await marketplaceStore.createRequest(envelope.address.toLowerCase(), payload, envelope.nonce), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
