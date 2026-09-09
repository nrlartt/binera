import { z } from "zod";

const address = z.string().regex(/^0x[0-9a-f]{40}$/i).transform(a => a as `0x${string}`);
const hex = z.string().regex(/^0x[0-9a-f]{2,260}$/i).transform(a => a as `0x${string}`);
const tx = z.string().regex(/^0x[0-9a-f]{64}$/i);
const decimal = z.string().regex(/^\d{1,78}$/);
const session = z.object({
  walletAddress: address, publicKey: hex, expiry: z.number().int().nonnegative().max(253402300799),
  permissions: z.object({
    calls: z.array(z.object({ to: address.optional(), signature: z.string().max(200).optional() }).refine(c => c.to || c.signature)).max(50).readonly().optional(),
    spend: z.array(z.object({ token: address.optional(), limit: decimal, period: z.enum(["minute", "hour", "day", "week", "month", "year"]) })).max(20).readonly().optional(),
  }),
});
export const activitySchema = z.object({
  id: hex, agentId: z.string().regex(/^(scan-56-\d{1,20}|studio-[\w-]+)$/).max(2000), agentName: z.string().max(1000), wallet: address,
  createdAt: z.iso.datetime(), session, grantTx: tx.optional(), jobId: z.string().regex(/^\d{1,15}$/).optional(),
  fundingTx: tx.optional(), callsId: z.string().min(1).max(512).optional(), quote: z.string().max(4096), price: decimal.refine(p => /[1-9]/.test(p)),
  provider: address.optional(), task: z.string().max(1200), status: z.enum(["permission-granted", "funded", "pending", "revoked"]), revokeTx: tx.optional(),
}).refine(a => a.id.toLowerCase() === a.session.publicKey.toLowerCase() && a.wallet.toLowerCase() === a.session.walletAddress.toLowerCase(), "Session does not match account");
export type ActivityRecord = z.infer<typeof activitySchema>;
const KEY = "agentmarket-activity-v1";
export function parseActivity(input: unknown): ActivityRecord[] {
  if (!Array.isArray(input) || input.length > 1000) throw new Error("Choose an activity export with at most 1,000 records.");
  return input.map(item => activitySchema.parse(item)); // Field-by-field parsing strips unknown key material.
}
export function loadActivity(): ActivityRecord[] {
  try { const data: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(data) ? data.slice(0, 1000).flatMap(a => { const parsed = activitySchema.safeParse(a); return parsed.success ? [parsed.data] : []; }) : []; } catch { return []; }
}
function writeActivity(records: ActivityRecord[]) { localStorage.setItem(KEY, JSON.stringify(records)); window.dispatchEvent(new Event("marketplace-activity")); }
export function saveActivity(record: ActivityRecord) { const clean = activitySchema.parse(record); writeActivity([clean, ...loadActivity().filter(a => a.id !== clean.id)].slice(0, 1000)); }
export function importActivity(input: unknown, wallet: string) {
  const incoming = parseActivity(input);
  if (incoming.some(r => r.wallet.toLowerCase() !== wallet.toLowerCase())) throw new Error("This export contains a different marketplace account. Connect that account first.");
  const existing = loadActivity(); const ids = new Set(existing.map(r => r.id));
  const additions = incoming.filter(r => !ids.has(r.id));
  if (existing.length + additions.length > 1000) throw new Error("Activity storage limit reached. Keep your exported references.");
  writeActivity([...existing, ...additions]); return additions.length;
}
