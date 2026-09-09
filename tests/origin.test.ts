import { test } from "node:test";
import assert from "node:assert/strict";
import { sameOrigin, PublicError } from "../src/lib/server/http";

test("origin checks support TLS termination without trusting forwarded headers", () => {
  const previous = process.env.APP_ORIGIN;
  try {
    process.env.APP_ORIGIN = "https://binera-production.up.railway.app";
    const request = (origin: string) => new Request("http://0.0.0.0:3000/api/quote", { headers: { origin, "x-forwarded-host": "attacker.example", "x-forwarded-proto": "https" } });
    assert.doesNotThrow(() => sameOrigin(request(process.env.APP_ORIGIN!)));
    for (const origin of ["https://attacker.example", "http://binera-production.up.railway.app", "null", "http://0.0.0.0:3000"]) {
      assert.throws(() => sameOrigin(request(origin)), (error: unknown) => error instanceof PublicError && error.status === 403);
    }
    delete process.env.APP_ORIGIN;
    assert.doesNotThrow(() => sameOrigin(new Request("http://localhost:3000/api/quote", { headers: { origin: "http://localhost:3000" } })));
    assert.throws(() => sameOrigin(request("https://attacker.example")), PublicError);
  } finally {
    if (previous === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previous;
  }
});
