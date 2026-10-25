"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, CircleCheck, CircleSlash, Hourglass, OctagonAlert } from "lucide-react";
import { providerLabel } from "@/lib/ai/labels";
import type { RunTrace, StepTrace } from "@/lib/orchestration/workflows";
import { formatDateTime } from "@/lib/clinical/time";

const STEP: Record<StepTrace["status"], { icon: typeof CircleCheck; color: string; label: string; bar: string }> = {
  ok: { icon: CircleCheck, color: "text-status-good", label: "OK", bar: "bg-series-1" },
  warning: { icon: AlertTriangle, color: "text-status-warning", label: "Warning", bar: "bg-series-1" },
  error: { icon: OctagonAlert, color: "text-status-serious", label: "Stopped", bar: "bg-series-1" },
  skipped: { icon: CircleSlash, color: "text-mist-500", label: "Skipped", bar: "bg-white/10" },
  waiting: { icon: Hourglass, color: "text-blush-300", label: "Waiting for the patient", bar: "bg-white/10" },
};

export const RUN_STATUS_LABEL: Record<RunTrace["status"], string> = {
  awaiting_patient: "Waiting for patient confirmation",
  completed: "Completed",
  completed_with_warnings: "Completed with warnings",
  blocked: "Blocked by safety review",
  failed: "Failed",
};

const ms = (v: number) => (v < 1 ? `${v.toFixed(2)} ms` : `${v.toFixed(1)} ms`);

/** Execution timeline: real start offsets and durations for each agent in one run. */
export function RunTimeline({ run }: { run: RunTrace }) {
  const [open, setOpen] = useState<string | null>(null);
  const total = Math.max(run.totalMs, 0.001);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-white">
          {run.workflowName} · {run.patientName}
        </p>
        <p className="text-sm text-mist-400">
          {RUN_STATUS_LABEL[run.status]} in {ms(run.totalMs)} · {formatDateTime(run.requestedAt)} (server time)
        </p>
      </div>
      {run.ai && (
        <p className="mt-1 text-sm text-mist-400">
          AI: {providerLabel(run.ai.provider, run.ai.model)}
          {run.ai.fallbackReason ? ` · fell back to mock: ${run.ai.fallbackReason}` : ""}
        </p>
      )}

      <ol className="mt-4 grid gap-1.5" aria-label="Agents that processed this request, in order">
        {run.steps.map((s, i) => {
          const st = STEP[s.status];
          const left = (s.startedMs / total) * 100;
          const width = Math.max(0.8, (s.durationMs / total) * 100);
          const key = `${s.agentId}-${i}`;
          const expanded = open === key;
          return (
            <li key={key} className="rounded-xl border border-white/[0.05] bg-white/[0.015]">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : key)}
                aria-expanded={expanded}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-left sm:grid-cols-[220px_minmax(0,1fr)_88px]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <st.icon className={`h-4 w-4 shrink-0 ${st.color}`} aria-hidden="true" />
                  <span className="truncate text-[0.95rem] font-medium text-white">{s.agentName}</span>
                  <span className="sr-only">{st.label}</span>
                </span>
                <span className="relative hidden h-2 rounded-full bg-white/[0.04] sm:block" aria-hidden="true">
                  <span className={`absolute top-0 h-2 rounded-full ${st.bar}`} style={{ left: `${left}%`, width: `${width}%` }} />
                </span>
                <span className="flex items-center justify-end gap-1 text-sm text-mist-400 tabular-nums">
                  {ms(s.durationMs)}
                  <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                </span>
              </button>
              <div className="px-3 pb-2.5 pl-9 text-sm text-mist-300">{s.summary}</div>
              {expanded && s.details.length > 0 && (
                <ul className="mx-3 mb-3 ml-9 grid gap-1 rounded-lg bg-night-950/50 p-3 text-sm text-mist-400">
                  {s.details.map((d, j) => (
                    <li key={j}>• {d}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-mist-500">Bars show each agent&apos;s real start time and duration within this run, measured on the server.</p>
    </div>
  );
}
