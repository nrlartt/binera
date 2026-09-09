import { z } from "zod";
import { getAddress, keccak256, toHex } from "viem";
import { erc8183Addresses } from "@altananetwork/sdk";

const hex = z.string().regex(/^0x[0-9a-f]+$/i);
export const quoteSchema = z.object({
  request: z.object({ task_description: z.string() }),
  response: z.object({ accepted: z.literal(true), terms: z.object({ deliverables: z.string(), quality_standards: z.string(), success_criteria: z.array(z.string()).optional(), price: z.string().regex(/^\d{1,78}$/), currency: z.string().regex(/^0x[0-9a-f]{40}$/i) }), negotiated_at: z.number().int().positive(), quote_expires_at: z.number().int().positive(), estimated_completion_seconds: z.number().optional() }),
  negotiation_hash: hex, provider_sig: hex, chain_id: z.literal(56), verifying_contract: z.string(),
});
export type SignedQuote = { agentId: string; provider: `0x${string}`; price: string; currency: `0x${string}`; description: string; task: string; deliverables: string; quality: string; expiresAt: number; fetchedAt: string; estimatedSeconds: number | null; negotiationHash: string };
// Wire-compatible canonical form: BNB Agent SDK negotiation.ts (MIT).
export function canonicalJson(value: unknown): string {
  const sort = (v: unknown): unknown => Array.isArray(v) ? v.map(sort) : v !== null && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, sort(item)])) : v;
  return JSON.stringify(sort(value)).replace(/[\u007f-\uffff]/g, ch => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
}
function sanitize(text: string) { return [...text.replaceAll("[", "(").replaceAll("]", ")")].filter(c => c.charCodeAt(0) >= 32 || c === "\t" || c === "\n").join(""); }
export function decodeQuote(input: unknown, task: string, now = Math.floor(Date.now() / 1000)) {
  const q = quoteSchema.parse(input); const terms = q.response.terms; const addresses = erc8183Addresses(56);
  if (q.response.quote_expires_at <= now + 30 || q.response.negotiated_at > now + 60) throw new Error("This quote expired or has an invalid timestamp. Request another quote.");
  if (q.request.task_description !== task) throw new Error("The quote does not match your task.");
  if (getAddress(q.verifying_contract) !== getAddress(addresses.commerce) || getAddress(terms.currency) !== getAddress(addresses.paymentToken)) throw new Error("This quote uses an unsupported payment contract.");
  if (BigInt(terms.price) <= 0n) throw new Error("This agent requires a different activation method.");
  const content = { version: 1, negotiated_at: q.response.negotiated_at, quote_expires_at: q.response.quote_expires_at, task: sanitize(task), terms: { deliverables: sanitize(terms.deliverables), quality_standards: sanitize(terms.quality_standards), ...(terms.success_criteria?.length ? { success_criteria: terms.success_criteria.map(sanitize) } : {}) }, price: terms.price, currency: terms.currency, chain_id: 56, verifying_contract: getAddress(q.verifying_contract) };
  const hash = keccak256(toHex(canonicalJson(content)));
  if (hash.toLowerCase() !== q.negotiation_hash.toLowerCase()) throw new Error("The quote contents do not match the seller's signed terms.");
  const description = canonicalJson({ ...content, negotiation_hash: q.negotiation_hash, provider_sig: q.provider_sig });
  if (description.length > 4096) throw new Error("Please shorten your task before requesting a quote.");
  return { q, hash, description };
}
