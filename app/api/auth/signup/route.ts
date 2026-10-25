import { cookies } from "next/headers";
import { homeFor, type Role } from "@/lib/auth/access";
import { ENROLLMENT_CODES, FAMILY_INVITE_CODES } from "@/lib/auth/demo-accounts";
import { cookieOptions, createToken, SESSION_COOKIE } from "@/lib/auth/token";
import { createUser, patientHasAccount, usernameTaken } from "@/lib/auth/users";

/**
 * POST /api/auth/signup  { role, name, username, password, code }
 *
 * The role someone picks only decides what they're asking for; access comes from proof:
 * - patient:   the clinic's enrollment code links the account to that patient's record
 * - family:    the patient's invite code links the account to that patient
 * - clinician: the account starts unverified and sees no patients until a clinic admin verifies it
 */

const ROLES: Role[] = ["patient", "family", "clinician"];
const bad = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bad("Please fill in the form.");
  }
  const str = (k: string, max: number) => (typeof body[k] === "string" ? (body[k] as string).trim().slice(0, max) : "");
  const role = body.role as Role;
  const name = str("name", 60);
  const username = str("username", 32).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const code = str("code", 40).toUpperCase();

  if (!ROLES.includes(role)) return bad("Choose who you are.");
  if (name.length < 2) return bad("Enter your full name.");
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) return bad("Username: 3–32 letters, numbers, dots, dashes or underscores.");
  if (password.length < 8 || password.length > 200) return bad("Password must be at least 8 characters.");
  if (await usernameTaken(username)) return bad("That username is taken. Try another.", 409);

  let patientIds: string[] = [];
  let verified = true;
  if (role === "patient") {
    const patientId = ENROLLMENT_CODES[code];
    if (!patientId) return bad("That enrollment code isn't valid. Ask your clinic for yours.");
    if (await patientHasAccount(patientId)) return bad("This patient already has an account.", 409);
    patientIds = [patientId];
  } else if (role === "family") {
    const patientId = FAMILY_INVITE_CODES[code];
    if (!patientId) return bad("That invite code isn't valid. Ask your family member for theirs.");
    patientIds = [patientId];
  } else {
    verified = false;
  }

  const user = await createUser({ username, password, displayName: name, role, patientIds, verified });
  (await cookies()).set(SESSION_COOKIE, createToken(user), cookieOptions);
  return Response.json({ redirect: homeFor(user) }, { status: 201 });
}
