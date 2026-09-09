import { z } from "zod";
import { negotiate } from "@/lib/server/studio";
import { errorResponse, PublicError, requestJson, sameOrigin } from "@/lib/server/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (Number(request.headers.get("content-length")) > 6000) throw new PublicError("Please shorten your request.", 413);
    const input = z.object({ id: z.string().max(500), task: z.string().min(12).max(1200) }).safeParse(await requestJson(request));
    if (!input.success) throw new PublicError("Describe the task in 12–1,200 characters.", 400);
    return Response.json(await negotiate(input.data.id, input.data.task));
  } catch (e) { return errorResponse(e); }
}
