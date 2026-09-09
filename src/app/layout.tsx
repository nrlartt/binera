import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import "./globals.css";
export const metadata: Metadata = { title: { default: "AgentMarket — Find the right agent", template: "%s · AgentMarket" }, description: "Discover, understand and compare real AI agents on BNB Chain. Review the evidence and stay in control." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><Shell>{children}</Shell></body></html>; }
