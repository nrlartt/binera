import { createPublicClient, http } from "viem";

/**
 * Read-only client for the protocol contracts. Defaults to BSC, but can point
 * at a local Hardhat node through BINERA_PROTOCOL_RPC for integration testing.
 * No wallet or signing key is involved.
 */
export const protocolClient = createPublicClient({
  transport: http(process.env.BINERA_PROTOCOL_RPC || process.env.BSC_RPC_URL || "https://bsc-dataseed.bnbchain.org", { timeout: 8000, retryCount: 1 }),
});
