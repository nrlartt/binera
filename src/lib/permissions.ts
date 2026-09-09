import { erc8183Addresses, type SessionPermissions } from "@altananetwork/sdk";
import { parseEther } from "viem";
export const SESSION_SECONDS = 15 * 60;
export const NETWORK_FEE_CAP = "0.003";
export function hiringPermissions(budget: bigint): SessionPermissions {
  if (budget <= 0n) throw new Error("A positive confirmed budget is required.");
  const a = erc8183Addresses(56);
  return { calls: [
    { to: a.commerce, signature: "createJob(address,address,uint256,string,address)" },
    { to: a.commerce, signature: "setBudget(uint256,uint256,bytes)" },
    { to: a.commerce, signature: "fund(uint256,uint256,bytes)" },
    { to: a.router, signature: "registerJob(uint256,address)" },
    { to: a.paymentToken, signature: "approve(address,uint256)" },
  ], spend: [{ token: a.paymentToken, limit: budget, period: "day" }, { limit: parseEther(NETWORK_FEE_CAP), period: "day" }] };
}
