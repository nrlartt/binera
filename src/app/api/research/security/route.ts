import { tokenSecurity } from "@/lib/server/token-security";
import { errorResponse } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) { try { return Response.json(await tokenSecurity(new URL(request.url).searchParams.get("token") ?? "")); } catch (e) { return errorResponse(e); } }
