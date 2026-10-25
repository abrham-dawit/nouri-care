"use client";

import { CalendarCheck, CalendarClock, CircleCheck, Lock, MessageCircle, Pill, Target, Undo2 } from "lucide-react";
import type { Appointment, CarePlan, SymptomReport } from "@/lib/clinical/types";
import { clearDecision, recordDecision, useReviewDecisions } from "@/lib/clinical/review-store";
import { formatClock, formatDate, formatDateWithWeekday, formatRelativeDay, formatTime, inRange } from "@/lib/clinical/time";
import { severityPhrase } from "@/lib/clinical/labels";
import { Card, CardHeader } from "@/components/clinical/ui";
import { SourceBadge } from "@/components/clinical/SourceBadge";

/* ───────────── Approved care plan ───────────── */

export function CarePlanCard({ plan }: { plan: CarePlan }) {
  return (
    <Card labelledBy="careplan-title">
      <CardHeader
        id="careplan-title"
        title="Approved care plan"
        subtitle={`Approved by ${plan.approvedBy} on ${formatDate(plan.approvedAt)}. Kept separate from anything AI-generated.`}
        action={<SourceBadge source={plan.source} />}
      />
      <dl className="grid gap-4">
        <div>
          <dt className="flex items-center gap-2 text-sm font-semibold text-mist-400">
            <Target className="h-4 w-4" aria-hidden="true" /> Glucose target
          </dt>
          <dd className="mt-1 text-white">
            {plan.glucoseTarget.low}–{plan.glucoseTarget.high} {plan.glucoseTarget.unit}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 text-sm font-semibold text-mist-400">
            <Pill className="h-4 w-4" aria-hidden="true" /> Medications &amp; reminder schedule
          </dt>
          {plan.medications.map((m) => (
            <dd key={m.name} className="mt-2 rounded-xl bg-white/[0.02] px-3.5 py-2.5">
              <p className="font-semibold text-white">{m.name}</p>
              <p className="text-sm text-mist-400">Reminders at {m.times.map(formatClock).join(", ")}</p>
              <p className="mt-1 text-sm text-mist-300">{m.instructions}</p>
            </dd>
          ))}
        </div>
        <div>
          <dt className="text-sm font-semibold text-mist-400">Check-ins</dt>
          <dd className="mt-1 text-mist-300">{plan.checkIns.join(" · ")}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-mist-400">Goals</dt>
          <dd>
            <ul className="mt-1 grid gap-1 text-mist-300">
              {plan.goals.map((g) => (
                <li key={g}>• {g}</li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-mist-400">Clinician notes</dt>
          <dd className="mt-1 text-mist-300">{plan.notes}</dd>
        </div>
      </dl>
      <p className="mt-5 flex items-start gap-2 border-t border-white/[0.06] pt-4 text-sm text-mist-400">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Changes to the care plan require verification by an authorised clinician. Nouri&apos;s agents can suggest topics for review but can never edit it.
      </p>
    </Card>
  );
}

/* ───────────── Symptoms (with review) ───────────── */

export function SymptomsCard({ symptoms, reviewer }: { symptoms: SymptomReport[]; reviewer: string }) {
  const decisions = useReviewDecisions();
  const recent = symptoms.filter((s) => inRange(s.at, "month"));
  return (
    <Card labelledBy="symptoms-title" id="symptoms" className="scroll-mt-28">
      <CardHeader
        id="symptoms-title"
        title="Patient-reported symptoms"
        subtitle="In the patient's own words. Severity is how the patient described it, not a clinical grade. Nouri does not diagnose."
        action={<SourceBadge source="patient_report" />}
      />
      <ul className="grid gap-2.5">
        {recent.map((s) => {
          const d = decisions[s.id];
          return (
            <li key={s.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-source-patient" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-white">
                      {s.symptom} <span className="font-normal text-mist-400">· {severityPhrase(s)}</span>
                    </p>
                    <p className="text-sm text-mist-500">
                      {formatRelativeDay(s.at)}, {formatTime(s.at)}
                    </p>
                    <p className="mt-1.5 text-mist-300 italic">&ldquo;{s.quote}&rdquo;</p>
                  </div>
                </div>
                {d ? (
                  <span className="flex items-center gap-2 text-sm text-status-good">
                    <CircleCheck className="h-4 w-4" aria-hidden="true" /> Reviewed
                    <button type="button" onClick={() => clearDecision(s.id)} className="ml-1 inline-flex items-center gap-1 text-mist-400 hover:text-white">
                      <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> Undo
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => recordDecision(s.id, { status: "reviewed", reviewer })}
                    className="rounded-xl border border-white/12 px-3.5 py-2 text-sm font-semibold text-white transition hover:border-glow-300/40 hover:bg-white/[0.04]"
                  >
                    Mark reviewed
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {!recent.length && <li className="text-mist-400">No symptoms reported in the last 30 days.</li>}
      </ul>
    </Card>
  );
}

/* ───────────── Appointments ───────────── */

export function AppointmentsCard({ appointments }: { appointments: Appointment[] }) {
  return (
    <Card labelledBy="appointments-title">
      <CardHeader id="appointments-title" title="Appointments" action={<SourceBadge source="clinician_entry" />} />
      <ol className="grid gap-3">
        {appointments.map((a) => (
          <li key={a.id} className="flex items-start gap-3">
            {a.status === "scheduled" ? (
              <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-tide-300" aria-hidden="true" />
            ) : (
              <CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-mist-500" aria-hidden="true" />
            )}
            <div>
              <p className="font-semibold text-white">
                {a.kind} <span className="text-sm font-normal text-mist-400">· {a.status === "scheduled" ? "Upcoming" : "Completed"}</span>
              </p>
              <p className="text-sm text-mist-400">
                {formatDateWithWeekday(a.at)}, {formatTime(a.at)} · {a.clinician}
              </p>
              {a.summary && <p className="mt-1 text-sm text-mist-300">{a.summary}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
