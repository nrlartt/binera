import { pancakeSnapshot } from "@/lib/server/chain";
import { errorResponse } from "@/lib/server/http";
export async function GET() { try { return Response.json(await pancakeSnapshot()); } catch (e) { return errorResponse(e); } }
