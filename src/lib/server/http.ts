import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";

export class PublicError extends Error { constructor(message: string, public status = 502) { super(message); } }
export function publicIPv4(ip: string): boolean {
  if (isIP(ip) !== 4) return false;
  const [a, b] = ip.split(".").map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0, 168].includes(b)) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && [18, 19, 51].includes(b)) || (a === 203 && b === 0));
}
// Resolve once and pin the checked address into the TLS connection. No redirects,
// credentials or cookies are forwarded to provider-controlled endpoints.
export async function remoteText(url: string, options: { body?: unknown; headers?: Record<string, string>; timeout?: number } = {}): Promise<string> {
  const u = new URL(url);
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) throw new PublicError("The provider published an unsupported endpoint.");
  const records = await Promise.race([lookup(u.hostname, { all: true, family: 4 }), new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(new PublicError("Provider DNS timed out.")), 5000); timer.unref(); })]);
  if (!records.length || records.some(r => !publicIPv4(r.address))) throw new PublicError("This provider endpoint is not publicly accessible.");
  return new Promise((resolve, reject) => {
    const body = options.body === undefined ? undefined : JSON.stringify(options.body);
    const req = request(u, { method: body ? "POST" : "GET", headers: { Accept: "application/json", "User-Agent": "AgentMarket/1.0", ...options.headers, ...(body ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body).toString() } : {}) },
      family: 4,
      lookup: (_hostname, _options, callback) => callback(null, records[0].address, 4),
    }, res => {
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) { res.resume(); reject(new PublicError(res.statusCode === 429 ? "The data source is busy. Please try again shortly." : "The provider is unavailable. Please try again later.")); return; }
      const chunks: Buffer[] = []; let size = 0;
      res.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 2_000_000) { req.destroy(new PublicError("The provider response is too large.")); return; } chunks.push(chunk); });
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    });
    const timer = setTimeout(() => req.destroy(new PublicError("The provider took too long to respond.")), options.timeout ?? 12000);
    req.on("close", () => clearTimeout(timer)); req.on("error", reject);
    if (body) req.write(body); req.end();
  });
}
export async function remoteJson(url: string, options?: Parameters<typeof remoteText>[1]): Promise<unknown> {
  try { return JSON.parse(await remoteText(url, options)); } catch (e) { if (e instanceof PublicError) throw e; throw new PublicError("The provider returned an unreadable response."); }
}
const cache = new Map<string, { expires: number; promise: Promise<unknown> }>();
export function cached<T>(key: string, fetcher: () => Promise<T>, ttl = 60000): Promise<T> {
  const hit = cache.get(key); if (hit && hit.expires > Date.now()) return hit.promise as Promise<T>;
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  const promise = fetcher().catch(e => { cache.delete(key); throw e; });
  cache.set(key, { expires: Date.now() + ttl, promise }); return promise;
}
export function errorResponse(error: unknown) {
  return Response.json({ error: error instanceof PublicError ? error.message : "This request could not be completed. Please try again." }, { status: error instanceof PublicError ? error.status : 500 });
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new PublicError("Please submit this request from the marketplace.", 403);
}
export async function requestJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader(); if (!reader) throw new PublicError("A request body is required.", 400);
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const item = await reader.read(); if (item.done) break; size += item.value.length; if (size > 8192) { await reader.cancel(); throw new PublicError("Please shorten your request.", 413); } chunks.push(item.value); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new PublicError("The request could not be read.", 400); }
}
