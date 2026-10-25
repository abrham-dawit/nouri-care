import "server-only";

import { canAccessPatient, type SessionUser } from "./access";
import { SESSION_COOKIE, verifyToken } from "./token";

/**
 * Server-side session checks for API routes. Reads the cookie from the request itself, so it
 * works in any route handler. Every data route re-checks here; proxy.ts is the first gate, not the only one.
 */

export function sessionFrom(request: Request): SessionUser | null {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return verifyToken(token ? decodeURIComponent(token) : null);
}

const deny = (status: number, error: string) => ({ response: Response.json({ error }, { status }) });

/** The signed-in user, or a 401 response. */
export function requireUser(request: Request): { user: SessionUser } | { response: Response } {
  const user = sessionFrom(request);
  return user ? { user } : deny(401, "Please sign in.");
}

/** The signed-in user if they may see `patientId`, or a 401/403 response. */
export function requirePatient(request: Request, patientId: string): { user: SessionUser } | { response: Response } {
  const auth = requireUser(request);
  if ("response" in auth) return auth;
  return canAccessPatient(auth.user, patientId) ? auth : deny(403, "You don't have access to this patient.");
}
