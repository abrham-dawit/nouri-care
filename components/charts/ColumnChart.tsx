"use client";

import { useState } from "react";
import { ChartTooltip } from "./ChartTooltip";
import { linear, niceTicks, useWidth } from "./scale";

export type ColumnSeries = { key: string; label: string; color: string };
export type Column = { key: string; label: string; title: string; values: Record<string, number> };

type ColumnChartProps = {
  label: string;
  series: ColumnSeries[];
  columns: Column[];
  unit?: string;
  height?: number;
  yMax?: number;
  /** Show every nth x label to avoid collisions on long ranges. */
  labelEvery?: number;
  reference?: { value: number; label: string };
};

const PAD = { top: 14, right: 12, bottom: 30, left: 40 };
const GAP = 2;
const R = 4;

/** Column with a rounded data-end (top) and square baseline. */
function topRounded(x: number, y: number, w: number, h: number) {
  const r = Math.min(R, h, w / 2);
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`;
}

/**
 * Stacked (or single-series) columns. ≤24px marks, 2px surface gaps between
 * segments, per-column hover/focus tooltip listing every series.
 */
export function ColumnChart({ label, series, columns, unit = "", height = 220, yMax, labelEvery = 1, reference }: ColumnChartProps) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const totals = columns.map((c) => series.reduce((s, ser) => s + (c.values[ser.key] ?? 0), 0));
  const ticks = niceTicks(0, yMax ?? Math.max(1, reference?.value ?? 0, ...totals) * 1.05, 4);
  const top = ticks[ticks.length - 1];
  const sy = linear(0, top, height - PAD.bottom, PAD.top);
  const band = (width - PAD.left - PAD.right) / Math.max(1, columns.length);
  const barW = Math.max(3, Math.min(24, band * 0.62));

  const activeCol = active !== null ? columns[active] : null;

  return (
    <div ref={wrapRef} className="relative w-full">
      {series.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-mist-400">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden="true" /> {s.label}
            </li>
          ))}
        </ul>
      )}
      <svg width={width} height={height} role="group" aria-label={label} className="block overflow-visible">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={sy(t)} y2={sy(t)} stroke="white" strokeOpacity="0.06" />
            <text x={PAD.left - 10} y={sy(t)} dy="0.32em" textAnchor="end" className="fill-mist-500 text-[11px] tabular-nums">
              {t}
            </text>
          </g>
        ))}
        {reference && (
          <g>
            <line x1={PAD.left} x2={width - PAD.right} y1={sy(reference.value)} y2={sy(reference.value)} stroke="white" strokeOpacity="0.3" />
            <text x={width - PAD.right} y={sy(reference.value) - 6} textAnchor="end" className="fill-mist-400 text-[11px]">
              {reference.label}
            </text>
          </g>
        )}
        <line x1={PAD.left} x2={width - PAD.right} y1={height - PAD.bottom} y2={height - PAD.bottom} stroke="white" strokeOpacity="0.14" />

        {columns.map((c, i) => {
          const cx = PAD.left + band * i + band / 2;
          let cursor = 0;
          const visible = series.filter((s) => (c.values[s.key] ?? 0) > 0);
          const total = totals[i];
          return (
            <g
              key={c.key}
              tabIndex={0}
              role="img"
              aria-label={`${c.title}: ${series.map((s) => `${s.label} ${c.values[s.key] ?? 0}${unit}`).join(", ")}`}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="outline-none"
            >
              {/* Hit area is the whole column band, bigger than the mark */}
              <rect x={cx - band / 2} y={PAD.top} width={band} height={height - PAD.top - PAD.bottom} fill="transparent" />
              {active === i && <rect x={cx - band / 2 + 1} y={PAD.top} width={band - 2} height={height - PAD.top - PAD.bottom} rx="6" fill="white" opacity="0.04" />}
              {visible.map((s, si) => {
                const v = c.values[s.key] ?? 0;
                const yTop = sy(cursor + v);
                const yBottom = sy(cursor);
                cursor += v;
                const isTop = si === visible.length - 1;
                const gap = si > 0 ? GAP : 0;
                const h = Math.max(0, yBottom - yTop - gap);
                return isTop ? (
                  <path key={s.key} d={topRounded(cx - barW / 2, yTop, barW, h)} fill={s.color} opacity={active === null || active === i ? 1 : 0.55} />
                ) : (
                  <rect key={s.key} x={cx - barW / 2} y={yTop} width={barW} height={h} fill={s.color} opacity={active === null || active === i ? 1 : 0.55} />
                );
              })}
              {total === 0 && <circle cx={cx} cy={height - PAD.bottom - 3} r="1.5" fill="white" opacity="0.25" />}
              {i % labelEvery === 0 && (
                <text x={cx} y={height - PAD.bottom + 19} textAnchor="middle" className="fill-mist-500 text-[11px]">
                  {c.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {activeCol && active !== null && (
        <ChartTooltip
          x={PAD.left + band * active + band / 2}
          y={sy(totals[active])}
          width={width}
          title={activeCol.title}
          rows={series.map((s) => ({ key: s.key, value: `${activeCol.values[s.key] ?? 0}${unit}`, label: s.label, color: s.color, mark: "rect" as const }))}
        />
      )}
    </div>
  );
}
