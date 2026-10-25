"use client";

import { useMemo, useState } from "react";
import { BellRing, Droplets, Moon, Utensils } from "lucide-react";
import type { PatientRecord, RangeKey, ReminderResponse } from "@/lib/clinical/types";
import { dayKey, formatDateTime, formatDateWithWeekday, formatRelativeDay, formatTime, rangeWindow, within } from "@/lib/clinical/time";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { DataTable } from "@/components/charts/DataTable";
import { Card, CardHeader } from "@/components/clinical/ui";
import { SourceBadge } from "@/components/clinical/SourceBadge";
import { sleepHoursText } from "@/lib/clinical/labels";
import { rangeDays } from "./range-axis";

/* ───────────── Sleep ───────────── */

export function SleepCard({ record, range }: { record: PatientRecord; range: RangeKey }) {
  const entries = useMemo(() => record.sleep.filter((e) => within(e.at, rangeWindow(range))), [record.sleep, range]);
  const days = rangeDays(range);
  const columns = days.map((d) => {
    const e = entries.find((x) => dayKey(x.at) === d.key);
    return { key: d.key, label: d.label, title: `${formatDateWithWeekday(d.at)}${e ? ` · ${e.quality} sleep` : " · not reported"}`, values: { hours: e?.hoursReported ?? 0 } };
  });

  return (
    <Card labelledBy="sleep-title">
      <CardHeader
        id="sleep-title"
        title="Sleep journal"
        subtitle="Hours are the patient's own estimate, shared during the morning check-in."
        action={<SourceBadge source="patient_report" />}
      />
      {range !== "day" && (
        <ColumnChart
          label="Reported hours of sleep per night"
          series={[{ key: "hours", label: "Hours slept (reported)", color: "var(--color-glow-400)" }]}
          columns={columns}
          unit=" h"
          yMax={10}
          labelEvery={range === "month" ? 5 : 1}
          reference={{ value: 7, label: "7 h" }}
        />
      )}
      <ul className="mt-4 grid gap-2.5">
        {entries.slice(0, range === "day" ? 1 : 3).map((e) => (
          <li key={e.id} className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5">
            <Moon className="mt-0.5 h-5 w-5 shrink-0 text-glow-300" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-semibold text-white">
                {sleepHoursText(e)} · {e.quality}
                <span className="ml-2 text-sm font-normal text-mist-500">{formatRelativeDay(e.at)}</span>
              </p>
              <p className="text-mist-300 italic">&ldquo;{e.quote}&rdquo;</p>
            </div>
          </li>
        ))}
        {!entries.length && <li className="text-mist-400">No sleep reported in this period.</li>}
      </ul>
      <DataTable
        caption="Sleep journal"
        columns={["Morning", "Hours (reported)", "Quality", "Patient's words"]}
        rows={entries.map((e) => [formatDateWithWeekday(e.at), e.hoursReported ?? "Not stated", e.quality, `“${e.quote}”`])}
      />
    </Card>
  );
}

/* ───────────── Medication reminders ───────────── */

const RESPONSE_SERIES: { key: ReminderResponse; label: string; color: string }[] = [
  { key: "acknowledged", label: "Acknowledged", color: "var(--color-series-1)" },
  { key: "snoozed", label: "Snoozed", color: "var(--color-series-2)" },
  { key: "no_response", label: "No response", color: "var(--color-series-3)" },
];
const RESPONSE_LABEL: Record<ReminderResponse, string> = { acknowledged: "Acknowledged", snoozed: "Snoozed", no_response: "No response" };

export function RemindersCard({ record, range }: { record: PatientRecord; range: RangeKey }) {
  const events = useMemo(() => record.reminders.filter((e) => within(e.at, rangeWindow(range))), [record.reminders, range]);
  const columns = rangeDays(range).map((d) => {
    const dayEvents = events.filter((e) => dayKey(e.at) === d.key);
    return {
      key: d.key,
      label: d.label,
      title: formatDateWithWeekday(d.at),
      values: Object.fromEntries(RESPONSE_SERIES.map((s) => [s.key, dayEvents.filter((e) => e.response === s.key).length])),
    };
  });

  return (
    <Card labelledBy="reminders-title">
      <CardHeader
        id="reminders-title"
        title="Medication reminder acknowledgments"
        subtitle="Reminders follow the clinician-approved schedule. Nouri records whether the patient responded."
        action={<SourceBadge source="device_reading" />}
      />
      <p className="mb-4 flex items-start gap-2.5 rounded-2xl border border-status-warning/25 bg-status-warning/[0.06] p-3.5 text-[0.95rem] text-mist-100">
        <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-status-warning" aria-hidden="true" />
        <span>
          <strong className="font-semibold">Acknowledged is not the same as taken.</strong> It means the patient told Nouri they heard the reminder. Nouri cannot confirm
          that medication was actually taken.
        </span>
      </p>
      {range === "day" ? (
        <ul className="grid gap-2">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[0.02] px-3.5 py-2.5">
              <span className="text-white">
                {formatTime(e.at)} · {e.medication}
              </span>
              <span className="text-sm text-mist-300">
                {RESPONSE_LABEL[e.response]}
                {e.respondedAt ? ` at ${formatTime(e.respondedAt)}` : ""}
              </span>
            </li>
          ))}
          {!events.length && <li className="text-mist-400">No reminders yet today.</li>}
        </ul>
      ) : (
        <ColumnChart label="Reminder responses per day" series={RESPONSE_SERIES} columns={columns} labelEvery={range === "month" ? 5 : 1} />
      )}
      <DataTable
        caption="Medication reminders"
        columns={["Delivered", "Medication", "Response", "Responded"]}
        rows={events.map((e) => [formatDateTime(e.at), e.medication, RESPONSE_LABEL[e.response], e.respondedAt ? formatTime(e.respondedAt) : "—"])}
      />
    </Card>
  );
}

/* ───────────── Meals & hydration ───────────── */

export function MealsCard({ record, range }: { record: PatientRecord; range: RangeKey }) {
  const [showAll, setShowAll] = useState(false);
  const w = rangeWindow(range);
  const meals = record.meals.filter((m) => within(m.at, w));
  const hydration = record.hydration.filter((h) => within(h.at, w));
  const days = [...new Set(meals.map((m) => dayKey(m.at)))];
  const visibleDays = showAll ? days : days.slice(0, 3);

  return (
    <Card labelledBy="meals-title">
      <CardHeader
        id="meals-title"
        title="Nutrition & hydration journal"
        subtitle="Meals as the patient described them. Calorie figures are rough AI estimates, for context only, and never used for medication or insulin decisions."
        action={
          <div className="flex gap-2">
            <SourceBadge source="patient_report" />
            <SourceBadge source="ai_estimate" />
          </div>
        }
      />
      <div className="grid gap-5">
        {visibleDays.map((k) => {
          const dayMeals = meals.filter((m) => dayKey(m.at) === k).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
          const water = hydration.find((h) => dayKey(h.at) === k);
          return (
            <section key={k} aria-label={formatDateWithWeekday(dayMeals[0].at)}>
              <h3 className="flex items-center justify-between text-sm font-semibold text-mist-400">
                <span>{formatRelativeDay(dayMeals[0].at)}</span>
                {water && (
                  <span className="inline-flex items-center gap-1.5 font-normal">
                    <Droplets className="h-4 w-4 text-glow-300" aria-hidden="true" /> About {water.glasses} glasses of water
                  </span>
                )}
              </h3>
              <ul className="mt-2 grid gap-1.5">
                {dayMeals.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-white/[0.02] px-3.5 py-2.5">
                    <Utensils className="h-4 w-4 shrink-0 text-mist-500" aria-hidden="true" />
                    <span className="w-20 text-sm text-mist-500 capitalize">{m.meal}</span>
                    <span className="min-w-0 flex-1 text-white">{m.description}</span>
                    {m.aiCalorieEstimate && (
                      <span className="inline-flex items-center gap-1.5 text-sm text-mist-400">
                        ≈{m.aiCalorieEstimate.kcal} kcal <SourceBadge source="ai_estimate" compact />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {!days.length && <p className="text-mist-400">No meals described in this period.</p>}
      </div>
      {days.length > 3 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-4 text-sm font-semibold text-glow-300 hover:text-glow-200" aria-expanded={showAll}>
          {showAll ? "Show fewer days" : `Show all ${days.length} days`}
        </button>
      )}
      <DataTable
        caption="Meals and hydration"
        columns={["Time", "Entry", "AI calorie estimate"]}
        rows={[
          ...meals.map((m) => [formatDateTime(m.at), `${m.meal}: ${m.description}`, m.aiCalorieEstimate ? `≈${m.aiCalorieEstimate.kcal} kcal (AI)` : "—"]),
          ...hydration.map((h) => [formatDateTime(h.at), `Water: about ${h.glasses} glasses`, "—"]),
        ]}
      />
    </Card>
  );
}
