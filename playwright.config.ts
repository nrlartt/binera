import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./tests/browser", timeout: 90000, workers: 1, use: { baseURL: process.env.TEST_URL || "http://localhost:3000", headless: true, trace: "retain-on-failure", screenshot: "only-on-failure", launchOptions: { channel: "msedge" } }, reporter: "list" });
