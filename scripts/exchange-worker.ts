/**
 * Maintenance worker: persists expiry transitions and keeps SQLite healthy.
 * Run alongside the app (Railway worker or a second process):
 *
 *   npm run worker
 */
import "../src/lib/server/load-env";
import { marketplaceStore } from "../src/lib/server/marketplace-store";

async function tick() {
  try {
    const expired = await marketplaceStore.sweepExpired();
    if (expired > 0) console.log(`[exchange-worker] closed ${expired} expired request(s)`);
  } catch (error) {
    console.error("[exchange-worker] sweep failed:", error instanceof Error ? error.message : error);
  }
}

await tick();
setInterval(tick, 60_000);
console.log("[exchange-worker] running every 60 seconds");
