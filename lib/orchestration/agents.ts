/**
 * Implementations of the agents that actually run today. All are rule-based
 * and deterministic: they describe recorded data and never diagnose,
 * prescribe or estimate measurements.
 */

import { buildVisitBrief } from "@/lib/clinical/brief";
import { reminderStats, summarize } from "@/lib/clinical/summaries";
import { buildTimeline, type TimelineItem } from "@/lib/clinical/timeline";
import { dayKey, dayWindow, formatDate, localISO, within } from "@/lib/clinical/time";
import type { PatientRecord, VisitBrief } from "@/lib/clinical/types";
import { screenText } from "@/lib/safety/boundaries";

export type AgentContext = {
  record: PatientRecord;
  reviewer: string;
  timeline?: TimelineItem[];
  brief?: VisitBrief;
  safetyPassed?: boolean;
};

export type AgentResult = {
  status: "ok" | "warning" | "error";
  summary: string;
  details?: string[];
};

export type AgentImpl = (ctx: AgentContext) => AgentResult;

const WINDOW_DAYS = 14;
const round = (n: number) => Math.round(n);
const signed = (n: number, unit = "") => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(round(n))}${unit}`;

/* ───────────── Patient Progress ───────────── */

export const healthTimeline: AgentImpl = (ctx) => {
  ctx.timeline = buildTimeline(ctx.record);
  const bySource = new Map<string, number>();
  ctx.timeline.forEach((t) => bySource.set(t.source, (bySource.get(t.source) ?? 0) + 1));
  return {
    status: "ok",
    summary: `Built a timeline of ${ctx.timeline.length} observations.`,
    details: [...bySource.entries()].map(([source, n]) => `${n} × ${source.replace("_", " ")}`),
  };
};

export const dataQuality: AgentImpl = ({ record }) => {
  const w = dayWindow(0, WINDOW_DAYS);
  const readings = record.glucose.filter((r) => within(r.at, w));
  const issues: string[] = [];

  // Days with no glucose readings at all
  const days = new Set(readings.map((r) => dayKey(r.at)));
  const missing = Array.from({ length: WINDOW_DAYS }, (_, i) => localISO(i, 12)).filter((at) => !days.has(dayKey(at)));
  if (missing.length) issues.push(`No glucose readings on ${missing.length} day${missing.length > 1 ? "s" : ""}: ${missing.map(formatDate).join(", ")}`);

  // Near-duplicates: same value within 5 minutes
  const sorted = [...readings].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const dupes = sorted.filter((r, i) => i > 0 && r.value === sorted[i - 1].value && Date.parse(r.at) - Date.parse(sorted[i - 1].at) < 5 * 60 * 1000);
  if (dupes.length) issues.push(`${dupes.length} possible duplicate reading${dupes.length > 1 ? "s" : ""}`);

  // Physiologically implausible values (likely entry or transcription errors)
  const implausible = readings.filter((r) => r.value < 20 || r.value > 600);
  if (implausible.length) issues.push(`${implausible.length} implausible value${implausible.length > 1 ? "s" : ""} (outside 20–600 mg/dL)`);

  // Share of readings that were read aloud rather than from the paired meter
  const reported = readings.filter((r) => r.source === "patient_report").length;
  const details = [`${readings.length} readings checked over ${WINDOW_DAYS} days`, `${reported} read aloud by the patient (not device-verified)`];

  return {
    status: issues.length ? "warning" : "ok",
    summary: issues.length ? `Found ${issues.length} data-quality issue${issues.length > 1 ? "s" : ""} for human review.` : "No data-quality issues found.",
    details: [...issues, ...details],
  };
};

export const trend: AgentImpl = ({ record }) => {
  const points = Array.from({ length: WINDOW_DAYS }, (_, i) => WINDOW_DAYS - 1 - i)
    .map((d, x) => {
      const key = dayKey(localISO(d, 12));
      const vals = record.glucose.filter((r) => dayKey(r.at) === key).map((r) => r.value);
      return vals.length ? { x, y: vals.reduce((a, b) => a + b, 0) / vals.length } : null;
    })
    .filter((p): p is { x: number; y: number } => p !== null);

  if (points.length < 3) return { status: "warning", summary: "Not enough daily data to describe a trend." };

  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  const slope = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  const change = slope * (WINDOW_DAYS - 1);
  return {
    status: "ok",
    summary: `Daily mean glucose changed by about ${signed(change, " mg/dL")} over ${WINDOW_DAYS} days (descriptive only).`,
    details: [`${n} of ${WINDOW_DAYS} days had readings`, `Least-squares slope: ${slope.toFixed(2)} mg/dL per day`],
  };
};

export const adherenceReporting: AgentImpl = ({ record }) => {
  const r = reminderStats(record.reminders, dayWindow(0, WINDOW_DAYS));
  return {
    status: r.noResponse.length >= 2 ? "warning" : "ok",
    summary: `${r.acknowledged} of ${r.total} reminders acknowledged (${round(r.ackRate ?? 0)}%). Acknowledgment ≠ confirmed intake.`,
    details: [`${r.snoozed.length} snoozed`, `${r.noResponse.length} with no response`],
  };
};

export const progressAnalysis: AgentImpl = ({ record }) => {
  const now = summarize(record, dayWindow(0, 7));
  const before = summarize(record, dayWindow(7, 7));
  const line = (label: string, a: number | null, b: number | null, unit: string, digits = 0) => {
    if (a === null || b === null) return `${label}: not enough data`;
    const f = (v: number) => v.toFixed(digits);
    const d = a - b;
    return `${label}: ${f(b)}${unit} → ${f(a)}${unit} (${d >= 0 ? "+" : "−"}${f(Math.abs(d))}${unit})`;
  };
  return {
    status: "ok",
    summary: "Compared the last 7 days with the previous 7 days.",
    details: [
      line("Mean glucose", now.glucose.mean, before.glucose.mean, " mg/dL"),
      line("Readings in target", now.glucose.pctInTarget, before.glucose.pctInTarget, "%"),
      line("Reported sleep", now.sleep.avgHours, before.sleep.avgHours, " h", 1),
      line("Reminders acknowledged", now.reminders.ackRate, before.reminders.ackRate, "%"),
    ],
  };
};

/* ───────────── Doctor Support ───────────── */

export const carePlan: AgentImpl = ({ record }) => {
  const plan = record.patient.carePlan;
  const verified = plan.source === "clinician_entry" && Boolean(plan.approvedBy);
  return {
    status: verified ? "ok" : "error",
    summary: verified ? `Using the care plan approved by ${plan.approvedBy} on ${formatDate(plan.approvedAt)}.` : "Care plan is not clinician-approved; refusing to use it.",
    details: [`Glucose target ${plan.glucoseTarget.low}–${plan.glucoseTarget.high} ${plan.glucoseTarget.unit}`, `${plan.medications.length} scheduled medication reminder(s), read-only`],
  };
};

export const doctorReport: AgentImpl = (ctx) => {
  ctx.brief = buildVisitBrief(ctx.record, { createdDaysAgo: 0, status: "pending_review", reviewer: ctx.reviewer });
  const statements = ctx.brief.sections.reduce((n, s) => n + s.statements.length, 0);
  return {
    status: "ok",
    summary: `Drafted a visit brief (${statements} statements in ${ctx.brief.sections.length} sections) using the rule-based template.`,
    details: ["Status: draft, awaiting clinician review", "AI drafting is not enabled in this build"],
  };
};

export const clinicalEvidence: AgentImpl = (ctx) => {
  if (!ctx.brief || !ctx.timeline) return { status: "error", summary: "Needs a brief and a timeline to verify." };
  const ids = new Set(ctx.timeline.map((t) => t.id));
  const statements = ctx.brief.sections.flatMap((s) => s.statements);
  const unresolved = statements.flatMap((s) => s.sourceIds.filter((id) => !ids.has(id)));
  const unsourced = statements.filter((s) => !s.sourceIds.length);
  const linked = statements.length - unsourced.length;
  return {
    status: unresolved.length ? "error" : "ok",
    summary: unresolved.length
      ? `${unresolved.length} source reference(s) could not be resolved.`
      : `All ${linked} evidence-bearing statements resolve to real observations.`,
    details: [
      `${statements.reduce((n, s) => n + s.sourceIds.length, 0)} source links checked`,
      `${unsourced.length} statement(s) state an absence of data and carry no sources`,
    ],
  };
};

/* ───────────── Safety ───────────── */

export const safetyReview: AgentImpl = (ctx) => {
  if (!ctx.brief) return { status: "error", summary: "Nothing to review." };
  const findings: string[] = [];
  for (const section of ctx.brief.sections) {
    for (const st of section.statements) {
      for (const label of screenText(st.text)) findings.push(`${label} in “${section.heading}”: “${st.text.slice(0, 80)}…”`);
    }
  }
  for (const s of ctx.brief.narrative?.sentences ?? []) {
    for (const label of screenText(s.text)) findings.push(`${label} in the AI overview: “${s.text.slice(0, 80)}…”`);
  }
  ctx.safetyPassed = findings.length === 0;
  return {
    status: findings.length ? "error" : "ok",
    summary: findings.length
      ? `Blocked: ${findings.length} statement(s) crossed a safety boundary.`
      : `Passed: no dosing, diagnosis or treatment language across ${ctx.brief.sections.length} sections.`,
    details: findings.length ? findings : ["Pattern screen only. Clinician review is still required."],
  };
};

/* ───────────── Registry of runnable agents ───────────── */

export const RUNNABLE: Record<string, AgentImpl> = {
  "health-timeline-agent": healthTimeline,
  "data-quality-agent": dataQuality,
  "trend-agent": trend,
  "adherence-reporting-agent": adherenceReporting,
  "progress-analysis-agent": progressAnalysis,
  "care-plan-agent": carePlan,
  "doctor-report-agent": doctorReport,
  "clinical-evidence-agent": clinicalEvidence,
  "safety-review-agent": safetyReview,
};
