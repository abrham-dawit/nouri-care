import "server-only";

/**
 * Reminders created for a patient (by the Planning Agent, from ASI:One or a Nouri device).
 * Medication reminders never carry a dose: they always say "as prescribed by your care team".
 * Prototype storage: in memory, cleared when the server restarts.
 */

import { randomUUID } from "node:crypto";
import { screenText } from "@/lib/safety/boundaries";

export type ReminderKind = "medication" | "check_in" | "hydration" | "meal" | "appointment" | "other";
export type Reminder = {
  id: string;
  patientId: string;
  title: string;
  /** 24-hour "HH:MM" in the patient's local time. */
  time: string;
  repeat: "daily" | "once";
  kind: ReminderKind;
  createdBy: string;
  createdAt: string;
  /** Set when the requested wording was replaced to remove dosing details. */
  safetyNote?: string;
};

const MAX_PER_PATIENT = 50;
const g = globalThis as unknown as { __nouriReminders?: Map<string, Reminder[]> };
g.__nouriReminders ??= new Map();

export const MEDICATION_TITLE = "Take your medication as prescribed by your care team";

export function addReminder(input: Omit<Reminder, "id" | "createdAt" | "safetyNote">): Reminder {
  let title = input.title.replace(/\s+/g, " ").trim().slice(0, 120) || "Check in with Nouri";
  let safetyNote: string | undefined;
  // Nouri never sets or repeats doses, even ones a user asks for.
  if (input.kind === "medication" || screenText(title).length || /\b\d+(\.\d+)?\s?(units?|mg|ml|tablets?|pills?)\b/i.test(title)) {
    if (title !== MEDICATION_TITLE) safetyNote = "Dose details removed: Nouri doesn't set or repeat doses. Follow the care plan.";
    title = MEDICATION_TITLE;
  }
  const reminder: Reminder = { ...input, title, id: `rem-${randomUUID().slice(0, 8)}`, createdAt: new Date().toISOString(), safetyNote };
  const list = g.__nouriReminders!.get(input.patientId) ?? [];
  list.push(reminder);
  g.__nouriReminders!.set(input.patientId, list.slice(-MAX_PER_PATIENT));
  return reminder;
}

export function listReminders(patientId: string): Reminder[] {
  return [...(g.__nouriReminders!.get(patientId) ?? [])].sort((a, b) => a.time.localeCompare(b.time));
}

/** "08:00" → "8:00 AM". */
export function formatReminderTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
