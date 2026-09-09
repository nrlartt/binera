import { z } from "zod";
export function deliveryAcknowledged(input: unknown, jobId: string): boolean {
  const result = z.object({ accepted: z.boolean().optional(), status: z.string().optional(), job_id: z.union([z.string(), z.number().int().nonnegative()]).optional(), error: z.unknown().optional() }).safeParse(input);
  if (!result.success) return false;
  const data = result.data;
  if (data.error || data.accepted === false || (data.job_id !== undefined && String(data.job_id) !== jobId)) return false;
  if (["rejected", "failed", "error"].includes(data.status?.toLowerCase() ?? "")) return false;
  return data.accepted === true || ["accepted", "processing", "queued", "submitted", "completed", "already_processing", "already_submitted"].includes(data.status?.toLowerCase() ?? "");
}
