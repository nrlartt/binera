import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { marketplaceMessage, type MarketplaceAction } from "../src/lib/marketplace";

const base = process.env.BASE_URL || "http://localhost:3000";
const buyer = privateKeyToAccount(generatePrivateKey());
const seller = privateKeyToAccount(generatePrivateKey());

async function signed(action: MarketplaceAction, account: typeof buyer, payload: unknown) {
  const nonce = crypto.randomUUID();
  const issuedAt = new Date().toISOString();
  const message = marketplaceMessage(action, account.address, nonce, issuedAt, payload);
  const signature = await account.signMessage({ message });
  return { action, address: account.address, nonce, issuedAt, payload, signature };
}

async function post(path: string, body: unknown) {
  const response = await fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  return { status: response.status, data };
}

const request = await post("/api/exchange/requests", await signed("request.create", buyer, {
  title: "Live API probe: USDT yield comparison",
  category: "yield",
  description: "Verify the signed marketplace path end to end with a real request, offer and acceptance.",
  budget: "3000000000000000000",
  deadline: new Date(Date.now() + 5 * 86400000).toISOString(),
}));
console.log("request:", request.status, request.data.id ?? request.data.error);

const offer = await post("/api/exchange/offers", await signed("offer.create", seller, {
  requestId: request.data.id,
  price: "1200000000000000000",
  deliveryHours: 24,
  terms: "Sourced comparison with block numbers, timestamps and explicit risk flags.",
}));
console.log("offer:", offer.status, offer.data.id ?? offer.data.error);

const accept = await post("/api/exchange/accept", await signed("offer.accept", buyer, { offerId: offer.data.id }));
console.log("accept:", accept.status, accept.data.request?.status ?? accept.data.error);

const snapshot = await fetch(`${base}/api/exchange?requestId=${request.data.id}`).then(r => r.json());
console.log("snapshot:", snapshot.requests?.[0]?.status, snapshot.offers?.map((o: { status: string }) => o.status).join(","), "events:", snapshot.events?.length);
console.log("addresses:", buyer.address, seller.address);
