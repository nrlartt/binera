import { NextRequest, NextResponse } from "next/server";
const windows = new Map<string, { count: number; until: number }>();
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const costly = path === "/api/quote" || path === "/api/research/context" || path.endsWith("/notify") || (path === "/api/discover" && request.nextUrl.searchParams.has("q") && !!request.nextUrl.searchParams.get("q"));
  const key = costly ? "limited-external-actions" : "reads"; const limit = costly ? 40 : 300; const now = Date.now();
  const bucket = windows.get(key); const state = bucket && bucket.until > now ? bucket : { count: 0, until: now + 60000 };
  state.count++; windows.set(key, state);
  if (state.count > limit) return NextResponse.json({ error: "The marketplace is receiving many requests. Please try again in a minute." }, { status: 429, headers: { "Retry-After": "60" } });
  if (Number(request.headers.get("content-length")) > 8192) return NextResponse.json({ error: "This request is too large." }, { status: 413 });
  return NextResponse.next();
}
export const config = { matcher: "/api/:path*" };
