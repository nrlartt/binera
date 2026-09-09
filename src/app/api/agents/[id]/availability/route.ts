import { activationReadiness } from "@/lib/server/studio";
import { errorResponse, PublicError } from "@/lib/server/http";
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!/^scan-56-\d{1,20}$/.test(id)) throw new PublicError("Use a registered BSC identity for activation.", 400);
    return Response.json(await activationReadiness(id));
  } catch (e) { return errorResponse(e); }
}
