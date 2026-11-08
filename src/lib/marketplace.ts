/**
 * Shared marketplace schemas. Used by the browser, the API routes and tests.
 * Prices are integer strings in the payment token's base units; nothing here
 * interprets them as a currency amount for the user.
 */
import { z } from "zod";
import { canonicalJson } from "./canonical";

export const marketplaceCategories = ["rebalancing", "grid", "yield", "health"] as const;
export type MarketplaceCategory = typeof marketplaceCategories[number];
export const marketplaceActions = ["listing.create", "listing.close", "request.create", "request.close", "offer.create", "offer.withdraw", "offer.accept"] as const;
export type MarketplaceAction = typeof marketplaceActions[number];

const address = z.string().regex(/^0x[0-9a-f]{40}$/i);
const price = z.string().regex(/^\d{1,78}$/).refine(value => { try { return BigInt(value) > 0n; } catch { return false; } }, "Price must be positive.");
const category = z.enum(marketplaceCategories);
const registryId = z.string().regex(/^scan-56-\d{1,20}$/);

export const listingPayloadSchema = z.object({
  name: z.string().trim().min(3).max(80),
  category,
  summary: z.string().trim().min(20).max(600),
  price,
  currency: address,
  deliveryHours: z.number().int().min(1).max(720),
  registryId: registryId.optional(),
  endpoint: z.url().refine(value => value.startsWith("https://"), "Only HTTPS endpoints are accepted.").optional(),
});

export const requestPayloadSchema = z.object({
  title: z.string().trim().min(5).max(90),
  category,
  description: z.string().trim().min(20).max(900),
  budget: price,
  deadline: z.iso.datetime(),
  slots: z.number().int().min(1).max(20).optional(),
  registryId: registryId.optional(),
});

export const offerPayloadSchema = z.object({
  requestId: z.uuid(),
  price,
  deliveryHours: z.number().int().min(1).max(720),
  terms: z.string().trim().min(10).max(500),
});

export const acceptPayloadSchema = z.object({ offerId: z.uuid() });
export const requestClosePayloadSchema = z.object({ requestId: z.uuid() });
export const listingClosePayloadSchema = z.object({ listingId: z.uuid() });
export const offerWithdrawPayloadSchema = z.object({ offerId: z.uuid() });

export const payloadSchemas = {
  "listing.create": listingPayloadSchema,
  "listing.close": listingClosePayloadSchema,
  "request.create": requestPayloadSchema,
  "request.close": requestClosePayloadSchema,
  "offer.create": offerPayloadSchema,
  "offer.withdraw": offerWithdrawPayloadSchema,
  "offer.accept": acceptPayloadSchema,
} as const;

export const envelopeSchema = z.object({
  action: z.enum(marketplaceActions),
  address,
  nonce: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  issuedAt: z.iso.datetime(),
  payload: z.unknown(),
  signature: z.string().regex(/^0x[0-9a-f]{130}$/i),
});

export type MarketplaceEnvelope = z.infer<typeof envelopeSchema>;

/** The exact text a wallet signs for a marketplace write. */
export function marketplaceMessage(action: MarketplaceAction, address: string, nonce: string, issuedAt: string, payload: unknown): string {
  return canonicalJson({ action, address, nonce, issuedAt, payload });
}

export function normalizePrice(value: string): string {
  return BigInt(value).toString();
}
