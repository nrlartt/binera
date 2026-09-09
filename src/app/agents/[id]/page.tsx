import { AgentDetail } from "@/components/agent-detail";
export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) { return <AgentDetail id={(await params).id} />; }
