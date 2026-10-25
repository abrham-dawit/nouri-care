"use client";

import { useMemo, useState, type ReactNode } from "react";
import { TIMELINE_KIND_LABEL, type TimelineItem, type TimelineKind } from "@/lib/clinical/timeline";
import type { RangeKey, Source } from "@/lib/clinical/types";
import { dayKey, formatRelativeDay, formatTime, rangeWindow, within } from "@/lib/clinical/time";
import { Card, CardHeader } from "@/components/clinical/ui";
import { SOURCE_LABEL, SourceBadge } from "@/components/clinical/SourceBadge";

const PAGE = 40;
const SOURCES: Source[] = ["patient_report", "device_reading", "clinician_entry", "ai_estimate"];

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
        selected ? "border-glow-300/40 bg-glow-300/10 text-white" : "border-white/10 text-mist-400 hover:border-white/20 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

/** Chronological, source-labelled history of everything Nouri recorded. */
export function TimelineCard({ items, range }: { items: TimelineItem[]; range: RangeKey }) {
  const [kinds, setKinds] = useState<Set<TimelineKind>>(new Set());
  const [source, setSource] = useState<Source | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const filtered = useMemo(() => {
    const w = rangeWindow(range);
    return items.filter(
      (t) =>
        (within(t.at, w) || (t.kind === "appointment" && Date.parse(t.at) > w.start)) &&
        (!kinds.size || kinds.has(t.kind)) &&
        (!source || t.source === source || t.extraSource?.source === source),
    );
  }, [items, range, kinds, source]);

  const shown = filtered.slice(0, limit);
  const groups: { key: string; at: string; items: TimelineItem[] }[] = [];
  for (const t of shown) {
    const k = dayKey(t.at);
    const last = groups[groups.length - 1];
    if (last?.key === k) last.items.push(t);
    else groups.push({ key: k, at: t.at, items: [t] });
  }

  const toggleKind = (k: TimelineKind) =>
    setKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <Card labelledBy="timeline-title">
      <CardHeader id="timeline-title" title="Health timeline" subtitle={`${filtered.length} observations in this period, newest first.`} />
      <div className="grid gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by type">
          {(Object.keys(TIMELINE_KIND_LABEL) as TimelineKind[]).map((k) => (
            <Chip key={k} selected={kinds.has(k)} onClick={() => toggleKind(k)}>
              {TIMELINE_KIND_LABEL[k]}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by source">
          {SOURCES.map((s) => (
            <Chip key={s} selected={source === s} onClick={() => setSource((cur) => (cur === s ? null : s))}>
              {SOURCE_LABEL[s]}
            </Chip>
          ))}
        </div>
      </div>

      <ol className="mt-6 grid gap-6">
        {groups.map((g) => (
          <li key={g.key}>
            <h3 className="sticky top-24 z-[1] mb-2 inline-block rounded-full bg-night-800/90 px-3 py-1 text-sm font-semibold text-mist-300 backdrop-blur">
              {formatRelativeDay(g.at)}
            </h3>
            <ol className="relative grid gap-1 border-l border-white/[0.08] pl-5">
              {g.items.map((t) => (
                <li key={t.id} className="relative flex flex-col gap-1.5 rounded-xl px-2 py-2 sm:flex-row sm:items-start sm:gap-4">
                  <span className="absolute top-3.5 -left-[25px] h-2 w-2 rounded-full bg-mist-500 ring-4 ring-night-850" aria-hidden="true" />
                  <span className="w-20 shrink-0 text-sm text-mist-500 tabular-nums">{formatTime(t.at)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="text-mist-100">{t.title}</span>
                    {t.detail && <span className="block text-sm text-mist-400">{t.detail}</span>}
                    {t.quote && <span className="block text-sm text-mist-400 italic">&ldquo;{t.quote}&rdquo;</span>}
                    {t.fromConversation && (
                      <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-source-patient/25 bg-source-patient/[0.07] px-2 py-0.5 text-xs text-mist-100">
                        From a conversation with Nouri · confirmed by the patient
                      </span>
                    )}
                    {t.extraSource && (
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-mist-400">
                        {t.extraSource.text} <SourceBadge source={t.extraSource.source} compact />
                      </span>
                    )}
                  </span>
                  <SourceBadge source={t.source} />
                </li>
              ))}
            </ol>
          </li>
        ))}
        {!groups.length && <li className="text-mist-400">Nothing matches these filters.</li>}
      </ol>
      {filtered.length > limit && (
        <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="mt-5 rounded-xl border border-white/12 px-4 py-2.5 font-semibold text-white hover:bg-white/[0.04]">
          Show more ({filtered.length - limit} remaining)
        </button>
      )}
    </Card>
  );
}
