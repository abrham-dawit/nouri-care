/**
 * Server-side assembly of compact, serialisable data for the clinician views.
 * Raw records stay on the server; the client receives summaries only.
 */

import { getAllRecords } from "./synthetic";
import { dailyGlucoseMeans, flagsFor, lastActivityAt, summarizeRange, type Flag, type PatientSummary } from "./summaries";
import { buildTimeline, type TimelineItem } from "./timeline";
import { inRange, isFuture } from "./time";
import type { Pronouns, RangeKey, SymptomReport } from "./types";

export type CompactSummary = {
  readings: number;
  glucoseMean: number | null;
  pctInTarget: number | null;
  above: number;
  below: number;
  reminders: number;
  ackRate: number | null;
  noResponse: number;
  avgSleep: number | null;
  poorSleep: number;
  meals: number;
  symptoms: number;
  lowMood: number;
  observations: number;
};

const compact = (s: PatientSummary): CompactSummary => ({
  readings: s.glucose.count,
  glucoseMean: s.glucose.mean,
  pctInTarget: s.glucose.pctInTarget,
  above: s.glucose.above.length,
  below: s.glucose.below.length,
  reminders: s.reminders.total,
  ackRate: s.reminders.ackRate,
  noResponse: s.reminders.noResponse.length,
  avgSleep: s.sleep.avgHours,
  poorSleep: s.sleep.poor.length,
  meals: s.meals,
  symptoms: s.symptoms,
  lowMood: s.mood.low,
  observations: s.observations,
});

const RANGES: RangeKey[] = ["day", "week", "month"];

export type PatientListItem = {
  id: string;
  index: number;
  name: string;
  preferredName: string;
  pronouns: Pronouns;
  age: number;
  location: string;
  conditions: string[];
  deviceId: string;
  lastActivityAt: string | null;
  nextAppointment: { at: string; kind: string } | null;
  target: { low: number; high: number };
  summaries: Record<RangeKey, { current: CompactSummary; previous: CompactSummary }>;
  flags: Record<RangeKey, Flag[]>;
  dailyMeans: (number | null)[];
};

export type ActivityItem = TimelineItem & { patientId: string; patientName: string };

export type PendingBrief = { id: string; patientId: string; patientName: string; createdAt: string; periodStart: string; periodEnd: string };
export type RecentSymptom = SymptomReport & { patientId: string; patientName: string };

export type DashboardData = {
  patients: PatientListItem[];
  activity: ActivityItem[];
  pendingBriefs: PendingBrief[];
  recentSymptoms: RecentSymptom[];
};

export function getPatientList(): PatientListItem[] {
  return getAllRecords().map((record, index) => {
    const p = record.patient;
    const next = [...record.appointments].reverse().find((a) => isFuture(a.at));
    return {
      id: p.id,
      index,
      name: p.name,
      preferredName: p.preferredName,
      pronouns: p.pronouns,
      age: p.age,
      location: p.location,
      conditions: p.conditions,
      deviceId: p.deviceId,
      lastActivityAt: lastActivityAt(record),
      nextAppointment: next ? { at: next.at, kind: next.kind } : null,
      target: { low: p.carePlan.glucoseTarget.low, high: p.carePlan.glucoseTarget.high },
      summaries: Object.fromEntries(
        RANGES.map((r) => [r, { current: compact(summarizeRange(record, r)), previous: compact(summarizeRange(record, r, 1)) }]),
      ) as PatientListItem["summaries"],
      flags: Object.fromEntries(RANGES.map((r) => [r, flagsFor(record, r)])) as PatientListItem["flags"],
      dailyMeans: dailyGlucoseMeans(record, 30).map((d) => (d.mean === null ? null : Math.round(d.mean))),
    };
  });
}

export function getDashboardData(): DashboardData {
  const records = getAllRecords();
  const activity = records
    .flatMap((r) =>
      buildTimeline(r)
        .filter((t) => t.kind !== "reminder" && !isFuture(t.at))
        .slice(0, 6)
        .map((t) => ({ ...t, patientId: r.patient.id, patientName: r.patient.name })),
    )
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 10);

  const pendingBriefs = records.flatMap((r) =>
    r.briefs
      .filter((b) => b.status === "pending_review")
      .map((b) => ({ id: b.id, patientId: r.patient.id, patientName: r.patient.name, createdAt: b.createdAt, periodStart: b.periodStart, periodEnd: b.periodEnd })),
  );

  const recentSymptoms = records
    .flatMap((r) => r.symptoms.filter((s) => inRange(s.at, "week")).map((s) => ({ ...s, patientId: r.patient.id, patientName: r.patient.name })))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return { patients: getPatientList(), activity, pendingBriefs, recentSymptoms };
}
