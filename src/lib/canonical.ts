/**
 * Canonical JSON used for signed marketplace envelopes.
 * Stable key order and unicode escaping so the exact bytes can be rebuilt
 * on the server without trusting any client-supplied copy.
 */
export function canonicalJson(value: unknown): string {
  const sort = (input: unknown): unknown => Array.isArray(input)
    ? input.map(sort)
    : input !== null && typeof input === "object"
      ? Object.fromEntries(Object.entries(input).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, sort(item)]))
      : input;
  return JSON.stringify(sort(value)).replace(/[\u007f-\uffff]/g, ch => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
}
