import { z } from "zod";
import { cached, remoteJson, requestJson, sameOrigin, errorResponse, PublicError } from "@/lib/server/http";
const slug = z.string().max(200).regex(/^[a-z0-9._/-]+$/);
const resource = z.object({ slug, method: z.enum(["POST", "GET"]), description: z.string(), pricing: z.object({ amount: z.string().optional(), asset: z.string(), network: z.string() }).optional() });
const catalogue = () => cached("xona-resources", async () => z.array(resource).max(500).parse(await remoteJson("https://api.xona-agent.com/x402-resources")), 60000);
export async function GET() {
  try { return Response.json({ resources: await catalogue(), observedAt: new Date().toISOString(), source: "https://api.xona-agent.com/x402-resources" }); } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = z.object({ slug }).parse(await requestJson(request));
    const selected = (await catalogue()).find(item => item.slug === input.slug);
    if (!selected || selected.method !== "POST") throw new PublicError("This resource does not support this payment preview.", 409);
    // Empty unsigned request only. Never forward wallet credentials or payment headers.
    const response = await remoteJson(`https://api.xona-agent.com/${selected.slug}`, { body: {}, allowPaymentRequired: true });
    const payment = z.object({ x402Version: z.number(), accepts: z.array(z.object({ network: z.string(), asset: z.string(), payTo: z.string(), amount: z.string().optional(), maxAmountRequired: z.string().optional() })).min(1) }).parse(response);
    return Response.json({ ...payment, observedAt: new Date().toISOString(), paid: false });
  } catch (error) { return errorResponse(error); }
}
