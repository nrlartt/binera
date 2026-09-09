import { readFile, writeFile, mkdir } from "node:fs/promises";

const manifest = JSON.parse(await readFile("submission/release.json", "utf8"));
const base = new URL(process.env.TEST_URL || manifest.publicUrl);
if (base.protocol !== "https:" || base.username || base.password) throw new Error("Use the public HTTPS application origin.");
const checks = [];
async function check(name, run) {
  const started = Date.now();
  try { const detail = await run(); checks.push({ name, passed: true, durationMs: Date.now() - started, detail }); }
  catch (error) { checks.push({ name, passed: false, durationMs: Date.now() - started, detail: error.message }); }
}
async function request(path, options) {
  return fetch(new URL(path, base), { redirect: "error", signal: AbortSignal.timeout(30000), ...options });
}
for (const path of ["/", "/profile", "/saved", "/compare", "/dashboard", "/category/rebalancing", "/category/grid", "/category/yield", "/category/health"]) {
  await check(`Page ${path}`, async () => {
    const response = await request(path); const text = await response.text();
    if (response.status !== 200 || !/<title>[^<]*Binera Agent Market/.test(text)) throw new Error(`Expected Binera HTML, received HTTP ${response.status}.`);
    return "HTTP 200 and Binera page title. Client-side interactions are covered separately by browser tests.";
  });
}
await check("Live dependencies", async () => {
  const response = await request("/api/health"); const data = await response.json();
  if (response.status !== 200 || data.status !== "ok" || data.dependencies?.chain !== "ok" || data.dependencies?.discovery !== "ok") throw new Error("RPC or discovery is degraded; inspect /api/health.");
  return `Chain and registry healthy. Intent: ${data.integrations?.intent}; TermiX: ${data.integrations?.termix}.`;
});
await check("PancakeSwap data freshness", async () => {
  const response = await request("/api/market"); const data = await response.json();
  if (response.status !== 200 || !/^\d+$/.test(data.blockNumber) || !(data.price > 0) || !Number.isFinite(Date.parse(data.timestamp)) || Math.abs(Date.now() - Date.parse(data.timestamp)) > 180000) throw new Error("Live pool data is missing, invalid or older than three minutes.");
  return `Observed BSC block ${data.blockNumber}.`;
});
for (const [name, origin, status] of [["Production origin", base.origin, 400], ["Foreign origin rejected", "https://foreign-origin.invalid", 403]]) {
  await check(name, async () => {
    const response = await request("/api/quote", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ id: "", task: "" }) });
    if (response.status !== status) throw new Error(`Expected HTTP ${status}, received ${response.status}.`);
    return "Invalid task used only to test request validation. No quote or transaction requested.";
  });
}
const report = { checkedAt: new Date().toISOString(), publicUrl: base.origin, passed: checks.every(c => c.passed), scope: "Unauthenticated deployment smoke test. No funded hiring, session grant, delivery or revocation is tested.", checks };
await mkdir("submission/evidence", { recursive: true });
await writeFile("submission/evidence/production-check.json", JSON.stringify(report, null, 2) + "\n");
for (const c of checks) console.log(`${c.passed ? "PASS" : "FAIL"} ${c.name}: ${c.detail}`);
if (!report.passed) process.exitCode = 1;
