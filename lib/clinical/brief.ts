/**
 * Visit-brief drafting. In Phase 2 the Doctor Report Agent uses a deterministic
 * template over recorded observations. Every statement lists the observation
 * ids it was built from, so a clinician can trace and verify it.
 * The brief describes what was recorded. It never diagnoses or recommends treatment.
 */

import { GLUCOSE_CONTEXT_LABEL, severityPhrase } from "./labels";
import { glucoseStats, reminderStats, sleepStats } from "./summaries";
import { dayWindow, formatDate, localISO, within } from "./time";
import type { BriefStatement, PatientRecord, VisitBrief } from "./types";

const BRIEF_DAYS = 14;
const round = (n: number) => Math.round(n);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function buildVisitBrief(
  record: PatientRecord,
  opts: { createdDaysAgo: number; status: VisitBrief["status"]; reviewer: string },
): VisitBrief {
  const { patient } = record;
  const w = dayWindow(opts.createdDaysAgo, BRIEF_DAYS);
  const target = patient.carePlan.glucoseTarget;
  const name = patient.preferredName;

  // Glucose
  const g = glucoseStats(record.glucose, target, w);
  const glucoseStatements: BriefStatement[] = [];
  const glucoseIds = record.glucose.filter((r) => within(r.at, w)).map((r) => r.id);
  if (g.count && g.mean !== null) {
    glucoseStatements.push({
      text: `${plural(g.count, "reading")} logged (${g.deviceCount} from the paired meter, ${g.reportedCount} read aloud by ${name}). Average ${round(g.mean)} mg/dL; ${round(g.pctInTarget ?? 0)}% within the care-plan target of ${target.low}–${target.high} mg/dL.`,
      sourceIds: glucoseIds,
    });
    if (g.above.length && g.max) {
      glucoseStatements.push({
        text: `${plural(g.above.length, "reading")} above ${target.high} mg/dL. Highest: ${g.max.value} mg/dL on ${formatDate(g.max.at)} (${GLUCOSE_CONTEXT_LABEL[g.max.context].toLowerCase()}).`,
        sourceIds: g.above.map((r) => r.id),
      });
    }
    if (g.below.length && g.min) {
      glucoseStatements.push({
        text: `${plural(g.below.length, "reading")} below ${target.low} mg/dL. Lowest: ${g.min.value} mg/dL on ${formatDate(g.min.at)} (${GLUCOSE_CONTEXT_LABEL[g.min.context].toLowerCase()}).`,
        sourceIds: g.below.map((r) => r.id),
      });
    }
  } else {
    glucoseStatements.push({ text: "No glucose readings were logged in this period.", sourceIds: [] });
  }

  // Sleep & wellbeing
  const s = sleepStats(record.sleep, w);
  const lowMood = record.checkIns.filter((c) => within(c.at, w) && c.mood === "low");
  const wellbeing: BriefStatement[] = [];
  if (s.nights && s.avgHours !== null) {
    wellbeing.push({
      text: `Sleep reported on ${s.nights} mornings, averaging ${s.avgHours.toFixed(1)} hours (patient estimate). Poor sleep reported on ${plural(s.poor.length, "night")}.`,
      sourceIds: record.sleep.filter((e) => within(e.at, w)).map((e) => e.id),
    });
  }
  if (lowMood.length) {
    wellbeing.push({
      text: `${name} described feeling low during ${plural(lowMood.length, "check-in")}.`,
      sourceIds: lowMood.map((c) => c.id),
    });
  }

  // Reminders
  const r = reminderStats(record.reminders, w);
  const reminderStatements: BriefStatement[] = [];
  if (r.total) {
    reminderStatements.push({
      text: `${r.acknowledged} of ${r.total} reminders acknowledged (${round(r.ackRate ?? 0)}%); ${r.snoozed.length} snoozed, ${r.noResponse.length} with no response. An acknowledgment means ${name} responded to Nouri. It does not confirm the medication was taken.`,
      sourceIds: record.reminders.filter((e) => within(e.at, w)).map((e) => e.id),
    });
  }

  // Symptoms, in the patient's words
  const symptoms = record.symptoms.filter((x) => within(x.at, w));
  const symptomStatements: BriefStatement[] = symptoms.length
    ? symptoms.map((x) => ({
        text: `${formatDate(x.at)}: ${x.symptom} (${severityPhrase(x)}): “${x.quote}”`,
        sourceIds: [x.id],
      }))
    : [{ text: "No symptoms were reported to Nouri in this period.", sourceIds: [] }];

  // Items for the clinician to look at. Observations only, no conclusions.
  const review: BriefStatement[] = [];
  if (g.below.length) review.push({ text: "Readings below the target range were recorded; review against the low-glucose plan.", sourceIds: g.below.map((x) => x.id) });
  if (g.above.length >= 3) review.push({ text: "Several readings above the target range were recorded.", sourceIds: g.above.map((x) => x.id) });
  if (r.noResponse.length >= 2) review.push({ text: "Some reminders received no acknowledgment.", sourceIds: r.noResponse.map((x) => x.id) });
  if (s.poor.length >= 3) review.push({ text: "Repeated reports of poor sleep.", sourceIds: s.poor.map((x) => x.id) });
  symptoms
    .filter((x) => x.severityReported === "moderate" || x.severityReported === "severe")
    .forEach((x) => review.push({ text: `Patient described “${x.symptom.toLowerCase()}” as ${x.severityReported}.`, sourceIds: [x.id] }));
  if (!review.length) review.push({ text: "Nothing in the recorded data met the review thresholds.", sourceIds: [] });

  const createdAt = localISO(opts.createdDaysAgo, opts.createdDaysAgo === 0 ? 7 : 18, opts.createdDaysAgo === 0 ? 30 : 0);
  return {
    id: `${patient.id}-brief-${opts.createdDaysAgo}`,
    createdAt,
    periodStart: new Date(w.start).toISOString(),
    periodEnd: new Date(w.end - 1).toISOString(),
    generator: "rule_template",
    agent: "Doctor Report Agent",
    status: opts.status,
    reviewedBy: opts.status === "approved" ? opts.reviewer : undefined,
    reviewedAt: opts.status === "approved" ? localISO(opts.createdDaysAgo - 1 < 0 ? 0 : opts.createdDaysAgo - 1, 9, 15) : undefined,
    sections: [
      { heading: "Glucose", statements: glucoseStatements },
      { heading: "Sleep & wellbeing", statements: wellbeing.length ? wellbeing : [{ text: "No sleep or mood reports in this period.", sourceIds: [] }] },
      { heading: "Medication reminders", statements: reminderStatements.length ? reminderStatements : [{ text: "No reminders were scheduled in this period.", sourceIds: [] }] },
      { heading: "Patient-reported symptoms", statements: symptomStatements },
      { heading: "For clinician review", statements: review },
    ],
  };
}
