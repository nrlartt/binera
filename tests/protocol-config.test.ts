import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readProtocolConfig, writeProtocolConfig } from "../src/lib/server/protocol-config";

const addresses = {
  stake: "0x1111111111111111111111111111111111111111",
  reputation: "0x2222222222222222222222222222222222222222",
  arbitration: "0x3333333333333333333333333333333333333333",
  vault: "0x4444444444444444444444444444444444444444",
};
const paymentToken = "0x55d398326f99059fF775485246999027B3197955";

async function tempFile() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "binera-protocol-"));
  return { file: path.join(dir, "protocol.json"), dir };
}

test("a written protocol configuration is read back from the runtime file", async () => {
  const { file, dir } = await tempFile();
  try {
    const written = await writeProtocolConfig({ addresses, paymentToken }, file);
    assert.equal(written.addresses.stake, addresses.stake);
    const read = await readProtocolConfig(file);
    assert.equal(read.source, "file");
    assert.equal(read.config?.paymentToken.toLowerCase(), paymentToken.toLowerCase());
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("invalid addresses are rejected before anything is persisted", async () => {
  const { dir } = await tempFile();
  try {
    await assert.rejects(() => writeProtocolConfig({ addresses: { ...addresses, stake: "0x123" }, paymentToken }, path.join(dir, "protocol.json")), /valid BSC address/i);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("missing configuration is reported as none rather than invented", async () => {
  const { dir } = await tempFile();
  try {
    const read = await readProtocolConfig(path.join(dir, "does-not-exist.json"));
    assert.equal(read.config, null);
    assert.equal(read.source, "none");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("environment configuration takes precedence over the runtime file", async () => {
  const keys = ["BINERA_STAKE_ADDRESS", "BINERA_REPUTATION_ADDRESS", "BINERA_ARBITRATION_ADDRESS", "BINERA_BOUNTY_VAULT_ADDRESS", "BINERA_PAYMENT_TOKEN_ADDRESS"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, {
      BINERA_STAKE_ADDRESS: addresses.stake,
      BINERA_REPUTATION_ADDRESS: addresses.reputation,
      BINERA_ARBITRATION_ADDRESS: addresses.arbitration,
      BINERA_BOUNTY_VAULT_ADDRESS: addresses.vault,
      BINERA_PAYMENT_TOKEN_ADDRESS: paymentToken,
    });
    const read = await readProtocolConfig("ignored.json");
    assert.equal(read.source, "env");
    assert.equal(read.config?.addresses.vault, addresses.vault);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
