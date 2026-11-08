import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { verifyMessage } from "viem";
import { decodeQuote } from "../src/lib/quote";
import { buildSellerQuote, createSeller, sellerCard } from "../src/lib/seller-runtime";
import { encodeErc8183Manifest, erc8183ManifestHash, verifyErc8183ManifestText, type Erc8183DeliverableManifest } from "@altananetwork/sdk";

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);
const config = { privateKey, baseUrl: "https://seller.example", price: "100000000000000000", name: "Reference seller" };
const task = "Research USDT yield on BNB Chain with sources, block numbers and explicit risk flags.";

test("the seller quote is wire-compatible with the marketplace decoder", async () => {
  const quote = await buildSellerQuote(task, config);
  const decoded = decodeQuote(quote, task);
  assert.equal(decoded.hash.toLowerCase(), quote.negotiation_hash.toLowerCase());
  assert.equal(decoded.q.chain_id, 56);
  assert.equal(await verifyMessage({ address: account.address, message: quote.negotiation_hash, signature: quote.provider_sig }), true);
});

test("the agent card advertises exactly the two hiring skills", () => {
  const card = sellerCard(config);
  assert.equal(card.url, "https://seller.example");
  assert.deepEqual(card.skills.map(skill => skill.id), ["negotiate", "notify_funded"]);
});

test("negotiate returns a signed quote through the JSON-RPC handler", async () => {
  const seller = createSeller(config);
  const response = await seller.handle({ jsonrpc: "2.0", id: 1, method: "message/send", params: { message: { parts: [{ kind: "data", data: { skill: "negotiate", task_description: task } }] } } }) as { result: { parts: { data: unknown }[] } };
  const decoded = decodeQuote(response.result.parts[0].data, task);
  assert.match(decoded.hash, /^0x[0-9a-f]{64}$/i);
});

test("notify_funded verifies the provider, builds a manifest and serves the exact bytes", async () => {
  const captured: { value?: { jobId: string; manifest: Erc8183DeliverableManifest; deliverableUrl: string } } = {};
  const seller = createSeller(config, {
    getJob: async () => ({ provider: account.address, statusName: "FUNDED", description: task }),
    collect: async () => ({ content: "# Real report\n\nObserved block: 1", metadata: { observed_block: "1" } }),
    submit: async input => { captured.value = input; return { status: "CONFIRMED" }; },
  });
  const response = await seller.handle({ jsonrpc: "2.0", id: 2, method: "message/send", params: { message: { parts: [{ kind: "data", data: { skill: "notify_funded", job_id: 9 } }] } } }) as { result: { parts: { data: { accepted: boolean; job_id: number } }[] } };
  assert.equal(response.result.parts[0].data.accepted, true);
  assert.equal(response.result.parts[0].data.job_id, 9);
  assert.ok(captured.value);
  assert.equal(captured.value.deliverableUrl, "https://seller.example/deliverable/9");
  const text = seller.manifest("9");
  assert.ok(text);
  assert.equal(verifyErc8183ManifestText(text!, erc8183ManifestHash(captured.value!.manifest)), true);
  assert.equal(text, encodeErc8183Manifest(captured.value!.manifest));
});

test("notify_funded refuses a job owned by another provider or not yet funded", async () => {
  const seller = createSeller(config, { getJob: async () => ({ provider: "0x" + "5".repeat(40), statusName: "FUNDED", description: task }) });
  await assert.rejects(() => seller.handle({ jsonrpc: "2.0", id: 3, method: "message/send", params: { message: { parts: [{ kind: "data", data: { skill: "notify_funded", job_id: 4 } }] } } }), /different provider/i);
  const unfunded = createSeller(config, { getJob: async () => ({ provider: account.address, statusName: "OPEN", description: task }) });
  await assert.rejects(() => unfunded.handle({ jsonrpc: "2.0", id: 4, method: "message/send", params: { message: { parts: [{ kind: "data", data: { skill: "notify_funded", job_id: 5 } }] } } }), /not in a deliverable state/i);
});
