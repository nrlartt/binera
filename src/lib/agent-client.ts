/**
 * Minimal agent-side SDK for the Binera exchange.
 * Agents sign every write locally; keys never leave the process.
 */
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { marketplaceMessage, type MarketplaceAction } from "./marketplace";
import type { z } from "zod";
import type { acceptPayloadSchema, listingPayloadSchema, offerPayloadSchema, requestPayloadSchema } from "./marketplace";

type ListingInput = z.infer<typeof listingPayloadSchema>;
type RequestInput = z.infer<typeof requestPayloadSchema>;
type OfferInput = z.infer<typeof offerPayloadSchema>;
type AcceptInput = z.infer<typeof acceptPayloadSchema>;

type FetchLike = (url: string, init: { method: string; headers?: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

const routes: Record<MarketplaceAction, string> = {
  "listing.create": "listings",
  "listing.close": "listings/close",
  "request.create": "requests",
  "request.close": "requests/close",
  "offer.create": "offers",
  "offer.withdraw": "offers/withdraw",
  "offer.accept": "accept",
};

export type AgentClientOptions = { privateKey: Hex; baseUrl?: string; fetchImpl?: FetchLike };

export function createAgentClient({ privateKey, baseUrl = "http://localhost:3000", fetchImpl }: AgentClientOptions) {
  const account = privateKeyToAccount(privateKey);
  const call = fetchImpl ?? ((url, init) => fetch(url, init) as unknown as ReturnType<FetchLike>);

  async function write<T>(action: MarketplaceAction, payload: unknown): Promise<T> {
    const nonce = crypto.randomUUID();
    const issuedAt = new Date().toISOString();
    const message = marketplaceMessage(action, account.address, nonce, issuedAt, payload);
    const signature = await account.signMessage({ message });
    const response = await call(`${baseUrl.replace(/\/$/, "")}/api/exchange/${routes[action]}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, address: account.address, nonce, issuedAt, payload, signature }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error((data as { error?: string }).error ?? `Marketplace request failed with HTTP ${response.status}.`);
    return data as T;
  }

  return {
    address: account.address,
    createListing: (payload: ListingInput) => write<{ id: string }>("listing.create", payload),
    closeListing: (listingId: string) => write<{ id: string; active: boolean }>("listing.close", { listingId }),
    createRequest: (payload: RequestInput) => write<{ id: string; slots?: number }>("request.create", payload),
    closeRequest: (requestId: string) => write<{ request: { id: string; status: string }; rejectedOffers: number }>("request.close", { requestId }),
    createOffer: (payload: OfferInput) => write<{ id: string }>("offer.create", payload),
    withdrawOffer: (offerId: string) => write<{ id: string; status: string }>("offer.withdraw", { offerId }),
    acceptOffer: (offerId: string) => write<{ request: { id: string; status: string }; filledSlots: number; slots: number }>("offer.accept", { offerId } satisfies AcceptInput),
    async snapshot(query: { category?: string; requestId?: string } = {}) {
      const params = new URLSearchParams(Object.entries(query).filter(([, value]) => Boolean(value)) as [string, string][]);
      const queryString = params.toString();
      const response = await call(`${baseUrl.replace(/\/$/, "")}/api/exchange${queryString ? `?${queryString}` : ""}`, { method: "GET", headers: { Accept: "application/json" } });
      const data = await response.json();
      if (!response.ok) throw new Error((data as { error?: string }).error ?? `Marketplace read failed with HTTP ${response.status}.`);
      return data as { listings: unknown[]; requests: unknown[]; offers: unknown[]; events: unknown[] };
    },
  };
}
