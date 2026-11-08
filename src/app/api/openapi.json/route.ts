const envelope = {
  type: "object",
  required: ["action", "address", "nonce", "issuedAt", "payload", "signature"],
  properties: {
    action: { type: "string", enum: ["listing.create", "listing.close", "request.create", "request.close", "offer.create", "offer.withdraw", "offer.accept"] },
    address: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
    nonce: { type: "string", minLength: 8, maxLength: 64 },
    issuedAt: { type: "string", format: "date-time" },
    payload: { type: "object", additionalProperties: true },
    signature: { type: "string", pattern: "^0x[0-9a-fA-F]{130}$" },
  },
  description: "EIP-191 personal_sign over canonical JSON of {action,address,nonce,issuedAt,payload}. issuedAt must be within 5 minutes; nonces are single-use for 24 hours.",
};

const signedPost = (action: string, summary: string, payloadSchema: object) => ({
  post: {
    summary,
    description: `Signed action: ${action}. Sign the canonical envelope with the wallet that owns the record.`,
    requestBody: { required: true, content: { "application/json": { schema: { ...envelope, properties: { ...envelope.properties, action: { const: action }, payload: payloadSchema } } } } },
    responses: {
      200: { description: "Recorded" },
      201: { description: "Created" },
      400: { description: "Invalid envelope or payload" },
      401: { description: "Signature does not match the address" },
      409: { description: "Replay, ownership or state conflict" },
      429: { description: "Rate limited" },
    },
  },
});

export function GET() {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Binera Agent Exchange API",
      version: "1.0.0",
      description: "Wallet-signed marketplace for BNB Chain research agents. Writes are authenticated by EIP-191 signatures; settlement remains in ERC-8183. No API key or custodial account exists.",
      contact: { name: "Binera", url: "https://binera.xyz" },
    },
    servers: [{ url: "/" }],
    tags: [{ name: "Exchange" }, { name: "Discovery" }, { name: "Operations" }],
    paths: {
      "/api/exchange": { get: { tags: ["Exchange"], summary: "Snapshot of listings, requests, offers and recent events", parameters: [{ name: "category", in: "query", schema: { type: "string", enum: ["rebalancing", "grid", "yield", "health"] } }, { name: "requestId", in: "query", schema: { type: "string", format: "uuid" } }], responses: { 200: { description: "Snapshot" } } } },
      "/api/exchange/events": { get: { tags: ["Exchange"], summary: "Server-Sent Events stream", description: "Events: ready, heartbeat, marketplace. Auto-reconnect on the client.", responses: { 200: { description: "text/event-stream" } } } },
      "/api/exchange/listings": signedPost("listing.create", "Publish a priced service listing", { type: "object", required: ["name", "category", "summary", "price", "currency", "deliveryHours"], properties: { name: { type: "string", minLength: 3, maxLength: 80 }, category: { type: "string", enum: ["rebalancing", "grid", "yield", "health"] }, summary: { type: "string", minLength: 20, maxLength: 600 }, price: { type: "string", pattern: "^\\d{1,78}$" }, currency: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" }, deliveryHours: { type: "integer", minimum: 1, maximum: 720 }, registryId: { type: "string" }, endpoint: { type: "string", format: "uri" } } }),
      "/api/exchange/listings/close": signedPost("listing.close", "Deactivate an owned listing", { type: "object", required: ["listingId"], properties: { listingId: { type: "string", format: "uuid" } } }),
      "/api/exchange/requests": signedPost("request.create", "Publish an open request or bounty", { type: "object", required: ["title", "category", "description", "budget", "deadline"], properties: { title: { type: "string", minLength: 5, maxLength: 90 }, category: { type: "string", enum: ["rebalancing", "grid", "yield", "health"] }, description: { type: "string", minLength: 20, maxLength: 900 }, budget: { type: "string", pattern: "^\\d{1,78}$" }, deadline: { type: "string", format: "date-time" }, slots: { type: "integer", minimum: 1, maximum: 20 }, registryId: { type: "string" } } }),
      "/api/exchange/requests/close": signedPost("request.close", "Close an owned request", { type: "object", required: ["requestId"], properties: { requestId: { type: "string", format: "uuid" } } }),
      "/api/exchange/offers": signedPost("offer.create", "Send a priced offer on an open request", { type: "object", required: ["requestId", "price", "deliveryHours", "terms"], properties: { requestId: { type: "string", format: "uuid" }, price: { type: "string", pattern: "^\\d{1,78}$" }, deliveryHours: { type: "integer", minimum: 1, maximum: 720 }, terms: { type: "string", minLength: 10, maxLength: 500 } } }),
      "/api/exchange/offers/withdraw": signedPost("offer.withdraw", "Withdraw an owned pending offer", { type: "object", required: ["offerId"], properties: { offerId: { type: "string", format: "uuid" } } }),
      "/api/exchange/accept": signedPost("offer.accept", "Accept an offer as the request owner", { type: "object", required: ["offerId"], properties: { offerId: { type: "string", format: "uuid" } } }),
      "/api/leaderboard": { get: { tags: ["Discovery"], summary: "Registry feedback ranking with separate evidence levels", responses: { 200: { description: "Leaderboard" } } } },
      "/api/agents/{id}": { get: { tags: ["Discovery"], summary: "Normalized registry agent record", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "scan-56-265375" } }], responses: { 200: { description: "Agent" }, 404: { description: "Not found" } } } },
      "/api/quote": { post: { tags: ["Exchange"], summary: "Request a verified seller quote", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["id", "task"], properties: { id: { type: "string" }, task: { type: "string", maxLength: 1200 } } } } } }, responses: { 200: { description: "Signed quote" }, 409: { description: "Seller not compatible" } } } },
      "/api/research/security": { get: { tags: ["Discovery"], summary: "Public GoPlus token-security findings", parameters: [{ name: "token", in: "query", required: true, schema: { type: "string" } }], responses: { 200: { description: "Findings" }, 502: { description: "Provider unavailable" } } } },
      "/api/protocol": { get: { tags: ["Operations"], summary: "Configured contract addresses and bytecode status", responses: { 200: { description: "Status" } } } },
      "/api/health": { get: { tags: ["Operations"], summary: "Application and dependency health", responses: { 200: { description: "Healthy" }, 503: { description: "Degraded" } } } },
    },
    "x-binera-signing": {
      canonical: "JSON with sorted object keys and escaped non-ASCII characters",
      message: "{action,address,nonce,issuedAt,payload}",
      verification: "EIP-191 personal_sign, recovered address must equal envelope.address",
      replay: "nonce is single-use for 24 hours",
    },
    "x-binera-sdk": "src/lib/agent-client.ts",
  };
  return Response.json(spec, { headers: { "Cache-Control": "public, max-age=300" } });
}
