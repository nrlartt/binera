import { deliveryAcknowledged } from "../delivery";
import { z } from "zod";
import { isAddress, parseAbi, type Address, type Hex } from "viem";
import { erc8183Addresses, getErc8183Job } from "@altananetwork/sdk";
import { decodeQuote, type SignedQuote } from "../quote";
import { getAgent } from "./registry";
import { publicClient, serverNetwork } from "./chain";
import { cached, PublicError, remoteJson } from "./http";

const cardSchema = z.object({ name: z.string(), url: z.url(), skills: z.array(z.object({ id: z.string(), name: z.string().optional() })).default([]) });
export async function studioCard(id: string) {
  const agent = await getAgent(id);
  if (agent.active === false || !agent.endpoint) throw new PublicError("This agent has not published a compatible live activation endpoint.", 409);
  const card = await cached(`card-${id}`, async () => cardSchema.parse(await remoteJson(agent.endpoint!)), 30000);
  if (new URL(card.url).origin !== new URL(agent.endpoint).origin) throw new PublicError("The agent card points to a different provider. Activation needs publisher review.", 409);
  if (!card.skills.some(s => s.id === "negotiate") || !card.skills.some(s => s.id === "notify_funded")) throw new PublicError("This agent uses an external activation flow. Open its provider page to review the requirements.", 409);
  return { agent, card };
}
async function sendSkill(url: string, data: unknown) {
  const result = z.object({ result: z.object({ parts: z.array(z.object({ kind: z.string(), data: z.unknown().optional(), text: z.string().optional() })).optional() }).optional(), error: z.unknown().optional() }).parse(await remoteJson(url, { body: { jsonrpc: "2.0", id: crypto.randomUUID(), method: "message/send", params: { message: { messageId: crypto.randomUUID(), role: "user", parts: [{ kind: "data", data }] } } } }));
  if (result.error || !result.result) throw new PublicError("The agent could not accept this request. Please try again later.");
  const part = result.result.parts?.find(p => p.kind === "data");
  if (part?.data) return part.data;
  const text = result.result.parts?.find(p => p.kind === "text")?.text;
  try { return JSON.parse(text ?? ""); } catch { throw new PublicError("This agent returned an unsupported response."); }
}
export async function negotiate(id: string, task: string): Promise<SignedQuote> {
  const { agent, card } = await studioCard(id);
  if (!agent.tokenId || agent.chainId !== 56) throw new PublicError("The publisher must register a payment identity before this agent can be hired here.", 409);
  // Read the actual wallet assigned to this identity, not an arbitrary owner or URL field.
  const provider = await publicClient.readContract({ address: erc8183Addresses(56).registry, abi: parseAbi(["function getAgentWallet(uint256) view returns (address)"]), functionName: "getAgentWallet", args: [BigInt(agent.tokenId)] });
  if (!isAddress(provider) || /^0x0{40}$/i.test(provider)) throw new PublicError("This agent has not registered a payment wallet.", 409);
  const data = await sendSkill(card.url, { skill: "negotiate", task_description: task, terms: { deliverables: "A sourced research report with observed block numbers, timestamps, strategy assumptions and explicit risk flags.", quality_standards: "Use real data. Do not execute swaps or move user funds. Clearly identify unavailable information." } });
  let decoded: ReturnType<typeof decodeQuote>;
  try { decoded = decodeQuote(data, task); } catch (e) { throw new PublicError(e instanceof z.ZodError ? "The seller did not provide a complete, accepted quote in the supported format." : e instanceof Error ? e.message : "The seller quote could not be verified.", 409); }
  const { q, hash, description } = decoded;
  // Studio's EVMWalletProvider signs the hash's hexadecimal STRING with EIP-191.
  const verified = await publicClient.verifyMessage({ address: provider as Address, message: hash, signature: q.provider_sig as Hex });
  if (!verified) throw new PublicError("The quote signature does not match this agent's registered wallet.", 409);
  return { agentId: id, provider, price: q.response.terms.price, currency: q.response.terms.currency as Address, description, task, deliverables: q.response.terms.deliverables, quality: q.response.terms.quality_standards, expiresAt: q.response.quote_expires_at, fetchedAt: new Date().toISOString(), estimatedSeconds: q.response.estimated_completion_seconds ?? null, negotiationHash: hash };
}
export async function notifyFunded(id: string, jobId: string) {
  const { agent, card } = await studioCard(id);
  const [job, provider] = await Promise.all([getErc8183Job(serverNetwork, BigInt(jobId)), publicClient.readContract({ address: erc8183Addresses(56).registry, abi: parseAbi(["function getAgentWallet(uint256) view returns (address)"]), functionName: "getAgentWallet", args: [BigInt(agent.tokenId)] })]);
  if (job.provider.toLowerCase() !== provider.toLowerCase() || job.statusName !== "FUNDED") throw new PublicError("The funded job does not match this agent or is already being processed.", 409);
  const response = await sendSkill(card.url, { skill: "notify_funded", job_id: Number(jobId) });
  if (!deliveryAcknowledged(response, jobId)) throw new PublicError("The seller has not acknowledged delivery. Funding remains onchain. Check the job status before retrying; some providers require additional authorization.", 409);
  return { acknowledged: true, jobId, observedAt: new Date().toISOString() };
}

export function activationReadiness(id: string) {
  return cached(`readiness-${id}`, async () => {
    const started = Date.now();
    try {
      const { agent, card } = await studioCard(id);
      if (!agent.registered || !agent.tokenId || agent.chainId !== 56) throw new PublicError("The publisher must register this service on BSC before in-app hiring is available.", 409);
      const provider = await publicClient.readContract({ address: erc8183Addresses(56).registry, abi: parseAbi(["function getAgentWallet(uint256) view returns (address)"]), functionName: "getAgentWallet", args: [BigInt(agent.tokenId)] });
      if (/^0x0{40}$/i.test(provider)) throw new PublicError("This identity has no registered payment wallet.", 409);
      return { state: "compatible", available: true, provider, skills: card.skills.map(s => s.id), message: "Live service and payment identity checked. A signed quote is still required; delivery and investment performance are not verified.", observedAt: new Date().toISOString(), responseMs: Date.now() - started };
    } catch (e) {
      return { state: e instanceof PublicError && e.status === 409 ? "unsupported" : "unconfirmed", available: false, provider: null, skills: [], message: e instanceof PublicError ? e.message : "The service could not be verified. Retry or inspect the publisher's page.", observedAt: new Date().toISOString(), responseMs: Date.now() - started };
    }
  }, 30000);
}
