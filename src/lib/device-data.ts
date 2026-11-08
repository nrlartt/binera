/**
 * Device-data inventory. Only public references are summarised or exported;
 * passkey references are counted so the user understands what is stored but
 * every clear scope deliberately excludes them.
 */
export const DEVICE_KEYS = {
  saved: "binera-saved",
  compare: "agentmarket-compare",
  activity: "agentmarket-activity-v1",
  passkeys: "binera-passkey-accounts-v1",
  legacyPasskey: "agentmarket-passkey-handle",
} as const;

export type PublicScope = "saved" | "compare" | "activity";
type StorageLike = Pick<Storage, "getItem" | "removeItem">;

function parseArray(raw: string | null): unknown[] {
  try { const value: unknown = JSON.parse(raw ?? "[]"); return Array.isArray(value) ? value : []; } catch { return []; }
}

export function summarizeDeviceData(storage: StorageLike) {
  const passkeyAccounts = parseArray(storage.getItem(DEVICE_KEYS.passkeys)).length;
  const legacyPasskey = storage.getItem(DEVICE_KEYS.legacyPasskey) ? 1 : 0;
  return {
    saved: parseArray(storage.getItem(DEVICE_KEYS.saved)).length,
    compare: parseArray(storage.getItem(DEVICE_KEYS.compare)).length,
    activity: parseArray(storage.getItem(DEVICE_KEYS.activity)).length,
    passkeys: passkeyAccounts + legacyPasskey,
  };
}

export function exportDeviceData(storage: StorageLike) {
  return {
    exportedAt: new Date().toISOString(),
    note: "Public selections and job references only. Passkey references and signing material are intentionally excluded; export them from the account dialog.",
    saved: parseArray(storage.getItem(DEVICE_KEYS.saved)),
    compare: parseArray(storage.getItem(DEVICE_KEYS.compare)),
    activity: parseArray(storage.getItem(DEVICE_KEYS.activity)),
  };
}

const scopeKeys: Record<PublicScope, string> = {
  saved: DEVICE_KEYS.saved,
  compare: DEVICE_KEYS.compare,
  activity: DEVICE_KEYS.activity,
};

export function clearDeviceData(storage: StorageLike, scopes: PublicScope[]): string[] {
  const cleared: string[] = [];
  for (const scope of scopes) {
    if (!(scope in scopeKeys)) continue;
    storage.removeItem(scopeKeys[scope]);
    cleared.push(scopeKeys[scope]);
  }
  return cleared;
}
