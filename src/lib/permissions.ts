import { erc8183Addresses, type SessionPermissions } from "@altananetwork/sdk";
import { formatUnits, parseEther } from "viem";
export const SESSION_SECONDS = 15 * 60;
export const NETWORK_FEE_CAP = "0.003";
export function hiringBalanceIssue(native: bigint, payment: bigint | null, price: bigint) {
  if (payment === null) return "Your U balance could not be verified. Retry the balance check before approving a payment.";
  if (payment < price) return `Your marketplace account has ${formatUnits(payment, 18)} U; this quote needs ${formatUnits(price, 18)} U (short by ${formatUnits(price - payment, 18)} U).`;
  if (native <= 0n) return `Your marketplace account has no BNB for network fees. Add a small BNB balance. The permission cap is ${NETWORK_FEE_CAP} BNB; it is not a fixed charge.`;
  return null;
}
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
