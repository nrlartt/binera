import { test, expect } from "@playwright/test";

test("wallet discovery, explicit connection, account changes and disconnect", async ({ page }) => {
  // Test-only EIP-1193 provider; no signatures or transfers are simulated.
  await page.addInitScript(() => {
    const listeners: Record<string, (() => void)[]> = {};
    const calls: string[] = [];
    const provider = {
      request: async ({ method }: { method: string }) => { calls.push(method); if (method === "eth_chainId") return "0x38"; if (method === "eth_requestAccounts") return ["0x1111111111111111111111111111111111111111"]; throw new Error("Unexpected wallet method"); },
      on: (name: string, fn: () => void) => { (listeners[name] ??= []).push(fn); },
      removeListener: (name: string, fn: () => void) => { listeners[name] = listeners[name]?.filter(f => f !== fn); },
    };
    Object.assign(window, { walletTestCalls: calls, changeWalletTestAccount: () => listeners.accountsChanged?.forEach(fn => fn()) });
    window.addEventListener("eip6963:requestProvider", () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info: { name: "Test Wallet", uuid: "test" }, provider } })));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Connect wallet", exact: true }).click();
  await page.getByRole("button", { name: "Connect Test Wallet" }).click();
  await expect(page.getByText("Test Wallet connected", { exact: true })).toBeVisible();
  await expect(page.getByText("0x1111111111111111111111111111111111111111", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close account dialog" }).click();
  await expect(page.locator(".wallet-button")).not.toContainText("Connect wallet");
  await page.evaluate(() => (window as unknown as { changeWalletTestAccount(): void }).changeWalletTestAccount());
  await expect(page.locator(".wallet-button")).toHaveText("Connect wallet");
  await page.locator(".wallet-button").click();
  await page.getByRole("button", { name: "Connect Test Wallet" }).click();
  await page.getByRole("button", { name: "Disconnect wallet", exact: true }).click();
  await expect(page.getByRole("button", { name: "Connect Test Wallet" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { walletTestCalls: string[] }).walletTestCalls)).toEqual(["eth_requestAccounts", "eth_chainId", "eth_requestAccounts", "eth_chainId"]);
});

test("no installed wallet keeps passkey onboarding available", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Connect wallet", exact: true }).click();
  await expect(page.getByText("No browser wallet detected.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create a passkey account" })).toBeDisabled();
  await page.getByLabel("I want a separate empty account.").check();
  await expect(page.getByRole("button", { name: "Create a passkey account" })).toBeEnabled();
});

test("saved passkey accounts restore after reload until explicitly disconnected", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("agentmarket-passkey-handle", JSON.stringify({
    address: "0x1111111111111111111111111111111111111111",
    credential: { kind: "webauthn", id: "test-credential_1", publicKey: `0x${"2".repeat(128)}`, rpId: location.hostname },
  })));
  await page.goto("/");
  await expect(page.locator(".wallet-button")).toContainText("0x1111");
  await page.locator(".wallet-button").click();
  await page.getByText("Saved accounts & recovery", { exact: true }).click();
  await expect(page.getByLabel("Saved marketplace account")).toHaveValue("test-credential_1");
  await expect(page.getByRole("button", { name: "Unlock saved account", exact: true })).toBeVisible();
  await expect(page.getByText("Your passkey is still required whenever an action needs a signature.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Disconnect this device session", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Unlock account", exact: true })).toBeVisible();
});

for (const mode of ["switch", "add", "reject", "unchanged"] as const) {
  test(`network detection and ${mode} response`, async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(({ mode }) => {
      let chain = "0x1"; let known = mode !== "add";
      const calls: string[] = []; const listeners: Record<string, ((id: string) => void)[]> = {};
      const provider = {
        request: async ({ method, params }: { method: string; params?: { chainId: string }[] }) => {
          calls.push(method);
          if (method === "eth_requestAccounts") return ["0x1111111111111111111111111111111111111111"];
          if (method === "eth_chainId") return chain;
          if (method === "wallet_addEthereumChain") { known = true; return null; }
          if (method === "wallet_switchEthereumChain") {
            if (params?.[0]?.chainId !== "0x38") throw new Error("Unexpected target chain");
            if (mode === "reject") throw { code: 4001 };
            if (!known) throw { code: 4902 };
            if (mode !== "unchanged") { chain = "0x38"; listeners.chainChanged?.forEach(fn => fn(chain)); }
            return null;
          }
          throw new Error("Unexpected method: " + method);
        },
        on: (event: string, fn: (id: string) => void) => { (listeners[event] ??= []).push(fn); },
        removeListener: (event: string, fn: (id: string) => void) => { listeners[event] = listeners[event]?.filter(f => f !== fn); },
      };
      Object.assign(window, { walletNetworkCalls: calls });
      window.addEventListener("eip6963:requestProvider", () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info: { name: "Network Test Wallet" }, provider } })));
    }, { mode });
    await page.goto("/"); await page.getByRole("button", { name: "Connect wallet", exact: true }).click();
    await page.getByRole("button", { name: "Connect Network Test Wallet" }).click();
    await expect(page.getByText("Network: Ethereum", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Copy wallet address", exact: true }).click();
    await expect(page.getByText("Copied", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("0x1111111111111111111111111111111111111111");
    await page.getByRole("button", { name: "Switch to BNB Smart Chain", exact: true }).click();
    if (mode === "reject" || mode === "unchanged") {
      await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Network switch was not");
      await expect(page.getByText("Network: Ethereum", { exact: true })).toBeVisible();
    } else {
      await expect(page.getByText("Network: BNB Smart Chain", { exact: true })).toBeVisible();
      await expect(page.getByText("Network Test Wallet connected", { exact: true })).toBeVisible();
    }
    const calls = await page.evaluate(() => (window as unknown as { walletNetworkCalls: string[] }).walletNetworkCalls);
    expect(calls.filter(c => c === "wallet_addEthereumChain").length).toBe(mode === "add" ? 1 : 0);
    expect(calls).not.toContain("eth_sendTransaction");
  });
}
