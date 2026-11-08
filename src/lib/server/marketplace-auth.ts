import { verifyMessage, type Address, type Hex } from "viem";
import { z } from "zod";
import { envelopeSchema, marketplaceMessage, payloadSchemas, type MarketplaceAction } from "../marketplace";
import { PublicError, requestJson } from "./http";

const MAX_SKEW_MS = 5 * 60 * 1000;

export async function verifySignedWrite(request: Request, action: MarketplaceAction) {
  let raw: unknown;
  try { raw = await requestJson(request); } catch (error) { throw error; }
  let envelope;
  try { envelope = envelopeSchema.parse(raw); } catch { throw new PublicError("This signed request is not in the supported format.", 400); }
  if (envelope.action !== action) throw new PublicError("The signed action does not match this endpoint.", 400);
  const issuedAt = Date.parse(envelope.issuedAt);
  if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > MAX_SKEW_MS) throw new PublicError("This signature is stale. Sign a new request.", 400);
  let payload: unknown;
  try { payload = payloadSchemas[action].parse(envelope.payload); } catch (error) {
    const issue = error instanceof z.ZodError ? error.issues[0] : null;
    throw new PublicError(issue ? `Check the ${issue.path.join(".") || "request"}: ${issue.message}` : "Check the submitted fields.", 400);
  }
  const message = marketplaceMessage(action, envelope.address, envelope.nonce, envelope.issuedAt, payload);
  let valid = false;
  try { valid = await verifyMessage({ address: envelope.address as Address, message, signature: envelope.signature as Hex }); } catch { valid = false; }
  if (!valid) throw new PublicError("The wallet signature does not match this request.", 401);
  return { envelope, payload };
}

const buckets = new Map<string, number[]>();
export function rateLimit(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter(at => now - at < windowMs);
  if (hits.length >= limit) return false;
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) buckets.delete(buckets.keys().next().value!);
  return true;
}

export function clientKey(request: Request, scope: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = request.headers.get("x-real-ip") ?? forwarded ?? "local";
  return `${scope}:${address.slice(0, 64)}`;
}
