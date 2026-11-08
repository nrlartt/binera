import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { MarketplaceStore } from "../src/lib/server/marketplace-store";
import { dispatchExchangeEvent } from "../src/lib/server/exchange-webhook";

const ownerA = "0x" + "11".repeat(20);
const ownerB = "0x" + "22".repeat(20);
const nonce = (label: string) => `nonce-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const listing = {
  name: "Durable listing", category: "yield" as const,
  summary: "A listing used to verify that records survive a store restart.",
  price: "1000000000000000000", currency: "0x55d398326f99059fF775485246999027B3197955", deliveryHours: 24,
};
const request = (deadline: string) => ({
  title: "Durable request", category: "yield" as const,
  description: "A request used to verify durable writes and expiration sweeping.",
  budget: "1000000000000000000", deadline,
});

async function tempStore() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "binera-db-"));
  return { dir, file: path.join(dir, "marketplace.db") };
}

test("records survive a new store instance on the same SQLite file", async () => {
  const { dir, file } = await tempStore();
  try {
    const first = new MarketplaceStore(file);
    await first.createListing(ownerA, listing, nonce("persist"));
    first.close();
    const second = new MarketplaceStore(file);
    const snapshot = await second.snapshot();
    assert.equal(snapshot.listings.length, 1);
    assert.equal(snapshot.listings[0].owner, ownerA.toLowerCase());
    second.close();
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("the expiry sweep persists closed requests and rejects pending offers", async () => {
  const { dir, file } = await tempStore();
  try {
    const store = new MarketplaceStore(file);
    const created = await store.createRequest(ownerA, request(new Date(Date.now() + 900).toISOString()), nonce("sweep-request"));
    const offer = await store.createOffer(ownerB, { requestId: created.id, price: "500000000000000000", deliveryHours: 12, terms: "Offer that must be rejected when the request expires." }, nonce("sweep-offer"));
    await new Promise(resolve => setTimeout(resolve, 1100));
    const swept = await store.sweepExpired();
    assert.equal(swept, 1);
    const snapshot = await store.snapshot({ requestId: created.id });
    assert.equal(snapshot.requests[0].status, "closed");
    assert.equal(snapshot.offers.find(item => item.id === offer.id)?.status, "rejected");
    assert.equal(await store.sweepExpired(), 0);
    store.close();
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("webhook delivery is signed and localhost HTTP is supported for tests", async () => {
  const received: { body: string; signature?: string; event?: string }[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", chunk => chunks.push(chunk as Buffer));
    req.on("end", () => {
      received.push({ body: Buffer.concat(chunks).toString("utf8"), signature: req.headers["x-binera-signature"] as string | undefined, event: req.headers["x-binera-event"] as string | undefined });
      res.writeHead(200).end("ok");
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const previous = { url: process.env.EXCHANGE_WEBHOOK_URL, secret: process.env.EXCHANGE_WEBHOOK_SECRET };
  try {
    process.env.EXCHANGE_WEBHOOK_URL = `http://127.0.0.1:${port}/events`;
    process.env.EXCHANGE_WEBHOOK_SECRET = "test-webhook-secret";
    const event = { id: crypto.randomUUID(), at: new Date().toISOString(), kind: "listing" as const, actor: ownerA, summary: "Webhook probe" };
    assert.equal(await dispatchExchangeEvent(event), true);
    assert.equal(received.length, 1);
    assert.equal(received[0].event, "listing");
    assert.equal(JSON.parse(received[0].body).id, event.id);
    const expected = `sha256=${createHmac("sha256", "test-webhook-secret").update(received[0].body).digest("hex")}`;
    assert.equal(received[0].signature, expected);

    process.env.EXCHANGE_WEBHOOK_URL = "http://example.com/events";
    assert.equal(await dispatchExchangeEvent(event), false);
  } finally {
    if (previous.url === undefined) delete process.env.EXCHANGE_WEBHOOK_URL; else process.env.EXCHANGE_WEBHOOK_URL = previous.url;
    if (previous.secret === undefined) delete process.env.EXCHANGE_WEBHOOK_SECRET; else process.env.EXCHANGE_WEBHOOK_SECRET = previous.secret;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
