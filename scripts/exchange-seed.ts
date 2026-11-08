import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { marketplaceMessage, type MarketplaceAction } from "../src/lib/marketplace";

const base = "http://localhost:3000";
const buyer = privateKeyToAccount(generatePrivateKey());
const sellers = [privateKeyToAccount(generatePrivateKey()), privateKeyToAccount(generatePrivateKey())];

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

const request = await post("/api/exchange/requests", await signed("request.create", buyer, {
  title: "Compare USDT yield routes on BNB Chain",
  category: "yield",
  description: "Need a sourced comparison of three USDT yield routes with fees, withdrawal conditions, block numbers and explicit risk flags.",
  budget: "8000000000000000000",
  deadline: new Date(Date.now() + 6 * 86400000).toISOString(),
}));
console.log("request:", request.status, request.data.id ?? request.data.error);

for (const [index, seller] of sellers.entries()) {
  const offer = await post("/api/exchange/offers", await signed("offer.create", seller, {
    requestId: request.data.id,
    price: `${(index + 1) * 500000000000000000}`,
    deliveryHours: 24 + index * 12,
    terms: index === 0 ? "Three routes, official sources, block heights and withdrawal notes. No position changes." : "Sourced yield study with risk flags, contract references and a clear limitations section.",
  }));
  console.log("offer:", offer.status, offer.data.id ?? offer.data.error);
}

const listing = await post("/api/exchange/listings", await signed("listing.create", sellers[0], {
  name: "PancakeSwap v3 range study",
  category: "rebalancing",
  summary: "A sourced range-placement study for a PancakeSwap v3 LP position, with pool reads, fee tier and explicit risk flags.",
  price: "700000000000000000",
  currency: "0x55d398326f99059fF775485246999027B3197955",
  deliveryHours: 36,
  registryId: "scan-56-265375",
}));
console.log("listing:", listing.status, listing.data.id ?? listing.data.error);

// Bounty: three slots for the same category, one slot accepted to show partial progress.
const bounty = await post("/api/exchange/requests", await signed("request.create", buyer, {
  title: "Bounty: three grid-plan reviews for BNB/USDT",
  category: "grid",
  description: "Three independent providers each deliver a bounded grid plan with pool data, assumptions and explicit risk flags.",
  budget: "2000000000000000000",
  deadline: new Date(Date.now() + 8 * 86400000).toISOString(),
  slots: 3,
}));
console.log("bounty:", bounty.status, bounty.data.id ?? bounty.data.error);
const bountyOffers = [];
for (const [index, seller] of sellers.entries()) {
  const offer = await post("/api/exchange/offers", await signed("offer.create", seller, {
    requestId: bounty.data.id,
    price: "900000000000000000",
    deliveryHours: 48,
    terms: `Bounty slot ${index + 1}: bounded grid plan with measured pool reads, explicit limits and no execution promises.`,
  }));
  bountyOffers.push(offer);
  console.log("bounty offer:", offer.status, offer.data.id ?? offer.data.error);
}
const accepted = await post("/api/exchange/accept", await signed("offer.accept", buyer, { offerId: bountyOffers[0].data.id }));
console.log("bounty slot accepted:", accepted.status, accepted.data.filledSlots, "/", accepted.data.slots);

