/**
 * Observations proposed from a conversation turn. Nothing here is saved until
 * the patient confirms it. Client-safe: used by both the companion UI and the server.
 */

import type { CheckIn, EntryOrigin, GlucoseContext, GlucoseReading, HydrationEntry, MealEntry, MealKind, Mood, SleepEntry, SleepQuality, SymptomReport } from "@/lib/clinical/types";
import { GLUCOSE_CONTEXT_LABEL } from "@/lib/clinical/labels";

/** `localLabel`: a short description in the patient's own language, for them to confirm. */
type Base = { id: string; quote: string; localLabel?: string };

export type ProposedObservation =
  | (Base & { kind: "sleep"; quality: SleepQuality; hours: number | null })
  | (Base & { kind: "meal"; meal: MealKind; description: string })
  | (Base & { kind: "hydration"; glasses: number })
  | (Base & { kind: "symptom"; symptom: string; severity: SymptomReport["severityReported"] })
  | (Base & { kind: "glucose"; value: number; context: GlucoseContext })
  | (Base & { kind: "mood"; mood: Mood });

export type ObservationKind = ProposedObservation["kind"];

export const OBSERVATION_JOURNAL: Record<ObservationKind, string> = {
  sleep: "Sleep journal",
  meal: "Meal journal",
  hydration: "Hydration journal",
  symptom: "Symptom report",
  glucose: "Glucose log (as you read it)",
  mood: "Mood check-in",
};

/** Plain-language description shown to the patient before they confirm. */
export function describeObservation(o: ProposedObservation): string {
  switch (o.kind) {
    case "sleep":
      return `You slept ${o.quality === "poor" ? "poorly" : o.quality === "fair" ? "okay" : "well"}${o.hours !== null ? `, about ${o.hours} hours` : ""}`;
    case "meal":
      return `${o.meal[0].toUpperCase()}${o.meal.slice(1)}: ${o.description}`;
    case "hydration":
      return `About ${o.glasses} glass${o.glasses === 1 ? "" : "es"} of water`;
    case "symptom":
      return `${o.symptom}${o.severity === "not_stated" ? "" : ` (${o.severity})`}`;
    case "glucose":
      return `Blood sugar ${o.value} mg/dL${o.context === "unspecified" ? "" : ` · ${GLUCOSE_CONTEXT_LABEL[o.context].toLowerCase()}`}`;
    case "mood":
      return `Feeling ${o.mood === "low" ? "low" : o.mood === "good" ? "good" : "okay"}`;
  }
}

export type LiveEntries = {
  glucose: GlucoseReading[];
  sleep: SleepEntry[];
  meals: MealEntry[];
  hydration: HydrationEntry[];
  symptoms: SymptomReport[];
  checkIns: CheckIn[];
};

export const emptyLiveEntries = (): LiveEntries => ({ glucose: [], sleep: [], meals: [], hydration: [], symptoms: [], checkIns: [] });

/** Turns confirmed observations into structured, source-labelled journal entries. */
export function toJournalEntries(observations: ProposedObservation[], at: string, origin: Omit<EntryOrigin, "quote">): LiveEntries {
  const out = emptyLiveEntries();
  for (const o of observations) {
    const meta = { id: `live-${o.id}`, at, source: "patient_report" as const, origin: { ...origin, quote: o.quote } };
    switch (o.kind) {
      case "sleep":
        out.sleep.push({ ...meta, hoursReported: o.hours, quality: o.quality, quote: o.quote });
        break;
      case "meal":
        out.meals.push({ ...meta, meal: o.meal, description: o.description });
        break;
      case "hydration":
        out.hydration.push({ ...meta, glasses: o.glasses });
        break;
      case "symptom":
        out.symptoms.push({ ...meta, symptom: o.symptom, severityReported: o.severity, quote: o.quote });
        break;
      case "glucose":
        out.glucose.push({ ...meta, value: o.value, unit: "mg/dL", context: o.context });
        break;
      case "mood":
        out.checkIns.push({ ...meta, kind: "conversation", mood: o.mood, quote: o.quote });
        break;
    }
  }
  return out;
}
