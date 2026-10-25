"use client";

import { useMemo, useState } from "react";
import { MessageCircleHeart } from "lucide-react";
import { mergeLive } from "@/lib/journal/merge";
import { usePatientLive } from "@/lib/journal/live-client";
import type { PatientRecord, RangeKey } from "@/lib/clinical/types";
import { RANGE_LABEL } from "@/lib/clinical/types";
import { summarizeRange, flagsFor, lastActivityAt } from "@/lib/clinical/summaries";
import { buildTimeline } from "@/lib/clinical/timeline";
import { RangeTabs } from "@/components/clinical/RangeTabs";
import { Card, CardHeader, FlagItem, StatTile, fmt } from "@/components/clinical/ui";
import { PatientHeader } from "./PatientHeader";
import { GlucoseCard } from "./GlucoseCard";
import { MealsCard, RemindersCard, SleepCard } from "./JournalCards";
import { AppointmentsCard, CarePlanCard, SymptomsCard } from "./CareCards";
import { VisitBriefPanel } from "./VisitBriefPanel";
import { TimelineCard } from "./TimelineCard";

export function PatientProfileView({ record: baseRecord, index, reviewer }: { record: PatientRecord; index: number; reviewer: string }) {
  const [range, setRange] = useState<RangeKey>("week");
  // Synthetic history plus anything the patient confirmed in conversation with Nouri.
  const live = usePatientLive(baseRecord.patient.id);
  const record = useMemo(() => mergeLive(baseRecord, live?.entries, live?.brief), [baseRecord, live]);
  const liveCount = live ? Object.values(live.entries).reduce((n, list) => n + list.length, 0) : 0;
  const timeline = useMemo(() => buildTimeline(record), [record]);
  const sources = useMemo(() => Object.fromEntries(timeline.map((t) => [t.id, t])), [timeline]);
  const s = useMemo(() => summarizeRange(record, range), [record, range]);
  const flags = useMemo(() => flagsFor(record, range), [record, range]);
  const period = range === "day" ? "today" : `last ${RANGE_LABEL[range]}`;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-28 pb-10 sm:px-8">
      <PatientHeader patient={record.patient} index={index} lastActivityAt={lastActivityAt(record)} />

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <RangeTabs value={range} onChange={setRange} />
        <p className="text-sm text-mist-500">Charts, tiles and the timeline show the {period}.</p>
        {liveCount > 0 && (
          <p className="inline-flex items-center gap-2 rounded-full border border-source-patient/30 bg-source-patient/[0.08] px-3 py-1 text-sm text-mist-100 sm:ml-auto">
            <MessageCircleHeart className="h-4 w-4 text-source-patient" aria-hidden="true" />
            {liveCount} new {liveCount === 1 ? "entry" : "entries"} from conversations with Nouri, confirmed by {record.patient.preferredName}
          </p>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Average glucose" value={fmt.int(s.glucose.mean)} unit="mg/dL" hint={`${fmt.pct(s.glucose.pctInTarget)} in target`} />
        <StatTile label="Readings logged" value={String(s.glucose.count)} hint={`${s.glucose.deviceCount} meter · ${s.glucose.reportedCount} read aloud`} />
        <StatTile label="Sleep (reported)" value={fmt.one(s.sleep.avgHours)} unit="h" hint={`${s.sleep.poor.length} poor night${s.sleep.poor.length === 1 ? "" : "s"}`} />
        <StatTile label="Reminders acknowledged" value={fmt.pct(s.reminders.ackRate)} hint={`${s.reminders.acknowledged} of ${s.reminders.total}`} />
        <StatTile label="Meals described" value={String(s.meals)} hint={`~${fmt.one(s.avgGlasses)} glasses water/day`} />
      </div>

      {flags.length > 0 && (
        <Card className="mt-4" labelledBy="flags-title">
          <h2 id="flags-title" className="mb-3 text-sm font-semibold tracking-widest text-mist-400 uppercase">
            Data flags · {period}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {flags.map((f) => (
              <FlagItem key={f.id} flag={f} />
            ))}
          </ul>
          <p className="mt-3 text-xs text-mist-500">Simple thresholds against the approved care plan. They point to data worth a look and do not diagnose anything.</p>
        </Card>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid min-w-0 content-start gap-6">
          <VisitBriefPanel brief={record.briefs[0]} sources={sources} reviewer={reviewer} preferredName={record.patient.preferredName} />
          <GlucoseCard record={record} range={range} />
          <div className="grid gap-6 lg:grid-cols-2">
            <SleepCard record={record} range={range} />
            <RemindersCard record={record} range={range} />
          </div>
          <MealsCard record={record} range={range} />
          <TimelineCard items={timeline} range={range} />
        </div>
        <aside className="grid content-start gap-6" aria-label="Care details">
          <SymptomsCard symptoms={record.symptoms} reviewer={reviewer} />
          <CarePlanCard plan={record.patient.carePlan} />
          <AppointmentsCard appointments={record.appointments} />
          <Card labelledBy="checkins-title">
            <CardHeader id="checkins-title" title="Mood at check-ins" subtitle={`How ${record.patient.preferredName} described feeling, ${period}.`} />
            <dl className="grid grid-cols-3 gap-2 text-center">
              {(["good", "okay", "low"] as const).map((m) => (
                <div key={m} className="rounded-2xl bg-white/[0.03] p-3">
                  <dt className="text-sm text-mist-400 capitalize">{m}</dt>
                  <dd className="text-2xl font-semibold text-white">{s.mood[m]}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </aside>
      </div>
    </div>
  );
}
