import "server-only";

/** Generated reply audio, kept briefly in memory so the device can download it. */

const TTL_MS = 15 * 60 * 1000;
const MAX_ITEMS = 50;

type Entry = { wav: Buffer; deviceId: string; createdAt: number };
const g = globalThis as unknown as { __nouriAudio?: Map<string, Entry> };
g.__nouriAudio ??= new Map();
const store = g.__nouriAudio;

function prune() {
  const now = Date.now();
  for (const [id, e] of store) if (now - e.createdAt > TTL_MS) store.delete(id);
  while (store.size > MAX_ITEMS) store.delete(store.keys().next().value!);
}

export function saveReplyAudio(interactionId: string, deviceId: string, wav: Buffer) {
  prune();
  store.set(interactionId, { wav, deviceId, createdAt: Date.now() });
}

/** Only the device that made the request can fetch its reply. */
export function getReplyAudio(interactionId: string, deviceId: string) {
  prune();
  const e = store.get(interactionId);
  return e && e.deviceId === deviceId ? e.wav : null;
}
