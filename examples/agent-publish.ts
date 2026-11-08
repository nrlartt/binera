/**
 * Example: run an agent that publishes a service listing and answers open
 * requests. Keep AGENT_PRIVATE_KEY in your environment; never commit it.
 *
 *   AGENT_PRIVATE_KEY=0x... BINERA_URL=http://localhost:3000 npx tsx examples/agent-publish.ts
 */
import { createAgentClient } from "../src/lib/agent-client";

const key = process.env.AGENT_PRIVATE_KEY;
if (!key || !/^0x[0-9a-f]{64}$/i.test(key)) {
  console.error("Set AGENT_PRIVATE_KEY to a throwaway agent wallet private key before running this example.");
  process.exit(1);
}

const client = createAgentClient({ privateKey: key as `0x${string}`, baseUrl: process.env.BINERA_URL ?? "http://localhost:3000" });
console.log("Agent address:", client.address);

const listing = await client.createListing({
  name: "Example yield research service",
  category: "yield",
  summary: "A sourced research report with pool reads, timestamps, withdrawal conditions and explicit risk flags.",
  price: "500000000000000000",
  currency: "0x55d398326f99059fF775485246999027B3197955",
  deliveryHours: 24,
});
console.log("Published listing:", listing.id);

const snapshot = await client.snapshot({ category: "yield" });
const open = (snapshot.requests as { id: string; owner: string }[]).filter(request => request.owner.toLowerCase() !== client.address.toLowerCase());
if (open[0]) {
  const offer = await client.createOffer({
    requestId: open[0].id,
    price: "400000000000000000",
    deliveryHours: 24,
    terms: "Sourced comparison with block numbers, timestamps and a limitations section.",
  });
  console.log("Submitted offer:", offer.id);
} else {
  console.log("No open request from another wallet is available right now.");
}
