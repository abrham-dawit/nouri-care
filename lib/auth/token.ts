/**
 * Signed session cookie: base64url(JSON payload) + "." + HMAC-SHA256. Stateless, so proxy.ts can
 * verify it on every request without a database. The secret is NOURI_SESSION_SECRET (server only).
 * Not "server-only"-tagged because proxy.ts imports it; it never reaches browser code.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Role, SessionUser } from "./access";

export const SESSION_COOKIE = "nouri_session";
export const SESSION_MAX_AGE_S = 8 * 60 * 60;

type Payload = SessionUser & { exp: number };

function secret(): string {
  const s = process.env.NOURI_SESSION_SECRET?.trim();
  if (!s || s.length < 32) throw new Error("NOURI_SESSION_SECRET is missing or shorter than 32 characters.");
  return s;
}

const sign = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

export function createToken(user: SessionUser): string {
  const payload: Payload = { ...user, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_S };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

const ROLES: Role[] = ["patient", "family", "clinician"];

/** The signed-in user, or null for a missing, tampered or expired token. */
export function verifyToken(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const [data, mac] = token.split(".");
  if (!data || !mac) return null;
  let expected: Buffer;
  try {
    expected = Buffer.from(sign(data));
  } catch {
    return null; // no secret configured: nobody is signed in
  }
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as Payload;
    if (typeof p.exp !== "number" || p.exp < Date.now() / 1000) return null;
    if (!ROLES.includes(p.role) || !Array.isArray(p.patientIds)) return null;
    return { uid: p.uid, name: p.name, role: p.role, patientIds: p.patientIds, verified: p.verified === true };
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  // Plain HTTP on the local network for the demo; set NOURI_SECURE_COOKIES=1 behind HTTPS.
  secure: process.env.NOURI_SECURE_COOKIES === "1",
  path: "/",
  maxAge: SESSION_MAX_AGE_S,
};
