"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { Bookmark, UserRound, BookOpen, Compass, Layers3, Columns3, ArrowUpRight, Menu, X, Wallet, LoaderCircle, Leaf, ShieldCheck } from "lucide-react";
import type { Client, CreateWalletResult, PasskeySigner } from "@altananetwork/sdk";
import { categories, type Agent } from "@/lib/domain";
import { api, CategoryIcon, CopyAddress, ErrorNotice, shortAddress, SourceLink } from "./ui";
import { BrowserWalletPanel, useBrowserWallet } from "./browser-wallet";
import { readPasskeyAccounts, recoverPasskeyPublicKey, savePasskeyAccounts, type SavedPasskeyAccount } from "@/lib/passkey-accounts";
import { useDialog } from "./use-dialog";

type Context = { compared: Agent[]; toggleCompare: (agent: Agent) => void; clearCompare: () => void; replaceCompared: (agents: Agent[]) => void; wallet: CreateWalletResult | null; client: Client | null; openWallet: () => void };
const MarketContext = createContext<Context | null>(null);
export const useMarket = () => { const context = useContext(MarketContext); if (!context) throw new Error("Missing marketplace context"); return context; };
export function Shell({ children }: { children: React.ReactNode }) {
  const browser = useBrowserWallet();
  const path = usePathname(); const [mobile, setMobile] = useState(false);
  const [compared, setCompared] = useState<Agent[]>([]); const [wallet, setWallet] = useState<CreateWalletResult | null>(null); const [client, setClient] = useState<Client | null>(null);
  const [walletOpen, setWalletOpen] = useState(false); const [passkeyBusy, setBusy] = useState(false); const [fundingBusy, setFundingBusy] = useState(false); const busy = passkeyBusy || fundingBusy || browser.busy; const [error, setError] = useState(""); const [compareError, setCompareError] = useState("");
  const [savedAccounts, setSavedAccounts] = useState<SavedPasskeyAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState(""); const [newAccountConfirmed, setNewAccountConfirmed] = useState(false);
  const [savedBalance, setSavedBalance] = useState<{ native: string; payment: string; keys: unknown[]; observedAt: string } | null>(null);
  useEffect(() => { try { const accounts = readPasskeyAccounts(localStorage, location.hostname); queueMicrotask(() => { setSavedAccounts(accounts); setSelectedAccount(accounts[0]?.credential.id || ""); }); } catch { queueMicrotask(() => setError("Saved account references could not be read. Keep browser data and any account backup; do not create a replacement account to recover funds.")); } }, []);
  useEffect(() => {
    const account = savedAccounts.find(item => item.credential.id === selectedAccount);
    if (!account) return;
    const controller = new AbortController();
    api<{ native: string; payment: string; keys: unknown[]; observedAt: string }>(`/api/account/${account.address}?offset=0`, { signal: controller.signal }).then(value => { if (!controller.signal.aborted) setSavedBalance(value); }).catch(() => { if (!controller.signal.aborted) setSavedBalance(null); });
    return () => controller.abort();
  }, [savedAccounts, selectedAccount]);
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
      let w: CreateWalletResult & { signer: PasskeySigner };
      const accounts = readPasskeyAccounts(localStorage, location.hostname);
      if (mode === "create") {
        if (!newAccountConfirmed) throw new Error("Confirm that you want a separate empty account. Creating a passkey does not recover an older balance.");
        // Migrate the legacy handle before any new account is created.
        savePasskeyAccounts(localStorage, [], location.hostname);
        w = await c.createPasskeyWallet({ name: `Binera ${new Date().toISOString()}`, rpId: location.hostname });
      } else {
        const selected = mode === "resume" ? accounts.find(a => a.credential.id === selectedAccount) : undefined;
        if (mode === "resume" && !selected) throw new Error("No saved account selected. Use an existing passkey or import your account references.");
        if (selected) {
          const credentialId = Uint8Array.from(atob(selected.credential.id.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
          const assertion = await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), rpId: location.hostname, userVerification: "required", allowCredentials: [{ type: "public-key", id: credentialId }] } }) as PublicKeyCredential | null;
          if (!assertion || assertion.id !== selected.credential.id) throw new Error("The selected passkey was not unlocked. Your saved accounts have not been removed.");
          const userHandle = (assertion.response as AuthenticatorAssertionResponse).userHandle;
          if (userHandle && ("0x" + [...new Uint8Array(userHandle)].map(b => b.toString(16).padStart(2, "0")).join("")).toLowerCase() !== selected.address.toLowerCase()) throw new Error("This passkey does not match the saved account address.");
          w = { address: selected.address, signer: sdk.signerFromPasskey(selected.credential) };
        } else {
          const webAuthn = await import("ox/WebAuthnP256");
          const challenge = () => ("0x" + [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
          const first = await webAuthn.sign({ challenge: challenge(), rpId: location.hostname, userVerification: "required" });
          const second = await webAuthn.sign({ challenge: challenge(), credentialId: first.id, rpId: location.hostname, userVerification: "required" });
          if (first.id !== second.id) throw new Error("Passkey confirmations did not use the same credential.");
          const handles = [first, second].map(proof => (proof.raw.response as AuthenticatorAssertionResponse).userHandle).map(handle => handle ? new Uint8Array(handle) : null);
          if (handles.some(handle => handle?.length !== 20) || !handles[0] || !handles[1]) throw new Error("This passkey does not contain a recoverable marketplace account address.");
          const address = ("0x" + [...handles[0]].map(b => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
          const secondAddress = "0x" + [...handles[1]].map(b => b.toString(16).padStart(2, "0")).join("");
          if (address.toLowerCase() !== secondAddress.toLowerCase()) throw new Error("Passkey confirmations returned different account addresses.");
          const publicKey = recoverPasskeyPublicKey([first, second]);
          w = { address, signer: sdk.signerFromPasskey({ kind: "webauthn", id: first.id, publicKey, rpId: location.hostname }) };
        }
      }
      if (w.signer.credential.kind === "webauthn") {
        const accounts = savePasskeyAccounts(localStorage, [{ address: w.address, credential: { ...w.signer.credential, rpId: location.hostname } }], location.hostname);
        setSavedAccounts(accounts); setSelectedAccount(w.signer.credential.id);
      }
      setClient(c); setWallet(w); setWalletOpen(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (/No saved account|Confirm that|does not match|not unlocked|original site|Conflicting|Two passkey|unambiguously|same credential|recoverable marketplace|different account/.test(message)) setError(message);
      else setError("Account unlock could not be completed. No saved reference was deleted. Try the original browser and passkey device; a new account will not recover an older balance.");
    } finally { setBusy(false); }
  }
  function exportAccounts() {
    try { const accounts = readPasskeyAccounts(localStorage, location.hostname); const url = URL.createObjectURL(new Blob([JSON.stringify(accounts, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = "binera-passkey-account-references.json"; link.click(); URL.revokeObjectURL(url); } catch { setError("Account references could not be exported. Keep this browser's data."); }
  }
  async function importAccounts(file?: File) {
    if (!file) return;
    try { if (file.size > 1000000) throw new Error(); const accounts = savePasskeyAccounts(localStorage, JSON.parse(await file.text()), location.hostname); setSavedAccounts(accounts); setSelectedAccount(accounts[0]?.credential.id || ""); setError(""); } catch { setError("This account-reference backup is invalid, conflicts with saved references, or belongs to a different domain. Existing records were not replaced."); }
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
    <div className="workspace"><header className="topbar"><button aria-label={mobile ? "Close navigation" : "Open navigation"} className="icon-button mobile-menu" onClick={() => setMobile(!mobile)}>{mobile ? <X size={20} /> : <Menu size={20} />}</button><div className="breadcrumb">Marketplace<span>/</span><strong>{path === "/profile" ? "Profile" : path === "/saved" ? "Saved agents" : path === "/dashboard" ? "My agents" : path === "/compare" ? "Comparison" : path.startsWith("/agents/") ? "Agent overview" : "Discover"}</strong></div><div className="topbar-right"><span className="noncustodial"><ShieldCheck size={14} />You stay in control</span><button className="button wallet-button" onClick={() => setWalletOpen(true)}><Wallet size={16} />{browser.connection ? shortAddress(browser.connection.address) : wallet ? shortAddress(wallet.address) : savedAccounts.length ? "Unlock account" : "Connect wallet"}</button></div></header>
      <main id="main">{children}</main><footer className="footer"><span>© {new Date().getFullYear()} Binera Agent Market</span><span>Real agents. Evidence before action.</span><span><Leaf size={13} /> Built on BNB Chain</span></footer>
    </div>
    {compared.length > 0 && path !== "/compare" && <div className="compare-dock"><Columns3 size={20} /><span><strong>{compared.length} {compared.length === 1 ? "agent" : "agents"}</strong> selected</span><button className="text-button" onClick={() => updateCompare([])}>Clear</button><Link className="button primary" href={compared.length < 2 ? `/category/${compared[0].categories[0]}` : "/compare"}>{compared.length < 2 ? "Choose a second agent" : "Compare agents"} <ArrowUpRight size={16} /></Link></div>}
    {compareError && <div role="alert" className="toast">{compareError}<button className="icon-button" aria-label="Dismiss" onClick={() => setCompareError("")}><X size={15} /></button></div>}
    {walletOpen && <div className="modal-backdrop" onClick={() => !busy && setWalletOpen(false)}><section role="dialog" aria-modal="true" aria-labelledby="account-title" className="modal" onClick={e => e.stopPropagation()}><button className="icon-button modal-close" aria-label="Close account dialog" disabled={busy} onClick={() => setWalletOpen(false)}><X size={20} /></button><span className="large-icon"><Wallet size={26} /></span><h2 id="account-title">{wallet ? "Your marketplace account" : "An account you control."}</h2><BrowserWalletPanel browser={browser} account={wallet?.address} onBusyChange={setFundingBusy} /><hr /><div className="account-recovery"><p>Reloading or updating Binera does not require a new account. Unlock your existing passkey to return to the same address.</p>{savedAccounts.length > 0 && <><label>Saved marketplace account<select aria-label="Saved marketplace account" disabled={busy} value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}>{savedAccounts.map(a => <option key={a.credential.id} value={a.credential.id}>{a.address}</option>)}</select></label>{savedBalance && <div className="notice"><div><strong>{savedBalance.native} BNB · {savedBalance.payment} U</strong><p>{savedBalance.keys.length ? `${savedBalance.keys.length} onchain key records loaded.` : "No onchain key registered yet. A saved reference or two-passkey recovery is required."}</p><SourceLink href={`https://bscscan.com/address/${savedAccounts.find(a => a.credential.id === selectedAccount)?.address}`}>Inspect saved account</SourceLink></div></div>}<button className="button primary full" disabled={busy} onClick={() => connect("resume")}>Unlock saved account</button><button className="text-button full" disabled={busy} onClick={exportAccounts}>Export account references</button></>}<label className="button full">Import account references<input type="file" accept=".json,application/json" disabled={busy} onChange={e => { void importAccounts(e.target.files?.[0]); e.target.value = ""; }} /></label><small>References contain public metadata, not the passkey. Keep the original passkey in your password manager. Job exports are a different file.</small></div><p>Your marketplace account uses a passkey to approve agent permissions and paid actions.</p>{error && <ErrorNotice message={error} />}{wallet ? <><div className="address-row"><span className="address">{wallet.address}</span><CopyAddress address={wallet.address} label="marketplace account address" /></div><div className="notice">BNB Smart Chain · Fund this account with BNB for network fees and U for agent fees. Send only assets supported on this network.</div><Link className="button primary full" href="/dashboard" onClick={() => setWalletOpen(false)}>Open my agents</Link><button disabled={busy} className="text-button full" onClick={() => { setWallet(null); setClient(null); setWalletOpen(false); }}>Disconnect this device session</button><small>Disconnecting does not revoke onchain permissions.</small></> : <><button disabled={busy} className="button primary full" onClick={() => connect("recover")}>{busy ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />}Use an existing passkey</button><small>This may request two confirmations to rebuild a missing public account reference.</small><label className="consent"><input type="checkbox" checked={newAccountConfirmed} disabled={busy} onChange={e => setNewAccountConfirmed(e.target.checked)} />I want a separate empty account. This will not recover an existing balance.</label><button disabled={busy || !newAccountConfirmed} className="button full" onClick={() => connect("create")}>Create a passkey account</button><small>No seed phrase. Your passkey stays on your device. A saved account can be unlocked before or after its first transaction. Creating another account keeps existing references.</small></>}</section></div>}
  </MarketContext.Provider>;
}
