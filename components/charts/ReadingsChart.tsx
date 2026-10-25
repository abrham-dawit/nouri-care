"use client";

import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ChartTooltip, type TooltipRow } from "./ChartTooltip";
import { linear, niceTicks, useWidth } from "./scale";

export type ReadingPoint = { id: string; x: number; y: number; title: string; detail: string };
export type MeanPoint = { x: number; y: number | null };

type ReadingsChartProps = {
  label: string;
  points: ReadingPoint[];
  /** Optional daily-mean line (single-hue, legend-keyed). */
  means?: MeanPoint[];
  xDomain: [number, number];
  xTicks: { x: number; label: string }[];
  yFloor?: number;
  yCeil?: number;
  band?: { low: number; high: number; label: string };
  unit: string;
  height?: number;
};

const COLOR = "var(--color-glow-400)";
const PAD = { top: 16, right: 16, bottom: 30, left: 44 };

/**
 * Individual readings as dots with an optional daily-mean line, over a
 * reference band (e.g. the care-plan target). One axis, hairline grid,
 * crosshair that snaps to the nearest reading, keyboard navigable.
 */
export function ReadingsChart({ label, points, means, xDomain, xTicks, yFloor = 0, yCeil, band, unit, height = 260 }: ReadingsChartProps) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const sorted = useMemo(() => [...points].sort((a, b) => a.x - b.x), [points]);
  const yMaxData = Math.max(band?.high ?? 0, ...sorted.map((p) => p.y), 1);
  const yMinData = Math.min(band?.low ?? Infinity, ...sorted.map((p) => p.y));
  const ticks = niceTicks(Math.min(yFloor, yMinData), yCeil ?? yMaxData * 1.04, 4);
  const y0 = ticks[0];
  const y1 = ticks[ticks.length - 1];

  const sx = linear(xDomain[0], xDomain[1], PAD.left, width - PAD.right);
  const sy = linear(y0, y1, height - PAD.bottom, PAD.top);

  const meanPath = (() => {
    if (!means) return "";
    let d = "";
    let pen = false;
    for (const m of means) {
      if (m.y === null) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${sx(m.x).toFixed(1)} ${sy(m.y).toFixed(1)}`;
      pen = true;
    }
    return d;
  })();

  const nearest = (px: number) => {
    let best = -1;
    let dist = Infinity;
    sorted.forEach((p, i) => {
      const d = Math.abs(sx(p.x) - px);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    return best >= 0 ? best : null;
  };

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setActive(nearest(e.clientX - rect.left));
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!sorted.length) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      setActive((i) => (i === null ? (dir > 0 ? 0 : sorted.length - 1) : Math.min(sorted.length - 1, Math.max(0, i + dir))));
    } else if (e.key === "Escape") setActive(null);
  };

  const a = active !== null ? sorted[active] : null;
  const rows: TooltipRow[] = a
    ? [
        { key: "v", value: `${a.y} ${unit}`, label: a.detail, color: COLOR, mark: "dot" },
        ...(band ? [{ key: "b", value: a.y > band.high ? "Above" : a.y < band.low ? "Below" : "Within", label: band.label }] : []),
      ]
    : [];

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-mist-400" aria-hidden="true">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: COLOR }} /> Reading
        </span>
        {means && (
          <span className="flex items-center gap-2">
            <span className="h-0.5 w-4 rounded-full" style={{ background: COLOR }} /> Daily average
          </span>
        )}
        {band && (
          <span className="flex items-center gap-2">
            <span className="h-3 w-4 rounded-[3px] border border-white/15 bg-white/[0.06]" /> {band.label}
          </span>
        )}
      </div>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${label}. Use left and right arrow keys to step through readings.`}
        tabIndex={0}
        className="block touch-none overflow-visible rounded-lg focus-visible:outline-offset-4"
        onPointerMove={onMove}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        {band && (
          <g>
            <rect x={PAD.left} width={width - PAD.left - PAD.right} y={sy(band.high)} height={sy(band.low) - sy(band.high)} fill="white" opacity="0.045" />
            <line x1={PAD.left} x2={width - PAD.right} y1={sy(band.high)} y2={sy(band.high)} stroke="white" strokeOpacity="0.16" />
            <line x1={PAD.left} x2={width - PAD.right} y1={sy(band.low)} y2={sy(band.low)} stroke="white" strokeOpacity="0.16" />
          </g>
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={sy(t)} y2={sy(t)} stroke="white" strokeOpacity="0.06" />
            <text x={PAD.left - 10} y={sy(t)} dy="0.32em" textAnchor="end" className="fill-mist-500 text-[11px] tabular-nums">
              {t}
            </text>
          </g>
        ))}
        <line x1={PAD.left} x2={width - PAD.right} y1={height - PAD.bottom} y2={height - PAD.bottom} stroke="white" strokeOpacity="0.14" />
        {xTicks.map((t) => (
          <text key={t.x} x={sx(t.x)} y={height - PAD.bottom + 19} textAnchor="middle" className="fill-mist-500 text-[11px]">
            {t.label}
          </text>
        ))}

        {meanPath && <path d={meanPath} fill="none" stroke={COLOR} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}

        {a && <line x1={sx(a.x)} x2={sx(a.x)} y1={PAD.top} y2={height - PAD.bottom} stroke="white" strokeOpacity="0.28" />}

        {sorted.map((p, i) => (
          <circle
            key={p.id}
            cx={sx(p.x)}
            cy={sy(p.y)}
            r={active === i ? 6 : 4}
            fill={COLOR}
            fillOpacity={active === null || active === i ? (means ? 0.75 : 1) : 0.35}
            stroke="var(--color-night-850)"
            strokeWidth="2"
          />
        ))}
      </svg>
      {a && <ChartTooltip x={sx(a.x)} y={sy(a.y)} width={width} title={a.title} rows={rows} />}
      {!sorted.length && <p className="absolute inset-0 flex items-center justify-center text-mist-400">No readings in this period</p>}
    </div>
  );
}
