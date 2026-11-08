import { marketplaceStore } from "@/lib/server/marketplace-store";
import { marketplaceCategories, type MarketplaceCategory } from "@/lib/marketplace";
import { errorResponse } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const rawCategory = params.get("category");
    const category = marketplaceCategories.includes(rawCategory as MarketplaceCategory) ? rawCategory as MarketplaceCategory : undefined;
    const requestId = params.get("requestId")?.slice(0, 64);
    return Response.json(await marketplaceStore.snapshot({ category, requestId }));
  } catch (error) { return errorResponse(error); }
}
