import "server-only";

import { allowRequest, authenticateDevice, type AuthenticatedDevice } from "./registry";

/**
 * Shared guard for device and agent endpoints (/api/v1/*): a server-issued credential, the
 * per-device rate limit, and a small JSON body. The patient always comes from the registry.
 */

export const apiError = (status: number, code: string, error: string) => Response.json({ error, code }, { status });

export async function guard(request: Request): Promise<{ device: AuthenticatedDevice } | { response: Response }> {
  const device = authenticateDevice(request);
  if (!device) return { response: apiError(401, "unauthorized", "Missing or invalid device credential.") };
  if (!allowRequest(device.deviceId)) return { response: apiError(429, "rate_limited", "Too many requests. Please wait a moment.") };
  return { device };
}

/** Reads `{ text }` (1–1000 characters) from a JSON body. */
export async function readText(request: Request): Promise<{ text: string; body: Record<string, unknown> } | { response: Response }> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return { response: apiError(400, "bad_request", 'Body must be JSON, e.g. {"text":"..."}.') };
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return { response: apiError(400, "bad_request", "text is required.") };
  if (text.length > 1000) return { response: apiError(413, "too_long", "text is limited to 1000 characters.") };
  return { text, body };
}
