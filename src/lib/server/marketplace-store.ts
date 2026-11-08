/**
 * Durable, single-instance marketplace index for listings, open requests and
 * offers. It stores only public marketplace text and wallet addresses.
 * Settlement stays on chain through the existing ERC-8183 flow; this index
 * never holds funds or signing material.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { PublicError } from "./http";
import { listingPayloadSchema, offerPayloadSchema, requestPayloadSchema, acceptPayloadSchema, requestClosePayloadSchema, listingClosePayloadSchema, offerWithdrawPayloadSchema, type MarketplaceCategory } from "../marketplace";
import { formatUnits } from "viem";

const address = z.string().regex(/^0x[0-9a-f]{40}$/i);
const iso = z.iso.datetime();

const listingSchema = z.object({
  id: z.uuid(), owner: address, createdAt: iso, active: z.boolean(),
  name: z.string().max(80), category: z.enum(["rebalancing", "grid", "yield", "health"]),
  summary: z.string().max(600), price: z.string().max(78), currency: address,
  deliveryHours: z.number().int(), registryId: z.string().max(40).optional(), endpoint: z.string().max(500).optional(),
});
const requestSchema = z.object({
  id: z.uuid(), owner: address, createdAt: iso, status: z.enum(["open", "accepted", "closed"]),
  acceptedOfferId: z.uuid().optional(), acceptedOfferIds: z.array(z.uuid()).max(20).optional(),
  slots: z.number().int().min(1).max(20).optional(),
  title: z.string().max(90), category: z.enum(["rebalancing", "grid", "yield", "health"]),
  description: z.string().max(900), budget: z.string().max(78), deadline: iso,
  registryId: z.string().max(40).optional(),
});
const offerSchema = z.object({
  id: z.uuid(), requestId: z.uuid(), owner: address, createdAt: iso,
  status: z.enum(["pending", "accepted", "rejected", "withdrawn"]),
  price: z.string().max(78), deliveryHours: z.number().int(), terms: z.string().max(500),
});
const eventSchema = z.object({
  id: z.uuid(), at: iso, kind: z.enum(["listing", "request", "offer", "accepted"]),
  actor: address, summary: z.string().max(200),
});
const dbSchema = z.object({
  version: z.literal(1), listings: z.array(listingSchema).max(500), requests: z.array(requestSchema).max(500),
  offers: z.array(offerSchema).max(2000), events: z.array(eventSchema).max(500),
  nonces: z.array(z.object({ nonce: z.string().max(64), address, at: iso })).max(2000),
});
type Db = z.infer<typeof dbSchema>;
export type Listing = z.infer<typeof listingSchema>;
export type MarketplaceRequest = z.infer<typeof requestSchema>;
export type Offer = z.infer<typeof offerSchema>;
export type MarketplaceEvent = z.infer<typeof eventSchema>;

const EMPTY: Db = { version: 1, listings: [], requests: [], offers: [], events: [], nonces: [] };
const MAX_LISTINGS_PER_OWNER = 20;
const MAX_OPEN_REQUESTS_PER_OWNER = 20;
const MAX_OFFERS_PER_REQUEST = 25;
const NONCE_WINDOW_MS = 24 * 60 * 60 * 1000;

function summaryPrice(price: string) {
  return `${formatUnits(BigInt(price), 18)} U`;
}

export class MarketplaceStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private file: string = process.env.MARKETPLACE_STORE_PATH || path.join(process.cwd(), ".data", "marketplace.json")) {}

  private async load(): Promise<Db> {
    try {
      const raw = await fs.readFile(this.file, "utf8");
      return dbSchema.parse(JSON.parse(raw));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { ...EMPTY };
      return { ...EMPTY };
    }
  }

  private async persist(db: Db) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify(db), "utf8");
    await fs.rename(temp, this.file);
  }

  private mutate<T>(work: (db: Db) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const db = await this.load();
      const result = work(db);
      await this.persist(db);
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private consumeNonce(db: Db, address: string, nonce: string) {
    const cutoff = Date.now() - NONCE_WINDOW_MS;
    db.nonces = db.nonces.filter(item => Date.parse(item.at) > cutoff);
    if (db.nonces.some(item => item.nonce === nonce && item.address === address)) throw new PublicError("This signed request was already used. Sign a new one.", 409);
    db.nonces.push({ nonce, address, at: new Date().toISOString() });
    if (db.nonces.length > 2000) db.nonces = db.nonces.slice(-2000);
  }

  private record(db: Db, kind: MarketplaceEvent["kind"], actor: string, summary: string) {
    db.events.push({ id: crypto.randomUUID(), at: new Date().toISOString(), kind, actor, summary });
    if (db.events.length > 500) db.events = db.events.slice(-500);
  }

  async snapshot(filter: { category?: MarketplaceCategory; requestId?: string } = {}) {
    const db = await this.load();
    const category = filter.category;
    const now = Date.now();
    const requests = db.requests.map(item => item.status === "open" && Date.parse(item.deadline) <= now ? { ...item, status: "closed" as const } : item);
    const statusById = new Map(requests.map(item => [item.id, item.status]));
    const offers = db.offers.map(item => item.status === "pending" && statusById.get(item.requestId) !== "open" ? { ...item, status: "rejected" as const } : item);
    return {
      listings: db.listings.filter(item => item.active && (!category || item.category === category)),
      requests: requests.filter(item => (!category || item.category === category) && (!filter.requestId || item.id === filter.requestId)),
      offers: offers.filter(item => !filter.requestId || item.requestId === filter.requestId),
      events: db.events.slice(-40).reverse(),
      observedAt: new Date().toISOString(),
    };
  }

  async eventsSince(since: string) {
    const db = await this.load();
    const cutoff = Date.parse(since);
    return db.events.filter(item => Number.isNaN(cutoff) || Date.parse(item.at) > cutoff);
  }

  createListing(owner: string, payload: unknown, nonce: string) {
    const data = listingPayloadSchema.parse(payload);
    return this.mutate(db => {
      this.consumeNonce(db, owner, nonce);
      const active = db.listings.filter(item => item.owner === owner && item.active);
      if (active.length >= MAX_LISTINGS_PER_OWNER) throw new PublicError("This wallet already has the maximum number of active listings.", 409);
      const listing: Listing = { id: crypto.randomUUID(), owner, createdAt: new Date().toISOString(), active: true, ...data, price: BigInt(data.price).toString() };
      db.listings = [listing, ...db.listings].slice(0, 500);
      this.record(db, "listing", owner, `New ${data.category} service listing: ${data.name}`);
      return listing;
    });
  }

  createRequest(owner: string, payload: unknown, nonce: string) {
    const data = requestPayloadSchema.parse(payload);
    if (Date.parse(data.deadline) <= Date.now()) throw new PublicError("Choose a deadline in the future.", 400);
    if (Date.parse(data.deadline) > Date.now() + 90 * 24 * 60 * 60 * 1000) throw new PublicError("Choose a deadline within 90 days.", 400);
    return this.mutate(db => {
      this.consumeNonce(db, owner, nonce);
      const open = db.requests.filter(item => item.owner === owner && item.status === "open");
      if (open.length >= MAX_OPEN_REQUESTS_PER_OWNER) throw new PublicError("This wallet already has the maximum number of open requests.", 409);
      const request: MarketplaceRequest = { id: crypto.randomUUID(), owner, createdAt: new Date().toISOString(), status: "open", ...data, slots: data.slots ?? 1, acceptedOfferIds: [], budget: BigInt(data.budget).toString() };
      db.requests = [request, ...db.requests].slice(0, 500);
      this.record(db, "request", owner, `New open request: ${data.title}`);
      return request;
    });
  }

  createOffer(owner: string, payload: unknown, nonce: string) {
    const data = offerPayloadSchema.parse(payload);
    return this.mutate(db => {
      this.consumeNonce(db, owner, nonce);
      const request = db.requests.find(item => item.id === data.requestId);
      if (!request) throw new PublicError("This request no longer exists.", 404);
      if (request.status !== "open") throw new PublicError("This request is no longer open for offers.", 409);
      if (Date.parse(request.deadline) <= Date.now()) throw new PublicError("This request has passed its deadline.", 409);
      if (request.owner === owner) throw new PublicError("You cannot offer on your own request.", 409);
      const existing = db.offers.filter(item => item.requestId === data.requestId);
      if (existing.some(item => item.owner === owner && item.status === "pending")) throw new PublicError("You already have a pending offer on this request.", 409);
      if (existing.length >= MAX_OFFERS_PER_REQUEST) throw new PublicError("This request already has the maximum number of offers.", 409);
      const offer: Offer = { id: crypto.randomUUID(), requestId: data.requestId, owner, createdAt: new Date().toISOString(), status: "pending", price: BigInt(data.price).toString(), deliveryHours: data.deliveryHours, terms: data.terms };
      db.offers = [offer, ...db.offers].slice(0, 2000);
      this.record(db, "offer", owner, `New offer on “${request.title}”: ${summaryPrice(offer.price)}`);
      return offer;
    });
  }

  acceptOffer(owner: string, payload: unknown, nonce: string) {    const data = acceptPayloadSchema.parse(payload);
    return this.mutate(db => {
      this.consumeNonce(db, owner, nonce);
      const offer = db.offers.find(item => item.id === data.offerId);
      if (!offer) throw new PublicError("This offer no longer exists.", 404);
      const request = db.requests.find(item => item.id === offer.requestId);
      if (!request) throw new PublicError("The related request no longer exists.", 404);
      if (request.owner !== owner) throw new PublicError("Only the request owner can accept an offer.", 403);
      if (request.status !== "open") throw new PublicError("This request is no longer open.", 409);
      if (Date.parse(request.deadline) <= Date.now()) throw new PublicError("This request has passed its deadline.", 409);
      if (offer.status !== "pending") throw new PublicError("This offer is no longer pending.", 409);
      const slots = request.slots ?? 1;
      const acceptedIds = new Set([...(request.acceptedOfferIds ?? []), ...(request.acceptedOfferId ? [request.acceptedOfferId] : [])]);
      if (acceptedIds.size >= slots) throw new PublicError("Every slot on this request is already filled.", 409);
      offer.status = "accepted";
      acceptedIds.add(offer.id);
      request.acceptedOfferIds = [...acceptedIds];
      request.acceptedOfferId = request.acceptedOfferIds[0];
      if (request.acceptedOfferIds.length >= slots) {
        request.status = "accepted";
        for (const other of db.offers) if (other.requestId === request.id && other.status === "pending") other.status = "rejected";
      }
      this.record(db, "accepted", owner, `Offer accepted on “${request.title}” (${request.acceptedOfferIds.length}/${slots}): ${summaryPrice(offer.price)}`);
      return { request, offer, filledSlots: request.acceptedOfferIds.length, slots };
    });
  }

  closeRequest(owner: string, payload: unknown, nonce: string) {
    const data = requestClosePayloadSchema.parse(payload);
    return this.mutate(db => {
      this.consumeNonce(db, owner, nonce);
      const request = db.requests.find(item => item.id === data.requestId);
      if (!request) throw new PublicError("This request no longer exists.", 404);
      if (request.owner !== owner) throw new PublicError("Only the request owner can close it.", 403);
      if (request.status !== "open") throw new PublicError("This request is no longer open.", 409);
      request.status = "closed";
      let rejected = 0;
      for (const offer of db.offers) {
        if (offer.requestId === request.id && offer.status === "pending") { offer.status = "rejected"; rejected++; }
      }
      this.record(db, "request", owner, `Closed request “${request.title}”${rejected ? `; ${rejected} pending offer(s) rejected` : ""}`);
      return { request, rejectedOffers: rejected };
    });
  }

  closeListing(owner: string, payload: unknown, nonce: string) {
    const data = listingClosePayloadSchema.parse(payload);
    return this.mutate(db => {
      this.consumeNonce(db, owner, nonce);
      const listing = db.listings.find(item => item.id === data.listingId);
      if (!listing) throw new PublicError("This listing no longer exists.", 404);
      if (listing.owner !== owner) throw new PublicError("Only the listing owner can deactivate it.", 403);
      if (!listing.active) throw new PublicError("This listing is already inactive.", 409);
      listing.active = false;
      this.record(db, "listing", owner, `Deactivated listing “${listing.name}”`);
      return listing;
    });
  }

  withdrawOffer(owner: string, payload: unknown, nonce: string) {
    const data = offerWithdrawPayloadSchema.parse(payload);
    return this.mutate(db => {
      this.consumeNonce(db, owner, nonce);
      const offer = db.offers.find(item => item.id === data.offerId);
      if (!offer) throw new PublicError("This offer no longer exists.", 404);
      if (offer.owner !== owner) throw new PublicError("Only the offer owner can withdraw it.", 403);
      if (offer.status !== "pending") throw new PublicError("Only a pending offer can be withdrawn.", 409);
      offer.status = "withdrawn";
      const request = db.requests.find(item => item.id === offer.requestId);
      this.record(db, "offer", owner, `Withdrew an offer${request ? ` on “${request.title}”` : ""}`);
      return offer;
    });
  }
}

export const marketplaceStore = new MarketplaceStore();
