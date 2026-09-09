import assert from "node:assert/strict";
import test from "node:test";
import * as Hash from "ox/Hash";
import * as Hex from "ox/Hex";
import * as P256 from "ox/P256";
import * as PublicKey from "ox/PublicKey";
import { PASSKEY_ACCOUNTS_KEY, parsePasskeyAccounts, readPasskeyAccounts, recoverPasskeyPublicKey, savePasskeyAccounts, type PasskeyProof } from "../src/lib/passkey-accounts";

const rpId = "binera.example";
const account = { address: `0x${"1".repeat(40)}`, credential: { kind: "webauthn" as const, id: "test-credential_1", publicKey: `0x${"2".repeat(128)}`, rpId } };
function storage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, values };
}

test("passkey account references migrate without overwriting older wallets", () => {
  const state = storage({ "agentmarket-passkey-handle": JSON.stringify(account) });
  assert.deepEqual(readPasskeyAccounts(state, rpId), [account]);
  const second = { ...account, address: `0x${"3".repeat(40)}`, credential: { ...account.credential, id: "test-credential_2" } };
  const saved = savePasskeyAccounts(state, [second], rpId);
  assert.equal(saved.length, 2);
  assert.equal(JSON.parse(state.values.get(PASSKEY_ACCOUNTS_KEY)!).length, 2);
  assert.throws(() => parsePasskeyAccounts([{ ...account, credential: { ...account.credential, rpId: "other.example" } }], rpId));
  assert.throws(() => parsePasskeyAccounts([account, { ...account, address: second.address }], rpId));
});

test("two independent P256 proofs recover one stable passkey public key", () => {
  const privateKey = P256.randomPrivateKey();
  const expected = PublicKey.toHex(P256.getPublicKey({ privateKey }), { includePrefix: false }).toLowerCase();
  const proof = (suffix: string): PasskeyProof => {
    const metadata = { authenticatorData: `0x${"4".repeat(74)}` as `0x${string}`, clientDataJSON: `{"type":"webauthn.get","challenge":"${suffix}","origin":"https://${rpId}"}` };
    const payload = Hash.sha256(Hex.concat(metadata.authenticatorData, Hash.sha256(Hex.fromString(metadata.clientDataJSON))));
    const { r, s } = P256.sign({ payload, privateKey, extraEntropy: true });
    return { metadata, signature: { r, s } };
  };
  assert.equal(recoverPasskeyPublicKey([proof("first"), proof("second")]), expected);
  assert.throws(() => recoverPasskeyPublicKey([proof("only-one")]));
  const otherKey = P256.randomPrivateKey();
  const otherMetadata = { authenticatorData: `0x${"5".repeat(74)}` as `0x${string}`, clientDataJSON: "different" };
  const otherPayload = Hash.sha256(Hex.concat(otherMetadata.authenticatorData, Hash.sha256(Hex.fromString(otherMetadata.clientDataJSON))));
  const { r, s } = P256.sign({ payload: otherPayload, privateKey: otherKey });
  assert.throws(() => recoverPasskeyPublicKey([proof("first"), { metadata: otherMetadata, signature: { r, s } }]));
});
