import { test, expect } from "@playwright/test";

test("payment help identifies the exact mainnet token and registry totals remain separate", async ({ page, request }) => {
  await page.goto("/docs");
  await page.getByText("How to get U for agent fees", { exact: true }).click();
  await expect(page.locator(".payment-help")).toContainText("0xcE24439F2D9C6a2289F741120FE202248B666666");
  await expect(page.getByRole("link", { name: "Binance U/USDT", exact: true })).toHaveAttribute("href", "https://www.binance.com/en/trade/U_USDT");
  const response = await request.get("/api/registry/stats");
  expect(response.status()).toBe(200);
  const stats = await response.json();
  expect(stats.registered).toBeGreaterThanOrEqual(stats.publishedA2A);
  expect(stats.note).toContain("do not prove service availability");
  await page.goto("/?catalog=registry");
  await page.getByText("How much of the registry am I seeing?", { exact: true }).click();
  await expect(page.getByRole("link", { name: "Explore the source registry", exact: true })).toBeVisible({ timeout: 30000 });
});

test("research catalogue is distinct from the registry and docs are public", async ({ page, request }) => {
  const response = await request.get("/api/discover"); const data = await response.json();
  expect(response.status()).toBe(200); expect(data.total).toBeLessThanOrEqual(4);
  expect(data.scope).toContain("Reviewed research providers");
  await page.goto("/docs");
  await expect(page.getByRole("heading", { name: "Request and hire", exact: true })).toBeVisible();
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Connect your account to open your profile." })).toBeVisible();
  await expect(page.getByLabel("Display name")).toHaveCount(0);
});

test("full registry is paginated and keeps five evidence levels distinct", async ({ page, request }) => {
  const response = await request.get("/api/discover?catalog=registry&page=1");
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.total).toBeGreaterThan(10000);
  expect(data.returned).toBeLessThanOrEqual(12);
  expect(data.pages).toBeGreaterThan(1);
  await page.goto("/?catalog=registry");
  await expect(page.getByText("Browse full registry", { exact: true })).toBeVisible();
  await page.getByText("How agent evidence is separated", { exact: true }).click();
  for (const label of ["Registered identity", "Published A2A/MCP endpoint", "Live endpoint", "Binera-compatible hiring", "Proven delivery"]) {
    await expect(page.locator(".evidence-guide").getByText(label, { exact: false })).toBeVisible();
  }
  await expect(page.locator(".agent-card").first().locator(".evidence-track span")).toHaveCount(5);
});

test("shared comparison sends identical tasks and preserves successful quotes", async ({ page }) => {
  const tasks: string[] = [];
  page.on("request", request => { if (request.url().endsWith("/api/quote") && request.method() === "POST") tasks.push(request.postDataJSON().task); });
  await page.goto("/compare?ids=scan-56-341225,scan-56-46501");
  await expect(page.locator(".comparison-table")).toBeVisible({ timeout: 40000 });
  await page.getByText("Customize research (optional)", { exact: true }).click();
  await page.getByLabel("Strategy budget (optional)").fill("3200");
  await page.getByRole("button", { name: "Get comparable quotes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Get comparable quotes", exact: true })).toBeEnabled({ timeout: 60000 });
  expect(tasks).toHaveLength(2); expect(tasks[0]).toEqual(tasks[1]); expect(tasks[0]).toContain("3200 USDT");
  await expect(page.getByRole("row", { name: /Quoted agent fee/ })).toContainText(" U");
  await page.locator(".comparison-table").getByRole("link", { name: "View agent" }).first().click();
  await page.getByRole("button", { name: "Review activation", exact: true }).click();
  await page.getByText("Customize research (optional)", { exact: true }).click();
  await expect(page.getByLabel("Strategy budget (optional)")).toHaveValue("3200");
});

test("profile requires a connected account and saved identities refresh live", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByLabel("Display name")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Connect account", exact: true })).toBeVisible();
  await page.goto("/agents/scan-56-341225");
  await page.getByRole("button", { name: /^Save / }).click();
  await page.goto("/saved"); await expect(page.locator(".job-card")).toHaveCount(1);
  await expect(page.locator(".job-card h3")).not.toHaveText("scan-56-341225", { timeout: 30000 });
  await page.getByRole("button", { name: /^Unsave / }).click();
  await expect(page.getByRole("heading", { name: "Keep a few specialists in mind." })).toBeVisible();
});

test("shared filters restore and research forms show live pool context", async ({ page }) => {
  await page.goto("/category/yield?asset=USDT&sort=feedback");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(page.getByLabel("Asset", { exact: true })).toHaveValue("USDT");
  await expect(page.getByLabel("Sort agents")).toHaveValue("feedback");
  await page.goto("/agents/scan-56-341225");
  await page.getByRole("button", { name: "Review activation", exact: true }).click();
  await page.getByText("Customize research (optional)", { exact: true }).click();
  await page.getByLabel("Strategy budget (optional)").fill("5000");
  await page.getByText("Review the exact task sent to sellers", { exact: true }).click();
  await expect(page.locator(".task-text")).toContainText("5000 USDT");
  await page.getByText("Preview market or account data (optional)", { exact: true }).click();
  await page.getByRole("button", { name: "Read live context", exact: true }).click();
  await expect(page.locator(".research-preview")).toContainText("Checked onchain", { timeout: 45000 });
  await page.getByLabel("Category", { exact: true }).selectOption("health");
  await expect(page.getByLabel("Venus Core account address (optional)")).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Research goal/ })).toHaveValue(/health factor monitoring/);
  await expect(page.getByRole("button", { name: "Read live context", exact: true })).toBeDisabled();
});

test("changing reviewed task inputs invalidates a live signed quote", async ({ page }) => {
  await page.goto("/agents/scan-56-341225");
  await page.getByRole("button", { name: "Review activation", exact: true }).click();
  await page.getByRole("button", { name: "Get a verified price quote", exact: true }).click();
  await expect(page.getByText("Seller signature checked", { exact: true })).toBeVisible({ timeout: 60000 });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Edit task", exact: true }).click();
  await page.getByText("Customize research (optional)", { exact: true }).click();
  await page.getByLabel("Strategy budget (optional)").fill("7000");
  await expect(page.getByText("Seller signature checked", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Connect account to activate", exact: true })).toHaveCount(0);
});
