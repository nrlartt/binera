"use client";
import { useState } from "react";
import { categories, assets } from "@/lib/domain";
import { taskSchema, taskText, newTask, type ResearchTask } from "@/lib/research-task";
import { api, ErrorNotice, SourceLink, dateLabel } from "./ui";

export function ResearchTaskForm({ value, onChange, disabled = false }: { value: ResearchTask; onChange: (v: ResearchTask) => void; disabled?: boolean }) {
  const result = taskSchema.safeParse(value);
  const update = (key: keyof ResearchTask, val: string) => onChange({ ...value, [key]: val });
  return <fieldset className="task-form" disabled={disabled}><legend>What do you need?</legend><label className="span-two">Research goal<textarea rows={3} maxLength={500} value={value.goal} onChange={e => update("goal", e.target.value)} /></label><details><summary>Customize research (optional)</summary><div className="form-grid">
    <label>Category<select aria-label="Category" value={value.category} onChange={e => onChange({ ...value, category: e.target.value as ResearchTask["category"], goal: value.goal === newTask(value.category).goal ? newTask(e.target.value as ResearchTask["category"]).goal : value.goal, target: "", lower: "", upper: "", levels: "" })}>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Asset<select aria-label="Asset" value={value.asset} onChange={e => update("asset", e.target.value)}>{assets.map(a => <option key={a}>{a}</option>)}</select></label>
    <label>Strategy budget (optional)<input inputMode="decimal" value={value.budget} onChange={e => update("budget", e.target.value)} /></label>
    <label>Research horizon<select aria-label="Research horizon" value={value.horizon} onChange={e => update("horizon", e.target.value)}>{["1 day", "7 days", "30 days", "90 days"].map(x => <option key={x}>{x}</option>)}</select></label>
    <label className="span-two">{value.category === "health" ? "Venus Core account address (optional)" : "PancakeSwap v3 pool address (optional)"}<input value={value.target} maxLength={42} placeholder="0x…" onChange={e => update("target", e.target.value)} /></label>
    {value.category !== "yield" && <><label>{value.category === "health" ? "Alert health threshold (research)" : "Lower price (token1 per token0)"}<input inputMode="decimal" value={value.lower} onChange={e => update("lower", e.target.value)} /></label><label>{value.category === "health" ? "Target health threshold (research)" : "Upper price (token1 per token0)"}<input inputMode="decimal" value={value.upper} onChange={e => update("upper", e.target.value)} /></label></>}
    {value.category === "grid" && <label>Grid levels (2–100)<input inputMode="numeric" value={value.levels} onChange={e => update("levels", e.target.value)} /></label>}

  </div></details><small>Strategy capital stays in your wallet. Research inputs do not create orders, monitoring or automated protection. Review task privacy before requesting a quote.</small>{!result.success && <ErrorNotice message={result.error.issues[0].message} />}<details><summary>Review the exact task sent to sellers</summary><pre className="task-text">{result.success ? taskText(value) : "Complete valid task inputs first."}</pre></details></fieldset>;
}
type Preview = { title: string; facts: Record<string, string>; block: string; observedAt: string; source: string; note: string };
export function ResearchPreview({ task }: { task: ResearchTask }) {
  const [result, setResult] = useState<{ key: string; data?: Preview; error?: string } | null>(null); const [busy, setBusy] = useState(false);
  const key = `${task.category}:${task.target}`;
  const current = result?.key === key ? result : null;
  async function read() { setBusy(true); try { const data = await api<Preview>(`/api/research/context?kind=${task.category === "health" ? "health" : "pool"}&address=${encodeURIComponent(task.target)}`); setResult({ key, data }); } catch (e) { setResult({ key, error: (e as Error).message }); } finally { setBusy(false); } }
  return <section className="research-preview"><h3>Review live data</h3><p>{task.category === "health" ? "Read this account’s Venus Core liquidity and entered markets. Isolated pools are not included." : task.target ? "Validate your pool against the PancakeSwap v3 factory and read its current state." : "No pool selected: preview the WBNB/USDT reference pool. This is market context, not evidence of support for your selected asset."}</p><button type="button" className="button" disabled={busy || (!!task.target && !/^0x[0-9a-f]{40}$/i.test(task.target)) || (task.category === "health" && !task.target)} onClick={read}>{busy ? "Reading chain…" : "Read live context"}</button>{current?.error && <ErrorNotice message={current.error} />}{current?.data && <><h4>{current.data.title}</h4><dl className="detail-facts">{Object.entries(current.data.facts).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><small>Block {current.data.block} · {dateLabel(current.data.observedAt)}</small><p>{current.data.note}</p><SourceLink href={current.data.source}>Inspect onchain source</SourceLink></>}</section>;
}
