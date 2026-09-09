import assert from "node:assert/strict";
import test from "node:test";
import { parseActivity, activitySchema } from "../src/lib/activity";
import { jobActions } from "../src/lib/job-match";
import { deliveryAcknowledged } from "../src/lib/delivery";
import { parseIntent, rankAgents } from "../src/lib/domain";
import { normalizeScan } from "../src/lib/server/registry";

const wallet = "0x" + "1".repeat(40);
const key = "0x04" + "2".repeat(128);
const record = { id: key, agentId: "scan-56-1", agentName: "TEST RECORD", wallet, createdAt: "2026-09-09T00:00:00Z", session: { walletAddress: wallet, publicKey: key, expiry: 2000000000, permissions: { calls: [{ to: wallet, signature: "fund(uint256,uint256,bytes)" }], spend: [{ limit: "100", period: "day" }] } }, quote: "test-only terms", price: "100", task: "test-only task", status: "pending" };
test("activity imports validate account binding, integers and timestamps, and strip secret fields", () => {
  const clean = parseActivity([{ ...record, privateKey: "DO_NOT_RETAIN", session: { ...record.session, signer: { secret: "DO_NOT_RETAIN" } } }]);
  assert.equal(JSON.stringify(clean).includes("DO_NOT_RETAIN"), false);
  for (const changed of [{ price: "not-a-number" }, { createdAt: "invalid" }, { jobId: "1/../2" }, { wallet: "0x" + "3".repeat(40) }, { session: { ...record.session, expiry: Infinity } }]) assert.equal(activitySchema.safeParse({ ...record, ...changed }).success, false);
  assert.throws(() => parseActivity({ records: [] }));
});
test("settlement and dispute windows do not overlap, and delivery prevents expiry refund", () => {
  const job = { statusName: "SUBMITTED", submittedAt: 100n, expiredAt: 300n };
  assert.deepEqual(jobActions(job, 149n, 50n), { approve: false, dispute: true, refund: false });
  assert.deepEqual(jobActions(job, 150n, 50n), { approve: true, dispute: false, refund: false });
  assert.equal(jobActions(job, 400n, 50n).refund, false);
  assert.equal(jobActions({ ...job, statusName: "FUNDED" }, 301n, 50n).refund, true);
});
test("HTTP success or contradictory seller response cannot acknowledge delivery", () => {
  assert.equal(deliveryAcknowledged({ status: "processing", job_id: 1 }, "1"), true);
  for (const response of [{}, { status: "ok" }, { accepted: false, status: "processing" }, { accepted: true, status: "failed" }, { accepted: true, job_id: 2 }]) assert.equal(deliveryAcknowledged(response, "1"), false);
});
test("unknown intent and exact-name discovery never return unrelated agents", () => {
  const agent = normalizeScan({ token_id: "1", chain_id: 56, name: "SpecificSpecialist", description: "USDT yield research" });
  assert.equal(rankAgents([agent], parseIntent("SpecificSpecialist")).length, 1);
  assert.equal(rankAgents([agent], parseIntent("astronomy telescope")).length, 0);
});
