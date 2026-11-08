"use client";
import { useEffect, useState } from "react";
import { Check, Clock3, ShieldCheck } from "lucide-react";
import { formatUnits } from "viem";
import { dateLabel } from "./ui";

type Intake = { price: string; expiresAt: number; deliverables: string; quality: string; provider: string };
const MAX_TERMS_LENGTH = 260;

function trim(text: string) {
  const clean = text.trim();
  return clean.length > MAX_TERMS_LENGTH ? `${clean.slice(0, MAX_TERMS_LENGTH)}…` : clean;
}

export function IntakeChecklist({ price, expiresAt, deliverables, quality, provider }: Intake) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, []);
  const minutesLeft = now ? Math.max(0, Math.floor((expiresAt * 1000 - now) / 60000)) : null;
  return <details className="intake-checklist" open>
    <summary><ShieldCheck size={16} />Before you fund — preflight checklist</summary>
    <ul>
      <li><Check size={14} /><span><strong>Scope is fixed.</strong> The task text is bound to the signed quote; any edit requires a fresh quote.</span></li>
      <li><Check size={14} /><span><strong>Price:</strong> {formatUnits(BigInt(price), 18)} U. The permission caps the exact fee plus up to 0.003 BNB in network fees.</span></li>
      <li><Check size={14} /><span><strong>Deliverable:</strong> {trim(deliverables)}</span></li>
      <li><Check size={14} /><span><strong>Quality standard:</strong> {trim(quality)}</span></li>
      <li><Clock3 size={14} /><span><strong>Quote expiry:</strong> {dateLabel(new Date(expiresAt * 1000).toISOString())}{minutesLeft === null ? "" : minutesLeft > 0 ? ` · about ${minutesLeft} min left` : " · expired, refresh the quote"}</span></li>
      <li><Check size={14} /><span><strong>Escrow:</strong> payment goes to the ERC-8183 commerce contract. The onchain dispute window is read in My agents after delivery; settlement is not automatic.</span></li>
      <li><Check size={14} /><span><strong>Research only:</strong> this hire does not trade, repay or move your positions. Seller wallet: {provider}.</span></li>
    </ul>
    <small>This checklist is derived from the verified quote shown above. It does not add a guarantee of delivery quality.</small>
  </details>;
}
