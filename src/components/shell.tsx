"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { Bookmark, UserRound, BookOpen, Compass, Layers3, Columns3, ArrowUpRight, Menu, X, Wallet, LoaderCircle, Leaf, ShieldCheck } from "lucide-react";
import type { Client, CreateWalletResult } from "@altananetwork/sdk";
import { categories, type Agent } from "@/lib/domain";
import { CategoryIcon, CopyAddress, ErrorNotice, shortAddress } from "./ui";
import { BrowserWalletPanel, useBrowserWallet } from "./browser-wallet";
import { useDialog } from "./use-dialog";

type Context = { compared: Agent[]; toggleCompare: (agent: Agent) => void; clearCompare: () => void; replaceCompared: (agents: Agent[]) => void; wallet: CreateWalletResult | null; client: Client | null; openWallet: () => void };
const MarketContext = createContext<Context | null>(null);
export const useMarket = () => { const context = useContext(MarketContext); if (!context) throw new Error("Missing marketplace context"); return context; };
export function Shell({ children }: { children: React.ReactNode }) {
  const browser = useBrowserWallet();
  const path = usePathname(); const [mobile, setMobile] = useState(false);
  const [compared, setCompared] = useState<Agent[]>([]); const [wallet, setWallet] = useState<CreateWalletResult | null>(null); const [client, setClient] = useState<Client | null>(null);
  const [walletOpen, setWalletOpen] = useState(false); const [passkeyBusy, setBusy] = useState(false); const [fundingBusy, setFundingBusy] = useState(false); const busy = passkeyBusy || fundingBusy || browser.busy; const [error, setError] = useState(""); const [compareError, setCompareError] = useState("");
  useDialog(walletOpen, () => { if (!busy) setWalletOpen(false); });
  useEffect(() => {
    try { const stored: Agent[] = JSON.parse(localStorage.getItem("agentmarket-compare") ?? "[]"); if (Array.isArray(stored)) { /* This restores user selection, never production registry data. */
      queueMicrotask(() => setCompared(stored.filter(a => typeof a.id === "string" && Array.isArray(a.categories)).slice(0, 3)));
    } } catch { /* Storage can be unavailable in private browsing. */ }
  }, []);
  function updateCompare(items: Agent[]) { setCompared(items); try { localStorage.setItem("agentmarket-compare", JSON.stringify(items)); } catch { /* In-memory comparison still works. */ } }
  function toggleCompare(agent: Agent) {
    setCompareError("");
    if (compared.some(a => a.id === agent.id)) { updateCompare(compared.filter(a => a.id !== agent.id)); return; }
    if (compared.length === 3) { setCompareError("Compare up to three agents. Remove one to add another."); return; }
    if (compared.length && !agent.categories.some(c => compared.every(a => a.categories.includes(c)))) { setCompareError("Choose agents that share a category for a meaningful comparison."); return; }
    updateCompare([...compared, agent]);
  }
  async function connect(mode: "create" | "recover" | "resume") {
    setBusy(true); setError("");
    try {
      if (!window.isSecureContext || !window.PublicKeyCredential) throw new Error("Use a browser with passkey support on HTTPS to connect your account.");
      const sdk = await import("@altananetwork/sdk"); const c = sdk.createClient({ chains: [sdk.BNB] });
      let w: CreateWalletResult;
      if (mode === "resume") {
        const saved = JSON.parse(localStorage.getItem("agentmarket-passkey-handle") || "null");
        if (!saved || saved.credential?.kind !== "webauthn" || saved.credential.rpId !== location.hostname || !/^0x[0-9a-f]{40}$/i.test(saved.address)) throw new Error("No saved handle");
        const id = Uint8Array.from(atob(saved.credential.id.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
        const assertion = await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), rpId: location.hostname, userVerification: "required", allowCredentials: [{ type: "public-key", id }] } });
        if (!assertion || assertion.id !== saved.credential.id) throw new Error("Passkey not selected");
        w = { address: saved.address, signer: sdk.signerFromPasskey(saved.credential) };
      } else {
        const created = mode === "create" ? await c.createPasskeyWallet({ name: "Binera Agent Market", rpId: location.hostname }) : await c.recoverFromPasskey({ rpId: location.hostname });
        w = created;
        // Public credential handle only, essential for recovery before the first onchain transaction.
        if (created.signer.credential.kind === "webauthn") localStorage.setItem("agentmarket-passkey-handle", JSON.stringify({ address: created.address, credential: { ...created.signer.credential, rpId: location.hostname } }));
      }
      setClient(c); setWallet(w); setWalletOpen(false);
    } catch { setError("The passkey request was not completed. Try again, or use a device where your passkey is saved."); } finally { setBusy(false); }
  }
  return <MarketContext.Provider value={{ compared, toggleCompare, clearCompare: () => updateCompare([]), replaceCompared: updateCompare, wallet, client, openWallet: () => setWalletOpen(true) }}>
    <a className="skip-link" href="#main">Skip to content</a>
    <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
      <Link href="/" className="brand" aria-label="Binera Agent Market home" onClick={() => setMobile(false)}><span className="brand-symbol"><Layers3 size={23} /></span>Binera<span className="brand-dot">.</span></Link>
      <div className="sidebar-label">YOUR NEXT ADVANTAGE</div>
      <nav aria-label="Main navigation">
        <Link className={`nav-item ${path === "/" ? "active" : ""}`} href="/" onClick={() => setMobile(false)}><Compass size={19} />Discover<span className="nav-arrow">↗</span></Link>
        <Link className={`nav-item ${path === "/dashboard" ? "active" : ""}`} href="/dashboard" onClick={() => setMobile(false)}><Layers3 size={19} />My agents</Link>
        <Link className={`nav-item ${path === "/compare" ? "active" : ""}`} href="/compare" onClick={() => setMobile(false)}><Columns3 size={19} />Compare{compared.length > 0 && <span className="count">{compared.length}</span>}</Link>
        <Link className={`nav-item ${path === "/saved" ? "active" : ""}`} href="/saved" onClick={() => setMobile(false)}><Bookmark size={19} />Saved agents</Link>
        {wallet && <Link className={`nav-item ${path === "/profile" ? "active" : ""}`} href="/profile" onClick={() => setMobile(false)}><UserRound size={19} />Profile</Link>}
        <Link className={`nav-item ${path === "/docs" ? "active" : ""}`} href="/docs" onClick={() => setMobile(false)}><BookOpen size={19} />Docs</Link>
      </nav>
      <div className="sidebar-label category-label">EXPLORE CATEGORIES</div>
      <nav aria-label="Agent categories">{categories.map(c => <Link className={`nav-item category-nav ${path === `/category/${c.id}` ? "active" : ""}`} key={c.id} href={`/category/${c.id}`} onClick={() => setMobile(false)}><CategoryIcon category={c.id} size={18} />{c.id === "health" ? "Health monitoring" : c.name}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><ShieldCheck size={23} /><strong>Your goals. Your control.</strong><p>Review the evidence.<br />Choose what an agent can do.</p><Link href="/dashboard">Manage permissions <ArrowUpRight size={14} /></Link></div><div className="chain-label"><span className="chain-diamond">◆</span>BNB Smart Chain<span className="network-dot" /></div></div>
    </aside>
    <div className="workspace"><header className="topbar"><button aria-label={mobile ? "Close navigation" : "Open navigation"} className="icon-button mobile-menu" onClick={() => setMobile(!mobile)}>{mobile ? <X size={20} /> : <Menu size={20} />}</button><div className="breadcrumb">Marketplace<span>/</span><strong>{path === "/profile" ? "Profile" : path === "/saved" ? "Saved agents" : path === "/dashboard" ? "My agents" : path === "/compare" ? "Comparison" : path.startsWith("/agents/") ? "Agent overview" : "Discover"}</strong></div><div className="topbar-right"><span className="noncustodial"><ShieldCheck size={14} />You stay in control</span><button className="button wallet-button" onClick={() => setWalletOpen(true)}><Wallet size={16} />{browser.connection ? shortAddress(browser.connection.address) : wallet ? shortAddress(wallet.address) : "Connect wallet"}</button></div></header>
      <main id="main">{children}</main><footer className="footer"><span>© {new Date().getFullYear()} Binera Agent Market</span><span>Real agents. Evidence before action.</span><span><Leaf size={13} /> Built on BNB Chain</span></footer>
    </div>
    {compared.length > 0 && path !== "/compare" && <div className="compare-dock"><Columns3 size={20} /><span><strong>{compared.length} {compared.length === 1 ? "agent" : "agents"}</strong> selected</span><button className="text-button" onClick={() => updateCompare([])}>Clear</button><Link className="button primary" href={compared.length < 2 ? `/category/${compared[0].categories[0]}` : "/compare"}>{compared.length < 2 ? "Choose a second agent" : "Compare agents"} <ArrowUpRight size={16} /></Link></div>}
    {compareError && <div role="alert" className="toast">{compareError}<button className="icon-button" aria-label="Dismiss" onClick={() => setCompareError("")}><X size={15} /></button></div>}
    {walletOpen && <div className="modal-backdrop" onClick={() => !busy && setWalletOpen(false)}><section role="dialog" aria-modal="true" aria-labelledby="account-title" className="modal" onClick={e => e.stopPropagation()}><button className="icon-button modal-close" aria-label="Close account dialog" disabled={busy} onClick={() => setWalletOpen(false)}><X size={20} /></button><span className="large-icon"><Wallet size={26} /></span><h2 id="account-title">{wallet ? "Your marketplace account" : "An account you control."}</h2><BrowserWalletPanel browser={browser} account={wallet?.address} onBusyChange={setFundingBusy} /><hr /><p>Your marketplace account uses a passkey to approve agent permissions and paid actions.</p>{error && <ErrorNotice message={error} />}{wallet ? <><div className="address-row"><span className="address">{wallet.address}</span><CopyAddress address={wallet.address} label="marketplace account address" /></div><div className="notice">BNB Smart Chain · Fund this account with BNB for network fees and U for agent fees. Send only assets supported on this network.</div><Link className="button primary full" href="/dashboard" onClick={() => setWalletOpen(false)}>Open my agents</Link><button disabled={busy} className="text-button full" onClick={() => { setWallet(null); setClient(null); setWalletOpen(false); }}>Disconnect this device session</button><small>Disconnecting does not revoke onchain permissions.</small></> : <><button disabled={busy} className="button primary full" onClick={() => connect("recover")}>{busy ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />}Use an existing passkey</button><button disabled={busy} className="button full" onClick={() => connect("create")}>Create a passkey account</button><button disabled={busy} className="text-button full" onClick={() => connect("resume")}>Resume an account saved on this device</button><small>No seed phrase. Your passkey stays on your device. Resume a saved account if it has not made its first transaction yet.</small></>}</section></div>}
  </MarketContext.Provider>;
}
