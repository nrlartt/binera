import { z } from "zod";
import * as Hash from "ox/Hash";
import * as Hex from "ox/Hex";
import * as P256 from "ox/P256";
import * as PublicKey from "ox/PublicKey";

const handleSchema = z.object({
  address: z.string().regex(/^0x[0-9a-f]{40}$/i).transform(v => v as `0x${string}`),
  credential: z.object({ kind: z.literal("webauthn"), id: z.string().regex(/^[A-Za-z0-9_-]+$/).max(2048), publicKey: z.string().regex(/^0x(?:04)?[0-9a-f]{128}$/i).transform(v => v as `0x${string}`), rpId: z.string().min(1).max(253) }),
});
export type SavedPasskeyAccount = z.infer<typeof handleSchema>;
export const PASSKEY_ACCOUNTS_KEY = "binera-passkey-accounts-v1";
const legacyKey = "agentmarket-passkey-handle";
type StorageAccess = Pick<Storage, "getItem" | "setItem">;

export function parsePasskeyAccounts(input: unknown, rpId: string): SavedPasskeyAccount[] {
  const accounts = z.array(handleSchema).max(100).parse(input);
  if (accounts.some(a => a.credential.rpId !== rpId)) throw new Error("Open the original site domain to use this account backup.");
  const seen = new Map<string, SavedPasskeyAccount>();
  for (const account of accounts) {
    const prior = seen.get(account.credential.id);
    if (prior && (prior.address.toLowerCase() !== account.address.toLowerCase() || prior.credential.publicKey.toLowerCase() !== account.credential.publicKey.toLowerCase())) throw new Error("Conflicting public references for the same passkey.");
    seen.set(account.credential.id, account);
  }
  return [...seen.values()];
}
export function readPasskeyAccounts(storage: StorageAccess, rpId: string) {
  const raw = storage.getItem(PASSKEY_ACCOUNTS_KEY);
  const accounts = raw ? parsePasskeyAccounts(JSON.parse(raw), rpId) : [];
  const legacy = storage.getItem(legacyKey);
  if (legacy) {
    const parsed = handleSchema.safeParse(JSON.parse(legacy));
    if (parsed.success && parsed.data.credential.rpId === rpId) accounts.push(parsed.data);
  }
  return parsePasskeyAccounts(accounts, rpId);
}
export function savePasskeyAccounts(storage: StorageAccess, incoming: unknown, rpId: string) {
  // Never overwrite an older wallet handle when creating another account.
  const merged = parsePasskeyAccounts([...readPasskeyAccounts(storage, rpId), ...parsePasskeyAccounts(incoming, rpId)], rpId);
  storage.setItem(PASSKEY_ACCOUNTS_KEY, JSON.stringify(merged));
  return merged;
}

export type PasskeyProof = {
  metadata: { authenticatorData: `0x${string}`; clientDataJSON: string };
  signature: { r: bigint; s: bigint };
};

function proofPayload(proof: PasskeyProof) {
  // WebAuthn ES256 signs SHA-256(authenticatorData || SHA-256(clientDataJSON)).
  return Hash.sha256(Hex.concat(proof.metadata.authenticatorData, Hash.sha256(Hex.fromString(proof.metadata.clientDataJSON))));
}

function proofCandidates(proof: PasskeyProof) {
  const payload = proofPayload(proof);
  return [0, 1].flatMap(yParity => {
    try {
      const publicKey = P256.recoverPublicKey({ payload, signature: { ...proof.signature, yParity } });
      if (!P256.verify({ payload, signature: proof.signature, publicKey })) return [];
      return [PublicKey.toHex(publicKey, { includePrefix: false }).toLowerCase() as `0x${string}`];
    } catch { return []; }
  });
}

export function recoverPasskeyPublicKey(proofs: PasskeyProof[]) {
  if (proofs.length < 2) throw new Error("Two passkey confirmations are required for safe public-key recovery.");
  let shared = new Set(proofCandidates(proofs[0]));
  for (const proof of proofs.slice(1)) {
    const candidates = new Set(proofCandidates(proof));
    shared = new Set([...shared].filter(value => candidates.has(value)));
  }
  if (shared.size !== 1) throw new Error("The passkey public key could not be recovered unambiguously. No account reference was saved.");
  return [...shared][0];
}
