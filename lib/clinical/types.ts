/**
 * Clinical data model. Every record carries a `source` so the UI can always
 * distinguish what a patient said, what a device measured, what a clinician
 * entered, and what an AI estimated.
 */

import type { AIProvider } from "@/lib/ai/labels";

export type Source = "patient_report" | "device_reading" | "clinician_entry" | "ai_estimate" | "system";

export type Pronouns = "she/her" | "he/him" | "they/them";

export type Caregiver = {
  name: string;
  relationship: string;
  /** What the patient has consented to share with this person. */
  sharing: ("check_ins" | "reminders" | "glucose" | "visit_summaries" | "emergency")[];
};

export type Medication = {
  name: string;
  /** Times of day as "HH:MM" in the patient's local time. */
  times: string[];
  /** Instructions exactly as prescribed — Nouri never alters these. */
  instructions: string;
};

export type CarePlan = {
  source: "clinician_entry";
  approvedBy: string;
  approvedAt: string;
  glucoseTarget: { low: number; high: number; unit: "mg/dL" };
  medications: Medication[];
  checkIns: string[];
  goals: string[];
  notes: string;
};

export type Patient = {
  id: string;
  name: string;
  preferredName: string;
  pronouns: Pronouns;
  age: number;
  birthYear: number;
  location: string;
  livingSituation: string;
  conditions: string[];
  deviceId: string;
  primaryClinician: string;
  enrolledAt: string;
  caregivers: Caregiver[];
  carePlan: CarePlan;
  /** Things the patient asked Nouri to remember (companionship context). */
  interests: string[];
};

/** Set on entries that came from a conversation and were confirmed by the patient. */
export type EntryOrigin = {
  conversationTurnId: string;
  confirmedAt: string;
  /** The patient's exact words the entry was extracted from. */
  quote: string;
  extractedBy: AIProvider;
};

/** "unspecified" when the patient didn't say. Nouri never guesses the context. */
export type GlucoseContext = "fasting" | "before_meal" | "after_meal" | "bedtime" | "unspecified";

export type GlucoseReading = {
  id: string;
  at: string;
  value: number;
  unit: "mg/dL";
  context: GlucoseContext;
  /** device_reading = paired meter; patient_report = the patient read the number aloud. */
  source: "device_reading" | "patient_report";
  origin?: EntryOrigin;
};

export type SleepQuality = "poor" | "fair" | "good";

export type SleepEntry = {
  id: string;
  /** Morning the patient reported on (night before). */
  at: string;
  /** null when the patient didn't say how long they slept. */
  hoursReported: number | null;
  quality: SleepQuality;
  quote: string;
  source: "patient_report";
  origin?: EntryOrigin;
};

export type MealKind = "breakfast" | "lunch" | "dinner" | "snack";

export type MealEntry = {
  id: string;
  at: string;
  meal: MealKind;
  description: string;
  source: "patient_report";
  /** Optional AI estimate — informational only, never used for dosing. */
  aiCalorieEstimate?: { kcal: number; source: "ai_estimate" };
  origin?: EntryOrigin;
};

export type HydrationEntry = {
  id: string;
  at: string;
  glasses: number;
  source: "patient_report";
  origin?: EntryOrigin;
};

export type ReminderResponse = "acknowledged" | "snoozed" | "no_response";

export type ReminderEvent = {
  id: string;
  /** When Nouri delivered the reminder. */
  at: string;
  medication: string;
  /** Acknowledgment means the patient responded to Nouri — not that the dose was taken. */
  response: ReminderResponse;
  respondedAt?: string;
  source: "device_reading";
};

export type SymptomReport = {
  id: string;
  at: string;
  symptom: string;
  /** The patient's own description of severity, not a clinical grading. */
  severityReported: "mild" | "moderate" | "severe" | "not_stated";
  quote: string;
  source: "patient_report";
  origin?: EntryOrigin;
};

export type Mood = "good" | "okay" | "low";

export type CheckIn = {
  id: string;
  at: string;
  kind: "morning" | "evening" | "conversation";
  mood: Mood;
  quote: string;
  source: "patient_report";
  origin?: EntryOrigin;
};

export type Appointment = {
  id: string;
  at: string;
  kind: string;
  clinician: string;
  status: "completed" | "scheduled" | "cancelled";
  /** Clinician-entered visit notes, if any. */
  summary?: string;
  source: "clinician_entry";
};

export type BriefStatement = {
  text: string;
  /** Ids of the observations this statement is based on. */
  sourceIds: string[];
};

export type VisitBrief = {
  id: string;
  createdAt: string;
  periodStart: string;
  periodEnd: string;
  /** Who/what drafted it. Phase 2 drafts are template-generated, not AI. */
  generator: "rule_template" | "ai_agent";
  agent: "Doctor Report Agent";
  /** Status recorded on the brief itself; clinician decisions in the review store override it. */
  status: "pending_review" | "approved";
  reviewedBy?: string;
  reviewedAt?: string;
  sections: { heading: string; statements: BriefStatement[] }[];
  /**
   * Optional AI-drafted overview. Each sentence cites the template statements it
   * restates (keys like "2.1" = section 2, statement 1), so it stays traceable.
   */
  narrative?: {
    provider: AIProvider;
    model?: string;
    sentences: { text: string; refs: string[] }[];
    safetyPassed: boolean;
  };
};

export type PatientRecord = {
  patient: Patient;
  glucose: GlucoseReading[];
  sleep: SleepEntry[];
  meals: MealEntry[];
  hydration: HydrationEntry[];
  reminders: ReminderEvent[];
  symptoms: SymptomReport[];
  checkIns: CheckIn[];
  appointments: Appointment[];
  briefs: VisitBrief[];
};

export type RangeKey = "day" | "week" | "month";

export const RANGE_DAYS: Record<RangeKey, number> = { day: 1, week: 7, month: 30 };

export const RANGE_LABEL: Record<RangeKey, string> = {
  day: "Today",
  week: "7 days",
  month: "30 days",
};
