import { formatUnits, parseAbi, type Address } from "viem";
import { publicClient, PANCAKE_FACTORY, pancakeSnapshot } from "@/lib/server/chain";
import { cached, errorResponse, PublicError } from "@/lib/server/http";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams; const kind = params.get("kind"); let address = params.get("address") || "";
    if (!["pool", "health"].includes(kind || "")) throw new PublicError("Choose pool or health context.", 400);
    if (!address && kind === "pool") address = (await pancakeSnapshot()).pool;
    if (!/^0x[0-9a-f]{40}$/i.test(address)) throw new PublicError("Enter a valid BNB Chain address.", 400);
    const data = await cached(`research-${kind}-${address.toLowerCase()}`, async () => {
      const block = await publicClient.getBlock(); const blockNumber = block.number;
      const base = { block: blockNumber.toString(), observedAt: new Date(Number(block.timestamp) * 1000).toISOString(), source: `https://bscscan.com/address/${address}` };
      if (kind === "health") {
        const comptroller = "0xfD36E2c2a6789Db23113685031d7F16329158384" as Address;
        const abi = parseAbi(["function getAccountLiquidity(address) view returns (uint256,uint256,uint256)", "function getAssetsIn(address) view returns (address[])"]);
        const [liquidity, markets] = await Promise.all([publicClient.readContract({ address: comptroller, abi, functionName: "getAccountLiquidity", args: [address as Address], blockNumber }), publicClient.readContract({ address: comptroller, abi, functionName: "getAssetsIn", args: [address as Address], blockNumber })]);
        if (liquidity[0] !== 0n) throw new PublicError("Venus could not value this account. No health conclusion is available.");
        return { ...base, title: "Venus Core account snapshot", facts: { "Entered markets": String(markets.length), "Account liquidity (USD)": formatUnits(liquidity[1], 18), "Account shortfall (USD)": formatUnits(liquidity[2], 18), "Health factor": "Not calculated" }, note: "Read-only protocol liquidity calculation, not a health-factor ratio or proof of no debt. Zero liquidity and shortfall do not establish safety. Other pools and protocols are excluded. No repayment or continuous monitoring is enabled." };
      }
      const abi = parseAbi(["function token0() view returns (address)", "function token1() view returns (address)", "function fee() view returns (uint24)", "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint32,bool)"]);
      const pool = address as Address;
      const [t0, t1, fee, slot] = await Promise.all([publicClient.readContract({ address: pool, abi, functionName: "token0", blockNumber }), publicClient.readContract({ address: pool, abi, functionName: "token1", blockNumber }), publicClient.readContract({ address: pool, abi, functionName: "fee", blockNumber }), publicClient.readContract({ address: pool, abi, functionName: "slot0", blockNumber })]);
      const registered = await publicClient.readContract({ address: PANCAKE_FACTORY, abi: parseAbi(["function getPool(address,address,uint24) view returns (address)"]), functionName: "getPool", args: [t0, t1, fee], blockNumber });
      if (registered.toLowerCase() !== pool.toLowerCase()) throw new PublicError("This address is not a registered PancakeSwap v3 pool.", 400);
      const tokenAbi = parseAbi(["function decimals() view returns (uint8)", "function symbol() view returns (string)"]);
      const [d0, d1, s0, s1] = await Promise.all([publicClient.readContract({ address: t0, abi: tokenAbi, functionName: "decimals", blockNumber }), publicClient.readContract({ address: t1, abi: tokenAbi, functionName: "decimals", blockNumber }), publicClient.readContract({ address: t0, abi: tokenAbi, functionName: "symbol", blockNumber }), publicClient.readContract({ address: t1, abi: tokenAbi, functionName: "symbol", blockNumber })]);
      const price = (Number(slot[0]) / 2 ** 96) ** 2 * 10 ** (d0 - d1);
      if (slot[0] === 0n || !Number.isFinite(price) || price <= 0) throw new PublicError("This pool has no usable initialized spot price.");
      return { ...base, title: `${s0.slice(0, 20)} / ${s1.slice(0, 20)}`, facts: { "Token 0": t0, "Token 1": t1, "Token1 per token0": price.toPrecision(8), "Fee tier": `${fee / 10000}%`, Tick: String(slot[1]), "Factory identity": "Checked onchain" }, note: "Spot price at this block, not a trading quote, APR, TVL or a risk assessment. Pool identity does not establish token safety." };
    }, 30000);
    return Response.json(data);
  } catch (e) { return errorResponse(e); }
}
