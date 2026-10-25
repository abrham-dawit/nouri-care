import { connection } from "next/server";
import { requirePatient } from "@/lib/auth/session";
import { getRecord } from "@/lib/clinical/synthetic";
import { parsePreferences } from "@/lib/voice/preferences";
import { getPreferences, setPreferences } from "@/lib/voice/store";

/**
 * GET/PUT /api/voice/preferences?patientId=…
 * The physical Nouri reads these too. Only accounts allowed to see the patient may read them,
 * and family members can't change them.
 */

function patientIdFrom(request: Request) {
  const id = new URL(request.url).searchParams.get("patientId");
  return id && getRecord(id) ? id : null;
}

export async function GET(request: Request) {
  await connection();
  const patientId = patientIdFrom(request);
  if (!patientId) return Response.json({ error: "Unknown patient." }, { status: 404 });
  const auth = requirePatient(request, patientId);
  if ("response" in auth) return auth.response;
  return Response.json({ preferences: getPreferences(patientId) });
}

export async function PUT(request: Request) {
  const patientId = patientIdFrom(request);
  if (!patientId) return Response.json({ error: "Unknown patient." }, { status: 404 });
  const auth = requirePatient(request, patientId);
  if ("response" in auth) return auth.response;
  if (auth.user.role === "family") return Response.json({ error: "Only the patient or their care team can change Nouri's voice." }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const parsed = parsePreferences(patientId, body);
  if (typeof parsed === "string") return Response.json({ error: parsed }, { status: 400 });
  setPreferences(parsed);
  return Response.json({ preferences: parsed });
}
