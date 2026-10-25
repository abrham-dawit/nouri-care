import { cookies } from "next/headers";
import { homeFor } from "@/lib/auth/access";
import { cookieOptions, createToken, SESSION_COOKIE } from "@/lib/auth/token";
import { verifyLogin } from "@/lib/auth/users";

/** POST /api/auth/login  { username, password } → sets the session cookie, returns where to go. */

const WINDOW_MS = 10 * 60_000;
const MAX_FAILS = 10;
const g = globalThis as unknown as { __nouriLoginFails?: Map<string, number[]> };
g.__nouriLoginFails ??= new Map();

export async function POST(request: Request) {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send your username and password." }, { status: 400 });
  }
  const username = typeof body.username === "string" ? body.username.slice(0, 64) : "";
  const password = typeof body.password === "string" ? body.password.slice(0, 200) : "";
  if (!username || !password) return Response.json({ error: "Enter your username and password." }, { status: 400 });

  // Slow down password guessing per username.
  const key = username.trim().toLowerCase();
  const now = Date.now();
  const fails = (g.__nouriLoginFails!.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (fails.length >= MAX_FAILS) return Response.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });

  const user = await verifyLogin(username, password);
  if (!user) {
    g.__nouriLoginFails!.set(key, [...fails, now]);
    return Response.json({ error: "That username and password don't match." }, { status: 401 });
  }
  g.__nouriLoginFails!.delete(key);
  (await cookies()).set(SESSION_COOKIE, createToken(user), cookieOptions);
  return Response.json({ redirect: homeFor(user), user: { name: user.name, role: user.role } });
}
