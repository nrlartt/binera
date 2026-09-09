import { getAgent } from "@/lib/server/registry";
import { errorResponse } from "@/lib/server/http";
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try { return Response.json(await getAgent((await ctx.params).id)); } catch (e) { return errorResponse(e); }
}
