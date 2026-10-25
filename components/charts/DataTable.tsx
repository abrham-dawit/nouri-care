import type { ReactNode } from "react";

/** The table-view twin every chart ships with, so no value is hover-only. */
export function DataTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: ReactNode[][] }) {
  return (
    <details className="group mt-3">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-medium text-mist-400 hover:text-white">
        <span className="transition-transform group-open:rotate-90" aria-hidden="true">
          ›
        </span>
        Show data table
      </summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-night-850 text-mist-400">
            <tr>
              {columns.map((c) => (
                <th key={c} scope="col" className="px-3 py-2 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04] text-mist-300 tabular-nums">
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-1.5">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
