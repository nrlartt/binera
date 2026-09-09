import assert from "node:assert/strict";
import test from "node:test";
import { matchesJob } from "../src/lib/job-match";

test("a competing escrow job cannot be mistaken for this payment", () => {
  const expected = { wallet: "0xAbC", provider: "0xDeF", quote: "signed terms", price: "100" };
  const job = { client: "0xabc", provider: "0xdef", description: "signed terms", budget: "100" };
  assert.equal(matchesJob(job, expected), true);
  for (const change of [{ client: "0xother" }, { provider: "0xother" }, { description: "other terms" }, { budget: "101" }]) {
    assert.equal(matchesJob({ ...job, ...change }, expected), false);
  }
});
