import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { isAddress } from "viem";

const address = z.string().refine(value => isAddress(value), "Enter a valid BSC address.");
const schema = z.object({
  addresses: z.object({ stake: address, reputation: address, arbitration: address, vault: address }),
  paymentToken: address,
  updatedAt: z.iso.datetime(),
});
export type ProtocolConfig = z.infer<typeof schema>;
export type ProtocolSource = "env" | "file" | "none";

const envKeys = { stake: "BINERA_STAKE_ADDRESS", reputation: "BINERA_REPUTATION_ADDRESS", arbitration: "BINERA_ARBITRATION_ADDRESS", vault: "BINERA_BOUNTY_VAULT_ADDRESS" } as const;

function fromEnv(): ProtocolConfig | null {
  const addresses = { stake: process.env[envKeys.stake], reputation: process.env[envKeys.reputation], arbitration: process.env[envKeys.arbitration], vault: process.env[envKeys.vault] };
  if (!Object.values(addresses).every(value => value && isAddress(value))) return null;
  const paymentToken = process.env.BINERA_PAYMENT_TOKEN_ADDRESS;
  if (!paymentToken || !isAddress(paymentToken)) return null;
  return { addresses: addresses as ProtocolConfig["addresses"], paymentToken, updatedAt: new Date().toISOString() };
}

export function protocolConfigFile() {
  return process.env.PROTOCOL_CONFIG_PATH || path.join(process.cwd(), ".data", "protocol.json");
}

export async function readProtocolConfig(file = protocolConfigFile()): Promise<{ config: ProtocolConfig | null; source: ProtocolSource }> {
  const env = fromEnv();
  if (env) return { config: env, source: "env" };
  try {
    const parsed = schema.parse(JSON.parse(await fs.readFile(file, "utf8")));
    return { config: parsed, source: "file" };
  } catch {
    return { config: null, source: "none" };
  }
}

export async function writeProtocolConfig(input: unknown, file = protocolConfigFile()): Promise<ProtocolConfig> {
  const parsed = schema.parse({ ...(input as object), updatedAt: new Date().toISOString() });
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(parsed), "utf8");
  await fs.rename(temp, file);
  return parsed;
}

export function protocolCacheKey(config: ProtocolConfig | null): string {
  if (!config) return "protocol-status-none";
  return `protocol-status-${config.addresses.stake}-${config.addresses.reputation}-${config.addresses.arbitration}-${config.addresses.vault}`.toLowerCase();
}
