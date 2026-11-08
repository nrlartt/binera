import { marketplaceStore } from "@/lib/server/marketplace-store";
import { clientKey, rateLimit, verifySignedWrite } from "@/lib/server/marketplace-auth";
import { errorResponse, PublicError, sameOrigin } from "@/lib/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (!rateLimit(clientKey(request, "offer-withdraw"), 20)) throw new PublicError("Too many marketplace writes. Wait a minute and retry.", 429);
    const { envelope, payload } = await verifySignedWrite(request, "offer.withdraw");
    return Response.json(await marketplaceStore.withdrawOffer(envelope.address.toLowerCase(), payload, envelope.nonce));
  } catch (error) { return errorResponse(error); }
}
