import { termixSecurity } from "@/lib/server/termix";
import { errorResponse } from "@/lib/server/http";
export async function GET(request: Request) { try { return Response.json(await termixSecurity(new URL(request.url).searchParams.get("token") ?? "")); } catch (e) { return errorResponse(e); } }
