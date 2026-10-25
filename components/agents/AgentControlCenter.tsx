"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Play, RefreshCw, Search, Sparkles } from "lucide-react";
import { AGENTS, AGENT_TEAMS, type AgentStatus } from "@/lib/agents";
import { providerLabel, type AIProvider } from "@/lib/ai/labels";
import { WORKFLOWS, type RunTrace, type WorkflowId } from "@/lib/orchestration/workflows";
import { formatDateTime } from "@/lib/clinical/time";
import { Card, CardHeader } from "@/components/clinical/ui";
import { AgentCard, type AgentActivity } from "./AgentCard";
import { RUN_STATUS_LABEL, RunTimeline } from "./RunTimeline";
import { STATUS_DEFINITION, StatusBadge } from "./StatusBadge";
import { WorkflowMap } from "./WorkflowMap";

type PatientOption = { id: string; name: string };
const STATUSES: AgentStatus[] = ["functional", "prototype", "planned"];
const RUNNABLE_WORKFLOWS = WORKFLOWS.filter((w) => w.runnable && w.trigger === "control_center");

export function AgentControlCenter({ patients }: { patients: PatientOption[] }) {
  const [runs, setRuns] = useState<RunTrace[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [workflowId, setWorkflowId] = useState<WorkflowId>("visit_brief");
  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");
  const [statusFilter, setStatusFilter] = useState<AgentStatus | null>(null);
  const [query, setQuery] = useState("");
  const [ai, setAi] = useState<{ provider: AIProvider; model: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/ai/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAi(d))
      .catch(() => undefined);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/runs", { cache: "no-store" });
      if (!res.ok) throw new Error(`Could not load the activity log (${res.status}).`);
      const data = (await res.json()) as { runs: RunTrace[] };
      setRuns(data.runs);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the activity log.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/agents/runs", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Could not load the activity log (${res.status}).`))))
      .then((data: { runs: RunTrace[] }) => !cancelled && setRuns(data.runs))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Could not load the activity log."))
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/agents/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId, patientId }),
      });
      const data = (await res.json()) as { run?: RunTrace; error?: string };
      if (!res.ok || !data.run) throw new Error(data.error ?? `Run failed (${res.status}).`);
      setRuns((prev) => [data.run!, ...prev.filter((r) => r.id !== data.run!.id)]);
      setSelectedRunId(data.run.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed.");
    } finally {
      setRunning(false);
    }
  };

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? runs[0] ?? null;
  const processed = useMemo(
    () => new Set(selectedRun?.steps.filter((s) => s.status !== "skipped").map((s) => s.agentId) ?? []),
    [selectedRun],
  );

  // Per-agent activity, derived only from real runs in the log.
  const activity = useMemo(() => {
    const map = new Map<string, AgentActivity>();
    for (const r of [...runs].reverse()) {
      for (const s of r.steps) {
        if (s.status === "skipped") continue;
        const prev = map.get(s.agentId) ?? { runs: 0, lastAt: null, lastStatus: null };
        map.set(s.agentId, { runs: prev.runs + 1, lastAt: r.requestedAt, lastStatus: s.status });
      }
    }
    return map;
  }, [runs]);

  const counts = Object.fromEntries(STATUSES.map((s) => [s, AGENTS.filter((a) => a.status === s).length])) as Record<AgentStatus, number>;
  const q = query.trim().toLowerCase();
  const visible = AGENTS.filter((a) => (!statusFilter || a.status === statusFilter) && (!q || `${a.name} ${a.summary}`.toLowerCase().includes(q)));

  return (
    <div className="mx-auto max-w-7xl px-4 pt-28 pb-10 sm:px-8">
      <header>
        <p className="text-sm font-semibold tracking-[0.18em] text-glow-300 uppercase">Orchestration</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">AI Agent Control Center</h1>
        <p className="mt-3 max-w-3xl text-lg leading-relaxed text-mist-300">
          Thirty specialised workflows in six teams, coordinated by the Master Orchestrator. Every status below is honest, and planned agents never show
          activity.
        </p>
        <p className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[0.95rem] text-mist-100">
          <Sparkles className="h-4 w-4 text-source-ai" aria-hidden="true" />
          {ai === null
            ? "Checking the AI provider…"
            : ai.provider !== "mock"
              ? `AI provider: ${providerLabel(ai.provider, ai.model)}, configured on the server.`
              : "Mock mode: no AI key on the server, so AI agents use rule-based stand-ins."}
        </p>
      </header>

      {/* Status summary */}
      <ul className="mt-8 grid gap-3 sm:grid-cols-3">
        {STATUSES.map((s) => (
          <li key={s} className="glass rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <StatusBadge status={s} />
              <span className="text-3xl font-semibold text-white">{counts[s]}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-mist-400">{STATUS_DEFINITION[s]}</p>
          </li>
        ))}
      </ul>

      {/* Run a workflow + execution timeline */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card labelledBy="run-title">
          <CardHeader
            id="run-title"
            title="Run a workflow"
            subtitle="Executes real agents on the server against a synthetic patient and records a timed trace."
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run();
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <label className="grid flex-1 gap-1.5 text-sm text-mist-400">
              Workflow
              <select
                value={workflowId}
                onChange={(e) => setWorkflowId(e.target.value as WorkflowId)}
                className="rounded-xl border border-white/10 bg-night-850 px-3 py-2.5 text-[0.95rem] text-white focus:border-glow-300/40 focus:outline-none"
              >
                {RUNNABLE_WORKFLOWS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid flex-1 gap-1.5 text-sm text-mist-400">
              Patient (synthetic)
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="rounded-xl border border-white/10 bg-night-850 px-3 py-2.5 text-[0.95rem] text-white focus:border-glow-300/40 focus:outline-none"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={running}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-glow-300 px-5 py-2.5 font-semibold text-night-950 transition hover:bg-glow-200 disabled:opacity-60"
            >
              {running ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
              {running ? "Running…" : "Run"}
            </button>
          </form>
          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-status-serious/30 bg-status-serious/10 px-3.5 py-2.5 text-sm text-mist-100">
              {error}
            </p>
          )}
          <div className="mt-6 border-t border-white/[0.06] pt-5" aria-live="polite">
            {selectedRun ? (
              <RunTimeline run={selectedRun} />
            ) : (
              <p className="text-mist-400">{loaded ? "No runs yet. Run a workflow to see which agents process it." : "Loading activity…"}</p>
            )}
          </div>
        </Card>

        <Card labelledBy="log-title">
          <CardHeader
            id="log-title"
            title="Activity log"
            subtitle="Real runs recorded by this server process (kept in memory, cleared on restart)."
            action={
              <button type="button" onClick={() => void refresh()} className="rounded-lg p-2 text-mist-400 hover:bg-white/5 hover:text-white" aria-label="Refresh activity log">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </button>
            }
          />
          <ol className="grid max-h-[32rem] gap-2 overflow-auto">
            {runs.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelectedRunId(r.id)}
                  aria-current={selectedRun?.id === r.id ? "true" : undefined}
                  className={`w-full rounded-xl border px-3.5 py-3 text-left transition ${
                    selectedRun?.id === r.id ? "border-glow-300/35 bg-glow-300/[0.06]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/15"
                  }`}
                >
                  <span className="block font-semibold text-white">{r.workflowName}</span>
                  <span className="block text-sm text-mist-400">
                    {r.patientName} · {r.steps.filter((s) => s.status !== "skipped").length} agents · {RUN_STATUS_LABEL[r.status]}
                  </span>
                  <span className="block text-xs text-mist-500">
                    {formatDateTime(r.requestedAt)} · by {r.requestedBy}
                  </span>
                </button>
              </li>
            ))}
            {loaded && !runs.length && <li className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-mist-400">Nothing has run yet in this server session.</li>}
          </ol>
        </Card>
      </div>

      {/* Workflows */}
      <section aria-labelledby="workflows-title" className="mt-10">
        <h2 id="workflows-title" className="font-display text-3xl font-semibold text-white">
          Workflows
        </h2>
        <p className="mt-2 max-w-3xl text-mist-400">
          How the orchestrator routes requests. Highlighted agents processed the selected run. Dashed workflows are planned and cannot run yet.
        </p>
        <div className="mt-5 grid gap-4">
          {WORKFLOWS.map((w) => (
            <WorkflowMap key={w.id} workflow={w} processed={selectedRun?.workflowId === w.id ? processed : undefined} />
          ))}
        </div>
      </section>

      {/* Agents by team */}
      <section aria-labelledby="agents-title" className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="agents-title" className="font-display text-3xl font-semibold text-white">
              All 30 agents
            </h2>
            <p className="mt-2 text-mist-400">
              Showing {visible.length} of {AGENTS.length}.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={statusFilter === s}
                  onClick={() => setStatusFilter((cur) => (cur === s ? null : s))}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium capitalize transition ${
                    statusFilter === s ? "border-glow-300/40 bg-glow-300/10 text-white" : "border-white/10 text-mist-400 hover:text-white"
                  }`}
                >
                  {s} ({counts[s]})
                </button>
              ))}
            </div>
            <label className="relative flex items-center">
              <span className="sr-only">Search agents</span>
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-mist-500" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search agents"
                className="w-full rounded-xl border border-white/[0.08] bg-night-850 py-2 pr-3 pl-9 text-sm text-white placeholder:text-mist-500 focus:border-glow-300/40 focus:outline-none sm:w-56"
              />
            </label>
          </div>
        </div>

        <div className="mt-6 grid gap-8">
          {AGENT_TEAMS.map((team) => {
            const agents = visible.filter((a) => a.team === team.id);
            if (!agents.length) return null;
            return (
              <section key={team.id} aria-labelledby={`team-${team.id}`}>
                <h3 id={`team-${team.id}`} className="text-lg font-semibold text-white">
                  <span className="text-mist-500">Team {team.number} · </span>
                  {team.name}
                </h3>
                <p className="text-sm text-mist-400">{team.purpose}</p>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {agents.map((agent) => (
                    <AgentCard key={agent.id} agent={agent} activity={activity.get(agent.id) ?? { runs: 0, lastAt: null, lastStatus: null }} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
