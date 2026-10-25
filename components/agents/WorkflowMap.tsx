import { ArrowRight, Hand } from "lucide-react";
import { getAgent } from "@/lib/agents";
import type { Workflow } from "@/lib/orchestration/workflows";
import { StatusBadge } from "./StatusBadge";

/**
 * A workflow drawn as the orchestrator runs it: ordered agent steps.
 * Agents that processed the selected run are highlighted.
 */
export function WorkflowMap({ workflow, processed }: { workflow: Workflow; processed?: Set<string> }) {
  return (
    <article className={`rounded-2xl border p-4 sm:p-5 ${workflow.runnable ? "border-white/[0.08] bg-white/[0.02]" : "border-dashed border-white/10 bg-transparent"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{workflow.name}</h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-mist-400">{workflow.description}</p>
        </div>
        {workflow.runnable ? (
          <span className="rounded-full border border-status-good/35 bg-status-good/10 px-2.5 py-0.5 text-xs font-semibold text-status-good">
            {workflow.trigger === "companion" ? "Runs from Talk to Nouri" : "Runnable here"}
          </span>
        ) : (
          <span className="rounded-full border border-white/12 px-2.5 py-0.5 text-xs font-semibold text-mist-400">Planned · {workflow.plannedPhase}</span>
        )}
      </div>

      <ol className="mt-4 flex flex-wrap items-stretch gap-y-3" aria-label={`${workflow.name} steps`}>
        <li className="flex items-center">
          <span className="rounded-xl border border-glow-300/25 bg-glow-300/[0.06] px-3 py-2 text-sm font-semibold text-glow-200">Master Orchestrator</span>
          <ArrowRight className="mx-1.5 h-4 w-4 shrink-0 text-mist-500" aria-hidden="true" />
        </li>
        {workflow.steps.map((step, i) => {
          const agent = getAgent(step.agentId);
          const hit = processed?.has(step.agentId);
          const last = i === workflow.steps.length - 1;
          return (
            <li key={`${step.agentId}-${i}`} className="flex items-center">
              <div
                title={step.purpose}
                className={`flex max-w-[15rem] flex-col gap-1.5 rounded-xl border px-3 py-2 transition ${
                  step.human
                    ? "border-blush-300/30 bg-blush-300/[0.06]"
                    : hit
                      ? "border-series-1/60 bg-series-1/15 shadow-[0_0_24px_-8px_var(--color-series-1)]"
                      : workflow.runnable
                        ? "border-white/10 bg-night-850"
                        : "border-dashed border-white/10 bg-night-850/50"
                }`}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                  {step.human && <Hand className="h-4 w-4 text-blush-300" aria-hidden="true" />}
                  {step.human ? "Patient confirms" : (agent?.name.replace(/ Agent$/, "") ?? step.agentId)}
                  {hit && <span className="sr-only"> (processed this run)</span>}
                </span>
                <span className="text-xs leading-snug text-mist-400">{step.purpose}</span>
                {agent && <StatusBadge status={agent.status} />}
              </div>
              {!last && <ArrowRight className="mx-1.5 h-4 w-4 shrink-0 text-mist-500" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </article>
  );
}
