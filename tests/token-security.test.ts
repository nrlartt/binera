import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTokenSecurity } from "../src/lib/server/token-security";

const token = "0x55d398326f99059ff775485246999027b3197955";

test("a successful provider response is normalized to readable JSON", () => {
  const text = normalizeTokenSecurity({ code: 1, result: { [token]: { is_honeypot: "0", holder_count: "100" } } }, token);
  const parsed = JSON.parse(text);
  assert.equal(parsed.is_honeypot, "0");
  assert.equal(parsed.holder_count, "100");
});

test("provider refusal or an unknown token never becomes a safety claim", () => {
  assert.throws(() => normalizeTokenSecurity({ code: 0, message: "rate limited" }, token), /could not complete/i);
  assert.throws(() => normalizeTokenSecurity({ code: 1, result: {} }, token), /no findings/i);
});

test("very large findings are bounded", () => {
  const holders = Array.from({ length: 4000 }, (_, index) => ({ address: `0x${String(index).padStart(40, "0")}`, balance: "1" }));
  const text = normalizeTokenSecurity({ code: 1, result: { [token]: { holders } } }, token);
  assert.ok(text.length <= 18_000, `expected bounded output, got ${text.length}`);
  assert.match(text, /truncated$/);
});
