"use client";
import { useEffect, useRef, useState } from "react";
import { createWalletClient, custom, encodeFunctionData, erc20Abi, getAddress, parseUnits, type Address, type EIP1193Provider } from "viem";
import { bsc } from "viem/chains";
import { Wallet } from "lucide-react";
import { loadTransfers, saveTransfer, type FundingTransfer } from "@/lib/transfers";
import { api, CopyAddress, ErrorNotice, SourceLink } from "./ui";

type Choice = { name: string; provider: EIP1193Provider };
type Connection = Choice & { address: Address; chainId: number };
const networkNames: Record<number, string> = { 1: "Ethereum", 56: "BNB Smart Chain", 97: "BNB Smart Chain Testnet", 137: "Polygon", 8453: "Base", 42161: "Arbitrum One", 10: "OP Mainnet" };
export function useBrowserWallet() {
  const [choices, setChoices] = useState<Choice[]>([]);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    const add = (choice: Choice) => setChoices(items => items.some(i => i.provider === choice.provider) ? items : [...items, choice]);
    const announce = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (typeof detail?.provider?.request === "function" && typeof detail?.info?.name === "string") add({ name: detail.info.name.slice(0, 60), provider: detail.provider });
    };
    window.addEventListener("eip6963:announceProvider", announce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const timer = setTimeout(() => {
      const legacy = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
      if (legacy?.request) add({ name: "Browser wallet", provider: legacy });
    }, 200);
    return () => { clearTimeout(timer); window.removeEventListener("eip6963:announceProvider", announce); };
  }, []);
  useEffect(() => {
    if (!connection) return;
    // Account changes invalidate the sender; network changes update the connected wallet.
    const reset = () => setConnection(null);
    connection.provider.on("accountsChanged", reset);
    const chainChanged = (id: string) => setConnection(current => current?.provider === connection.provider ? { ...current, chainId: Number(id) } : current);
    connection.provider.on("chainChanged", chainChanged);
    connection.provider.on("disconnect", reset);
    return () => {
      connection.provider.removeListener("accountsChanged", reset);
      connection.provider.removeListener("chainChanged", chainChanged);
      connection.provider.removeListener("disconnect", reset);
    };
  }, [connection]);
  async function connect(choice: Choice) {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try {
      const accounts = await choice.provider.request({ method: "eth_requestAccounts" });
      if (!accounts[0]) throw new Error("No account selected");
      const chainId = Number(await choice.provider.request({ method: "eth_chainId" }));
      setConnection({ ...choice, address: getAddress(accounts[0]), chainId });
    } catch { setError("Wallet connection was not completed. Unlock your wallet and approve the connection request."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function ensureBNB() {
    if (!connection) throw new Error("Connect your wallet first.");
    const provider = connection.provider;
    if (Number(await provider.request({ method: "eth_chainId" })) !== 56) {
      try { await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x38" }] }); }
      catch (e) {
        const code = (e as { code?: number; data?: { originalError?: { code?: number } } }).code ?? (e as { data?: { originalError?: { code?: number } } }).data?.originalError?.code;
        if (code !== 4902) throw new Error("Network switch was not approved. Approve BNB Smart Chain in your wallet to continue.");
        await provider.request({ method: "wallet_addEthereumChain", params: [{ chainId: "0x38", chainName: "BNB Smart Chain", nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 }, rpcUrls: ["https://bsc-dataseed.bnbchain.org"], blockExplorerUrls: ["https://bscscan.com"] }] });
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x38" }] });
      }
    }
    const chainId = Number(await provider.request({ method: "eth_chainId" }));
    setConnection(current => current?.provider === provider ? { ...current, chainId } : current);
    if (chainId !== 56) throw new Error("Network switch was not completed. BNB Smart Chain is required.");
  }
  async function switchNetwork() {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try { await ensureBNB(); } catch (e) { setError(e instanceof Error ? e.message : "Network switch failed. Try again in your wallet."); }
    finally { lock.current = false; setBusy(false); }
  }
  return { choices, connection, busy, error, connect, ensureBNB, switchNetwork, disconnect: () => setConnection(null) };
}

export function BrowserWalletPanel({ browser, account, onBusyChange }: { browser: ReturnType<typeof useBrowserWallet>; account?: Address; onBusyChange: (busy: boolean) => void }) {
  const [amount, setAmount] = useState(""); const [token, setToken] = useState("BNB");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [transfers, setTransfers] = useState<FundingTransfer[]>([]);
  const lock = useRef(false);
  useEffect(() => { queueMicrotask(() => setTransfers(loadTransfers())); }, []);
  const mine = transfers.filter(t => t.to.toLowerCase() === account?.toLowerCase());
  const unresolved = mine.some(t => ["unknown", "submitted"].includes(t.status));
  function remember(item: FundingTransfer) { saveTransfer(item); setTransfers(loadTransfers()); }
  async function checkTransfer(item: FundingTransfer) {
    if (!item.hash || lock.current) return;
    lock.current = true; setBusy(true); onBusyChange(true); setError("");
    try {
      const receipt = await api<{ status: string; transfer?: { from: string; to: string; asset: string; amount: string } }>(`/api/transactions/${item.hash}`);
      if (receipt.status === "reverted") remember({ ...item, status: "reverted" });
      else if (receipt.status === "confirmed") {
        const t = receipt.transfer;
        if (!t || t.from.toLowerCase() !== item.from.toLowerCase() || t.to.toLowerCase() !== item.to.toLowerCase() || t.asset !== item.asset || parseUnits(t.amount, 18) !== parseUnits(item.amount, 18)) throw new Error("Transfer does not match the saved funding request.");
        remember({ ...item, status: "confirmed" });
      } else setError("Receipt is still pending. Do not send this transfer again.");
    } catch { setError("The funding transfer could not be reconciled. Inspect the wallet and explorer before sending again."); }
    finally { lock.current = false; setBusy(false); onBusyChange(false); }
  }
  async function fund() {
    if (!account || !browser.connection || lock.current || unresolved) return;
    lock.current = true; setBusy(true); onBusyChange(true); setError("");
    let pending: FundingTransfer | null = null;
    try {
      if (!/^\d{1,18}(\.\d{1,18})?$/.test(amount) || parseUnits(amount, 18) <= 0n) throw new Error("Enter a positive amount with up to 18 decimal places.");
      const { provider, address } = browser.connection;
      const wallet = createWalletClient({ chain: bsc, transport: custom(provider) });
      await browser.ensureBNB();
      const addresses = await wallet.getAddresses();
      if (addresses[0]?.toLowerCase() !== address.toLowerCase()) throw new Error("Your selected wallet changed. Reconnect before transferring.");
      const { erc8183Addresses } = await import("@altananetwork/sdk");
      pending = { id: crypto.randomUUID(), from: address, to: account, asset: token as "BNB" | "U", amount, createdAt: new Date().toISOString(), status: "unknown" };
      remember(pending);
      const result = await wallet.sendTransaction({ account: address, to: token === "BNB" ? account : erc8183Addresses(56).paymentToken, value: token === "BNB" ? parseUnits(amount, 18) : 0n, ...(token === "U" ? { data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [account, parseUnits(amount, 18)] }) } : {}) });
      remember({ ...pending, hash: result, status: "submitted" });
    } catch (e) {
      const rejected = e instanceof Error && (e.name === "UserRejectedRequestError" || /user rejected|user denied/i.test(e.message));
      if (pending && rejected) remember({ ...pending, status: "cancelled" });
      setError(e instanceof Error && /Enter a positive|Network switch|selected wallet changed/.test(e.message) ? e.message : "Transfer was not confirmed. Check your wallet activity before retrying."); }
    finally { lock.current = false; setBusy(false); onBusyChange(false); }
  }
  return <div className="browser-wallet-panel">
    {browser.connection ? <><strong>{browser.connection.name} connected</strong><div className="address-row"><span className="address">{browser.connection.address}</span><CopyAddress address={browser.connection.address} label="wallet address" /></div><p role="status">Network: {networkNames[browser.connection.chainId] ?? `Chain ${browser.connection.chainId}`}</p>{browser.connection.chainId !== 56 && <button className="button full" disabled={busy || browser.busy} onClick={browser.switchNetwork}>{browser.busy ? "Approve network switch?" : "Switch to BNB Smart Chain"}</button>}<button className="text-button full" disabled={busy || browser.busy} onClick={browser.disconnect}>Disconnect wallet</button>
      {account ? <div className="notice"><div><strong>Fund your marketplace account</strong><p>Send BNB for network fees or U for agent fees on BNB Smart Chain.</p><div className="address-row"><span className="address">To: {account}</span><CopyAddress address={account} label="funding address" /></div>{unresolved ? <p>A previous transfer needs confirmation. Check its status below before sending another.</p> : <><label className="field-label">Asset<select value={token} disabled={busy} onChange={e => setToken(e.target.value)}><option>BNB</option><option>U</option></select></label><label className="field-label">Amount<input inputMode="decimal" value={amount} disabled={busy} onChange={e => setAmount(e.target.value)} /></label><button className="button full" disabled={busy || browser.busy || !amount} onClick={fund}>{busy ? "Review in your walletâ€¦" : "Review transfer in wallet"}</button></>}</div></div> : <p>Next, create or unlock your marketplace account below to activate agents. Your connected wallet can fund it.</p>}
    </> : <><p>Connect your browser wallet. Connecting does not move funds or grant agent permissions.</p>{browser.choices.length ? browser.choices.map((choice, index) => <button className="button full" key={index} disabled={browser.busy} onClick={() => browser.connect(choice)}><Wallet size={17} />{browser.busy ? "Check your walletâ€¦" : `Connect ${choice.name}`}</button>) : <div className="notice">No browser wallet detected. Enable MetaMask, Rabby or another Ethereum wallet, then reload this page. On mobile, open this site in your walletâ€™s browser.</div>}</>}
    {mine.length > 0 && <details open={unresolved}><summary>Funding history</summary>{mine.map(item => <div className="notice" key={item.id}><div><strong>{item.amount} {item.asset} ? {item.status}</strong>{item.hash ? <><SourceLink href={`https://bscscan.com/tx/${item.hash}`}>Inspect transaction</SourceLink><button className="text-button" disabled={busy} onClick={() => checkTransfer(item)}>Check receipt</button></> : item.status === "unknown" ? <><p>Check your wallet activity. If it was sent, paste the transaction hash to reconcile it.</p><label className="field-label">Transaction hash<input maxLength={66} onChange={e => { if (/^0x[0-9a-f]{64}$/i.test(e.target.value)) remember({ ...item, hash: e.target.value, status: "submitted" }); }} /></label><button className="text-button" disabled={busy} onClick={() => { if (window.confirm("Only continue if your wallet confirms this transfer was never broadcast. A pending transfer must be reconciled instead.")) remember({ ...item, status: "cancelled" }); }}>I verified that no transfer was sent</button></> : null}</div></div>)}</details>}
    {(error || browser.error) && <ErrorNotice message={error || browser.error} />}
  </div>;
}
