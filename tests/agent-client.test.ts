import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { verifyMessage } from "viem";
import { createAgentClient } from "../src/lib/agent-client";
import { marketplaceMessage } from "../src/lib/marketplace";

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

const listing = {
  name: "SDK listing test",
  category: "yield" as const,
  summary: "A signed listing created through the agent client to verify envelopes and routing.",
  price: "1000000000000000000",
  currency: "0x55d398326f99059fF775485246999027B3197955" as const,
  deliveryHours: 24,
};

test("agent client signs the canonical message and posts to the right route", async () => {
  const captured: { value?: { url: string; body: Record<string, unknown> } } = {};
  const client = createAgentClient({
    privateKey,
    baseUrl: "http://example.test/",
    fetchImpl: async (url, init) => {
      captured.value = { url, body: JSON.parse(init.body ?? "{}") };
      return { ok: true, status: 201, json: async () => ({ id: "listing-id" }) };
    },
  });
  const result = await client.createListing(listing);
  assert.equal(result.id, "listing-id");
  const request = captured.value;
  assert.ok(request);
  assert.equal(request!.url, "http://example.test/api/exchange/listings");
  const envelope = request!.body as { action: string; address: string; nonce: string; issuedAt: string; payload: unknown; signature: `0x${string}` };
  assert.equal(envelope.action, "listing.create");
  assert.equal(envelope.address, account.address);
  const rebuilt = marketplaceMessage("listing.create", envelope.address, envelope.nonce, envelope.issuedAt, envelope.payload);
  assert.equal(await verifyMessage({ address: account.address, message: rebuilt, signature: envelope.signature }), true);
});

test("agent client surfaces public API errors instead of pretending success", async () => {
  const client = createAgentClient({
    privateKey,
    fetchImpl: async () => ({ ok: false, status: 409, json: async () => ({ error: "This request no longer exists." }) }),
  });
  await assert.rejects(() => client.createOffer({ requestId: "00000000-0000-4000-8000-000000000000", price: "1", deliveryHours: 1, terms: "Valid terms for the test." }), /no longer exists/i);
});

test("agent client routes close and withdraw actions to their own endpoints", async () => {
  const calls: { url: string; action: string }[] = [];
  const client = createAgentClient({
    privateKey,
    baseUrl: "http://example.test",
    fetchImpl: async (url, init) => {
      calls.push({ url, action: JSON.parse(init.body ?? "{}").action });
      return { ok: true, status: 200, json: async () => ({ id: "x", status: "withdrawn", active: false }) };
    },
  });
  const id = "00000000-0000-4000-8000-000000000000";
  await client.closeListing(id);
  await client.closeRequest(id);
  await client.withdrawOffer(id);
  assert.deepEqual(calls.map(call => call.action), ["listing.close", "request.close", "offer.withdraw"]);
  assert.ok(calls[0].url.endsWith("/api/exchange/listings/close"));
  assert.ok(calls[1].url.endsWith("/api/exchange/requests/close"));
  assert.ok(calls[2].url.endsWith("/api/exchange/offers/withdraw"));
});

test("agent client maps accept and snapshot calls", async () => {  const urls: string[] = [];
  const client = createAgentClient({
    privateKey,
    baseUrl: "http://example.test",
    fetchImpl: async (url) => {
      urls.push(url);
      if (url.includes("/accept")) return { ok: true, status: 200, json: async () => ({ request: { id: "r", status: "open" }, filledSlots: 1, slots: 3 }) };
      return { ok: true, status: 200, json: async () => ({ listings: [], requests: [], offers: [], events: [] }) };
    },
  });
  const accepted = await client.acceptOffer("00000000-0000-4000-8000-000000000000");
  assert.equal(accepted.filledSlots, 1);
  const snapshot = await client.snapshot({ category: "yield" });
  assert.equal(snapshot.listings.length, 0);
  assert.ok(urls[0].endsWith("/api/exchange/accept"));
  assert.ok(urls[1].includes("category=yield"));
});
