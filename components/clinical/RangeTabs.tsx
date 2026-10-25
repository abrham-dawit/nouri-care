"use client";

import { RANGE_LABEL, type RangeKey } from "@/lib/clinical/types";

const RANGES: RangeKey[] = ["day", "week", "month"];

/** Date-range control: the first filter in the row, scoping everything below it. */
export function RangeTabs({ value, onChange }: { value: RangeKey; onChange: (r: RangeKey) => void }) {
  return (
    <div role="radiogroup" aria-label="Time range" className="inline-flex rounded-xl border border-white/[0.08] bg-night-850 p-1">
      {RANGES.map((r) => {
        const selected = r === value;
        return (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(r)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const next = RANGES[(RANGES.indexOf(value) + (e.key === "ArrowRight" ? 1 : RANGES.length - 1)) % RANGES.length];
              onChange(next);
              (e.currentTarget.parentElement?.querySelector(`[data-range="${next}"]`) as HTMLButtonElement | null)?.focus();
            }}
            tabIndex={selected ? 0 : -1}
            data-range={r}
            className={`rounded-lg px-4 py-2 text-[0.95rem] font-semibold transition-colors ${
              selected ? "bg-white/[0.09] text-white shadow-sm" : "text-mist-400 hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            {RANGE_LABEL[r]}
          </button>
        );
      })}
    </div>
  );
}
