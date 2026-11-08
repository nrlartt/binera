"use client";
import { useEffect, useRef, useState } from "react";
import type { Address, EIP1193Provider } from "viem";

type Raw = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };

export function useEvmWallet() {
  const [provider, setProvider] = useState<EIP1193Provider | null>(null);
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const discovered = useRef<EIP1193Provider | null>(null);

  useEffect(() => {
    const capture = (event: Event) => {
      const detail = (event as unknown as CustomEvent).detail;
      if (typeof detail?.provider?.request === "function" && !discovered.current) { discovered.current = detail.provider; setProvider(detail.provider); }
    };
    window.addEventListener("eip6963:announceProvider", capture as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const timer = setTimeout(() => {
      const legacy = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
      if (legacy?.request && !discovered.current) { discovered.current = legacy; setProvider(legacy); }
    }, 250);
    return () => { clearTimeout(timer); window.removeEventListener("eip6963:announceProvider", capture as EventListener); };
  }, []);

  async function connect() {
    setBusy(true); setError("");
    try {
      const chosen = provider ?? discovered.current ?? (window as Window & { ethereum?: EIP1193Provider }).ethereum;
      if (!chosen?.request) throw new Error("No browser wallet found. Install MetaMask or Rabby.");
      const accounts = await chosen.request({ method: "eth_requestAccounts" }) as string[];
      if (!accounts[0]) throw new Error("No wallet account was selected.");
      setProvider(chosen); setAccount(accounts[0] as Address); setChainId(Number(await chosen.request({ method: "eth_chainId" })));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function switchTo(target: number) {
    if (!provider) return;
    setError("");
    const raw = provider as unknown as Raw;
    const hex = `0x${target.toString(16)}`;
    try { await raw.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] }); }
    catch (e) {
      if ((e as { code?: number }).code !== 4902) { setError((e as Error).message); return; }
      await raw.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: hex,
          chainName: target === 56 ? "BNB Smart Chain" : "BNB Smart Chain Testnet",
          nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
          rpcUrls: [target === 56 ? "https://bsc-dataseed.bnbchain.org" : "https://data-seed-prebsc-1-s1.binance.org:8545"],
          blockExplorerUrls: [target === 56 ? "https://bscscan.com" : "https://testnet.bscscan.com"],
        }],
      });
    }
    setChainId(Number(await raw.request({ method: "eth_chainId" })));
  }

  async function waitForReceipt(hash: string) {
    if (!provider) throw new Error("Wallet disconnected.");
    const raw = provider as unknown as Raw;
    const started = Date.now();
    while (Date.now() - started < 5 * 60 * 1000) {
      const receipt = await raw.request({ method: "eth_getTransactionReceipt", params: [hash] }) as { status?: string } | null;
      if (receipt) {
        if (receipt.status === "0x0") throw new Error("The transaction reverted.");
        return receipt;
      }
      await new Promise(resolve => setTimeout(resolve, 2500));
    }
    throw new Error("The transaction was not mined within five minutes.");
  }

  async function send(data: `0x${string}`) {
    if (!provider || !account) throw new Error("Connect a wallet first.");
    setBusy(true); setError("");
    try {
      const hash = await (provider as unknown as Raw).request({ method: "eth_sendTransaction", params: [{ from: account, data }] }) as string;
      await waitForReceipt(hash);
      return hash;
    } catch (e) { setError((e as Error).message); throw e; } finally { setBusy(false); }
  }

  return { provider, account, chainId, busy, error, setError, connect, switchTo, send };
}
