import { CircleCheck, CircleDashed, FlaskConical } from "lucide-react";
import { STATUS_LABEL, type AgentStatus } from "@/lib/agents";

const STYLE: Record<AgentStatus, { icon: typeof CircleCheck; cls: string }> = {
  functional: { icon: CircleCheck, cls: "border-status-good/35 bg-status-good/10 text-status-good" },
  prototype: { icon: FlaskConical, cls: "border-status-warning/35 bg-status-warning/10 text-status-warning" },
  planned: { icon: CircleDashed, cls: "border-white/12 bg-white/[0.03] text-mist-400" },
};

/** Icon + label, never color alone. */
export function StatusBadge({ status }: { status: AgentStatus }) {
  const s = STYLE[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>
      <s.icon className="h-3.5 w-3.5" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export const STATUS_DEFINITION: Record<AgentStatus, string> = {
  functional: "Implemented and executed by the orchestrator in this build.",
  prototype: "Runs, but as a partial or rule-based stand-in for the intended design.",
  planned: "Not built yet. Planned agents never show activity.",
};
