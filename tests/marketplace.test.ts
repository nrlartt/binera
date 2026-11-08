import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { envelopeSchema, listingPayloadSchema, marketplaceMessage, offerPayloadSchema } from "../src/lib/marketplace";
import { MarketplaceStore } from "../src/lib/server/marketplace-store";

const ownerA = "0x" + "11".repeat(20);
const ownerB = "0x" + "22".repeat(20);
const token = "0x" + "33".repeat(20);

function nonce(label: string) { return `nonce-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

async function tempStore() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "binera-market-"));
  return { store: new MarketplaceStore(path.join(dir, "marketplace.json")), dir };
}

const listing = {
  name: "BNB LP range research",
  category: "rebalancing" as const,
  summary: "A sourced research report covering range placement, fees and risk flags with timestamps.",
  price: "1000000000000000000",
  currency: token,
  deliveryHours: 24,
};

test("marketplace message is deterministic across key order", () => {
  const first = marketplaceMessage("listing.create", ownerA, "nonce-abc-123", "2026-11-08T00:00:00.000Z", { b: 2, a: 1 });
  const second = marketplaceMessage("listing.create", ownerA, "nonce-abc-123", "2026-11-08T00:00:00.000Z", { a: 1, b: 2 });
  assert.equal(first, second);
  assert.match(first, /"payload":\{"a":1,"b":2\}/);
});

test("signed envelope rejects malformed signatures and unsupported actions", () => {
  const base = { action: "listing.create", address: ownerA, nonce: "nonce-abc-123", issuedAt: "2026-11-08T00:00:00.000Z", payload: {}, signature: "0x" + "ab".repeat(65) };
  assert.equal(envelopeSchema.safeParse(base).success, true);
  assert.equal(envelopeSchema.safeParse({ ...base, action: "listing.delete" }).success, false);
  assert.equal(envelopeSchema.safeParse({ ...base, signature: "0x12" }).success, false);
  assert.equal(envelopeSchema.safeParse({ ...base, nonce: "short" }).success, false);
});

test("payload validation blocks zero prices and unsafe endpoints", () => {
  assert.equal(listingPayloadSchema.safeParse({ ...listing, price: "0" }).success, false);
  assert.equal(listingPayloadSchema.safeParse({ ...listing, endpoint: "http://example.com/card" }).success, false);
  assert.equal(listingPayloadSchema.safeParse({ ...listing, endpoint: "https://example.com/card" }).success, true);
  assert.equal(offerPayloadSchema.safeParse({ requestId: "not-a-uuid", price: "1", deliveryHours: 1, terms: "Deliver the report" }).success, false);
});

test("store creates a listing, denies a replayed nonce and exposes events", async () => {
  const { store, dir } = await tempStore();
  try {
    const reused = nonce("reuse");
    const created = await store.createListing(ownerA, listing, reused);
    assert.equal(created.owner, ownerA.toLowerCase());
    await assert.rejects(() => store.createListing(ownerA, { ...listing, name: "Second listing" }, reused), /already used/i);
    const snapshot = await store.snapshot();
    assert.equal(snapshot.listings.length, 1);
    assert.equal(snapshot.events[0].kind, "listing");
    assert.match(snapshot.events[0].summary, /BNB LP range research/);
  } finally { store.close(); await rm(dir, { recursive: true, force: true }); }
});

test("request, offer and acceptance follow ownership rules", async () => {
  const { store, dir } = await tempStore();
  try {
    const request = await store.createRequest(ownerA, {
      title: "Need a sourced USDT yield comparison",
      category: "yield",
      description: "Compare three USDT yield options with sources, fees, withdrawal rules and risk flags.",
      budget: "5000000000000000000",
      deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
    }, nonce("request"));
    await assert.rejects(() => store.createOffer(ownerA, { requestId: request.id, price: "1", deliveryHours: 12, terms: "Self offer test" }, nonce("self")), /your own request/i);
    const offer = await store.createOffer(ownerB, { requestId: request.id, price: "900000000000000000", deliveryHours: 12, terms: "Sourced report with block numbers and risk flags." }, nonce("offer"));
    await assert.rejects(() => store.acceptOffer(ownerB, { offerId: offer.id }, nonce("wrong-owner")), /request owner/i);
    const result = await store.acceptOffer(ownerA, { offerId: offer.id }, nonce("accept"));
    assert.equal(result.request.status, "accepted");
    assert.equal(result.offer.status, "accepted");
    const snapshot = await store.snapshot({ requestId: request.id });
    assert.equal(snapshot.offers.length, 1);
    assert.equal(snapshot.events[0].kind, "accepted");
  } finally { store.close(); await rm(dir, { recursive: true, force: true }); }
});

test("an expired request reads as closed and rejects new offers", async () => {
  const { store, dir } = await tempStore();
  try {
    const request = await store.createRequest(ownerA, {
      title: "Short-lived research request",
      category: "yield",
      description: "This request expires almost immediately so the closing transition can be verified.",
      budget: "1000000000000000000",
      deadline: new Date(Date.now() + 900).toISOString(),
    }, nonce("expiring"));
    await new Promise(resolve => setTimeout(resolve, 1100));
    await assert.rejects(() => store.createOffer(ownerB, { requestId: request.id, price: "1", deliveryHours: 1, terms: "Too late for this request." }, nonce("expired-offer")), /deadline/i);
    const snapshot = await store.snapshot({ requestId: request.id });
    assert.equal(snapshot.requests[0].status, "closed");
  } finally { store.close(); await rm(dir, { recursive: true, force: true }); }
});

test("closing a request rejects pending offers and is owner-only", async () => {
  const { store, dir } = await tempStore();
  try {
    const request = await store.createRequest(ownerA, {
      title: "Request to be closed by its owner",
      category: "health",
      description: "The owner closes this request before any provider is selected.",
      budget: "2000000000000000000",
      deadline: new Date(Date.now() + 86400000).toISOString(),
    }, nonce("close-request"));
    const offer = await store.createOffer(ownerB, { requestId: request.id, price: "500000000000000000", deliveryHours: 24, terms: "A pending offer that should be rejected on close." }, nonce("close-offer"));
    await assert.rejects(() => store.closeRequest(ownerB, { requestId: request.id }, nonce("close-wrong")), /owner/i);
    const result = await store.closeRequest(ownerA, { requestId: request.id }, nonce("close-right"));
    assert.equal(result.request.status, "closed");
    assert.equal(result.rejectedOffers, 1);
    const snapshot = await store.snapshot({ requestId: request.id });
    assert.equal(snapshot.offers.find(item => item.id === offer.id)?.status, "rejected");
  } finally { store.close(); await rm(dir, { recursive: true, force: true }); }
});

test("listings can be deactivated by their owner and disappear from public reads", async () => {
  const { store, dir } = await tempStore();
  try {
    const created = await store.createListing(ownerA, {
      name: "Deactivatable listing",
      category: "yield",
      summary: "A listing created only to verify the owner-only deactivation transition.",
      price: "1000000000000000000",
      currency: token,
      deliveryHours: 24,
    }, nonce("listing-close"));
    await assert.rejects(() => store.closeListing(ownerB, { listingId: created.id }, nonce("listing-wrong")), /owner/i);
    await store.closeListing(ownerA, { listingId: created.id }, nonce("listing-right"));
    assert.equal((await store.snapshot()).listings.length, 0);
  } finally { store.close(); await rm(dir, { recursive: true, force: true }); }
});

test("a provider can withdraw a pending offer but not an accepted one", async () => {
  const { store, dir } = await tempStore();
  try {
    const request = await store.createRequest(ownerA, {
      title: "Withdrawal transition request",
      category: "grid",
      description: "A provider submits one offer and withdraws it before the owner accepts.",
      budget: "3000000000000000000",
      deadline: new Date(Date.now() + 86400000).toISOString(),
    }, nonce("withdraw-request"));
    const offer = await store.createOffer(ownerB, { requestId: request.id, price: "600000000000000000", deliveryHours: 12, terms: "Offer that will be withdrawn by its owner." }, nonce("withdraw-offer"));
    await assert.rejects(() => store.withdrawOffer(ownerA, { offerId: offer.id }, nonce("withdraw-wrong")), /offer owner/i);
    const withdrawn = await store.withdrawOffer(ownerB, { offerId: offer.id }, nonce("withdraw-right"));
    assert.equal(withdrawn.status, "withdrawn");
    await assert.rejects(() => store.acceptOffer(ownerA, { offerId: offer.id }, nonce("withdraw-accept")), /no longer pending/i);
  } finally { store.close(); await rm(dir, { recursive: true, force: true }); }
});

test("a multi-slot request fills gradually and rejects pending offers once full", async () => {  const { store, dir } = await tempStore();
  try {
    const request = await store.createRequest(ownerA, {
      title: "Bounty: three sourced yield comparisons",
      category: "yield",
      description: "Three independent providers each deliver a sourced yield comparison with risk flags.",
      budget: "1000000000000000000",
      deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
      slots: 2,
    }, nonce("bounty"));
    assert.equal(request.slots, 2);
    const first = await store.createOffer(ownerB, { requestId: request.id, price: "500000000000000000", deliveryHours: 24, terms: "First slot deliverable with sources and limits." }, nonce("bounty-offer-1"));
    const second = await store.createOffer("0x" + "44".repeat(20), { requestId: request.id, price: "600000000000000000", deliveryHours: 30, terms: "Second slot deliverable with sources and limits." }, nonce("bounty-offer-2"));
    const third = await store.createOffer("0x" + "55".repeat(20), { requestId: request.id, price: "700000000000000000", deliveryHours: 36, terms: "Third slot deliverable with sources and limits." }, nonce("bounty-offer-3"));
    const one = await store.acceptOffer(ownerA, { offerId: first.id }, nonce("bounty-accept-1"));
    assert.equal(one.request.status, "open");
    assert.equal(one.filledSlots, 1);
    const two = await store.acceptOffer(ownerA, { offerId: second.id }, nonce("bounty-accept-2"));
    assert.equal(two.request.status, "accepted");
    assert.equal(two.filledSlots, 2);
    const snapshot = await store.snapshot({ requestId: request.id });
    assert.equal(snapshot.offers.find(offer => offer.id === third.id)?.status, "rejected");
    await assert.rejects(() => store.createOffer(ownerB, { requestId: request.id, price: "1", deliveryHours: 1, terms: "Offer after the bounty is full." }, nonce("bounty-late")), /no longer open/i);
  } finally { store.close(); await rm(dir, { recursive: true, force: true }); }
});

test("closed requests reject new offers and category filters stay exact", async () => {  const { store, dir } = await tempStore();
  try {
    const request = await store.createRequest(ownerA, {
      title: "Grid planning research request",
      category: "grid",
      description: "Plan a bounded grid with real pool data, explicit assumptions and risk flags.",
      budget: "2000000000000000000",
      deadline: new Date(Date.now() + 3 * 86400000).toISOString(),
    }, nonce("grid-request"));
    const offer = await store.createOffer(ownerB, { requestId: request.id, price: "1000000000000000000", deliveryHours: 24, terms: "Measured grid plan with sources and limits." }, nonce("grid-offer"));
    await store.acceptOffer(ownerA, { offerId: offer.id }, nonce("grid-accept"));
    await assert.rejects(() => store.createOffer(ownerB, { requestId: request.id, price: "1", deliveryHours: 1, terms: "Late offer after acceptance" }, nonce("late")), /no longer open/i);
    const filtered = await store.snapshot({ category: "grid" });
    assert.equal(filtered.requests.length, 1);
    assert.equal(filtered.requests[0].category, "grid");
    const empty = await store.snapshot({ category: "health" });
    assert.equal(empty.requests.length, 0);
  } finally { store.close(); await rm(dir, { recursive: true, force: true }); }
});
