/**
 * The Master Orchestrator: runs a workflow's agents in order against one
 * patient and records a real, timed trace of what each agent did.
 *
 * Traces are kept in this server process's memory only (capped, reset on
 * restart). Nothing here is fabricated: if it's in the log, it ran.
 */

import { getAgent } from "@/lib/agents";
import { getRecord } from "@/lib/clinical/synthetic";
import { RUNNABLE, type AgentContext } from "./agents";
import { getWorkflow, type RunTrace, type StepTrace, type WorkflowId } from "./workflows";

const MAX_RUNS = 50;

const store = globalThis as unknown as { __nouriRuns?: RunTrace[]; __nouriRunSeq?: number };
store.__nouriRuns ??= [];
store.__nouriRunSeq ??= 0;

export class WorkflowError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
  }
}

export function listRuns(): RunTrace[] {
  return store.__nouriRuns!;
}

export function newRunId() {
  store.__nouriRunSeq! += 1;
  return `run-${store.__nouriRunSeq}-${Date.now().toString(36)}`;
}

/** Adds a completed trace (from any workflow runner, e.g. conversation.ts) to the activity log. */
export function recordRun(trace: RunTrace) {
  store.__nouriRuns!.unshift(trace);
  store.__nouriRuns!.length = Math.min(store.__nouriRuns!.length, MAX_RUNS);
}

export function runWorkflow(workflowId: WorkflowId, patientId: string, requestedBy: string): RunTrace {
  const workflow = getWorkflow(workflowId);
  if (!workflow) throw new WorkflowError(`Unknown workflow "${workflowId}".`, 400);
  if (!workflow.runnable) throw new WorkflowError(`"${workflow.name}" is planned for ${workflow.plannedPhase} and cannot run yet.`, 409);
  if (workflow.trigger !== "control_center") throw new WorkflowError(`"${workflow.name}" starts from a conversation with Nouri, not from here.`, 409);
  const record = getRecord(patientId);
  if (!record) throw new WorkflowError(`Unknown patient "${patientId}".`, 404);

  const ctx: AgentContext = { record, reviewer: requestedBy };
  const t0 = performance.now();
  const runnable = workflow.steps.filter((s) => RUNNABLE[s.agentId]).length;
  const steps: StepTrace[] = [
    {
      agentId: "master-orchestrator-agent",
      agentName: "Master Orchestrator Agent",
      startedMs: 0,
      durationMs: performance.now() - t0,
      status: "ok",
      summary: `Routed “${workflow.name}” for ${record.patient.name} through ${runnable} agents.`,
      details: workflow.steps.map((s, i) => `${i + 1}. ${getAgent(s.agentId)?.name ?? s.agentId}: ${s.purpose}`),
    },
  ];
  let halted = false;

  for (const step of workflow.steps) {
    const agent = getAgent(step.agentId);
    const impl = RUNNABLE[step.agentId];
    const startedMs = performance.now() - t0;
    if (halted || !impl || !agent) {
      steps.push({
        agentId: step.agentId,
        agentName: agent?.name ?? step.agentId,
        startedMs,
        durationMs: 0,
        status: "skipped",
        summary: halted ? "Skipped: an earlier agent stopped the workflow." : "Skipped: agent is not implemented.",
        details: [],
      });
      continue;
    }
    try {
      const result = impl(ctx);
      steps.push({ agentId: agent.id, agentName: agent.name, startedMs, durationMs: performance.now() - t0 - startedMs, status: result.status, summary: result.summary, details: result.details ?? [] });
      if (result.status === "error") halted = true;
    } catch (err) {
      steps.push({
        agentId: agent.id,
        agentName: agent.name,
        startedMs,
        durationMs: performance.now() - t0 - startedMs,
        status: "error",
        summary: "Agent threw an error.",
        details: [err instanceof Error ? err.message : String(err)],
      });
      halted = true;
    }
  }

  const blocked = ctx.safetyPassed === false;
  const failed = steps.some((s) => s.status === "error") && !blocked;
  const warned = steps.some((s) => s.status === "warning");

  const trace: RunTrace = {
    id: newRunId(),
    workflowId,
    workflowName: workflow.name,
    patientId,
    patientName: record.patient.name,
    requestedBy,
    requestedAt: new Date().toISOString(),
    totalMs: performance.now() - t0,
    status: blocked ? "blocked" : failed ? "failed" : warned ? "completed_with_warnings" : "completed",
    steps,
    output: ctx.brief ? { briefId: ctx.brief.id, safetyPassed: ctx.safetyPassed } : undefined,
  };

  recordRun(trace);
  return trace;
}
