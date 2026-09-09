import assert from "node:assert/strict";
import test from "node:test";
import { getAddress, keccak256, toHex } from "viem";
import { erc8183Addresses } from "@altananetwork/sdk";
import { canonicalJson, decodeQuote } from "../src/lib/quote";
function signedFixture() {
  const a = erc8183Addresses(56); const task = "TEST ONLY: research yield";
  const q = { request: { task_description: task }, response: { accepted: true, terms: { deliverables: "Sourced report", quality_standards: "Real data", price: "100", currency: a.paymentToken }, negotiated_at: 100, quote_expires_at: 1000 }, negotiation_hash: "", provider_sig: "0x1234", chain_id: 56, verifying_contract: a.commerce };
  q.negotiation_hash = keccak256(toHex(canonicalJson({ version: 1, negotiated_at: 100, quote_expires_at: 1000, task, terms: { deliverables: "Sourced report", quality_standards: "Real data" }, price: "100", currency: a.paymentToken, chain_id: 56, verifying_contract: getAddress(a.commerce) })));
  return q;
}
test("canonical form is stable across key order and escapes unicode", () => { assert.equal(canonicalJson({ z: "é", a: 1 }), '{"a":1,"z":"\\u00e9"}'); });
test("quote accepts only intact, current, same-task, same-chain terms", () => {
  const q = signedFixture(); assert.equal(decodeQuote(q, q.request.task_description, 200).hash, q.negotiation_hash);
  assert.throws(() => decodeQuote(q, "Changed task", 200)); assert.throws(() => decodeQuote(q, q.request.task_description, 990));
  assert.throws(() => decodeQuote({ ...q, chain_id: 97 }, q.request.task_description, 200));
  assert.throws(() => decodeQuote({ ...q, response: { ...q.response, terms: { ...q.response.terms, price: "101" } } }, q.request.task_description, 200));
  assert.throws(() => decodeQuote({ ...q, verifying_contract: "0x0000000000000000000000000000000000000001" }, q.request.task_description, 200));
});
