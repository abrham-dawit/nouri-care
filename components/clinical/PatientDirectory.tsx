"use client";

import { useMemo, useState } from "react";
import type { PatientListItem } from "@/lib/clinical/dashboard";
import type { RangeKey } from "@/lib/clinical/types";
import { PatientSearch, matchPatient } from "./PatientSearch";
import { PatientTable } from "./PatientTable";
import { RangeTabs } from "./RangeTabs";
import { DemoDataNotice } from "./ui";

export function PatientDirectory({ patients }: { patients: PatientListItem[] }) {
  const [range, setRange] = useState<RangeKey>("week");
  const [query, setQuery] = useState("");
  const shown = useMemo(() => patients.filter((p) => matchPatient(p, query)), [patients, query]);
  return (
    <div className="mx-auto max-w-7xl px-4 pt-28 pb-10 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-glow-300 uppercase">Doctor portal</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">Patients</h1>
          <p className="mt-2 text-mist-400">Everyone Nouri supports under your care. Open a profile for journals, trends and visit briefs.</p>
        </div>
        <DemoDataNotice />
      </header>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <RangeTabs value={range} onChange={setRange} />
        <PatientSearch value={query} onChange={setQuery} />
        <p className="text-sm text-mist-500 sm:ml-auto" aria-live="polite">
          {shown.length} of {patients.length} patients
        </p>
      </div>
      <div className="glass mt-6 rounded-3xl p-4 sm:p-6">
        <PatientTable patients={shown} range={range} />
      </div>
    </div>
  );
}
