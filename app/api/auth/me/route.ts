import { connection } from "next/server";
import { homeFor, navFor } from "@/lib/auth/access";
import { sessionFrom } from "@/lib/auth/session";

/** GET /api/auth/me → the signed-in user (for the header and menus), or { user: null }. */
export async function GET(request: Request) {
  await connection();
  const user = sessionFrom(request);
  if (!user) return Response.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
  return Response.json(
    { user: { name: user.name, role: user.role, patientIds: user.patientIds, verified: user.verified }, home: homeFor(user), nav: navFor(user) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
