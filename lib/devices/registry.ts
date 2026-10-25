import "server-only";

/**
 * Device authentication for physical Nouri units.
 *
 * Each device gets a random credential from `npm run device:issue` (scripts/issue-device-token.mjs).
 * The server stores only a SHA-256 hash of it, together with the device id and the patient it
 * belongs to. The patient is always taken from this server-side mapping; anything the device
 * claims about which patient it serves is ignored.
 *
 * Prototype storage: `.data/devices.json` (git-ignored). Production needs a real secret store,
 * credential rotation and revocation auditing.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getRecord } from "@/lib/clinical/synthetic";

export type DeviceRecord = { deviceId: string; patientId: string; tokenSha256: string; issuedAt: string; revoked?: boolean };
export type AuthenticatedDevice = { deviceId: string; patientId: string };

const REGISTRY_PATH = join(process.cwd(), ".data", "devices.json");

function loadDevices(): DeviceRecord[] {
  try {
    const data = JSON.parse(readFileSync(REGISTRY_PATH, "utf8")) as { devices?: DeviceRecord[] };
    return Array.isArray(data.devices) ? data.devices : [];
  } catch {
    return [];
  }
}

export const registryIsEmpty = () => loadDevices().filter((d) => !d.revoked).length === 0;

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest();

/** Resolves `Authorization: Bearer <credential>` to a registered device, or null. */
export function authenticateDevice(request: Request): AuthenticatedDevice | null {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S{20,200})$/i);
  if (!match) return null;
  const presented = sha256(match[1]);
  let found: DeviceRecord | null = null;
  // Compare against every record in constant time per record (no early exit on a match).
  for (const d of loadDevices()) {
    const stored = Buffer.from(d.tokenSha256, "hex");
    if (stored.length === presented.length && timingSafeEqual(stored, presented) && !d.revoked) found = d;
  }
  if (!found || !getRecord(found.patientId)) return null;
  return { deviceId: found.deviceId, patientId: found.patientId };
}

/* ── simple per-device rate limit (in memory) ── */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const g = globalThis as unknown as { __nouriRate?: Map<string, number[]> };
g.__nouriRate ??= new Map();

/** True if the device is within its budget (and records this request). */
export function allowRequest(deviceId: string) {
  const now = Date.now();
  const recent = (g.__nouriRate!.get(deviceId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    g.__nouriRate!.set(deviceId, recent);
    return false;
  }
  recent.push(now);
  g.__nouriRate!.set(deviceId, recent);
  return true;
}
