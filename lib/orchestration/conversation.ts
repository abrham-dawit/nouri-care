import "server-only";

/**
 * The core Phase 4 workflow, in two halves separated by the patient's own decision:
 *
 * 1. runConversationTurn: Nouri replies; explicitly stated observations are
 *    extracted, verified against the patient's words, and held. Nothing is saved.
 * 2. confirmTurn: only the observations the patient confirmed become journal
 *    entries; the timeline is rebuilt and a new reviewable visit brief is drafted.
 *
 * Both record a full trace in the agent activity log.
 */

import { buildVisitBrief } from "@/lib/clinical/brief";
import { getRecord } from "@/lib/clinical/synthetic";
import { buildTimeline } from "@/lib/clinical/timeline";
import { understand } from "@/lib/ai/understand";
import { draftNarrative } from "@/lib/ai/narrative";
import { providerLabel, type AIProvider } from "@/lib/ai/labels";
import { providerInfo, type ChatMessage } from "@/lib/ai/provider";
import { mergeLive } from "@/lib/journal/merge";
import { describeObservation, toJournalEntries, type ObservationKind } from "@/lib/journal/observations";
import { addLiveEntries, demoClockTimestamp, getTurn, liveBrief, liveEntries, nextSeq, saveTurn, setLiveBrief, type ConversationTurn } from "@/lib/journal/store";
import { getLanguage } from "@/lib/voice/languages";
import { getPreferences } from "@/lib/voice/store";
import { clinicalEvidence, safetyReview, type AgentContext } from "./agents";
import { listRuns, newRunId, recordRun, WorkflowError } from "./runtime";
import type { RunTrace, StepTrace } from "./workflows";

const MAX_MESSAGE = 500;
const MAX_HISTORY = 6;

function tracer() {
  const t0 = performance.now();
  const steps: StepTrace[] = [];
  return {
    steps,
    elapsed: () => performance.now() - t0,
    /** Record a step. `from` is the step's start offset; duration runs until now. */
    add(agentId: string, agentName: string, from: number, status: StepTrace["status"], summary: string, details: string[] = []) {
      steps.push({ agentId, agentName, startedMs: from, durationMs: Math.max(0, performance.now() - t0 - from), status, summary, details });
    },
  };
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/* ───────────── 1. Conversation turn ───────────── */

export async function runConversationTurn(input: {
  patientId: string;
  message: string;
  history: ChatMessage[];
  requestedBy: string;
  /** Steps that happened before the text existed (e.g. device auth, speech-to-text), shown first in the trace. */
  preSteps?: Omit<StepTrace, "startedMs">[];
}) {
  const record = getRecord(input.patientId);
  if (!record) throw new WorkflowError(`Unknown patient "${input.patientId}".`, 404);
  const message = input.message.trim();
  if (!message) throw new WorkflowError("Message is empty.", 400);
  if (message.length > MAX_MESSAGE) throw new WorkflowError(`Message is longer than ${MAX_MESSAGE} characters.`, 400);

  const p = record.patient;
  const history = input.history
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE) }));

  const seq = nextSeq();
  const turnId = `turn-${seq}-${Date.now().toString(36)}`;
  const t = tracer();

  t.add("master-orchestrator-agent", "Master Orchestrator Agent", 0, "ok", `Routed a message from ${p.preferredName} through the conversation workflow.`);
  for (const s of input.preSteps ?? []) t.steps.push({ ...s, startedMs: t.elapsed() });

  let from = t.elapsed();
  const caregiver = p.caregivers.find((c) => c.sharing.includes("check_ins"));
  const patientCtx = { preferredName: p.preferredName, interests: p.interests, caregiverName: caregiver?.name.split(" ")[0] };
  t.add("memory-agent", "Memory Agent", from, "ok", `Loaded ${plural(p.interests.length, "thing")} ${p.preferredName} chose to share.`, [
    "Only the preferred name, shared interests and a caregiver's first name go to the model. No health records are sent.",
  ]);

  from = t.elapsed();
  const prefs = getPreferences(p.id);
  const language = { code: prefs.language, region: prefs.region };
  const langLabel = `${getLanguage(language.code)?.name ?? language.code}${language.region ? ` (${language.region})` : ""}`;
  const u = await understand({ turnId, message, history, patient: patientCtx, language });
  t.add(
    "conversation-agent",
    "Conversation Agent",
    from,
    u.fallbackReason || u.languageNote ? "warning" : "ok",
    u.provider !== "mock"
      ? `Replied in ${langLabel} using ${providerLabel(u.provider, u.model)}.`
      : `Replied using the rule-based mock${u.fallbackReason ? `. Fallback: ${u.fallbackReason}` : " (no AI key configured)"}.`,
    [
      `Reply: “${u.reply}”`,
      ...(u.replyEnglish !== u.reply ? [`English: “${u.replyEnglish}”`] : []),
      ...(u.languageNote ? [u.languageNote] : []),
      "Extraction below came from this same call.",
    ],
  );

  const shared = u.provider !== "mock" ? "Part of the shared model call above." : "Part of the mock's rule-based pass above.";
  const count = (...kinds: ObservationKind[]) => u.observations.filter((o) => kinds.includes(o.kind));
  const extraction: [string, string, ObservationKind[], string][] = [
    ["emotion-support-agent", "Emotion Support Agent", ["mood"], "mood"],
    ["sleep-journal-agent", "Sleep Journal Agent", ["sleep"], "sleep report"],
    ["meal-tracking-agent", "Meal Tracking Agent", ["meal", "hydration"], "meal/water entry"],
    ["symptom-tracking-agent", "Symptom Tracking Agent", ["symptom"], "symptom"],
    ["glucose-logging-agent", "Glucose Logging Agent", ["glucose"], "glucose reading"],
  ];
  for (const [id, name, kinds, noun] of extraction) {
    const found = count(...kinds);
    t.add(id, name, t.elapsed(), "ok", found.length ? `Found ${plural(found.length, noun)}.` : `No ${noun} stated.`, [...found.map(describeObservation), shared]);
  }

  from = t.elapsed();
  t.add(
    "data-quality-agent",
    "Data Quality Agent",
    from,
    u.dropped.length ? "warning" : "ok",
    `Verified ${plural(u.observations.length, "observation")} against the patient's exact words${u.dropped.length ? `; dropped ${u.dropped.length}` : ""}.`,
    u.dropped.length ? u.dropped : ["Every quote appears in the message; every number was said by the patient."],
  );

  from = t.elapsed();
  t.add(
    "emergency-request-agent",
    "Emergency Request Agent",
    from,
    u.safety.emergency ? "warning" : "ok",
    u.safety.emergency ? `Detected “${u.safety.emergency}”. Told ${p.preferredName} to call 911. Simulated: no call was placed.` : "No emergency language detected.",
  );

  from = t.elapsed();
  t.add(
    "safety-review-agent",
    "Safety Review Agent",
    from,
    u.safety.replyFindings.length || u.safety.dosingQuestion ? "warning" : "ok",
    u.safety.replyFindings.length
      ? `Replaced an unsafe reply (${u.safety.replyFindings.join(", ")}). Screened the English translation as well as the reply.`
      : u.safety.emergency
        ? "Used the fixed emergency reply."
        : u.safety.dosingQuestion
          ? "Dosing question detected: used the fixed reply that defers to the care plan and doctor."
          : "Reply passed: no dosing, diagnosis or treatment language.",
  );

  const waiting = u.observations.length > 0;
  t.add(
    "patient-confirmation",
    "Patient confirmation",
    t.elapsed(),
    waiting ? "waiting" : "skipped",
    waiting ? `Waiting for ${p.preferredName} to confirm ${plural(u.observations.length, "observation")}. Nothing is saved yet.` : "Nothing to confirm.",
  );

  const runId = newRunId();
  const turn: ConversationTurn = {
    id: turnId,
    patientId: p.id,
    at: demoClockTimestamp(seq),
    receivedAt: new Date().toISOString(),
    message,
    reply: u.reply,
    replyEnglish: u.replyEnglish,
    language: u.language,
    replyLanguage: u.replyLanguage,
    languageNote: u.languageNote,
    mood: u.mood,
    observations: u.observations,
    provider: u.provider,
    model: u.model,
    fallbackReason: u.fallbackReason,
    dropped: u.dropped,
    safety: u.safety,
    status: waiting ? "awaiting_confirmation" : "nothing_to_save",
    savedObservationIds: [],
    runId,
  };
  saveTurn(turn);

  const warned = t.steps.some((s) => s.status === "warning");
  const run: RunTrace = {
    id: runId,
    workflowId: "conversation_to_journal",
    workflowName: "Conversation turn",
    patientId: p.id,
    patientName: p.name,
    requestedBy: input.requestedBy,
    requestedAt: turn.receivedAt,
    totalMs: t.elapsed(),
    status: waiting ? "awaiting_patient" : warned ? "completed_with_warnings" : "completed",
    steps: t.steps,
    output: { turnId },
    ai: { provider: u.provider, model: u.model, fallbackReason: u.fallbackReason },
  };
  recordRun(run);
  return { turn, run };
}

/* ───────────── 2. Patient confirmation ───────────── */

export async function confirmTurn(input: { turnId: string; acceptIds: string[]; requestedBy: string }) {
  const turn = getTurn(input.turnId);
  if (!turn) throw new WorkflowError("That conversation turn was not found. It may have been cleared when the server restarted.", 404);
  if (turn.status !== "awaiting_confirmation") throw new WorkflowError("This turn has already been answered.", 409);
  const record = getRecord(turn.patientId)!;
  const p = record.patient;

  const accept = new Set(input.acceptIds);
  const accepted = turn.observations.filter((o) => accept.has(o.id));
  const t = tracer();
  t.add("master-orchestrator-agent", "Master Orchestrator Agent", 0, "ok", `Routed ${p.preferredName}'s confirmation through the save workflow.`);
  t.add(
    "patient-confirmation",
    "Patient confirmation",
    t.elapsed(),
    "ok",
    accepted.length ? `${p.preferredName} confirmed ${accepted.length} of ${turn.observations.length} observations.` : `${p.preferredName} chose not to save anything.`,
    turn.observations.map((o) => `${accept.has(o.id) ? "✓ Save" : "✕ Don't save"}: ${describeObservation(o)}`),
  );

  let briefId: string | undefined;
  let safetyPassed: boolean | undefined;
  const ai = providerInfo();
  let narrativeProvider: AIProvider = "mock";

  if (accepted.length) {
    let from = t.elapsed();
    const entries = toJournalEntries(accepted, turn.at, { conversationTurnId: turn.id, confirmedAt: new Date().toISOString(), extractedBy: turn.provider });
    addLiveEntries(p.id, entries);
    const merged = mergeLive(record, liveEntries(p.id));
    const timeline = buildTimeline(merged);
    t.add("health-timeline-agent", "Health Timeline Agent", from, "ok", `Saved ${accepted.length} journal ${accepted.length === 1 ? "entry" : "entries"} labelled “patient report”. Timeline now has ${timeline.length} observations.`, [
      `From conversation ${turn.id}, confirmed by the patient`,
    ]);

    from = t.elapsed();
    const brief = buildVisitBrief(merged, { createdDaysAgo: 0, status: "pending_review", reviewer: input.requestedBy });
    brief.id = `${p.id}-brief-live-${turn.id}`;
    brief.createdAt = turn.at;
    const { narrative, note } = await draftNarrative(brief, p.preferredName);
    brief.narrative = narrative;
    narrativeProvider = narrative?.provider ?? "mock";
    t.add(
      "doctor-report-agent",
      "Doctor Report Agent",
      from,
      narrative ? "ok" : "warning",
      `Drafted an updated visit brief from the template${narrative ? `, plus a ${narrative.provider !== "mock" ? `${providerLabel(narrative.provider, narrative.model)} AI` : "rule-based"} overview` : ""}.`,
      [note, "Status: draft, awaiting clinician review"],
    );

    const ctx: AgentContext = { record: merged, reviewer: input.requestedBy, timeline, brief };
    from = t.elapsed();
    const evidence = clinicalEvidence(ctx);
    t.add("clinical-evidence-agent", "Clinical Evidence Agent", from, evidence.status, evidence.summary, evidence.details);

    from = t.elapsed();
    const safety = safetyReview(ctx);
    t.add("safety-review-agent", "Safety Review Agent", from, safety.status, safety.summary, safety.details);

    safetyPassed = ctx.safetyPassed;
    if (safetyPassed && evidence.status !== "error") {
      setLiveBrief(p.id, brief);
      briefId = brief.id;
    }
  }

  turn.status = accepted.length ? "saved" : "dismissed";
  turn.savedObservationIds = accepted.map((o) => o.id);

  const run: RunTrace = {
    id: newRunId(),
    workflowId: "journal_confirmation",
    workflowName: "Save confirmed observations",
    patientId: p.id,
    patientName: p.name,
    requestedBy: input.requestedBy,
    requestedAt: new Date().toISOString(),
    totalMs: t.elapsed(),
    status: safetyPassed === false ? "blocked" : t.steps.some((s) => s.status === "error") ? "failed" : t.steps.some((s) => s.status === "warning") ? "completed_with_warnings" : "completed",
    steps: t.steps,
    output: { briefId, safetyPassed, turnId: turn.id },
    ai: accepted.length ? { provider: narrativeProvider, model: narrativeProvider === "mock" ? null : ai.model } : undefined,
  };
  turn.confirmRunId = run.id;
  recordRun(run);

  // Close out the original turn's trace: the patient has now answered.
  const original = listRuns().find((r) => r.id === turn.runId);
  const pending = original?.steps.find((s) => s.agentId === "patient-confirmation");
  if (original && pending) {
    pending.status = "ok";
    pending.summary = accepted.length
      ? `${p.preferredName} confirmed ${accepted.length} of ${turn.observations.length}; saved by run ${run.id}.`
      : `${p.preferredName} chose not to save anything.`;
    original.status = original.steps.some((s) => s.status === "warning") ? "completed_with_warnings" : "completed";
  }
  return { turn, run, brief: liveBrief(p.id) };
}
