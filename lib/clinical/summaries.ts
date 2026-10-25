/**
 * Deterministic, rule-based summaries of a patient's recorded data. These are
 * plain arithmetic over source observations, never AI estimates or diagnoses.
 */

import { dayKey, localISO, rangeWindow, within, type TimeWindow } from "./time";
import type { CarePlan, GlucoseReading, PatientRecord, RangeKey, ReminderEvent, SleepEntry } from "./types";

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export type GlucoseStats = {
  count: number;
  deviceCount: number;
  reportedCount: number;
  mean: number | null;
  min: GlucoseReading | null;
  max: GlucoseReading | null;
  above: GlucoseReading[];
  below: GlucoseReading[];
  pctInTarget: number | null;
};

export function glucoseStats(readings: GlucoseReading[], target: CarePlan["glucoseTarget"], w: TimeWindow): GlucoseStats {
  const list = readings.filter((r) => within(r.at, w));
  const above = list.filter((r) => r.value > target.high);
  const below = list.filter((r) => r.value < target.low);
  const sorted = [...list].sort((a, b) => a.value - b.value);
  return {
    count: list.length,
    deviceCount: list.filter((r) => r.source === "device_reading").length,
    reportedCount: list.filter((r) => r.source === "patient_report").length,
    mean: avg(list.map((r) => r.value)),
    min: sorted[0] ?? null,
    max: sorted[sorted.length - 1] ?? null,
    above,
    below,
    pctInTarget: list.length ? ((list.length - above.length - below.length) / list.length) * 100 : null,
  };
}

export type SleepStats = { nights: number; avgHours: number | null; poor: SleepEntry[]; fair: number; good: number };

export function sleepStats(entries: SleepEntry[], w: TimeWindow): SleepStats {
  const list = entries.filter((e) => within(e.at, w));
  return {
    nights: list.length,
    avgHours: avg(list.map((e) => e.hoursReported).filter((h): h is number => h !== null)),
    poor: list.filter((e) => e.quality === "poor"),
    fair: list.filter((e) => e.quality === "fair").length,
    good: list.filter((e) => e.quality === "good").length,
  };
}

export type ReminderStats = {
  total: number;
  acknowledged: number;
  snoozed: ReminderEvent[];
  noResponse: ReminderEvent[];
  ackRate: number | null;
};

export function reminderStats(events: ReminderEvent[], w: TimeWindow): ReminderStats {
  const list = events.filter((e) => within(e.at, w));
  const acknowledged = list.filter((e) => e.response === "acknowledged").length;
  return {
    total: list.length,
    acknowledged,
    snoozed: list.filter((e) => e.response === "snoozed"),
    noResponse: list.filter((e) => e.response === "no_response"),
    ackRate: list.length ? (acknowledged / list.length) * 100 : null,
  };
}

export type PatientSummary = {
  glucose: GlucoseStats;
  sleep: SleepStats;
  reminders: ReminderStats;
  meals: number;
  avgGlasses: number | null;
  symptoms: number;
  mood: { good: number; okay: number; low: number };
  observations: number;
};

export function summarize(record: PatientRecord, w: TimeWindow): PatientSummary {
  const glucose = glucoseStats(record.glucose, record.patient.carePlan.glucoseTarget, w);
  const sleep = sleepStats(record.sleep, w);
  const reminders = reminderStats(record.reminders, w);
  const meals = record.meals.filter((m) => within(m.at, w)).length;
  const hydration = record.hydration.filter((h) => within(h.at, w));
  const symptoms = record.symptoms.filter((s) => within(s.at, w)).length;
  const checkIns = record.checkIns.filter((c) => within(c.at, w));
  const mood = {
    good: checkIns.filter((c) => c.mood === "good").length,
    okay: checkIns.filter((c) => c.mood === "okay").length,
    low: checkIns.filter((c) => c.mood === "low").length,
  };
  return {
    glucose,
    sleep,
    reminders,
    meals,
    avgGlasses: avg(hydration.map((h) => h.glasses)),
    symptoms,
    mood,
    observations: glucose.count + sleep.nights + meals + hydration.length + symptoms + checkIns.length,
  };
}

export const summarizeRange = (record: PatientRecord, range: RangeKey, offsetPeriods = 0) =>
  summarize(record, rangeWindow(range, offsetPeriods));

/** Daily mean glucose for the last `days` days (oldest first); null where nothing was logged. */
export function dailyGlucoseMeans(record: PatientRecord, days: number) {
  const byDay = new Map<string, number[]>();
  for (const r of record.glucose) {
    const k = dayKey(r.at);
    byDay.set(k, [...(byDay.get(k) ?? []), r.value]);
  }
  return Array.from({ length: days }, (_, i) => {
    const at = localISO(days - 1 - i, 12);
    const values = byDay.get(dayKey(at)) ?? [];
    return { at, mean: avg(values) };
  });
}

export function lastActivityAt(record: PatientRecord) {
  const latest = [record.checkIns[0], record.glucose[0], record.sleep[0], record.meals[0]]
    .filter(Boolean)
    .map((e) => e!.at)
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  return latest[0] ?? null;
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Rule-based flags â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type FlagLevel = "serious" | "warning" | "info";

export type Flag = {
  id: string;
  level: FlagLevel;
  text: string;
  sourceIds: string[];
};

/**
 * Simple, transparent thresholds that point a clinician at data worth looking
 * at. They are not diagnoses and never trigger any automatic action.
 */
export function flagsFor(record: PatientRecord, range: RangeKey): Flag[] {
  const s = summarizeRange(record, range);
  const target = record.patient.carePlan.glucoseTarget;
  const flags: Flag[] = [];
  const pid = record.patient.id;

  if (s.glucose.below.length > 0) {
    flags.push({
      id: `${pid}-flag-below`,
      level: "serious",
      text: `${s.glucose.below.length} glucose reading${s.glucose.below.length > 1 ? "s" : ""} below target (<${target.low} mg/dL)`,
      sourceIds: s.glucose.below.map((r) => r.id),
    });
  }
  if (s.glucose.above.length >= (range === "day" ? 1 : 3)) {
    flags.push({
      id: `${pid}-flag-above`,
      level: "warning",
      text: `${s.glucose.above.length} reading${s.glucose.above.length > 1 ? "s" : ""} above target (>${target.high} mg/dL)`,
      sourceIds: s.glucose.above.map((r) => r.id),
    });
  }
  if (s.reminders.noResponse.length >= (range === "day" ? 1 : 2)) {
    flags.push({
      id: `${pid}-flag-noresp`,
      level: "warning",
      text: `${s.reminders.noResponse.length} reminder${s.reminders.noResponse.length > 1 ? "s" : ""} not acknowledged`,
      sourceIds: s.reminders.noResponse.map((r) => r.id),
    });
  }
  if (s.sleep.poor.length >= (range === "day" ? 1 : 3)) {
    flags.push({
      id: `${pid}-flag-sleep`,
      level: "info",
      text: `Poor sleep reported on ${s.sleep.poor.length} night${s.sleep.poor.length > 1 ? "s" : ""}`,
      sourceIds: s.sleep.poor.map((e) => e.id),
    });
  }
  const w = rangeWindow(range);
  const symptoms = record.symptoms.filter((x) => within(x.at, w));
  if (symptoms.length) {
    flags.push({
      id: `${pid}-flag-symptoms`,
      level: symptoms.some((x) => x.severityReported === "moderate" || x.severityReported === "severe") ? "warning" : "info",
      text: `${symptoms.length} patient-reported symptom${symptoms.length > 1 ? "s" : ""}`,
      sourceIds: symptoms.map((x) => x.id),
    });
  }
  const order: Record<FlagLevel, number> = { serious: 0, warning: 1, info: 2 };
  return flags.sort((a, b) => order[a.level] - order[b.level]);
}
