import { z } from "zod";
import { categoryName, type Category } from "./domain";

const positive = z.string().max(30).refine(v => !v || (/^\d+(\.\d+)?$/.test(v) && Number(v) > 0 && Number.isFinite(Number(v))), "Enter a positive number.");
export const taskSchema = z.object({
  category: z.enum(["rebalancing", "grid", "yield", "health"]),
  asset: z.string().trim().min(1).max(20), budget: positive,
  target: z.string().trim().max(42).refine(v => !v || /^0x[0-9a-f]{40}$/i.test(v), "Enter a BNB Chain address."),
  lower: positive, upper: positive, levels: z.string().refine(v => !v || (/^\d+$/.test(v) && Number(v) >= 2 && Number(v) <= 100), "Use 2–100 levels."),
  horizon: z.enum(["1 day", "7 days", "30 days", "90 days"]),
  goal: z.string().trim().min(12).max(500),
}).superRefine((v, ctx) => { if (v.lower && v.upper && Number(v.lower) >= Number(v.upper)) ctx.addIssue({ code: "custom", path: ["upper"], message: "The upper or target threshold must exceed the lower threshold." }); });
export type ResearchTask = z.infer<typeof taskSchema>;
export function newTask(category: Category = "yield"): ResearchTask {
  return { category, asset: "USDT", budget: "", target: "", lower: "", upper: "", levels: "", horizon: "7 days", goal: `Research ${categoryName(category).toLowerCase()} on BNB Chain. Include sources, timestamps and risk flags.` };
}
export function taskText(input: ResearchTask) {
  const v = taskSchema.parse(input);
  return ["Research only. Do not trade, repay, or move funds.", `Category: ${categoryName(v.category)}. Chain: BNB Smart Chain (56).`, `Asset: ${v.asset}. Horizon: ${v.horizon}.`, v.budget && `Strategy budget context: ${v.budget} ${v.asset}; this is not the agent fee.`, v.target && `${v.category === "health" ? "Venus Core account" : "PancakeSwap v3 pool"}: ${v.target}.`, v.lower && `Lower / alert threshold: ${v.lower}.`, v.upper && `Upper / target threshold: ${v.upper}.`, v.levels && `Grid levels: ${v.levels}.`, `Goal: ${v.goal}`].filter(Boolean).join("\n");
}
