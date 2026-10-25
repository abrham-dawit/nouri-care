import { connection } from "next/server";
import { apiError, guard } from "@/lib/devices/api";
import { addReminder, formatReminderTime, listReminders, type Reminder, type ReminderKind } from "@/lib/reminders/store";

/**
 * Reminders for the authenticated device's patient (the Planning Agent's action).
 *   GET  → { reminders: [...] }
 *   POST { "title", "time": "HH:MM", "repeat": "daily"|"once", "kind", "agent" } → { reminder }
 */

const KINDS: ReminderKind[] = ["medication", "check_in", "hydration", "meal", "appointment", "other"];
const view = (r: Reminder) => ({ ...r, time_label: formatReminderTime(r.time) });

export async function GET(request: Request) {
  await connection();
  const auth = await guard(request);
  if ("response" in auth) return auth.response;
  return Response.json({ reminders: listReminders(auth.device.patientId).map(view) });
}

export async function POST(request: Request) {
  const auth = await guard(request);
  if ("response" in auth) return auth.response;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError(400, "bad_request", "Body must be JSON.");
  }
  const title = typeof body.title === "string" ? body.title : "";
  const time = typeof body.time === "string" ? body.time : "";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return apiError(400, "bad_request", 'time must be 24-hour "HH:MM".');
  const kind = KINDS.includes(body.kind as ReminderKind) ? (body.kind as ReminderKind) : "other";
  const repeat = body.repeat === "daily" ? "daily" : "once";
  const agent = typeof body.agent === "string" ? body.agent.slice(0, 60) : auth.device.deviceId;

  const reminder = addReminder({ patientId: auth.device.patientId, title, time, repeat, kind, createdBy: agent });
  return Response.json({ reminder: view(reminder) }, { status: 201 });
}
