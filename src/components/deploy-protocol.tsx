"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, LoaderCircle, Rocket, ShieldAlert, Wallet } from "lucide-react";
import { encodeDeployData, isAddress, type Abi, type Address, type EIP1193Provider } from "viem";
import { contractArtifacts, type ContractName } from "@/lib/contracts/artifacts";
import { ErrorNotice, shortAddress } from "./ui";

type RawProvider = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };
const raw = (provider: EIP1193Provider) => provider as unknown as RawProvider;

type StepState = { state: "idle" | "sending" | "pending" | "confirmed" | "failed"; hash?: string; address?: string; error?: string };
const steps: { name: ContractName; args: (token: Address, arbiter: Address, deployer: Address) => unknown[]; label: string }[] = [
  { name: "BineraStake", args: (token, arbiter) => [token, arbiter], label: "Agent stake" },
  { name: "BineraReputation", args: (_token, _arbiter, deployer) => [deployer], label: "Reputation" },
  { name: "BineraArbitration", args: () => [], label: "Arbitration" },
  { name: "BineraBountyVault", args: token => [token], label: "Bounty vault" },
];
const networks: Record<number, { name: string; explorer: string }> = {
  56: { name: "BNB Smart Chain", explorer: "https://bscscan.com" },
  97: { name: "BNB Smart Chain Testnet", explorer: "https://testnet.bscscan.com" },
};

export function DeployProtocol() {
  const [provider, setProvider] = useState<EIP1193Provider | null>(null);
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState(0);
  const [token, setToken] = useState("0x55d398326f99059fF775485246999027B3197955");
  const [arbiter, setArbiter] = useState("");
  const [status, setStatus] = useState<Record<string, StepState>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [operatorToken, setOperatorToken] = useState("");
  const [activated, setActivated] = useState(false);
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
    setError("");
    try {
      const chosen = provider ?? discovered.current ?? (window as Window & { ethereum?: EIP1193Provider }).ethereum;
      if (!chosen?.request) throw new Error("No browser wallet found. Install MetaMask or Rabby to deploy from this page.");
      const accounts = await chosen.request({ method: "eth_requestAccounts" }) as string[];
      if (!accounts[0]) throw new Error("No wallet account was selected.");
      const id = Number(await chosen.request({ method: "eth_chainId" }));
      setProvider(chosen); setAccount(accounts[0] as Address); setChainId(id);
      if (!arbiter) setArbiter(accounts[0]);
    } catch (e) { setError((e as Error).message); }
  }

  async function switchTo(target: 56 | 97) {
    if (!provider) return;
    setError("");
    const hex = `0x${target.toString(16)}`;
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
    } catch (e) {
      const code = (e as { code?: number }).code;
      if (code !== 4902) { setError((e as Error).message); return; }
      await provider.request({
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
    setChainId(Number(await provider.request({ method: "eth_chainId" })));
  }

  async function waitForReceipt(hash: string): Promise<{ contractAddress?: string; status?: string }> {
    if (!provider) throw new Error("Wallet disconnected.");
    const started = Date.now();
    while (Date.now() - started < 5 * 60 * 1000) {
      const receipt = await raw(provider).request({ method: "eth_getTransactionReceipt", params: [hash] }) as { contractAddress?: string; status?: string } | null;
      if (receipt) return receipt;
      await new Promise(resolve => setTimeout(resolve, 2500));
    }
    throw new Error("The deployment transaction was not mined within five minutes. Check the explorer before retrying.");
  }

  async function deploy() {
    if (!provider || !account) { await connect(); return; }
    if (!isAddress(token)) { setError("Enter the ERC-20 payment token address used for stake and bounties."); return; }
    if (!isAddress(arbiter)) { setError("Enter the arbiter address (a multisig or timelock is recommended)."); return; }
    if (chainId !== 56 && chainId !== 97) { setError("Switch the wallet to BNB Smart Chain or its testnet first."); return; }
    setBusy(true); setError(""); setStatus({});
    try {
      for (const step of steps) {
        setStatus(current => ({ ...current, [step.name]: { state: "sending" } }));
        const artifact = contractArtifacts[step.name];
        const data = encodeDeployData({ abi: artifact.abi as Abi, bytecode: artifact.bytecode as `0x${string}`, args: step.args(token as Address, arbiter as Address, account) });
        const hash = await raw(provider).request({ method: "eth_sendTransaction", params: [{ from: account, data }] }) as string;
        setStatus(current => ({ ...current, [step.name]: { state: "pending", hash } }));
        const receipt = await waitForReceipt(hash);
        if (receipt.status === "0x0" || !receipt.contractAddress) throw new Error(`${step.label} deployment reverted.`);
        const code = await raw(provider).request({ method: "eth_getCode", params: [receipt.contractAddress, "latest"] }) as string;
        if (!code || code === "0x") throw new Error(`${step.label} has no bytecode at the reported address.`);
        setStatus(current => ({ ...current, [step.name]: { state: "confirmed", hash, address: receipt.contractAddress } }));
      }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const deployed = steps.every(step => status[step.name]?.state === "confirmed");
  const envBlock = deployed ? [
    `BINERA_STAKE_ADDRESS=${status.BineraStake.address}`,
    `BINERA_REPUTATION_ADDRESS=${status.BineraReputation.address}`,
    `BINERA_ARBITRATION_ADDRESS=${status.BineraArbitration.address}`,
    `BINERA_BOUNTY_VAULT_ADDRESS=${status.BineraBountyVault.address}`,
    `BINERA_PAYMENT_TOKEN_ADDRESS=${token}`,
  ].join("\n") : "";

  async function copyEnv() {
    try { await navigator.clipboard.writeText(envBlock); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setError("Could not copy. Select the block manually."); }
  }

  async function activate() {
    setError("");
    try {
      if (operatorToken.length < 16) throw new Error("Enter the operator token configured on the server.");
      const response = await fetch("/api/protocol/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-operator-token": operatorToken },
        body: JSON.stringify({
          addresses: {
            stake: status.BineraStake.address ?? "",
            reputation: status.BineraReputation.address ?? "",
            arbitration: status.BineraArbitration.address ?? "",
            vault: status.BineraBountyVault.address ?? "",
          },
          paymentToken: token,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Activation failed.");
      setActivated(true);
    } catch (e) { setError((e as Error).message); }
  }

  const network = networks[chainId];

  return <div className="page protocol-page deploy-page">
    <Link className="text-button" href="/protocol"><ArrowLeft size={14} />Protocol status</Link>
    <div className="eyebrow" style={{ marginTop: 14 }}>OPERATOR DEPLOYMENT</div>
    <div className="page-heading"><div><h1>Deploy with your wallet.</h1><p>The contracts are deployed from this browser by your own wallet. No key is sent to or stored by Binera. Gas is paid by the deploying wallet; nothing is deployed until you sign each transaction.</p></div></div>
    {error && <ErrorNotice message={error} />}

    <section className="research-card deploy-panel">
      <h3><Wallet size={18} />1. Wallet &amp; network</h3>
      {!account ? <button className="button primary" onClick={() => void connect()}><Wallet size={15} />Connect wallet</button> : <div className="deploy-wallet"><span>{shortAddress(account)}</span><span className={`badge ${network ? "verified" : "subtle"}`}>{network ? network.name : `Unsupported chain ${chainId}`}</span>{chainId !== 56 && <button className="text-button" onClick={() => void switchTo(56)}>Switch to BSC</button>}{chainId !== 97 && <button className="text-button" onClick={() => void switchTo(97)}>Switch to testnet</button>}</div>}
      <p>Deploy to testnet first, verify each address on BscScan, run a funded dispute and bounty scenario, then repeat on mainnet.</p>
    </section>

    <section className="research-card deploy-panel">
      <h3><ShieldAlert size={18} />2. Parameters</h3>
      <label className="field-label">Payment token (ERC-20)<input value={token} onChange={e => setToken(e.target.value)} placeholder="0x… U on BSC" spellCheck={false} /></label>
      <label className="field-label">Arbiter (multisig or timelock)<input value={arbiter} onChange={e => setArbiter(e.target.value)} placeholder="0x…" spellCheck={false} /></label>
      <p>The arbiter can slash staked balances and must not be a hot wallet for production. The reputation recorder is the deploying wallet; move it to an operator address you control after deployment.</p>
      <button className="button primary" disabled={busy || !account} onClick={() => void deploy()}>{busy ? <LoaderCircle size={15} className="spin" /> : <Rocket size={15} />}{busy ? "Waiting for wallet confirmations…" : "Deploy four contracts"}</button>
    </section>

    <section className="research-card deploy-panel">
      <h3><Rocket size={18} />3. Deployment progress</h3>
      <ol className="deploy-steps">{steps.map(step => {
        const state = status[step.name] ?? { state: "idle" };
        return <li key={step.name} className={state.state}>
          <div><strong>{step.label}</strong><small>{step.name}</small></div>
          <span className={`badge ${state.state === "confirmed" ? "verified" : "subtle"}`}>{state.state}</span>
          {state.hash && network && <a href={`${network.explorer}/tx/${state.hash}`} target="_blank" rel="noopener noreferrer">Transaction</a>}
          {state.address && <code>{state.address}</code>}
          {state.state === "confirmed" && <Check size={14} />}
        </li>;
      })}</ol>
    </section>

    {deployed && <section className="research-card deploy-panel">
      <h3><Check size={18} />4. Activate this deployment</h3>
      <p>Add the environment block and restart, or activate this deployment on the server with the operator token (never stored in the browser). Protocol status then verifies bytecode at each address before showing it as live.</p>
      <div className="deploy-env"><pre>{envBlock}</pre><button className="button" onClick={() => void copyEnv()}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy env block"}</button></div>
      <label className="field-label">Operator token<input type="password" value={operatorToken} onChange={e => setOperatorToken(e.target.value)} placeholder="Configured as OPERATOR_TOKEN on the server" autoComplete="off" /></label>
      {activated ? <div className="notice"><div><strong>Deployment activated</strong><p><Link href="/protocol">Open protocol status</Link> to verify each contract against BSC bytecode.</p></div></div> : <button className="button primary" onClick={() => void activate()}><ShieldAlert size={15} />Activate on this server</button>}
      <p><small>Activation requires the server operator to set OPERATOR_TOKEN. It writes only public contract addresses to the ignored runtime file; no key is ever accepted.</small></p>
    </section>}
  </div>;
}
