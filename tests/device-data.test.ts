import { test } from "node:test";
import assert from "node:assert/strict";
import { clearDeviceData, DEVICE_KEYS, exportDeviceData, summarizeDeviceData } from "../src/lib/device-data";

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    removeItem: (key: string) => { map.delete(key); },
    has: (key: string) => map.has(key),
  };
}

test("device summary counts arrays and does not crash on invalid JSON", () => {
  const storage = memoryStorage({
    [DEVICE_KEYS.saved]: JSON.stringify(["scan-56-1", "scan-56-2"]),
    [DEVICE_KEYS.compare]: "not-json",
    [DEVICE_KEYS.activity]: JSON.stringify([{ id: "0x01" }, { id: "0x02" }, { id: "0x03" }]),
    [DEVICE_KEYS.passkeys]: JSON.stringify([{ address: "0xabc" }]),
    [DEVICE_KEYS.legacyPasskey]: "{}",
  });
  assert.deepEqual(summarizeDeviceData(storage), { saved: 2, compare: 0, activity: 3, passkeys: 2 });
});

test("exporting public references never includes passkey material", () => {
  const storage = memoryStorage({
    [DEVICE_KEYS.saved]: JSON.stringify(["scan-56-1"]),
    [DEVICE_KEYS.activity]: JSON.stringify([{ id: "0x01" }]),
    [DEVICE_KEYS.passkeys]: JSON.stringify([{ credential: { id: "secret-handle" } }]),
  });
  const exported = exportDeviceData(storage);
  const text = JSON.stringify(exported);
  assert.equal(text.includes("secret-handle"), false);
  assert.equal(exported.saved.length, 1);
  assert.equal(exported.activity.length, 1);
});

test("clearing a scope removes only that scope and never passkey references", () => {
  const storage = memoryStorage({
    [DEVICE_KEYS.saved]: JSON.stringify(["scan-56-1"]),
    [DEVICE_KEYS.compare]: JSON.stringify(["scan-56-1"]),
    [DEVICE_KEYS.activity]: JSON.stringify([{ id: "0x01" }]),
    [DEVICE_KEYS.passkeys]: JSON.stringify([{ address: "0xabc" }]),
  });
  const cleared = clearDeviceData(storage, ["saved", "activity"]);
  assert.deepEqual(cleared.sort(), [DEVICE_KEYS.saved, DEVICE_KEYS.activity].sort());
  assert.equal(storage.has(DEVICE_KEYS.saved), false);
  assert.equal(storage.has(DEVICE_KEYS.activity), false);
  assert.equal(storage.has(DEVICE_KEYS.compare), true);
  assert.equal(storage.has(DEVICE_KEYS.passkeys), true);
});

test("unknown scopes are ignored rather than deleting unexpected keys", () => {
  const storage = memoryStorage({ [DEVICE_KEYS.saved]: "[]" });
  const cleared = clearDeviceData(storage, ["everything" as "saved"]);
  assert.deepEqual(cleared, []);
  assert.equal(storage.has(DEVICE_KEYS.saved), true);
});
