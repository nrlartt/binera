import { z } from "zod";
import { notifyFunded } from "@/lib/server/studio";
import { errorResponse, PublicError, requestJson, sameOrigin } from "@/lib/server/http";
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request); const { id } = await ctx.params;
    if (!/^\d{1,15}$/.test(id)) throw new PublicError("Invalid job reference.", 400);
    const body = z.object({ agentId: z.string().max(500) }).parse(await requestJson(request));
    return Response.json(await notifyFunded(body.agentId, id));
  } catch (e) { return errorResponse(e); }
}
