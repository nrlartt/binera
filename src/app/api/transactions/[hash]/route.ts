import { decodeFunctionData, parseEventLogs, parseUnits, erc20Abi, formatUnits, TransactionReceiptNotFoundError } from "viem";
import { erc8183Addresses } from "@altananetwork/sdk";
import { publicClient } from "@/lib/server/chain";
import { errorResponse, PublicError } from "@/lib/server/http";
export async function GET(_request: Request, ctx: { params: Promise<{ hash: string }> }) {
  try {
    const { hash } = await ctx.params; if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new PublicError("Invalid transaction hash.", 400);
    const txHash = hash as `0x${string}`;
    const [receipt, tx] = await Promise.all([publicClient.getTransactionReceipt({ hash: txHash }), publicClient.getTransaction({ hash: txHash })]);
    let transfer: { from: string; to: string; asset: string; amount: string } | null = null;
    if (tx.to && tx.input === "0x") transfer = { from: tx.from, to: tx.to, asset: "BNB", amount: formatUnits(tx.value, 18) };
    if (tx.to?.toLowerCase() === erc8183Addresses(56).paymentToken.toLowerCase()) {
      try { const decoded = decodeFunctionData({ abi: erc20Abi, data: tx.input }); if (decoded.functionName === "transfer") transfer = { from: tx.from, to: decoded.args[0], asset: "U", amount: formatUnits(decoded.args[1], 18) }; } catch { /* Not a supported funding transfer. */ }
    }
    if (receipt.status === "success" && transfer?.asset === "U") {
      const expected = transfer;
      const tokenLogs = receipt.logs.filter(log => log.address.toLowerCase() === erc8183Addresses(56).paymentToken.toLowerCase());
      const transfers = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: tokenLogs, strict: true });
      if (!transfers.some(log => log.args.from.toLowerCase() === expected.from.toLowerCase() && log.args.to.toLowerCase() === expected.to.toLowerCase() && log.args.value === parseUnits(expected.amount, 18))) transfer = null;
    }
    return Response.json({ status: receipt.status === "success" ? "confirmed" : "reverted", hash, block: receipt.blockNumber.toString(), transfer, observedAt: new Date().toISOString() });
  } catch (e) { if (e instanceof TransactionReceiptNotFoundError) return Response.json({ status: "pending" }); return errorResponse(e); }
}
