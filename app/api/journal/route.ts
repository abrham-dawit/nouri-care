import { connection } from "next/server";
import { canAccessPatient } from "@/lib/auth/access";
import { requirePatient, requireUser } from "@/lib/auth/session";
import { getAllRecords, getRecord } from "@/lib/clinical/synthetic";
import { buildTimeline } from "@/lib/clinical/timeline";
import { emptyLiveEntries } from "@/lib/journal/observations";
import { liveBrief, liveEntries, recentTurns } from "@/lib/journal/store";

/**
 * Live, patient-confirmed journal data from conversations.
 *   GET /api/journal?patientId=…  → that patient's live entries, latest brief and recent turns
 *   GET /api/journal              → a per-patient summary for the clinician dashboard
 *
 * Each patient's data is returned only to accounts allowed to see that patient.
 */
export async function GET(request: Request) {
  await connection();
  const patientId = new URL(request.url).searchParams.get("patientId");

  if (patientId) {
    if (!getRecord(patientId)) return Response.json({ error: "Unknown patient." }, { status: 404 });
    const auth = requirePatient(request, patientId);
    if ("response" in auth) return auth.response;
    return Response.json({ entries: liveEntries(patientId), brief: liveBrief(patientId), turns: recentTurns(patientId) });
  }

  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  const patients = getAllRecords().filter((r) => canAccessPatient(auth.user, r.patient.id)).map((r) => {
    const live = liveEntries(r.patient.id);
    const asRecord = { ...r, ...emptyLiveEntries(), ...live, reminders: [], appointments: [], briefs: [] };
    const items = buildTimeline(asRecord);
    const brief = liveBrief(r.patient.id);
    return {
      patientId: r.patient.id,
      patientName: r.patient.name,
      newEntries: items.length,
      lastAt: items[0]?.at ?? null,
      items: items.slice(0, 5),
      brief: brief ? { id: brief.id, createdAt: brief.createdAt, periodStart: brief.periodStart, periodEnd: brief.periodEnd } : null,
    };
  });
  return Response.json({ patients });
}
