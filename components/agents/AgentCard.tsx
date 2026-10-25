import { Code2, Cpu } from "lucide-react";
import { ENGINE_LABEL, type Agent } from "@/lib/agents";
import { formatTime } from "@/lib/clinical/time";
import { StatusBadge } from "./StatusBadge";

export type AgentActivity = { runs: number; lastAt: string | null; lastStatus: string | null };

export function AgentCard({ agent, activity }: { agent: Agent; activity: AgentActivity }) {
  const planned = agent.status === "planned";
  return (
    <li className={`flex h-full min-w-0 flex-col rounded-2xl border p-4 ${planned ? "border-dashed border-white/10 bg-transparent" : "border-white/[0.08] bg-white/[0.025]"}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-mist-500 tabular-nums">{String(agent.number).padStart(2, "0")}</span>
        <StatusBadge status={agent.status} />
      </div>
      <h3 className={`mt-2 font-semibold ${planned ? "text-mist-300" : "text-white"}`}>{agent.name}</h3>
      <p className="mt-1 text-sm leading-relaxed text-mist-400">{agent.summary}</p>
      <p className="mt-3 text-sm leading-relaxed text-mist-300">{agent.statusNote}</p>

      <dl className="mt-auto grid gap-1.5 pt-4 text-xs text-mist-400">
        <div className="flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
          <dt className="sr-only">Engine</dt>
          <dd>{ENGINE_LABEL[agent.engine]}</dd>
        </div>
        {agent.implementation && (
          <div className="flex min-w-0 items-center gap-1.5">
            <Code2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <dt className="sr-only">Implementation</dt>
            <dd className="min-w-0 truncate font-mono" title={agent.implementation}>
              {agent.implementation}
            </dd>
          </div>
        )}
        <div className="border-t border-white/[0.06] pt-2">
          <dt className="sr-only">Activity this session</dt>
          <dd>
            {planned
              ? `Planned for ${agent.plannedPhase} · no activity`
              : activity.runs
                ? `Ran ${activity.runs}× this server session · last ${formatTime(activity.lastAt!)}${activity.lastStatus ? ` (${activity.lastStatus})` : ""}`
                : "Not run yet this server session"}
          </dd>
        </div>
      </dl>
    </li>
  );
}
