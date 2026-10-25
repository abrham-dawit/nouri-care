export type TooltipRow = { key: string; value: string; label: string; color?: string; mark?: "line" | "dot" | "rect" };

/** Values lead, labels follow; series keyed with a short mark of their color. */
export function ChartTooltip({ x, y, width, title, rows }: { x: number; y: number; width: number; title: string; rows: TooltipRow[] }) {
  const flip = x > width - 200;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 min-w-44 rounded-xl border border-white/10 bg-night-950/95 px-3.5 py-2.5 shadow-xl backdrop-blur-md"
      style={{ left: flip ? undefined : x + 14, right: flip ? width - x + 14 : undefined, top: Math.max(0, y - 20) }}
    >
      <p className="text-xs font-medium text-mist-400">{title}</p>
      <ul className="mt-1.5 grid gap-1">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2.5">
            {r.color && (
              <span
                aria-hidden="true"
                className={r.mark === "dot" ? "h-2 w-2 rounded-full" : r.mark === "rect" ? "h-2.5 w-2.5 rounded-[3px]" : "h-0.5 w-3 rounded-full"}
                style={{ background: r.color }}
              />
            )}
            <span className="text-[0.95rem] font-semibold text-white tabular-nums">{r.value}</span>
            <span className="text-sm text-mist-400">{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
