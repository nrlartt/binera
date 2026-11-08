import { z } from "zod";
import { isAddress } from "viem";
import { cached, PublicError, remoteJson } from "./http";

const responseSchema = z.object({
  code: z.number(),
  message: z.string().optional(),
  result: z.record(z.string(), z.unknown()).optional(),
});

export type TokenSecurityFinding = { tokenAddress: string; content: string; observedAt: string; source: string; sourceUrl: string; note: string };

/** Pure normalizer so the provider response shape is testable without network access. */
export function normalizeTokenSecurity(input: unknown, tokenAddress: string): string {
  const parsed = responseSchema.parse(input);
  if (parsed.code !== 1) throw new PublicError("The security provider could not complete this check. This is not a safety signal.", 502);
  const entry = parsed.result?.[tokenAddress.toLowerCase()];
  if (!entry || typeof entry !== "object") throw new PublicError("The security provider has no findings for this token. This does not establish that it is safe.", 404);
  const text = JSON.stringify(entry, null, 2);
  if (text.length <= 18_000) return text;
  const suffix = "\n…truncated";
  return `${text.slice(0, 18_000 - suffix.length)}${suffix}`;
}

export function tokenSecurity(tokenAddress: string): Promise<TokenSecurityFinding> {
  if (!isAddress(tokenAddress)) throw new PublicError("Enter a valid BNB Chain token address.", 400);
  const normalized = tokenAddress.toLowerCase();
  return cached(`token-security-${normalized}`, async () => {
    const url = `https://api.gopluslabs.io/api/v1/token_security/56?contract_addresses=${encodeURIComponent(normalized)}`;
    let payload: unknown;
    try { payload = await remoteJson(url, { timeout: 12_000 }); } catch (error) {
      if (error instanceof PublicError) throw error;
      throw new PublicError("Token security research is temporarily unavailable. No finding was produced.", 502);
    }
    return {
      tokenAddress: normalized,
      content: normalizeTokenSecurity(payload, normalized),
      observedAt: new Date().toISOString(),
      source: "GoPlus token security API",
      sourceUrl: "https://docs.gopluslabs.io/reference/token-security-api",
      note: "Token-level findings from a public read-only provider, not a risk rating or an agent endorsement. Output is untrusted publisher data.",
    };
  }, 60_000);
}
