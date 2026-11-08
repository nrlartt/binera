/**
 * Reference A2A seller server.
 *
 *   SELLER_PRIVATE_KEY=0x... SELLER_BASE_URL=https://seller.example npm run seller
 *
 * The seller has to be registered on ERC-8004 with this wallet as its payment
 * wallet before Binera can hire it. This process never sends its key anywhere.
 */
import "../src/lib/server/load-env";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createSeller } from "../src/lib/seller-runtime";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const privateKey = required("SELLER_PRIVATE_KEY");
if (!/^0x[0-9a-f]{64}$/i.test(privateKey)) throw new Error("SELLER_PRIVATE_KEY must be a 32-byte hex key.");
const baseUrl = required("SELLER_BASE_URL").replace(/\/$/, "");
if (!/^https?:\/\//.test(baseUrl)) throw new Error("SELLER_BASE_URL must be an absolute URL.");
if (baseUrl.startsWith("http://") && !/localhost|127\.0\.0\.1/.test(baseUrl)) throw new Error("Use HTTPS for any public seller URL; the buyer only fetches HTTPS.");

const price = process.env.SELLER_PRICE || "100000000000000000";
const port = Number(process.env.SELLER_PORT || 4400);
const seller = createSeller({
  privateKey: privateKey as `0x${string}`,
  baseUrl,
  price,
  currency: process.env.SELLER_CURRENCY as `0x${string}` | undefined,
  name: process.env.SELLER_NAME || "Binera reference research seller",
  description: process.env.SELLER_DESCRIPTION,
});

function send(response: ServerResponse, status: number, body: string, type = "application/json") {
  response.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  response.end(body);
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > 128_000) throw new Error("Request body is too large.");
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", baseUrl);
  try {
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/.well-known/agent-card.json" || url.pathname === "/agent-card.json")) {
      return send(response, 200, JSON.stringify(seller.card));
    }
    if (request.method === "GET" && url.pathname === "/health") {
      return send(response, 200, JSON.stringify({ ok: true, address: seller.address }));
    }
    const delivery = url.pathname.match(/^\/deliverable\/(\d{1,20})$/);
    if (request.method === "GET" && delivery) {
      const text = seller.manifest(delivery[1]);
      if (!text) return send(response, 404, "No manifest for this job.", "text/plain");
      return send(response, 200, text, "text/markdown; charset=utf-8");
    }
    if (request.method === "POST" && url.pathname === "/") {
      const body = await readBody(request);
      const result = await seller.handle(body);
      return send(response, 200, JSON.stringify(result));
    }
    return send(response, 404, JSON.stringify({ error: "Not found." }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "The seller could not complete this request.";
    return send(response, 200, JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32000, message } }));
  }
});

server.listen(port, () => {
  console.log(`Seller listening on ${port}`);
  console.log(`Card: ${baseUrl}/.well-known/agent-card.json`);
  console.log(`Provider wallet: ${seller.address}`);
  console.log(`Price: ${price} base units`);
});
