import { z } from "zod";
const address = z.string().regex(/^0x[0-9a-f]{40}$/i);
export const transferSchema = z.object({ id: z.string().uuid(), from: address, to: address, amount: z.string().regex(/^\d{1,18}(\.\d{1,18})?$/), asset: z.enum(["BNB", "U"]), createdAt: z.iso.datetime(), hash: z.string().regex(/^0x[0-9a-f]{64}$/i).optional(), status: z.enum(["unknown", "submitted", "confirmed", "reverted", "cancelled"]) });
export type FundingTransfer = z.infer<typeof transferSchema>;
const key = "agentmarket-funding-v1";
export function loadTransfers(): FundingTransfer[] {
  try { const data: unknown = JSON.parse(localStorage.getItem(key) ?? "[]"); return Array.isArray(data) ? data.slice(0, 200).flatMap(item => { const result = transferSchema.safeParse(item); return result.success ? [result.data] : []; }) : []; } catch { return []; }
}
export function saveTransfer(transfer: FundingTransfer) { const value = transferSchema.parse(transfer); localStorage.setItem(key, JSON.stringify([value, ...loadTransfers().filter(t => t.id !== value.id)].slice(0, 200))); }
