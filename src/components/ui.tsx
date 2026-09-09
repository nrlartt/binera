"use client";
import { useState } from "react";
import { Copy, Check, ArrowLeftRight, Grid2X2, TrendingUp, HeartPulse, ShieldCheck, CircleCheck, ExternalLink } from "lucide-react";
import type { Category } from "@/lib/domain";
export function CategoryIcon({ category, size = 22 }: { category: Category; size?: number }) { const Icon = { rebalancing: ArrowLeftRight, grid: Grid2X2, yield: TrendingUp, health: HeartPulse }[category]; return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />; }
export function TrustBadge({ verified }: { verified: boolean }) { return <span className={`badge ${verified ? "verified" : "neutral"}`}>{verified ? <ShieldCheck size={13} /> : <CircleCheck size={13} />}{verified ? "Verified identity" : "Registered identity"}</span>; }
export function SourceLink({ href, children }: { href: string; children: React.ReactNode }) { return <a className="source-link" href={href} target="_blank" rel="noopener noreferrer">{children}<ExternalLink size={12} /></a>; }
export function shortAddress(value: string) { return `${value.slice(0, 6)}…${value.slice(-4)}`; }
export function dateLabel(value: string | null) { if (!value || Number.isNaN(Date.parse(value))) return "Not available"; return new Date(value).toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC"; }
export async function api<T>(url: string, init?: RequestInit): Promise<T> { const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "The request could not be completed."); return data as T; }
export function ErrorNotice({ message }: { message: string }) { return <div className="notice error" role="alert">{message}</div>; }

export function CopyAddress({ address, label = "address" }: { address: string; label?: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    try { await navigator.clipboard.writeText(address); setStatus("copied"); }
    catch { setStatus("failed"); }
  }
  return <span className="copy-address"><button type="button" className="icon-button" aria-label={`Copy ${label}`} title={status === "copied" ? "Copied" : `Copy ${label}`} onClick={copy}>{status === "copied" ? <Check size={14} /> : <Copy size={14} />}</button><span className="copy-feedback" role="status">{status === "copied" ? "Copied" : status === "failed" ? "Could not copy. Select the address manually." : ""}</span></span>;
}
