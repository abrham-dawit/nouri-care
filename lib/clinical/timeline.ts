import { GLUCOSE_CONTEXT_LABEL, severityPhrase, sleepHoursText } from "./labels";
import type { EntryOrigin, PatientRecord, Source } from "./types";

export type TimelineKind = "glucose" | "sleep" | "meal" | "hydration" | "reminder" | "symptom" | "check_in" | "appointment";

export type TimelineItem = {
  id: string;
  at: string;
  kind: TimelineKind;
  title: string;
  detail?: string;
  quote?: string;
  source: Source;
  /** A secondary source on the same item, e.g. an AI calorie estimate on a meal. */
  extraSource?: { source: Source; text: string };
  /** Present when the entry came from a conversation the patient confirmed. */
  fromConversation?: boolean;
};

const RESPONSE_LABEL = {
  acknowledged: "Acknowledged",
  snoozed: "Snoozed",
  no_response: "No response",
} as const;

export const TIMELINE_KIND_LABEL: Record<TimelineKind, string> = {
  glucose: "Glucose",
  sleep: "Sleep",
  meal: "Meals",
  hydration: "Hydration",
  reminder: "Reminders",
  symptom: "Symptoms",
  check_in: "Check-ins",
  appointment: "Appointments",
};

const conv = (origin?: EntryOrigin) => (origin ? { fromConversation: true, quote: origin.quote } : {});

/** Every observation as one chronological, source-labelled feed (newest first). */
export function buildTimeline(record: PatientRecord): TimelineItem[] {
  const items: TimelineItem[] = [
    ...record.glucose.map((r) => ({
      id: r.id,
      at: r.at,
      kind: "glucose" as const,
      title: `${r.value} mg/dL`,
      detail: `${GLUCOSE_CONTEXT_LABEL[r.context]} · ${r.source === "device_reading" ? "from paired meter" : "read aloud by patient"}`,
      source: r.source,
      ...conv(r.origin),
    })),
    ...record.sleep.map((e) => ({
      id: e.id,
      at: e.at,
      kind: "sleep" as const,
      title: `${sleepHoursText(e)} · ${e.quality} sleep`,
      quote: e.quote,
      source: e.source,
      ...conv(e.origin),
    })),
    ...record.meals.map((m) => ({
      id: m.id,
      at: m.at,
      kind: "meal" as const,
      title: `${m.meal[0].toUpperCase()}${m.meal.slice(1)}: ${m.description}`,
      source: m.source,
      extraSource: m.aiCalorieEstimate
        ? { source: "ai_estimate" as const, text: `≈${m.aiCalorieEstimate.kcal} kcal (AI estimate, informational only)` }
        : undefined,
      ...conv(m.origin),
    })),
    ...record.hydration.map((h) => ({
      id: h.id,
      at: h.at,
      kind: "hydration" as const,
      title: `About ${h.glasses} glasses of water`,
      source: h.source,
      ...conv(h.origin),
    })),
    ...record.reminders.map((r) => ({
      id: r.id,
      at: r.at,
      kind: "reminder" as const,
      title: `${r.medication} reminder: ${RESPONSE_LABEL[r.response]}`,
      detail: r.response === "acknowledged" ? "Patient responded to Nouri. Intake not confirmed." : undefined,
      source: r.source,
    })),
    ...record.symptoms.map((s) => ({
      id: s.id,
      at: s.at,
      kind: "symptom" as const,
      title: `${s.symptom} (${severityPhrase(s)})`,
      quote: s.quote,
      source: s.source,
      ...conv(s.origin),
    })),
    ...record.checkIns.map((c) => ({
      id: c.id,
      at: c.at,
      kind: "check_in" as const,
      title: `${c.kind === "conversation" ? "Mood in conversation" : c.kind === "morning" ? "Morning check-in" : "Evening check-in"}: ${c.mood}`,
      quote: c.quote,
      source: c.source,
      ...conv(c.origin),
    })),
    ...record.appointments.map((a) => ({
      id: a.id,
      at: a.at,
      kind: "appointment" as const,
      title: `${a.kind} with ${a.clinician} (${a.status})`,
      detail: a.summary,
      source: a.source,
    })),
  ];
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
