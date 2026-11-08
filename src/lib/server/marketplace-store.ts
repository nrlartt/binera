/**
 * Durable marketplace index backed by SQLite (node:sqlite).
 * Public records only; settlement stays on chain. A legacy JSON store is
 * imported once when present so existing deployments keep their data.
 */
import { DatabaseSync } from "node:sqlite";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { PublicError } from "./http";
import {
  listingPayloadSchema, offerPayloadSchema, requestPayloadSchema, acceptPayloadSchema,
  requestClosePayloadSchema, listingClosePayloadSchema, offerWithdrawPayloadSchema,
  type MarketplaceCategory,
} from "../marketplace";
import { formatUnits } from "viem";
import { dispatchExchangeEvent } from "./exchange-webhook";

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
export type Listing = z.infer<typeof listingSchema>;
export type MarketplaceRequest = z.infer<typeof requestSchema>;
export type Offer = z.infer<typeof offerSchema>;
export type MarketplaceEvent = z.infer<typeof eventSchema>;

const MAX_LISTINGS_PER_OWNER = 20;
const MAX_OPEN_REQUESTS_PER_OWNER = 20;
const MAX_OFFERS_PER_REQUEST = 25;

function summaryPrice(price: string) {
  return `${formatUnits(BigInt(price), 18)} U`;
}

type Row = Record<string, unknown>;
const parseJson = <T>(value: unknown, fallback: T): T => {
  try { return JSON.parse(String(value ?? "")) as T; } catch { return fallback; }
};

export class MarketplaceStore {
  private db: DatabaseSync;
  private ready: Promise<void>;

  constructor(private file: string = process.env.MARKETPLACE_DB_PATH || path.join(process.cwd(), ".data", "marketplace.db")) {
    this.db = new DatabaseSync(file);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS listings (
        id TEXT PRIMARY KEY, owner TEXT NOT NULL, created_at TEXT NOT NULL, active INTEGER NOT NULL,
        name TEXT NOT NULL, category TEXT NOT NULL, summary TEXT NOT NULL, price TEXT NOT NULL,
        currency TEXT NOT NULL, delivery_hours INTEGER NOT NULL, registry_id TEXT, endpoint TEXT
      );
      CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY, owner TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL,
        accepted_offer_ids TEXT NOT NULL DEFAULT '[]', slots INTEGER NOT NULL DEFAULT 1,
        title TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, budget TEXT NOT NULL,
        deadline TEXT NOT NULL, registry_id TEXT
      );
      CREATE TABLE IF NOT EXISTS offers (
        id TEXT PRIMARY KEY, request_id TEXT NOT NULL, owner TEXT NOT NULL, created_at TEXT NOT NULL,
        status TEXT NOT NULL, price TEXT NOT NULL, delivery_hours INTEGER NOT NULL, terms TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS nonces (
        nonce TEXT NOT NULL, address TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (nonce, address)
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY, at TEXT NOT NULL, kind TEXT NOT NULL, actor TEXT NOT NULL, summary TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_listings_owner ON listings(owner, active);
      CREATE INDEX IF NOT EXISTS idx_requests_owner ON requests(owner, status);
      CREATE INDEX IF NOT EXISTS idx_requests_deadline ON requests(status, deadline);
      CREATE INDEX IF NOT EXISTS idx_offers_request ON offers(request_id, status);
      CREATE INDEX IF NOT EXISTS idx_events_at ON events(at);
    `);
    this.ready = this.importLegacy();
  }

  private async importLegacy() {
    const legacy = path.join(path.dirname(this.file), "marketplace.json");
    try {
      const count = Number((this.db.prepare("SELECT COUNT(*) AS n FROM listings").get() as { n: number }).n) + Number((this.db.prepare("SELECT COUNT(*) AS n FROM requests").get() as { n: number }).n);
      if (count > 0) return;
      const raw = JSON.parse(await fs.readFile(legacy, "utf8"));
      const listings = z.array(listingSchema).parse(raw.listings ?? []);
      const requests = z.array(requestSchema).parse(raw.requests ?? []);
      const offers = z.array(offerSchema).parse(raw.offers ?? []);
      const events = z.array(eventSchema).parse(raw.events ?? []);
      this.transaction(() => {
        for (const item of listings) this.insertListing(item);
        for (const item of requests) this.insertRequest(item);
        for (const item of offers) this.insertOffer(item);
        for (const event of events) this.insertEvent(event);
      });
    } catch { /* No legacy store, or already migrated. */ }
  }

  private transaction<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = work(); this.db.exec("COMMIT"); return result; }
    catch (error) { try { this.db.exec("ROLLBACK"); } catch { /* already rolled back */ } throw error; }
  }

  private insertListing(item: Listing) {
    this.db.prepare("INSERT OR REPLACE INTO listings (id,owner,created_at,active,name,category,summary,price,currency,delivery_hours,registry_id,endpoint) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(item.id, item.owner.toLowerCase(), item.createdAt, item.active ? 1 : 0, item.name, item.category, item.summary, item.price, item.currency.toLowerCase(), item.deliveryHours, item.registryId ?? null, item.endpoint ?? null);
  }

  private insertRequest(item: MarketplaceRequest) {
    this.db.prepare("INSERT OR REPLACE INTO requests (id,owner,created_at,status,accepted_offer_ids,slots,title,category,description,budget,deadline,registry_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(item.id, item.owner.toLowerCase(), item.createdAt, item.status, JSON.stringify(item.acceptedOfferIds ?? []), item.slots ?? 1, item.title, item.category, item.description, item.budget, item.deadline, item.registryId ?? null);
  }

  private insertOffer(item: Offer) {
    this.db.prepare("INSERT OR REPLACE INTO offers (id,request_id,owner,created_at,status,price,delivery_hours,terms) VALUES (?,?,?,?,?,?,?,?)")
      .run(item.id, item.requestId, item.owner.toLowerCase(), item.createdAt, item.status, item.price, item.deliveryHours, item.terms);
  }

  private insertEvent(event: MarketplaceEvent) {
    this.db.prepare("INSERT OR REPLACE INTO events (id,at,kind,actor,summary) VALUES (?,?,?,?,?)")
      .run(event.id, event.at, event.kind, event.actor.toLowerCase(), event.summary);
    this.db.prepare("DELETE FROM events WHERE id NOT IN (SELECT id FROM events ORDER BY at DESC LIMIT 500)").run();
  }

  private record(kind: MarketplaceEvent["kind"], actor: string, summary: string): MarketplaceEvent {
    const event: MarketplaceEvent = { id: crypto.randomUUID(), at: new Date().toISOString(), kind, actor: actor.toLowerCase(), summary };
    this.insertEvent(event);
    return event;
  }

  private consumeNonce(nonce: string, actor: string) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    this.db.prepare("DELETE FROM nonces WHERE at < ?").run(cutoff);
    const exists = this.db.prepare("SELECT 1 FROM nonces WHERE nonce = ? AND address = ?").get(nonce, actor);
    if (exists) throw new PublicError("This signed request was already used. Sign a new one.", 409);
    this.db.prepare("INSERT INTO nonces (nonce,address,at) VALUES (?,?,?)").run(nonce, actor, new Date().toISOString());
  }

  async sweepExpired(now = new Date()) {
    await this.ready;
    const stamp = now.toISOString();
    return this.transaction(() => {
      const expired = this.db.prepare("SELECT id, owner, title FROM requests WHERE status = 'open' AND deadline <= ?").all(stamp) as { id: string; owner: string; title: string }[];
      for (const request of expired) {
        this.db.prepare("UPDATE requests SET status = 'closed' WHERE id = ?").run(request.id);
        this.db.prepare("UPDATE offers SET status = 'rejected' WHERE request_id = ? AND status = 'pending'").run(request.id);
        this.record("request", request.owner, `Expired request “${request.title}”`);
      }
      return expired.length;
    });
  }

  async snapshot(filter: { category?: MarketplaceCategory; requestId?: string } = {}) {
    await this.sweepExpired();
    const category = filter.category;
    const listingRows = this.db.prepare(`SELECT * FROM listings WHERE active = 1${category ? " AND category = ?" : ""} ORDER BY created_at DESC LIMIT 500`).all(...(category ? [category] : [])) as Row[];
    const requestRows = this.db.prepare(`SELECT * FROM requests WHERE 1 = 1${category ? " AND category = ?" : ""}${filter.requestId ? " AND id = ?" : ""} ORDER BY created_at DESC LIMIT 500`).all(...([category, filter.requestId].filter(Boolean) as string[])) as Row[];
    const offerRows = this.db.prepare(`SELECT * FROM offers${filter.requestId ? " WHERE request_id = ?" : ""} ORDER BY created_at DESC LIMIT 2000`).all(...(filter.requestId ? [filter.requestId] : [])) as Row[];
    const eventRows = this.db.prepare("SELECT * FROM events ORDER BY at DESC LIMIT 40").all() as Row[];
    return {
      listings: listingRows.map(this.rowListing),
      requests: requestRows.map(this.rowRequest),
      offers: offerRows.map(this.rowOffer),
      events: eventRows.map(this.rowEvent),
      observedAt: new Date().toISOString(),
    };
  }

  async eventsSince(since: string) {
    await this.ready;
    return (this.db.prepare("SELECT * FROM events WHERE at > ? ORDER BY at ASC LIMIT 100").all(since) as Row[]).map(this.rowEvent);
  }

  close() { this.db.close(); }

  private rowListing = (row: Row): Listing => listingSchema.parse({
    id: row.id, owner: row.owner, createdAt: row.created_at, active: Boolean(row.active), name: row.name,
    category: row.category, summary: row.summary, price: row.price, currency: row.currency,
    deliveryHours: row.delivery_hours, ...(row.registry_id ? { registryId: row.registry_id } : {}), ...(row.endpoint ? { endpoint: row.endpoint } : {}),
  });
  private rowRequest = (row: Row): MarketplaceRequest => requestSchema.parse({
    id: row.id, owner: row.owner, createdAt: row.created_at, status: row.status,
    acceptedOfferIds: parseJson(row.accepted_offer_ids, []), slots: row.slots, title: row.title,
    category: row.category, description: row.description, budget: row.budget, deadline: row.deadline,
    ...(row.registry_id ? { registryId: row.registry_id } : {}),
  });
  private rowOffer = (row: Row): Offer => offerSchema.parse({
    id: row.id, requestId: row.request_id, owner: row.owner, createdAt: row.created_at,
    status: row.status, price: row.price, deliveryHours: row.delivery_hours, terms: row.terms,
  });
  private rowEvent = (row: Row): MarketplaceEvent => eventSchema.parse({ id: row.id, at: row.at, kind: row.kind, actor: row.actor, summary: row.summary });

  createListing(owner: string, payload: unknown, nonce: string) {
    const data = listingPayloadSchema.parse(payload);
    return this.ready.then(() => {
      const output = this.transaction(() => {
        this.consumeNonce(nonce, owner);
        const count = Number((this.db.prepare("SELECT COUNT(*) AS n FROM listings WHERE owner = ? AND active = 1").get(owner) as { n: number }).n);
        if (count >= MAX_LISTINGS_PER_OWNER) throw new PublicError("This wallet already has the maximum number of active listings.", 409);
        const listing: Listing = { id: crypto.randomUUID(), owner, createdAt: new Date().toISOString(), active: true, ...data, price: BigInt(data.price).toString() };
        this.insertListing(listing);
        return { listing, event: this.record("listing", owner, `New ${data.category} service listing: ${data.name}`) };
      });
      void dispatchExchangeEvent(output.event);
      return output.listing;
    });
  }

  createRequest(owner: string, payload: unknown, nonce: string) {
    const data = requestPayloadSchema.parse(payload);
    if (Date.parse(data.deadline) <= Date.now()) throw new PublicError("Choose a deadline in the future.", 400);
    if (Date.parse(data.deadline) > Date.now() + 90 * 24 * 60 * 60 * 1000) throw new PublicError("Choose a deadline within 90 days.", 400);
    return this.ready.then(() => {
      const output = this.transaction(() => {
        this.consumeNonce(nonce, owner);
        const open = Number((this.db.prepare("SELECT COUNT(*) AS n FROM requests WHERE owner = ? AND status = 'open'").get(owner) as { n: number }).n);
        if (open >= MAX_OPEN_REQUESTS_PER_OWNER) throw new PublicError("This wallet already has the maximum number of open requests.", 409);
        const request: MarketplaceRequest = { id: crypto.randomUUID(), owner, createdAt: new Date().toISOString(), status: "open", acceptedOfferIds: [], slots: data.slots ?? 1, ...data, budget: BigInt(data.budget).toString() };
        this.insertRequest(request);
        return { request, event: this.record("request", owner, `New open request: ${data.title}`) };
      });
      void dispatchExchangeEvent(output.event);
      return output.request;
    });
  }

  createOffer(owner: string, payload: unknown, nonce: string) {
    const data = offerPayloadSchema.parse(payload);
    return this.ready.then(() => {
      const output = this.transaction(() => {
        this.consumeNonce(nonce, owner);
        const request = this.db.prepare("SELECT * FROM requests WHERE id = ?").get(data.requestId) as Row | undefined;
        if (!request) throw new PublicError("This request no longer exists.", 404);
        if (request.status !== "open") throw new PublicError("This request is no longer open for offers.", 409);
        if (Date.parse(String(request.deadline)) <= Date.now()) throw new PublicError("This request has passed its deadline.", 409);
        if (String(request.owner).toLowerCase() === owner.toLowerCase()) throw new PublicError("You cannot offer on your own request.", 409);
        const existing = this.db.prepare("SELECT owner, status FROM offers WHERE request_id = ?").all(data.requestId) as { owner: string; status: string }[];
        if (existing.some(item => item.owner === owner.toLowerCase() && item.status === "pending")) throw new PublicError("You already have a pending offer on this request.", 409);
        if (existing.length >= MAX_OFFERS_PER_REQUEST) throw new PublicError("This request already has the maximum number of offers.", 409);
        const offer: Offer = { id: crypto.randomUUID(), requestId: data.requestId, owner, createdAt: new Date().toISOString(), status: "pending", price: BigInt(data.price).toString(), deliveryHours: data.deliveryHours, terms: data.terms };
        this.insertOffer(offer);
        return { offer, event: this.record("offer", owner, `New offer on “${String(request.title)}”: ${summaryPrice(offer.price)}`) };
      });
      void dispatchExchangeEvent(output.event);
      return output.offer;
    });
  }

  acceptOffer(owner: string, payload: unknown, nonce: string) {
    const data = acceptPayloadSchema.parse(payload);
    return this.ready.then(() => {
      const result = this.transaction(() => {
        this.consumeNonce(nonce, owner);
        const offerRow = this.db.prepare("SELECT * FROM offers WHERE id = ?").get(data.offerId) as Row | undefined;
        if (!offerRow) throw new PublicError("This offer no longer exists.", 404);
        const requestRow = this.db.prepare("SELECT * FROM requests WHERE id = ?").get(String(offerRow.request_id)) as Row | undefined;
        if (!requestRow) throw new PublicError("The related request no longer exists.", 404);
        if (String(requestRow.owner) !== owner.toLowerCase()) throw new PublicError("Only the request owner can accept an offer.", 403);
        if (requestRow.status !== "open") throw new PublicError("This request is no longer open.", 409);
        if (Date.parse(String(requestRow.deadline)) <= Date.now()) throw new PublicError("This request has passed its deadline.", 409);
        if (offerRow.status !== "pending") throw new PublicError("This offer is no longer pending.", 409);
        const slots = Number(requestRow.slots ?? 1);
        const accepted = new Set<string>(parseJson<string[]>(requestRow.accepted_offer_ids, []));
        if (accepted.size >= slots) throw new PublicError("Every slot on this request is already filled.", 409);
        accepted.add(data.offerId);
        this.db.prepare("UPDATE offers SET status = 'accepted' WHERE id = ?").run(data.offerId);
        this.db.prepare("UPDATE requests SET accepted_offer_ids = ? WHERE id = ?").run(JSON.stringify([...accepted]), String(requestRow.id));
        if (accepted.size >= slots) {
          this.db.prepare("UPDATE requests SET status = 'accepted' WHERE id = ?").run(String(requestRow.id));
          this.db.prepare("UPDATE offers SET status = 'rejected' WHERE request_id = ? AND status = 'pending'").run(String(requestRow.id));
        }
        const event = this.record("accepted", owner, `Offer accepted on “${String(requestRow.title)}” (${accepted.size}/${slots}): ${summaryPrice(String(offerRow.price))}`);
        return { event, filledSlots: accepted.size, slots, status: accepted.size >= slots ? "accepted" : "open", requestId: String(requestRow.id) };
      });
      void dispatchExchangeEvent(result.event);
      return { request: { id: result.requestId, status: result.status }, offer: { id: data.offerId, status: "accepted" }, filledSlots: result.filledSlots, slots: result.slots };
    });
  }

  closeRequest(owner: string, payload: unknown, nonce: string) {
    const data = requestClosePayloadSchema.parse(payload);
    return this.ready.then(() => {
      const output = this.transaction(() => {
        this.consumeNonce(nonce, owner);
        const request = this.db.prepare("SELECT * FROM requests WHERE id = ?").get(data.requestId) as Row | undefined;
        if (!request) throw new PublicError("This request no longer exists.", 404);
        if (String(request.owner) !== owner.toLowerCase()) throw new PublicError("Only the request owner can close it.", 403);
        if (request.status !== "open") throw new PublicError("This request is no longer open.", 409);
        this.db.prepare("UPDATE requests SET status = 'closed' WHERE id = ?").run(data.requestId);
        const rejected = Number((this.db.prepare("UPDATE offers SET status = 'rejected' WHERE request_id = ? AND status = 'pending'").run(data.requestId) as { changes: number }).changes);
        const event = this.record("request", owner, `Closed request “${String(request.title)}”${rejected ? `; ${rejected} pending offer(s) rejected` : ""}`);
        return { event, rejected };
      });
      void dispatchExchangeEvent(output.event);
      return { request: { id: data.requestId, status: "closed" }, rejectedOffers: output.rejected };
    });
  }

  closeListing(owner: string, payload: unknown, nonce: string) {
    const data = listingClosePayloadSchema.parse(payload);
    return this.ready.then(() => {
      const output = this.transaction(() => {
        this.consumeNonce(nonce, owner);
        const listing = this.db.prepare("SELECT * FROM listings WHERE id = ?").get(data.listingId) as Row | undefined;
        if (!listing) throw new PublicError("This listing no longer exists.", 404);
        if (String(listing.owner) !== owner.toLowerCase()) throw new PublicError("Only the listing owner can deactivate it.", 403);
        if (!Number(listing.active)) throw new PublicError("This listing is already inactive.", 409);
        this.db.prepare("UPDATE listings SET active = 0 WHERE id = ?").run(data.listingId);
        return { event: this.record("listing", owner, `Deactivated listing “${String(listing.name)}”`), listing };
      });
      void dispatchExchangeEvent(output.event);
      return { ...this.rowListing(output.listing), active: false };
    });
  }

  withdrawOffer(owner: string, payload: unknown, nonce: string) {
    const data = offerWithdrawPayloadSchema.parse(payload);
    return this.ready.then(() => {
      const output = this.transaction(() => {
        this.consumeNonce(nonce, owner);
        const offer = this.db.prepare("SELECT * FROM offers WHERE id = ?").get(data.offerId) as Row | undefined;
        if (!offer) throw new PublicError("This offer no longer exists.", 404);
        if (String(offer.owner) !== owner.toLowerCase()) throw new PublicError("Only the offer owner can withdraw it.", 403);
        if (offer.status !== "pending") throw new PublicError("Only a pending offer can be withdrawn.", 409);
        this.db.prepare("UPDATE offers SET status = 'withdrawn' WHERE id = ?").run(data.offerId);
        const request = this.db.prepare("SELECT title FROM requests WHERE id = ?").get(String(offer.request_id)) as { title: string } | undefined;
        return { event: this.record("offer", owner, `Withdrew an offer${request ? ` on “${request.title}”` : ""}`), offer };
      });
      void dispatchExchangeEvent(output.event);
      return { ...this.rowOffer(output.offer), status: "withdrawn" as const };
    });
  }
}

export const marketplaceStore = new MarketplaceStore();
