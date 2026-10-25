import type { ReactNode } from "react";
import { AlertTriangle, FlaskConical, Info, OctagonAlert } from "lucide-react";
import type { Flag, FlagLevel } from "@/lib/clinical/summaries";

export function Card({ children, className = "", id, labelledBy }: { children: ReactNode; className?: string; id?: string; labelledBy?: string }) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={`glass rounded-3xl p-5 sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

export function CardHeader({ id, title, subtitle, action }: { id?: string; title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id={id} className="text-lg font-semibold text-white">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-sm leading-relaxed text-mist-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type StatTileProps = {
  label: string;
  value: string;
  unit?: string;
  delta?: { text: string; tone: "good" | "bad" | "neutral" };
  hint?: ReactNode;
  trend?: ReactNode;
};

/** Stat tile: label · value · optional delta vs the previous period · optional trend. */
export function StatTile({ label, value, unit, delta, hint, trend }: StatTileProps) {
  const tone = delta?.tone === "good" ? "text-status-good" : delta?.tone === "bad" ? "text-status-serious" : "text-mist-400";
  return (
    <div className="glass flex flex-col justify-between rounded-2xl p-4 sm:p-5">
      <p className="text-sm font-medium text-mist-400">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-3xl font-semibold tracking-tight text-white">
          {value}
          {unit && <span className="ml-1 text-base font-medium text-mist-400">{unit}</span>}
        </p>
        {trend}
      </div>
      {(delta || hint) && (
        <p className="mt-2 text-sm text-mist-400">
          {delta && <span className={`font-semibold ${tone}`}>{delta.text}</span>}
          {delta && hint && " · "}
          {hint}
        </p>
      )}
    </div>
  );
}

const FLAG: Record<FlagLevel, { icon: typeof Info; color: string; label: string }> = {
  serious: { icon: OctagonAlert, color: "text-status-serious", label: "Needs attention" },
  warning: { icon: AlertTriangle, color: "text-status-warning", label: "Review" },
  info: { icon: Info, color: "text-glow-300", label: "Note" },
};

/** Rule-based data flag: icon + label + text, never color alone. */
export function FlagItem({ flag, compact = false }: { flag: Flag; compact?: boolean }) {
  const f = FLAG[flag.level];
  return (
    <li className={`flex items-start gap-2.5 ${compact ? "text-sm" : "text-[0.95rem]"} text-mist-300`}>
      <f.icon className={`mt-0.5 h-4 w-4 shrink-0 ${f.color}`} aria-hidden="true" />
      <span>
        <span className="sr-only">{f.label}: </span>
        {flag.text}
      </span>
    </li>
  );
}

const AVATAR_TINTS = ["from-glow-400/40 to-tide-400/20", "from-blush-300/40 to-ember-300/15", "from-tide-300/40 to-glow-500/15", "from-amber-300/35 to-ember-300/15", "from-source-ai/40 to-glow-400/15", "from-glow-200/30 to-series-1/20"];

export function PatientAvatar({ name, index, size = "md" }: { name: string; index: number; size?: "md" | "lg" }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br font-semibold text-white ${AVATAR_TINTS[index % AVATAR_TINTS.length]} ${
        size === "lg" ? "h-16 w-16 text-xl" : "h-11 w-11 text-sm"
      }`}
    >
      {initials}
    </span>
  );
}

export function DemoDataNotice({ children }: { children?: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/[0.07] px-3 py-1 text-sm text-amber-300">
      <FlaskConical className="h-4 w-4" aria-hidden="true" />
      {children ?? "Synthetic demo data · not real patients · not for clinical use"}
    </p>
  );
}

export const fmt = {
  int: (n: number | null | undefined) => (n === null || n === undefined ? "—" : Math.round(n).toString()),
  pct: (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${Math.round(n)}%`),
  one: (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toFixed(1)),
};
