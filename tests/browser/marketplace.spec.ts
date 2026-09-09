import { test, expect } from "@playwright/test";

test("live discovery, intent, detail, compatible comparison and account boundary", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/?catalog=registry"); await expect(page.getByRole("heading", { name: /Find the right agent/ })).toBeVisible();
  await expect(page.locator(".agent-card").first()).toBeVisible({ timeout: 40000 });
  await page.getByRole("button", { name: "All agents", exact: true }).click();
  await expect(page.locator(".agent-card").first()).toBeVisible({ timeout: 40000 });
  await expect(page.getByLabel("Loading agents")).toHaveCount(0);
  for (const category of ["Rebalancing", "Grid Trading", "Yield Optimisation", "Health Factor Monitoring"]) await expect(page.locator(".category-grid").getByRole("heading", { name: category, exact: true })).toBeVisible();
  await page.getByLabel("What would you like an agent to do?").fill("I have 5,000 USDT and want low-risk yield.");
  await page.getByRole("button", { name: "Find my agent" }).click();
  await expect(page.locator(".intent-summary")).toContainText("low risk requested", { timeout: 40000 });
  await expect(page.getByText("No agent meets every requested condition on this page.")).toBeVisible();
  const comparable = page.locator(".agent-card").filter({ hasText: "Yield Optimisation" });
  await expect(comparable.nth(1)).toBeVisible();
  await comparable.nth(0).locator(".compare-toggle").click();
  await expect(page.locator(".compare-dock").getByRole("link", { name: "Choose a second agent" })).toHaveAttribute("href", /\/category\//);
  await expect(page.locator(".compare-dock").getByRole("link", { name: "Compare agents" })).toHaveCount(0);
  await comparable.nth(1).locator(".compare-toggle").click();
  await page.locator(".compare-dock").getByRole("link", { name: "Compare agents" }).click();
  await expect(page.locator(".comparison-table")).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("row", { name: /Risk assessment/ })).toContainText("Not available");
  await page.locator(".comparison-table").getByRole("link", { name: "View agent" }).first().click();
  await expect(page.getByRole("heading", { name: "Evidence you can inspect" })).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Review activation" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Task and terms become public onchain.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Close activation", exact: true }).click();
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Your workspace starts here." })).toBeVisible();
  await page.getByRole("main").getByRole("button", { name: "Connect account" }).click();
  await expect(page.getByRole("button", { name: "Use an existing passkey" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("all categories render live source data", async ({ page }) => {
  for (const category of ["rebalancing", "grid", "yield", "health"]) {
    await page.goto(`/category/${category}`); await expect(page.locator(".agent-card").first()).toBeVisible({ timeout: 40000 });
    await expect(page.locator(".results-footer")).toContainText("8004scan");
  }
});

test("mobile navigation, no horizontal overflow and screenshots", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/");
  await expect(page.locator(".agent-card").first()).toBeVisible({ timeout: 40000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("link", { name: "My agents" }).click();
  await expect(page.getByRole("heading", { name: "Stay in the loop." })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1100 }); await page.goto("/"); await expect(page.locator(".agent-card").first()).toBeVisible();
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
});

test("live seller quote is reviewed before account activation", async ({ page }) => {
  // A real registry identity observed during integration research, not a fixture.
  await page.goto("/agents/scan-56-341225");
  await page.getByRole("button", { name: "Review activation" }).click();
  await page.getByRole("button", { name: "Get a verified price quote" }).click();
  await expect(page.getByText("Seller signature checked")).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole("button", { name: "Refresh price quote" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Connect account to activate" })).toBeDisabled();
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: "Connect account to activate" })).toBeEnabled();
  await page.getByRole("button", { name: "Connect account to activate" }).click();
  await expect(page.getByRole("heading", { name: "An account you control." })).toBeVisible();
  // No passkey ceremony, approval, payment or transaction is simulated.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "An account you control." })).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Put expertise to work." })).toBeVisible();
});
