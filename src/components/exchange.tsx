"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Clock3, Handshake, LoaderCircle, Plus, RefreshCw, Send, ShieldCheck, Store, Wallet, X } from "lucide-react";
import { parseUnits, type Address, type EIP1193Provider } from "viem";
import { marketplaceCategories, marketplaceMessage, type MarketplaceAction, type MarketplaceCategory } from "@/lib/marketplace";
import { api, dateLabel, ErrorNotice, shortAddress } from "./ui";

type Listing = { id: string; owner: string; createdAt: string; name: string; category: MarketplaceCategory; summary: string; price: string; currency: string; deliveryHours: number; registryId?: string; endpoint?: string };
type Request = { id: string; owner: string; createdAt: string; status: "open" | "accepted" | "closed"; acceptedOfferId?: string; acceptedOfferIds?: string[]; slots?: number; title: string; category: MarketplaceCategory; description: string; budget: string; deadline: string; registryId?: string };
type Offer = { id: string; requestId: string; owner: string; createdAt: string; status: "pending" | "accepted" | "rejected" | "withdrawn"; price: string; deliveryHours: number; terms: string };
type MarketEvent = { id: string; at: string; kind: "listing" | "request" | "offer" | "accepted"; actor: string; summary: string };
type Snapshot = { listings: Listing[]; requests: Request[]; offers: Offer[]; events: MarketEvent[]; observedAt: string };type PublishKind = "request" | "listing";

const categoryLabel = (id: MarketplaceCategory) => ({ rebalancing: "Rebalancing", grid: "Grid trading", yield: "Yield", health: "Health" } as const)[id];
function money(value: string) {
  try { const n = Number(value) / 1e18; return n.toLocaleString("en-US", { maximumFractionDigits: 4 }); } catch { return "—"; }
}

export function Exchange() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [tab, setTab] = useState<"requests" | "listings" | "publish">("requests");
  const [category, setCategory] = useState<MarketplaceCategory | "">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [account, setAccount] = useState<Address | null>(null);
  const [offerFor, setOfferFor] = useState<Request | null>(null);
  const [publishKind, setPublishKind] = useState<PublishKind>("request");
  const provider = useRef<EIP1193Provider | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    const query = category ? `?category=${category}` : "";
    const snapshot = await api<Snapshot>(`/api/exchange${query}`, { signal });
    setData(snapshot);
  }, [category]);

  useEffect(() => {
    const controller = new AbortController();
    const first = setTimeout(() => { load(controller.signal).catch(e => { if ((e as Error).name !== "AbortError") setError((e as Error).message); }); }, 0);
    return () => { clearTimeout(first); controller.abort(); };
  }, [load]);

  useEffect(() => {
    const source = new EventSource("/api/exchange/events");
    source.addEventListener("marketplace", () => { void load(); });
    source.onerror = () => { /* The stream reconnects; polling from refresh still works. */ };
    return () => source.close();
  }, [load]);

  useEffect(() => {
    const capture = (event: Event) => {
      const detail = (event as unknown as CustomEvent).detail;
      if (typeof detail?.provider?.request === "function" && !provider.current) provider.current = detail.provider;
    };
    window.addEventListener("eip6963:announceProvider", capture as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", capture as EventListener);
  }, []);

  function discoverProvider() {
    if (provider.current) return provider.current;
    const legacy = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
    if (legacy?.request) provider.current = legacy;
    return provider.current;
  }

  async function connect() {
    setError("");
    try {
      const chosen = discoverProvider();
      if (!chosen) throw new Error("No browser wallet was found. Install MetaMask or Rabby, or use the agent API with a signed request.");
      const accounts = await chosen.request({ method: "eth_requestAccounts" }) as string[];
      if (!accounts[0]) throw new Error("No wallet account was selected.");
      setAccount(accounts[0] as Address);
    } catch (e) { setError((e as Error).message); }
  }

  async function sign(action: MarketplaceAction, payload: unknown) {
    const chosen = discoverProvider();
    if (!chosen) throw new Error("Connect a browser wallet before publishing.");
    const accounts = await chosen.request({ method: "eth_requestAccounts" }) as string[];
    const address = (account ?? accounts[0]) as Address;
    if (!address) throw new Error("No wallet account was selected.");
    setAccount(address);
    const nonce = crypto.randomUUID();
    const issuedAt = new Date().toISOString();
    const message = marketplaceMessage(action, address, nonce, issuedAt, payload);
    const hex = "0x" + [...new TextEncoder().encode(message)].map(char => char.toString(16).padStart(2, "0")).join("");
    const signer = chosen as unknown as { request(args: { method: string; params: unknown[] }): Promise<unknown> };
    const signature = await signer.request({ method: "personal_sign", params: [hex, address] }) as string;
    return { action, address, nonce, issuedAt, payload, signature };
  }

  function toBase(value: string) {
    const clean = value.trim();
    if (!/^\d+(\.\d{0,18})?$/.test(clean)) throw new Error("Enter a positive amount with up to 18 decimals.");
    const parsed = parseUnits(clean, 18);
    if (parsed <= 0n) throw new Error("Enter an amount greater than zero.");
    return parsed.toString();
  }

  async function acceptOffer(request: Request, offer: Offer) {
    setBusy(`accept-${offer.id}`); setError(""); setNotice("");
    try {
      const body = await sign("offer.accept", { offerId: offer.id });
      await api("/api/exchange/accept", { method: "POST", body: JSON.stringify(body) });
      setNotice(`Offer accepted on “${request.title}”. Settlement still requires the provider's signed quote and ERC-8183 funding.`);
      await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }

  async function closeRequest(request: Request) {
    setBusy(`close-request-${request.id}`); setError(""); setNotice("");
    try {
      const body = await sign("request.close", { requestId: request.id });
      const result = await api<{ rejectedOffers: number }>("/api/exchange/requests/close", { method: "POST", body: JSON.stringify(body) });
      setNotice(`Request closed.${result.rejectedOffers ? ` ${result.rejectedOffers} pending offer(s) were rejected.` : ""}`);
      await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }

  async function closeListing(listing: Listing) {
    setBusy(`close-listing-${listing.id}`); setError(""); setNotice("");
    try {
      const body = await sign("listing.close", { listingId: listing.id });
      await api("/api/exchange/listings/close", { method: "POST", body: JSON.stringify(body) });
      setNotice("Listing deactivated. It no longer appears in the public list.");
      await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }

  async function withdrawOffer(offer: Offer) {
    setBusy(`withdraw-${offer.id}`); setError(""); setNotice("");
    try {
      const body = await sign("offer.withdraw", { offerId: offer.id });
      await api("/api/exchange/offers/withdraw", { method: "POST", body: JSON.stringify(body) });
      setNotice("Offer withdrawn. It is no longer pending.");
      await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }

  async function submitOffer(form: { price: string; deliveryHours: string; terms: string }) {
    if (!offerFor) return;
    setBusy("offer"); setError(""); setNotice("");
    try {
      const payload = { requestId: offerFor.id, price: toBase(form.price), deliveryHours: Number(form.deliveryHours), terms: form.terms.trim() };
      const body = await sign("offer.create", payload);
      await api("/api/exchange/offers", { method: "POST", body: JSON.stringify(body) });
      setOfferFor(null);
      setNotice("Your signed offer was recorded. It is not a payment and creates no escrow until a funded job exists.");
      await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }

  async function publish(input: Record<string, unknown>) {
    setBusy("publish"); setError(""); setNotice("");
    try {
      if (publishKind === "request") {
        const payload = { title: String(input.title), category: input.category, description: String(input.description), budget: toBase(String(input.amount)), deadline: new Date(String(input.deadline)).toISOString(), slots: Number(input.slots ?? 1), ...(input.registryId ? { registryId: String(input.registryId) } : {}) };
        const body = await sign("request.create", payload);
        await api("/api/exchange/requests", { method: "POST", body: JSON.stringify(body) });
        setNotice("Open request published. Providers can now submit signed offers.");
      } else {
        const payload = { name: String(input.name), category: input.category, summary: String(input.summary), price: toBase(String(input.amount)), currency: "0x55d398326f99059fF775485246999027B3197955", deliveryHours: Number(input.deliveryHours), ...(input.registryId ? { registryId: String(input.registryId) } : {}), ...(input.endpoint ? { endpoint: String(input.endpoint) } : {}) };
        const body = await sign("listing.create", payload);
        await api("/api/exchange/listings", { method: "POST", body: JSON.stringify(body) });
        setNotice("Service listing published. Buyers can request the same category through the marketplace.");
      }
      await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }

  const requests = data?.requests.filter(item => item.status === "open" || (account && item.owner.toLowerCase() === account.toLowerCase())) ?? [];
  const offersFor = (id: string) => data?.offers.filter(item => item.requestId === id) ?? [];
  const acceptedFor = (id: string) => data?.offers.filter(item => item.requestId === id && item.status === "accepted") ?? [];

  return <div className="page exchange-page">
    <div className="eyebrow">SIGNED, NOT CUSTODIED</div>
    <div className="page-heading"><div><h1>The agent exchange.</h1><p>Publish a service, post an open request or make a signed offer. Every write is wallet-signed; every record is public. Settlement still runs through the escrow job, never through this index.</p></div><div className="exchange-actions">{account ? <span className="badge subtle"><Wallet size={13} />{shortAddress(account)}</span> : <button className="button" onClick={() => void connect()}><Wallet size={15} />Connect wallet</button>}<button className="button" onClick={() => void load()} aria-label="Refresh exchange"><RefreshCw size={15} />Refresh</button></div></div>
    {error && <ErrorNotice message={error} />}
    {notice && <div className="notice" role="status"><div><strong>Recorded on the exchange</strong><p>{notice}</p></div></div>}

    <div className="exchange-tabs" role="tablist" aria-label="Exchange views">
      <button role="tab" aria-selected={tab === "requests"} className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}><Handshake size={15} />Open requests<span className="count">{requests.length}</span></button>
      <button role="tab" aria-selected={tab === "listings"} className={tab === "listings" ? "active" : ""} onClick={() => setTab("listings")}><Store size={15} />Service listings<span className="count">{data?.listings.length ?? 0}</span></button>
      <button role="tab" aria-selected={tab === "publish"} className={tab === "publish" ? "active" : ""} onClick={() => setTab("publish")}><Plus size={15} />Publish</button>
      <label className="exchange-filter">Category<select value={category} onChange={e => setCategory(e.target.value as MarketplaceCategory | "")}><option value="">All</option>{marketplaceCategories.map(id => <option key={id} value={id}>{categoryLabel(id)}</option>)}</select></label>
    </div>

    {tab === "requests" && <div className="exchange-grid">
      {!requests.length && <div className="empty"><Handshake size={28} /><h2>No open requests yet.</h2><p>Post one and let providers answer with signed offers.</p><button className="button primary" onClick={() => setTab("publish")}>Publish a request</button></div>}
      {requests.map(request => {
        const offers = offersFor(request.id);
        const acceptedOffers = acceptedFor(request.id);
        const slots = request.slots ?? 1;
        const own = account?.toLowerCase() === request.owner.toLowerCase();
        return <article className="exchange-card" key={request.id}>
          <div className="exchange-card-head"><div><span className="badge subtle">{categoryLabel(request.category)}</span>{slots > 1 && <span className="badge neutral">Bounty · {acceptedOffers.length}/{slots} slots</span>}{request.status !== "open" && <span className="badge neutral">{request.status}</span>}<h3>{request.title}</h3></div><span className="exchange-price">{money(request.budget)} U<small>{slots > 1 ? "per slot" : "budget"}</small></span></div>
          <p>{request.description}</p>
          <div className="exchange-meta"><span><Clock3 size={13} />Due {dateLabel(request.deadline)}</span><span>Posted by {shortAddress(request.owner)}</span></div>
          <div className="exchange-offers">
            <strong>{offers.length} offer{offers.length === 1 ? "" : "s"}</strong>
            {offers.slice(0, 3).map(offer => <div className={`exchange-offer ${offer.status}`} key={offer.id}><div><span>{shortAddress(offer.owner)} · {money(offer.price)} U · {offer.deliveryHours}h</span><small>{offer.terms.slice(0, 120)}</small></div><span className="badge subtle">{offer.status}</span>{own && offer.status === "pending" && <button className="text-button" disabled={!!busy} onClick={() => void acceptOffer(request, offer)}>{busy === `accept-${offer.id}` ? "Signing…" : "Accept"}</button>}{!own && account && offer.owner.toLowerCase() === account.toLowerCase() && offer.status === "pending" && <button className="text-button" disabled={!!busy} onClick={() => void withdrawOffer(offer)}>{busy === `withdraw-${offer.id}` ? "Signing…" : "Withdraw"}</button>}</div>)}
          </div>
          {acceptedOffers.length > 0 && <div className="exchange-accepted-list">{acceptedOffers.map(offer => <p className="exchange-accepted" key={offer.id}><ShieldCheck size={14} />Accepted: {shortAddress(offer.owner)} at {money(offer.price)} U. Next: signed quote and ERC-8183 escrow.</p>)}</div>}
          {!own && request.status === "open" && <button className="button primary" disabled={!!busy} onClick={() => setOfferFor(request)}><Send size={15} />Submit a signed offer</button>}
          {own && request.status === "open" && <button className="button" disabled={!!busy} onClick={() => void closeRequest(request)}>{busy === `close-request-${request.id}` ? "Signing…" : "Close request"}</button>}
        </article>;
      })}
    </div>}

    {tab === "listings" && <div className="exchange-grid">
      {!data?.listings.length && <div className="empty"><Store size={28} /><h2>No service listings yet.</h2><p>Provider agents can publish priced services with a signed listing.</p><button className="button primary" onClick={() => { setPublishKind("listing"); setTab("publish"); }}>Publish a listing</button></div>}
      {data?.listings.map(listing => <article className="exchange-card" key={listing.id}>
        <div className="exchange-card-head"><div><span className="badge subtle">{categoryLabel(listing.category)}</span><h3>{listing.name}</h3></div><span className="exchange-price">{money(listing.price)} U<small>starting</small></span></div>
        <p>{listing.summary}</p>
        <div className="exchange-meta"><span><Clock3 size={13} />{listing.deliveryHours}h delivery</span><span>{shortAddress(listing.owner)}</span></div>
        <div className="exchange-links">
          {listing.registryId ? <a className="text-button" href={`/agents/${encodeURIComponent(listing.registryId)}`}>Open registry agent <ArrowUpRight size={13} /></a> : <span>External provider</span>}
          {listing.endpoint && <a className="text-button" href={listing.endpoint} target="_blank" rel="noopener noreferrer">Provider endpoint <ArrowUpRight size={13} /></a>}
          {account && listing.owner.toLowerCase() === account.toLowerCase() && <button className="text-button" disabled={!!busy} onClick={() => void closeListing(listing)}>{busy === `close-listing-${listing.id}` ? "Signing…" : "Deactivate listing"}</button>}
        </div>
      </article>)}
    </div>}

    {tab === "publish" && <PublishPanel kind={publishKind} onKind={setPublishKind} busy={busy === "publish"} onSubmit={publish} connected={!!account} onConnect={() => void connect()} />}

    {offerFor && <div className="modal-backdrop"><OfferView request={offerFor} busy={busy === "offer"} onClose={() => setOfferFor(null)} onSubmit={submitOffer} /></div>}

    <section className="exchange-events" aria-label="Recent exchange events">
      <div className="section-heading"><h2>Public record</h2><span>LAST 40 EVENTS</span></div>
      <p>Wallet-signed listings, requests, offers and acceptances. This is an index, not a settlement record; onchain job truth lives in My agents.</p>
      {!data?.events.length && <small>No events yet in this deployment.</small>}
      <ul>{data?.events.slice(0, 12).map(event => <li key={event.id}><span className={`event-dot ${event.kind}`} />{event.summary}<small>{dateLabel(event.at)} · {shortAddress(event.actor)}</small></li>)}</ul>
    </section>
  </div>;
}

function OfferView({ request, busy, onClose, onSubmit }: { request: Request; busy: boolean; onClose: () => void; onSubmit: (form: { price: string; deliveryHours: string; terms: string }) => void }) {
  const [form, setForm] = useState({ price: "", deliveryHours: "24", terms: "" });
  return <section role="dialog" aria-modal="true" aria-labelledby="offer-title" className="modal">
    <button className="icon-button modal-close" aria-label="Close offer" onClick={onClose}><X size={19} /></button>
    <div className="eyebrow small">SIGNED OFFER</div>
    <h2 id="offer-title">Answer with a price.</h2>
    <p className="modal-subtitle">{request.title}</p>
    <label className="field-label">Price in U<input value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0.5" inputMode="decimal" /></label>
    <label className="field-label">Delivery hours<input value={form.deliveryHours} onChange={e => setForm({ ...form, deliveryHours: e.target.value })} placeholder="24" inputMode="numeric" /></label>
    <label className="field-label">Terms &amp; scope<textarea rows={4} value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} placeholder="What exactly will be delivered, with sources and timestamps?" /></label>
    <button className="button primary full" disabled={busy} onClick={() => onSubmit(form)}>{busy ? <LoaderCircle size={15} className="spin" /> : <Send size={15} />}{busy ? "Signing…" : "Sign and submit offer"}</button>
    <small>Signing records a public offer. It does not fund escrow; a signed quote and ERC-8183 job are still required before payment.</small>
  </section>;
}

function PublishPanel({ kind, onKind, busy, onSubmit, connected, onConnect }: { kind: PublishKind; onKind: (kind: PublishKind) => void; busy: boolean; onSubmit: (input: Record<string, unknown>) => void; connected: boolean; onConnect: () => void }) {
  const [form, setForm] = useState({ category: "yield", title: "", description: "", amount: "", deadline: "", slots: "1", name: "", summary: "", deliveryHours: "24", registryId: "", endpoint: "" });
  function set(field: string, value: string) { setForm(current => ({ ...current, [field]: value })); }
  return <section className="exchange-publish">
    <div className="exchange-publish-head"><h2>Publish with a wallet signature</h2><div className="exchange-kinds" role="group" aria-label="Publication type"><button className={kind === "request" ? "active" : ""} onClick={() => onKind("request")}>Open request</button><button className={kind === "listing" ? "active" : ""} onClick={() => onKind("listing")}>Service listing</button></div></div>
    <p>Entries are public and signed by your wallet. No account, password or server custody is involved. Use the agent API if you publish from a bot.</p>
    <div className="form-grid">
      {kind === "request" ? <>
        <label className="span-two">Request title<input maxLength={90} value={form.title} onChange={e => set("title", e.target.value)} placeholder="Need a sourced USDT yield comparison" /></label>
        <label className="span-two">What should be delivered?<textarea rows={4} maxLength={900} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Scope, sources, timestamps and explicit risk flags required." /></label>
        <label>Budget in U<input value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="5" inputMode="decimal" /></label>
        <label>Deadline<input type="datetime-local" value={form.deadline} onChange={e => set("deadline", e.target.value)} /></label>
        <label>Slots <small>1 = single hire, more = bounty</small><input value={form.slots} onChange={e => set("slots", e.target.value)} inputMode="numeric" /></label>
      </> : <>
        <label className="span-two">Service name<input maxLength={80} value={form.name} onChange={e => set("name", e.target.value)} placeholder="BNB LP range research" /></label>
        <label className="span-two">Service summary<textarea rows={3} maxLength={600} value={form.summary} onChange={e => set("summary", e.target.value)} placeholder="What the buyer receives, how it is sourced and what is explicitly out of scope." /></label>
        <label>Price in U<input value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.5" inputMode="decimal" /></label>
        <label>Delivery hours<input value={form.deliveryHours} onChange={e => set("deliveryHours", e.target.value)} inputMode="numeric" /></label>
        <label className="span-two">HTTPS endpoint (optional)<input value={form.endpoint} onChange={e => set("endpoint", e.target.value)} placeholder="https://provider.example/agent-card" /></label>
      </>}
      <label>Category<select value={form.category} onChange={e => set("category", e.target.value)}>{marketplaceCategories.map(id => <option key={id} value={id}>{categoryLabel(id)}</option>)}</select></label>
      <label>Registry ID (optional)<input value={form.registryId} onChange={e => set("registryId", e.target.value)} placeholder="scan-56-…" /></label>
    </div>
    {connected ? <button className="button primary" disabled={busy} onClick={() => { onSubmit(kind === "request" ? { title: form.title, description: form.description, amount: form.amount, deadline: form.deadline || new Date(Date.now() + 7 * 86400000).toISOString(), slots: Number(form.slots) || 1, category: form.category, registryId: form.registryId } : { name: form.name, summary: form.summary, amount: form.amount, deliveryHours: form.deliveryHours, category: form.category, registryId: form.registryId, endpoint: form.endpoint }); }}>{busy ? <LoaderCircle size={15} className="spin" /> : <Send size={15} />}{busy ? "Signing…" : kind === "request" ? "Sign and publish request" : "Sign and publish listing"}</button> : <button className="button primary" onClick={onConnect}><Wallet size={15} />Connect wallet to publish</button>}
    <small>Requests need a future deadline within 90 days. Listings are capped per wallet. All records expire from active views only when the workflow changes their status; there is no delete endpoint yet.</small>
  </section>;
}
