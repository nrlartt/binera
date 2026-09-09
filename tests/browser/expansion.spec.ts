import { test, expect } from "@playwright/test";

test("shared comparison sends identical tasks and preserves successful quotes", async ({ page }) => {
  const tasks: string[] = [];
  page.on("request", request => { if (request.url().endsWith("/api/quote") && request.method() === "POST") tasks.push(request.postDataJSON().task); });
  await page.goto("/compare?ids=scan-56-341225,scan-56-46501");
  await expect(page.locator(".comparison-table")).toBeVisible({ timeout: 40000 });
  await page.getByLabel("Strategy budget (optional)").fill("3200");
  await page.getByRole("button", { name: "Get comparable quotes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Get comparable quotes", exact: true })).toBeEnabled({ timeout: 60000 });
  expect(tasks).toHaveLength(2); expect(tasks[0]).toEqual(tasks[1]); expect(tasks[0]).toContain("3200 USDT");
  await expect(page.getByRole("row", { name: /Quoted agent fee/ })).toContainText(" U");
  await page.locator(".comparison-table").getByRole("link", { name: "View agent" }).first().click();
  await page.getByRole("button", { name: "Review activation", exact: true }).click();
  await expect(page.getByLabel("Strategy budget (optional)")).toHaveValue("3200");
});

test("profile persists locally and saved identities refresh from the live registry", async ({ page }) => {
  await page.goto("/profile");
  await page.getByLabel("Display name").fill("Binera researcher");
  await page.getByLabel("About your research goals").fill("Compare sourced USDT research.");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await page.reload(); await expect(page.getByLabel("Display name")).toHaveValue("Binera researcher");
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
  await page.getByLabel("Strategy budget (optional)").fill("5000");
  await page.getByText("Review the exact task sent to sellers", { exact: true }).click();
  await expect(page.locator(".task-text")).toContainText("5000 USDT");
  await page.getByRole("button", { name: "Read live context", exact: true }).click();
  await expect(page.locator(".research-preview")).toContainText("Checked onchain", { timeout: 45000 });
  await page.getByLabel("Category", { exact: true }).selectOption("health");
  await expect(page.getByLabel("Venus Core account address (optional)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Read live context", exact: true })).toBeDisabled();
});

test("changing reviewed task inputs invalidates a live signed quote", async ({ page }) => {
  await page.goto("/agents/scan-56-341225");
  await page.getByRole("button", { name: "Review activation", exact: true }).click();
  await page.getByRole("button", { name: "Get a verified price quote", exact: true }).click();
  await expect(page.getByText("Seller signature checked", { exact: true })).toBeVisible({ timeout: 60000 });
  await page.getByRole("checkbox").check();
  await page.getByLabel("Strategy budget (optional)").fill("7000");
  await expect(page.getByText("Seller signature checked", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Connect account to activate", exact: true })).toHaveCount(0);
});
