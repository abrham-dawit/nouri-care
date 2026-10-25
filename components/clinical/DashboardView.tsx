"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarClock, ClipboardCheck, FileText, MessageCircle } from "lucide-react";
import type { DashboardData } from "@/lib/clinical/dashboard";
import { useReviewDecisions } from "@/lib/clinical/review-store";
import { DEMO_NOW, formatDate, formatDateWithWeekday, formatLongDate, formatRelativeDay, formatTime, greeting } from "@/lib/clinical/time";
import { RANGE_LABEL, type RangeKey } from "@/lib/clinical/types";
import { severityPhrase } from "@/lib/clinical/labels";
import { useDashboardLive } from "@/lib/journal/live-client";
import { PatientSearch, matchPatient } from "./PatientSearch";
import { PatientTable } from "./PatientTable";
import { RangeTabs } from "./RangeTabs";
import { SourceBadge } from "./SourceBadge";
import { Card, CardHeader, DemoDataNotice, StatTile, fmt } from "./ui";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? sum(v) / v.length : null;
};

/** Signed change vs the previous equal period. `upIsGood: null` keeps the tone neutral. */
function delta(current: number | null, previous: number | null, unit: string, upIsGood: boolean | null, range: RangeKey) {
  if (current === null || previous === null) return undefined;
  const d = Math.round(current - previous);
  const vs = range === "day" ? "yesterday" : `previous ${RANGE_LABEL[range]}`;
  if (d === 0) return { text: `No change vs ${vs}`, tone: "neutral" as const };
  const tone = upIsGood === null ? ("neutral" as const) : (d > 0) === upIsGood ? ("good" as const) : ("bad" as const);
  return { text: `${d > 0 ? "+" : "−"}${Math.abs(d)}${unit} vs ${vs}`, tone };
}

export function DashboardView({ data, clinician }: { data: DashboardData; clinician: string }) {
  const [range, setRange] = useState<RangeKey>("week");
  const [query, setQuery] = useState("");
  const decisions = useReviewDecisions();
  const live = useDashboardLive();

  const patients = useMemo(() => data.patients.filter((p) => matchPatient(p, query)), [data.patients, query]);
  const ids = new Set(patients.map((p) => p.id));
  const liveBriefs = live.filter((l) => l.brief).map((l) => ({ ...l.brief!, patientId: l.patientId, patientName: l.patientName, fromConversation: true }));
  const pendingBriefs = [
    ...liveBriefs,
    // A newer brief drafted from a conversation supersedes the older static draft.
    ...data.pendingBriefs.filter((b) => !liveBriefs.some((l) => l.patientId === b.patientId)).map((b) => ({ ...b, fromConversation: false })),
  ].filter((b) => ids.has(b.patientId) && !decisions[b.id]);
  const liveCounts = new Map(live.map((l) => [l.patientId, l.newEntries]));
  const activity = [
    ...live.flatMap((l) => l.items.map((t) => ({ ...t, patientId: l.patientId, patientName: l.patientName }))),
    ...data.activity,
  ]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 12);
  const newSymptoms = data.recentSymptoms.filter((s) => ids.has(s.patientId) && !decisions[s.id]);

  const cur = patients.map((p) => p.summaries[range].current);
  const prev = patients.map((p) => p.summaries[range].previous);
  const observations = sum(cur.map((s) => s.observations));
  const ackRate = mean(cur.map((s) => s.ackRate));
  const inTarget = mean(cur.map((s) => s.pctInTarget));

  const upcoming = patients
    .filter((p) => p.nextAppointment)
    .sort((a, b) => Date.parse(a.nextAppointment!.at) - Date.parse(b.nextAppointment!.at))
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-28 pb-10 sm:px-8">
      {/* Page header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-glow-300 uppercase">Doctor dashboard</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            {greeting()}, Dr. {clinician.split(" ").pop()}
          </h1>
          <p className="mt-2 text-mist-400">
            {formatLongDate(DEMO_NOW)} · Signed in as {clinician} (demo clinician role)
          </p>
        </div>
        <DemoDataNotice />
      </header>

      {/* Filters: one row, scoping everything below */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <RangeTabs value={range} onChange={setRange} />
        <PatientSearch value={query} onChange={setQuery} />
        <p className="text-sm text-mist-500 sm:ml-auto" aria-live="polite">
          {patients.length} of {data.patients.length} patients
        </p>
      </div>

      {/* Stat tiles */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Awaiting your review" value={String(pendingBriefs.length + newSymptoms.length)} hint={`${pendingBriefs.length} briefs · ${newSymptoms.length} symptom reports`} />
        <StatTile
          label={`Observations captured, ${RANGE_LABEL[range].toLowerCase()}`}
          value={observations.toLocaleString("en-US")}
          delta={delta(observations, sum(prev.map((s) => s.observations)), "", null, range)}
        />
        <StatTile
          label="Glucose readings in target"
          value={fmt.pct(inTarget)}
          delta={delta(inTarget, mean(prev.map((s) => s.pctInTarget)), " pts", true, range)}
        />
        <StatTile
          label="Reminders acknowledged"
          value={fmt.pct(ackRate)}
          delta={delta(ackRate, mean(prev.map((s) => s.ackRate)), " pts", true, range)}
        />
      </div>
      <p className="mt-2 text-xs text-mist-500">
        Averages across the patients shown. An acknowledgment means the patient responded to Nouri&apos;s reminder, not that a dose was taken.
      </p>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card labelledBy="patients-title">
          <CardHeader
            id="patients-title"
            title="Patients"
            subtitle={`Summaries for ${range === "day" ? "today" : `the last ${RANGE_LABEL[range]}`}. Flags are simple, transparent thresholds, not diagnoses.`}
          />
          <PatientTable patients={patients} range={range} liveCounts={liveCounts} />
        </Card>

        <div className="grid content-start gap-6">
          <Card labelledBy="queue-title">
            <CardHeader id="queue-title" title="Review queue" subtitle="Nothing reaches the care record until you approve it." />
            <ul className="grid gap-2.5">
              {pendingBriefs.map((b) => (
                <li key={b.id}>
                  <Link href={`/patients/${b.patientId}#visit-brief`} className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition hover:border-glow-300/25">
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-glow-300" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block font-semibold text-white">
                        {b.fromConversation ? "Updated visit brief" : "Visit brief"} · {b.patientName}
                      </span>
                      <span className="block text-sm text-mist-400">
                        {b.fromConversation ? "Redrafted after a confirmed conversation" : `Drafted ${formatRelativeDay(b.createdAt).toLowerCase()}`} · covers{" "}
                        {formatDate(b.periodStart)}–{formatDate(b.periodEnd)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              {newSymptoms.map((s) => (
                <li key={s.id}>
                  <Link href={`/patients/${s.patientId}#symptoms`} className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition hover:border-glow-300/25">
                    <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-source-patient" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block font-semibold text-white">
                        {s.symptom} · {s.patientName}
                      </span>
                      <span className="block text-sm text-mist-400">
                        {severityPhrase(s).replace(/^./, (c) => c.toUpperCase())} · {formatRelativeDay(s.at)}, {formatTime(s.at)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              {!pendingBriefs.length && !newSymptoms.length && (
                <li className="flex items-center gap-2.5 rounded-2xl border border-dashed border-white/10 p-4 text-mist-400">
                  <ClipboardCheck className="h-5 w-5 text-status-good" aria-hidden="true" /> All caught up.
                </li>
              )}
            </ul>
          </Card>

          <Card labelledBy="upcoming-title">
            <CardHeader id="upcoming-title" title="Upcoming visits" />
            <ul className="grid gap-3">
              {upcoming.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <CalendarClock className="h-5 w-5 shrink-0 text-tide-300" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/patients/${p.id}`} className="font-semibold text-white hover:text-glow-200">
                      {p.name}
                    </Link>
                    <p className="text-sm text-mist-400">
                      {p.nextAppointment!.kind} · {formatDateWithWeekday(p.nextAppointment!.at)}, {formatTime(p.nextAppointment!.at)}
                    </p>
                  </div>
                </li>
              ))}
              {!upcoming.length && <li className="text-mist-400">No upcoming visits.</li>}
            </ul>
          </Card>
        </div>
      </div>

      <Card labelledBy="activity-title" className="mt-6">
        <CardHeader id="activity-title" title="Latest from Nouri" subtitle="The most recent observations across all patients, labelled by source." />
        <ol className="divide-y divide-white/[0.05]">
          {activity
            .filter((a) => ids.has(a.patientId))
            .map((a) => (
              <li key={a.id} className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:gap-4">
                <span className="w-36 shrink-0 text-sm text-mist-500 tabular-nums">
                  {formatRelativeDay(a.at)}, {formatTime(a.at)}
                </span>
                <span className="min-w-0 flex-1">
                  <Link href={`/patients/${a.patientId}`} className="font-semibold text-white hover:text-glow-200">
                    {a.patientName}
                  </Link>
                  <span className="text-mist-300"> · {a.title}</span>
                  {a.quote && <span className="block text-sm text-mist-400 italic">&ldquo;{a.quote}&rdquo;</span>}
                  {a.fromConversation && <span className="block text-xs text-source-patient">From a conversation · confirmed by the patient</span>}
                </span>
                <SourceBadge source={a.source} />
              </li>
            ))}
        </ol>
        <Link href="/patients" className="mt-4 inline-flex items-center gap-1.5 font-semibold text-glow-300 hover:text-glow-200">
          All patients <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Card>
    </div>
  );
}
