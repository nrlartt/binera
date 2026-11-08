import { createHmac } from "node:crypto";
import type { MarketplaceEvent } from "./marketplace-store";

/**
 * Optional outbound delivery for marketplace events. Disabled unless
 * EXCHANGE_WEBHOOK_URL is configured. HTTPS is required; localhost HTTP is
 * allowed for local integration tests only. Payloads contain public records.
 */
export async function dispatchExchangeEvent(event: MarketplaceEvent): Promise<boolean> {
  const url = process.env.EXCHANGE_WEBHOOK_URL;
  if (!url) return false;
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);
  if (!url.startsWith("https://") && !local) return false;
  const body = JSON.stringify(event);
  const secret = process.env.EXCHANGE_WEBHOOK_SECRET;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Binera-Exchange/1.0",
    "X-Binera-Event": event.kind,
  };
  if (secret) headers["X-Binera-Signature"] = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(5000) });
      if (response.ok) return true;
      if (response.status < 500) return false;
    } catch { /* retry once */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}
