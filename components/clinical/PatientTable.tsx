"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { PatientListItem } from "@/lib/clinical/dashboard";
import type { RangeKey } from "@/lib/clinical/types";
import { formatRelativeDay, formatTime } from "@/lib/clinical/time";
import { Sparkline } from "@/components/charts/Sparkline";
import { FlagItem, PatientAvatar, fmt } from "./ui";

export function PatientTable({ patients, range, liveCounts }: { patients: PatientListItem[]; range: RangeKey; liveCounts?: Map<string, number> }) {
  if (!patients.length) {
    return <p className="rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center text-mist-400">No patients match your search.</p>;
  }
  return (
    <div>
      <div className="hidden grid-cols-[minmax(0,2.2fr)_1fr_1.1fr_0.9fr_minmax(0,1.6fr)_20px] gap-4 px-4 pb-2 text-xs font-semibold tracking-widest text-mist-500 uppercase lg:grid">
        <span>Patient</span>
        <span>Glucose avg</span>
        <span>30-day trend</span>
        <span>Reminders</span>
        <span>Flags</span>
        <span />
      </div>
      <ul className="grid gap-2.5">
        {patients.map((p) => {
          const s = p.summaries[range].current;
          const flags = p.flags[range];
          return (
            <li key={p.id}>
              <Link
                href={`/patients/${p.id}`}
                className="group grid gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-glow-300/25 hover:bg-white/[0.04] lg:grid-cols-[minmax(0,2.2fr)_1fr_1.1fr_0.9fr_minmax(0,1.6fr)_20px] lg:items-center"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <PatientAvatar name={p.name} index={p.index} />
                  <div className="min-w-0">
                    <p className="truncate text-[1.05rem] font-semibold text-white">
                      {p.name} <span className="font-normal text-mist-400">· {p.age}</span>
                    </p>
                    <p className="truncate text-sm text-mist-400">{p.conditions.join(" · ")}</p>
                    <p className="mt-0.5 text-xs text-mist-500">
                      {p.lastActivityAt ? `Last heard ${formatRelativeDay(p.lastActivityAt).toLowerCase()}, ${formatTime(p.lastActivityAt)}` : "No recent activity"}
                    </p>
                    {(liveCounts?.get(p.id) ?? 0) > 0 && (
                      <p className="mt-1 inline-flex rounded-full border border-source-patient/30 bg-source-patient/[0.08] px-2 py-0.5 text-xs text-mist-100">
                        {liveCounts!.get(p.id)} new from conversations
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:contents">
                  <div className="order-1">
                    <p className="text-xs text-mist-500 lg:hidden">Glucose avg</p>
                    <p className="font-semibold text-white">
                      {fmt.int(s.glucoseMean)} <span className="text-sm font-normal text-mist-400">mg/dL</span>
                    </p>
                    <p className="text-sm text-mist-400">{fmt.pct(s.pctInTarget)} in target</p>
                  </div>
                  <div className="order-3 hidden sm:order-2 sm:block">
                    <p className="text-xs text-mist-500 lg:hidden">30-day trend</p>
                    <Sparkline values={p.dailyMeans} label={`${p.name}: daily average glucose, last 30 days`} />
                  </div>
                  <div className="order-2 sm:order-3">
                    <p className="text-xs text-mist-500 lg:hidden">Reminders</p>
                    <p className="font-semibold text-white">{fmt.pct(s.ackRate)}</p>
                    <p className="text-sm text-mist-400">acknowledged</p>
                  </div>
                </div>

                <ul className="grid gap-1">
                  {flags.slice(0, 2).map((f) => (
                    <FlagItem key={f.id} flag={f} compact />
                  ))}
                  {flags.length > 2 && <li className="pl-6 text-sm text-mist-500">+{flags.length - 2} more</li>}
                  {!flags.length && <li className="text-sm text-mist-500">No flags</li>}
                </ul>
                <ChevronRight className="hidden h-5 w-5 text-mist-500 transition group-hover:translate-x-0.5 group-hover:text-white lg:block" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
