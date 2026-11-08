import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { marketplaceMessage, type MarketplaceAction } from "../src/lib/marketplace";

const base = process.env.BASE_URL || "http://localhost:3000";
const buyer = privateKeyToAccount(generatePrivateKey());
const seller = privateKeyToAccount(generatePrivateKey());

async function signed(action: MarketplaceAction, account: typeof buyer, payload: unknown) {
  const nonce = crypto.randomUUID();
  const issuedAt = new Date().toISOString();
  const message = marketplaceMessage(action, account.address, nonce, issuedAt, payload);
  return { action, address: account.address, nonce, issuedAt, payload, signature: await account.signMessage({ message }) };
}
async function post(path: string, body: unknown) {
  const response = await fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}
async function snapshot(requestId?: string) {
  return fetch(`${base}/api/exchange${requestId ? `?requestId=${requestId}` : ""}`).then(r => r.json());
}

// Close request flow
const request = await post("/api/exchange/requests", await signed("request.create", buyer, {
  title: "Lifecycle probe: close request",
  category: "yield",
  description: "Created only to verify the close transition and pending-offer rejection.",
  budget: "1000000000000000000",
  deadline: new Date(Date.now() + 86400000).toISOString(),
}));
const offer = await post("/api/exchange/offers", await signed("offer.create", seller, {
  requestId: request.data.id, price: "500000000000000000", deliveryHours: 24, terms: "Pending offer for the close transition.",
}));
if (offer.status !== 201) throw new Error("Offer creation failed before the close transition.");
const close = await post("/api/exchange/requests/close", await signed("request.close", buyer, { requestId: request.data.id }));
const afterClose = await snapshot(request.data.id);
console.log("close request:", close.status, close.data.request?.status, "rejected:", close.data.rejectedOffers, "offer:", afterClose.offers[0]?.status);

// Withdraw offer flow
const request2 = await post("/api/exchange/requests", await signed("request.create", buyer, {
  title: "Lifecycle probe: withdraw offer",
  category: "grid",
  description: "Created only to verify that a provider can withdraw a pending offer.",
  budget: "1000000000000000000",
  deadline: new Date(Date.now() + 86400000).toISOString(),
}));
const offer2 = await post("/api/exchange/offers", await signed("offer.create", seller, {
  requestId: request2.data.id, price: "400000000000000000", deliveryHours: 12, terms: "Offer that will be withdrawn immediately.",
}));
const withdraw = await post("/api/exchange/offers/withdraw", await signed("offer.withdraw", seller, { offerId: offer2.data.id }));
console.log("withdraw offer:", withdraw.status, withdraw.data.status);

// Listing deactivation
const listing = await post("/api/exchange/listings", await signed("listing.create", seller, {
  name: "Lifecycle probe listing",
  category: "health",
  summary: "Created only to verify the listing deactivation transition.",
  price: "1000000000000000000",
  currency: "0x55d398326f99059fF775485246999027B3197955",
  deliveryHours: 24,
}));
const closeListing = await post("/api/exchange/listings/close", await signed("listing.close", seller, { listingId: listing.data.id }));
const listings = await snapshot();
console.log("close listing:", closeListing.status, closeListing.data.active, "visible:", listings.listings.some((item: { id: string }) => item.id === listing.data.id));

// Expired request projection and offer rejection
const expiring = await post("/api/exchange/requests", await signed("request.create", buyer, {
  title: "Lifecycle probe: expiry",
  category: "health",
  description: "This request expires in under two seconds so the projection can be checked.",
  budget: "1000000000000000000",
  deadline: new Date(Date.now() + 1200).toISOString(),
}));
await new Promise(resolve => setTimeout(resolve, 1600));
const expiredSnapshot = await snapshot(expiring.data.id);
const lateOffer = await post("/api/exchange/offers", await signed("offer.create", seller, {
  requestId: expiring.data.id, price: "1", deliveryHours: 1, terms: "This offer must be rejected after expiry.",
}));
console.log("expired request:", expiredSnapshot.requests[0]?.status, "late offer:", lateOffer.status, lateOffer.data.error);
