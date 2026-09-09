import { isAddress, parseAbi, formatEther, formatUnits } from "viem";
import { BNB, erc8183Addresses } from "@altananetwork/sdk";
import { publicClient } from "@/lib/server/chain";
import { errorResponse, PublicError } from "@/lib/server/http";
export async function GET(request: Request, ctx: { params: Promise<{ address: string }> }) {
  try {
    const { address } = await ctx.params; if (!isAddress(address)) throw new PublicError("Invalid account address.", 400);
    const params = new URL(request.url).searchParams;
    const offset = Number(params.get("offset") ?? "0"); const requestedBlock = params.get("block");
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000 || (requestedBlock && !/^\d{1,15}$/.test(requestedBlock))) throw new PublicError("Invalid permission page.", 400);
    const blockNumber = requestedBlock ? BigInt(requestedBlock) : await publicClient.getBlockNumber();
    const abi = parseAbi(["function getKeys(address) view returns (bytes32[])", "function getPublicKey(address,bytes32) view returns (bytes)", "function isValidKey(address,bytes32) view returns (bool)"]);
    const [native, payment, keys] = await Promise.all([
      publicClient.getBalance({ address, blockNumber }),
      publicClient.readContract({ address: erc8183Addresses(56).paymentToken, abi: parseAbi(["function balanceOf(address) view returns (uint256)"]), functionName: "balanceOf", args: [address], blockNumber }),
      publicClient.readContract({ address: BNB.keyStore, abi, functionName: "getKeys", args: [address], blockNumber }),
    ]);
    const sessions = await Promise.all(keys.slice(offset, offset + 50).map(async keyId => {
      const [publicKey, valid] = await Promise.all([publicClient.readContract({ address: BNB.keyStore, abi, functionName: "getPublicKey", args: [address, keyId], blockNumber }), publicClient.readContract({ address: BNB.keyStore, abi, functionName: "isValidKey", args: [address, keyId], blockNumber })]);
      return { keyId, publicKey, valid };
    }));
    return Response.json({ address, native: formatEther(native), payment: formatUnits(payment, 18), keys: sessions, truncated: keys.length > offset + 50, nextOffset: keys.length > offset + 50 ? offset + 50 : null, block: blockNumber.toString(), observedAt: new Date().toISOString() });
  } catch (e) { return errorResponse(e); }
}
