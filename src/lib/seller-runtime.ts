/**
 * First-party A2A seller runtime.
 *
 * Serves an agent card, signs ERC-8183 quotes with the seller's own key, turns
 * a funded job into a real research manifest, submits the manifest hash on
 * chain and serves the exact bytes at the delivery URL. No key is sent to the
 * marketplace or stored by it.
 */
import { keccak256, parseAbi, toHex, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  BNB, erc8183Addresses, encodeErc8183Manifest, erc8183ManifestHash,
  getErc8183Job, signerFromPrivateKey, submitErc8183Deliverable,
  type Erc8183DeliverableManifest,
} from "@altananetwork/sdk";
import { canonicalJson } from "./canonical";
import { sanitizeQuoteText } from "./quote";
import { PANCAKE_FACTORY, USDT, WBNB, publicClient } from "./server/chain";

export const DEFAULT_CURRENCY = erc8183Addresses(56).paymentToken as Address;
const NETWORK = { ...BNB, publicRpcUrl: process.env.BSC_RPC_URL || BNB.publicRpcUrl };
const priceAbi = parseAbi(["function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint32,bool)", "function token0() view returns (address)", "function token1() view returns (address)", "function fee() view returns (uint24)", "function decimals() view returns (uint8)", "function symbol() view returns (string)"]);

export type SellerConfig = {
  privateKey: Hex;
  baseUrl: string;
  price: string;
  currency?: Address;
  name: string;
  description?: string;
  now?: () => number;
};

export function sellerCard(config: SellerConfig) {
  return {
    name: config.name,
    description: config.description ?? "Sourced BNB Chain research with explicit sources, block numbers and risk flags.",
    url: config.baseUrl.replace(/\/$/, ""),
    skills: [
      { id: "negotiate", name: "Negotiate a research task", description: "Return a signed, canonical quote bound to the exact task." },
      { id: "notify_funded", name: "Deliver a funded research job", description: "Produce a sourced manifest and submit its hash on chain." },
    ],
  };
}

export async function buildSellerQuote(task: string, config: SellerConfig) {
  const account = privateKeyToAccount(config.privateKey);
  const addresses = erc8183Addresses(56);
  const now = config.now ? config.now() : Math.floor(Date.now() / 1000);
  const negotiated_at = now;
  const quote_expires_at = now + 900;
  const currency = config.currency ?? DEFAULT_CURRENCY;
  const deliverables = "A sourced research report with observed block numbers, timestamps, explicit assumptions and risk flags.";
  const quality_standards = "Use real chain reads. Do not execute swaps, repay debt or move user funds. Identify unavailable information instead of guessing.";
  const content = {
    version: 1,
    negotiated_at,
    quote_expires_at,
    task: sanitizeQuoteText(task),
    terms: { deliverables: sanitizeQuoteText(deliverables), quality_standards: sanitizeQuoteText(quality_standards) },
    price: config.price,
    currency,
    chain_id: 56,
    verifying_contract: addresses.commerce,
  };
  const hash = keccak256(toHex(canonicalJson(content)));
  const provider_sig = await account.signMessage({ message: hash });
  return {
    request: { task_description: task },
    response: {
      accepted: true as const,
      terms: { deliverables, quality_standards: quality_standards, price: config.price, currency },
      negotiated_at,
      quote_expires_at,
      estimated_completion_seconds: 300,
    },
    negotiation_hash: hash,
    provider_sig,
    chain_id: 56 as const,
    verifying_contract: addresses.commerce,
  };
}

function format(value: bigint | number | string, maximumFractionDigits = 6) {
  return Number(value).toLocaleString("en-US", { maximumFractionDigits });
}

/** Real chain reads only. Missing facts are reported as unavailable. */
export async function collectResearch(task: string): Promise<{ content: string; metadata: Record<string, unknown> }> {
  const block = await publicClient.getBlock();
  const observedAt = new Date(Number(block.timestamp) * 1000).toISOString();
  const match = task.match(/0x[0-9a-fA-F]{40}/);
  const lines: string[] = [];
  const sources: string[] = [];
  const limitations: string[] = [];
  lines.push(`# Research deliverable`, "", `Task: ${task}`, "", `Observed block: ${block.number} (chain 56)`, `Source time: ${observedAt}`, "");
  if (match) {
    const address = match[0] as Address;
    lines.push(`## Target ${address}`, "");
    const [token0, token1, fee, slot] = await Promise.all([
      publicClient.readContract({ address, abi: priceAbi, functionName: "token0", blockNumber: block.number }).catch(() => null),
      publicClient.readContract({ address, abi: priceAbi, functionName: "token1", blockNumber: block.number }).catch(() => null),
      publicClient.readContract({ address, abi: priceAbi, functionName: "fee", blockNumber: block.number }).catch(() => null),
      publicClient.readContract({ address, abi: priceAbi, functionName: "slot0", blockNumber: block.number }).catch(() => null),
    ]);
    if (token0 && token1 && fee !== null && slot) {
      const [d0, d1, s0, s1] = await Promise.all([
        publicClient.readContract({ address: token0, abi: priceAbi, functionName: "decimals", blockNumber: block.number }).catch(() => 18),
        publicClient.readContract({ address: token1, abi: priceAbi, functionName: "decimals", blockNumber: block.number }).catch(() => 18),
        publicClient.readContract({ address: token0, abi: priceAbi, functionName: "symbol", blockNumber: block.number }).catch(() => "token0"),
        publicClient.readContract({ address: token1, abi: priceAbi, functionName: "symbol", blockNumber: block.number }).catch(() => "token1"),
      ]);
      const registered = await publicClient.readContract({ address: PANCAKE_FACTORY, abi: parseAbi(["function getPool(address,address,uint24) view returns (address)"]), functionName: "getPool", args: [token0, token1, fee], blockNumber: block.number }).catch(() => null);
      const ratio = (Number(slot[0]) / 2 ** 96) ** 2;
      const adjusted = ratio * 10 ** (Number(d0) - Number(d1));
      const price = token0.toLowerCase() === WBNB.toLowerCase() ? adjusted : 1 / adjusted;
      lines.push(`- Pair: ${s0} / ${s1}`, `- Fee tier: ${Number(fee) / 10_000}%`, `- Spot ratio: ${price.toPrecision(8)}`, `- Factory registered: ${registered?.toLowerCase() === address.toLowerCase() ? "checked onchain" : "NOT confirmed by the official factory"}`, "");
      sources.push(`https://bscscan.com/address/${address}`);
      limitations.push("Spot price at one block; not an executable quote, APY, TVL or risk rating.");
    } else {
      const [balance, code] = await Promise.all([publicClient.getBalance({ address, blockNumber: block.number }).catch(() => null), publicClient.getCode({ address, blockNumber: block.number }).catch(() => null)]);
      lines.push(`- Native balance: ${balance === null ? "unavailable" : format(balance)} BNB`, `- Contract code: ${code && code !== "0x" ? "present" : "none"}`, "");
      sources.push(`https://bscscan.com/address/${address}`);
      limitations.push("Balance and code presence do not describe strategy, solvency or risk.");
    }
  } else {
    const pool = await publicClient.readContract({ address: PANCAKE_FACTORY, abi: parseAbi(["function getPool(address,address,uint24) view returns (address)"]), functionName: "getPool", args: [WBNB, USDT, 500], blockNumber: block.number }).catch(() => null);
    lines.push(`## Market context`, "", `- Reference pool: WBNB / USDT`, `- Pool: ${pool ?? "unavailable"}`, "");
    sources.push("https://developer.pancakeswap.finance/contracts/v3/addresses");
    limitations.push("No target address was supplied; this is market context only.");
  }
  lines.push(`## Sources`, ...sources.map(source => `- ${source}`), "", `## Limitations`, ...limitations.map(item => `- ${item}`), "- Research only. No transaction was executed and no position was changed.", "");
  return { content: lines.join("\n"), metadata: { task, observed_block: block.number.toString(), observed_at: observedAt, category: "research", sources } };
}

export type SellerDeps = {
  getJob: (jobId: string) => Promise<{ provider: string; statusName: string; description: string }>;
  submit: (input: { jobId: string; manifest: Erc8183DeliverableManifest; deliverableUrl: string }) => Promise<unknown>;
  collect: (task: string) => Promise<{ content: string; metadata: Record<string, unknown> }>;
};

export function createSeller(config: SellerConfig, deps?: Partial<SellerDeps>) {
  const account = privateKeyToAccount(config.privateKey);
  const manifests = new Map<string, string>();
  const resolved: SellerDeps = {
    getJob: deps?.getJob ?? (async jobId => getErc8183Job(NETWORK, BigInt(jobId)) as Promise<{ provider: string; statusName: string; description: string }>),
    submit: deps?.submit ?? (async ({ jobId, manifest, deliverableUrl }) => submitErc8183Deliverable({ address: account.address }, signerFromPrivateKey(config.privateKey), { jobId: BigInt(jobId), manifest, deliverableUrl }, { network: NETWORK })),
    collect: deps?.collect ?? collectResearch,
  };

  async function handle(payload: unknown) {
    const rpc = payload as { id?: unknown; method?: string; params?: { message?: { parts?: { kind?: string; data?: Record<string, unknown> }[] } } };
    const respond = (data: unknown) => ({ jsonrpc: "2.0", id: rpc.id ?? null, result: { parts: [{ kind: "data", data }] } });
    if (rpc.method !== "message/send") throw new Error("Unsupported JSON-RPC method.");
    const data = rpc.params?.message?.parts?.find(part => part.kind === "data")?.data;
    if (!data || typeof data !== "object") throw new Error("A data part is required.");
    const skill = String((data as { skill?: unknown }).skill ?? "");
    if (skill === "negotiate") {
      const task = String((data as { task_description?: unknown }).task_description ?? "").slice(0, 1200);
      if (task.length < 12) throw new Error("Describe a research task of at least 12 characters.");
      return respond(await buildSellerQuote(task, config));
    }
    if (skill === "notify_funded") {
      const jobId = String((data as { job_id?: unknown }).job_id ?? "").replace(/\D/g, "").slice(0, 20);
      if (!jobId) throw new Error("A numeric job_id is required.");
      const job = await resolved.getJob(jobId);
      if (job.provider.toLowerCase() !== account.address.toLowerCase()) throw new Error("This job belongs to a different provider.");
      if (job.statusName !== "FUNDED") throw new Error("The job is not in a deliverable state.");
      const { content, metadata } = await resolved.collect(job.description);
      const addresses = erc8183Addresses(56);
      const manifest: Erc8183DeliverableManifest = {
        version: 1, job_id: Number(jobId), chain_id: 56,
        contracts: { commerce: addresses.commerce, router: addresses.router, policy: addresses.policy },
        response: { content, content_type: "text/markdown" }, metadata,
      };
      const deliverableUrl = `${config.baseUrl.replace(/\/$/, "")}/deliverable/${jobId}`;
      await resolved.submit({ jobId, manifest, deliverableUrl });
      const text = encodeErc8183Manifest(manifest);
      manifests.set(jobId, text);
      return respond({ accepted: true, status: "accepted", job_id: Number(jobId), deliverable_hash: erc8183ManifestHash(manifest), deliverable_url: deliverableUrl });
    }
    throw new Error("Unsupported skill.");
  }

  return {
    address: account.address,
    card: sellerCard(config),
    handle,
    manifest: (jobId: string) => manifests.get(jobId) ?? null,
  };
}
