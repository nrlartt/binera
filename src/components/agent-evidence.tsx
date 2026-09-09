"use client";
import { Check, Minus } from "lucide-react";
import { agentEvidence, type Agent, type AgentEvidence } from "@/lib/domain";

const labels: { key: keyof Omit<AgentEvidence, "observedAt">; label: string; short: string }[] = [
  { key: "identityRegistered", label: "Registered identity", short: "Identity" },
  { key: "interfacePublished", label: "Published A2A/MCP endpoint", short: "Interface" },
  { key: "endpointLive", label: "Live endpoint", short: "Live" },
  { key: "hiringCompatible", label: "Binera-compatible hiring", short: "Hire" },
  { key: "provenDelivery", label: "Proven delivery", short: "Delivery" },
];

export function AgentEvidenceTrack({ agent, evidence, compact = false }: { agent: Agent; evidence?: AgentEvidence; compact?: boolean }) {
  const state = evidence ?? agentEvidence(agent);
  return <div className={`evidence-track ${compact ? "compact" : ""}`} aria-label="Agent evidence levels">
    {labels.map(step => {
      const established = state[step.key];
      return <span className={established ? "established" : "unknown"} key={step.key} title={`${step.label}: ${established ? "established" : "not established"}`}>
        {established ? <Check size={11} /> : <Minus size={11} />}
        {compact ? step.short : step.label}
      </span>;
    })}
  </div>;
}

export function EvidenceLevelGuide() {
  return <details className="evidence-guide">
    <summary>How agent evidence is separated</summary>
    <ol>
      {labels.map((step, index) => <li key={step.key}><strong>{index + 1}. {step.label}</strong><span>{[
        "An ERC-8004 identity exists on BNB Smart Chain.",
        "The registry publishes A2A or MCP service metadata.",
        "A recent health or direct service check succeeded.",
        "The service supports Binera negotiation, a registered payment wallet and the hiring flow.",
        "A saved onchain job reached COMPLETED and its deliverable hash was verified.",
      ][index]}</span></li>)}
    </ol>
    <p>Each level needs its own evidence. A higher-looking publisher claim never fills a missing level.</p>
  </details>;
}
