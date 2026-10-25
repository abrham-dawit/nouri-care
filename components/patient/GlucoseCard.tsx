"use client";

import { useMemo } from "react";
import type { PatientRecord, RangeKey } from "@/lib/clinical/types";
import { GLUCOSE_CONTEXT_LABEL } from "@/lib/clinical/labels";
import { dayKey, formatDateTime, formatRelativeDay, formatTime, rangeWindow, within } from "@/lib/clinical/time";
import { ReadingsChart } from "@/components/charts/ReadingsChart";
import { DataTable } from "@/components/charts/DataTable";
import { Card, CardHeader } from "@/components/clinical/ui";
import { SourceBadge } from "@/components/clinical/SourceBadge";
import { rangeDays, timeAxis } from "./range-axis";

const CONTEXT = GLUCOSE_CONTEXT_LABEL;

export function GlucoseCard({ record, range }: { record: PatientRecord; range: RangeKey }) {
  const target = record.patient.carePlan.glucoseTarget;
  const readings = useMemo(() => record.glucose.filter((r) => within(r.at, rangeWindow(range))), [record.glucose, range]);
  const axis = timeAxis(range);

  const points = readings.map((r) => ({
    id: r.id,
    x: Date.parse(r.at),
    y: r.value,
    title: `${formatRelativeDay(r.at)}, ${formatTime(r.at)}`,
    detail: `${CONTEXT[r.context]} · ${r.source === "device_reading" ? "paired meter" : "read aloud"}`,
  }));

  const means = useMemo(() => {
    if (range === "day") return undefined;
    return rangeDays(range).map((d) => {
      const vals = readings.filter((r) => dayKey(r.at) === d.key).map((r) => r.value);
      return { x: Date.parse(d.at), y: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
    });
  }, [readings, range]);

  return (
    <Card labelledBy="glucose-title">
      <CardHeader
        id="glucose-title"
        title="Blood glucose"
        subtitle={
          <>
            Recorded readings only. Nouri never estimates or fills in a value. Shaded band: care-plan target {target.low}–{target.high} {target.unit}, set by the
            clinician.
          </>
        }
        action={
          <div className="flex gap-2">
            <SourceBadge source="device_reading" />
            <SourceBadge source="patient_report" />
          </div>
        }
      />
      <ReadingsChart
        label={`Blood glucose readings, ${readings.length} in range`}
        points={points}
        means={means}
        xDomain={axis.domain}
        xTicks={axis.ticks}
        yFloor={60}
        band={{ low: target.low, high: target.high, label: `Target ${target.low}–${target.high}` }}
        unit={target.unit}
      />
      <DataTable
        caption="Glucose readings"
        columns={["Time", "Value (mg/dL)", "Context", "Source"]}
        rows={readings.map((r) => [formatDateTime(r.at), r.value, CONTEXT[r.context], <SourceBadge key={r.id} source={r.source} compact />])}
      />
    </Card>
  );
}
