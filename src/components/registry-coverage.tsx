"use client";
import { useEffect, useState } from "react";
import { api, SourceLink, dateLabel } from "./ui";

type Coverage = { registered: number; publishedA2A: number; publishedMCP: number; observedAt: string; source: string; note: string };
export function RegistryCoverage() {
  const [data, setData] = useState<Coverage | null>(null);
  useEffect(() => { const controller = new AbortController(); api<Coverage>("/api/registry/stats", { signal: controller.signal }).then(d => { if (!controller.signal.aborted) setData(d); }).catch(() => { /* Registry statistics must not prevent discovery. */ }); return () => controller.abort(); }, []);
  return <details><summary>How much of the registry am I seeing?</summary><p>Browse full registry reads real source pages and reports the source match total. The provider allows shallow offsets through 10,000, so Binera exposes the first 10,008 matches rather than pretending every identity was downloaded. Direct identity pages remain available. The research marketplace separately checks a smaller set for hiring compatibility.</p>{data ? <><p>{data.registered.toLocaleString("en-US")} BSC registrations; {data.publishedA2A.toLocaleString("en-US")} publish A2A metadata and {data.publishedMCP.toLocaleString("en-US")} publish MCP metadata. These counts can overlap.</p><p>{data.note}</p><small>Observed {dateLabel(data.observedAt)} · Cached up to 15 minutes. </small><SourceLink href={data.source}>Explore the source registry</SourceLink></> : <p>Live registry totals are not available yet. Discovery remains usable.</p>}</details>;
}
