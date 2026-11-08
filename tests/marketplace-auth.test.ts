import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { marketplaceMessage, requestPayloadSchema } from "../src/lib/marketplace";
import { verifySignedWrite } from "../src/lib/server/marketplace-auth";

const account = privateKeyToAccount(generatePrivateKey());

const payload = {
  title: "Signed verification request",
  category: "health" as const,
  description: "A request used only to verify that the server rebuilds and checks the signed message.",
  budget: "1000000000000000000",
  deadline: new Date(Date.now() + 86400000).toISOString(),
};

async function envelope(overrides: Record<string, unknown> = {}) {
  const nonce = crypto.randomUUID();
  const issuedAt = new Date().toISOString();
  const message = marketplaceMessage("request.create", account.address, nonce, issuedAt, payload);
  return { action: "request.create", address: account.address, nonce, issuedAt, payload, signature: await account.signMessage({ message }), ...overrides };
}

function request(body: unknown) {
  return new Request("http://localhost:3000/api/exchange/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

test("a correctly signed envelope is accepted and the payload is normalized", async () => {
  const result = await verifySignedWrite(request(await envelope()), "request.create");
  assert.equal(result.envelope.address, account.address);
  assert.equal(requestPayloadSchema.parse(result.payload).category, "health");
});

test("a tampered payload is rejected even when the signature is well formed", async () => {
  const signed = await envelope();
  const tampered = { ...signed, payload: { ...payload, budget: "9000000000000000000" } };
  await assert.rejects(() => verifySignedWrite(request(tampered), "request.create"), /signature does not match/i);
});

test("a stale signature is rejected before any marketplace write", async () => {
  const stale = await envelope({ issuedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() });
  await assert.rejects(() => verifySignedWrite(request(stale), "request.create"), /stale/i);
});

test("a signature for another action cannot be replayed on this endpoint", async () => {
  const signed = await envelope({ action: "listing.create" });
  await assert.rejects(() => verifySignedWrite(request(signed), "request.create"), /does not match this endpoint/i);
});

test("payload schema violations surface as public validation messages", async () => {
  const bad = await envelope({ payload: { ...payload, title: "x" } });
  await assert.rejects(() => verifySignedWrite(request(bad), "request.create"), /Check the title/i);
});
