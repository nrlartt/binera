import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { isAddress } from "viem";
import { cached, PublicError } from "./http";

// Only operator-configured transports are accepted, never URLs or commands from
// users or registry metadata. The single exposed tool is read-only.
export function termixSecurity(tokenAddress: string) {
  if (!isAddress(tokenAddress)) throw new PublicError("Enter a valid BNB Chain token address.", 400);
  return cached(`termix-security-${tokenAddress.toLowerCase()}`, async () => {
    const endpoint = process.env.TERMIX_MCP_URL;
    const command = process.env.TERMIX_COMMAND;
    if (!endpoint && !command) throw new PublicError("Token security research is not connected yet. This does not establish that a token is safe.", 503);
    if (endpoint && !endpoint.startsWith("https://")) throw new PublicError("The token research service needs a secure connection.", 503);
    const transport = endpoint ? new StreamableHTTPClientTransport(new URL(endpoint), { requestInit: { headers: process.env.TERMIX_MCP_TOKEN ? { Authorization: `Bearer ${process.env.TERMIX_MCP_TOKEN}` } : {} } }) : new StdioClientTransport({ command: command!, args: JSON.parse(process.env.TERMIX_ARGS || "[]"), stderr: "ignore" });
    const client = new Client({ name: "binera-token-research", version: "1.0.0" });
    try {
      await Promise.race([client.connect(transport), new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(new PublicError("Token research timed out.")), 10000); timer.unref(); })]);
      const tools = await client.listTools({}, { timeout: 10000 });
      if (!tools.tools.some(t => t.name === "Token_Security_Check")) throw new PublicError("The research service does not expose the supported read-only security tool.", 503);
      const result = await client.callTool({ name: "Token_Security_Check", arguments: { tokenAddress: tokenAddress.toLowerCase() } }, undefined, { timeout: 15000 });
      if (result.isError) throw new PublicError("The security provider could not complete this check.");
      const content = Array.isArray(result.content) ? result.content.filter(p => p.type === "text" && typeof p.text === "string").map(p => p.text).join("\n").slice(0, 18000) : "";
      if (!content) throw new PublicError("The security provider returned no findings.");
      return { tokenAddress, content, observedAt: new Date().toISOString(), source: "TermiX BSC MCP / GoPlus", sourceUrl: "https://github.com/TermiX-official/bsc-mcp", note: "Token-level findings, not a risk rating or an agent endorsement. Tool output is untrusted publisher data." };
    } finally { await client.close().catch(() => {}); await transport.close().catch(() => {}); }
  }, 60000);
}
