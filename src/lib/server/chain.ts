import { createPublicClient, fallback, http, parseAbi, formatUnits, type Address } from "viem";
import { bsc } from "viem/chains";
import { BNB } from "@altananetwork/sdk";
import { cached } from "./http";

export const publicClient = createPublicClient({ chain: bsc, transport: fallback([http(process.env.BSC_RPC_URL || "https://bsc-dataseed.bnbchain.org", { timeout: 8000, retryCount: 1 }), http("https://bsc-rpc.publicnode.com", { timeout: 8000, retryCount: 1 })]) });
export const serverNetwork = { ...BNB, publicRpcUrl: process.env.BSC_RPC_URL || BNB.publicRpcUrl };
export const PANCAKE_FACTORY = "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865" as Address;
export const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" as Address;
export const USDT = "0x55d398326f99059fF775485246999027B3197955" as Address;
export function pancakeSnapshot() {
  return cached("pancake-snapshot", async () => {
    const block = await publicClient.getBlock(); const blockNumber = block.number;
    const pool = await publicClient.readContract({ address: PANCAKE_FACTORY, abi: parseAbi(["function getPool(address,address,uint24) view returns (address)"]), functionName: "getPool", args: [WBNB, USDT, 500], blockNumber });
    const abi = parseAbi(["function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint32 feeProtocol,bool unlocked)", "function token0() view returns (address)"]);
    const [slot, token0, balance0, balance1] = await Promise.all([
      publicClient.readContract({ address: pool, abi, functionName: "slot0", blockNumber }),
      publicClient.readContract({ address: pool, abi, functionName: "token0", blockNumber }),
      publicClient.readContract({ address: WBNB, abi: parseAbi(["function balanceOf(address) view returns (uint256)"]), functionName: "balanceOf", args: [pool], blockNumber }),
      publicClient.readContract({ address: USDT, abi: parseAbi(["function balanceOf(address) view returns (uint256)"]), functionName: "balanceOf", args: [pool], blockNumber }),
    ]);
    const ratio = (Number(slot[0]) / 2 ** 96) ** 2;
    const price = token0.toLowerCase() === WBNB.toLowerCase() ? ratio : 1 / ratio;
    return { pool, pair: "WBNB / USDT", protocol: "PancakeSwap v3", feePercent: 0.05, price, tick: slot[1], wbnbBalance: formatUnits(balance0, 18), usdtBalance: formatUnits(balance1, 18), blockNumber: blockNumber.toString(), timestamp: new Date(Number(block.timestamp) * 1000).toISOString(), fetchedAt: new Date().toISOString(), source: `https://bscscan.com/address/${pool}`, note: "Pool spot price and token balances. Balances include fees; these are not an APY, TVL estimate or executable quote." };
  }, 30000);
}
