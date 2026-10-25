/**
 * Workflow definitions: which agents the Master Orchestrator calls, in order.
 * Client-safe (no implementations), so the UI can draw the same pipelines
 * the server runs.
 */

import type { AIProvider } from "@/lib/ai/labels";

export type WorkflowId = "visit_brief" | "data_quality_scan" | "conversation_to_journal" | "journal_confirmation" | "device_event" | "emergency_request";

export type WorkflowStep = {
  agentId: string;
  /** Why the orchestrator calls this agent here. */
  purpose: string;
  /** A human step (e.g. patient confirmation), not an agent. */
  human?: boolean;
};

export type Workflow = {
  id: WorkflowId;
  name: string;
  description: string;
  /** runnable = the orchestrator can execute it in this build. */
  runnable: boolean;
  /** Where a runnable workflow is started from. */
  trigger?: "control_center" | "companion";
  plannedPhase?: string;
  steps: WorkflowStep[];
};

export const WORKFLOWS: Workflow[] = [
  {
    id: "visit_brief",
    name: "Prepare a visit brief",
    description: "Turns a patient's recorded observations into a reviewable, source-linked visit brief, then checks it against safety boundaries.",
    runnable: true,
    trigger: "control_center",
    steps: [
      { agentId: "care-plan-agent", purpose: "Load the clinician-approved care plan (targets, schedule)" },
      { agentId: "health-timeline-agent", purpose: "Assemble every observation with its source label" },
      { agentId: "data-quality-agent", purpose: "Flag gaps, duplicates and implausible values" },
      { agentId: "trend-agent", purpose: "Describe the 14-day glucose pattern" },
      { agentId: "adherence-reporting-agent", purpose: "Report reminder acknowledgments (not intake)" },
      { agentId: "progress-analysis-agent", purpose: "Compare this week with last week" },
      { agentId: "doctor-report-agent", purpose: "Draft the brief from the template" },
      { agentId: "clinical-evidence-agent", purpose: "Verify every statement links to real observations" },
      { agentId: "safety-review-agent", purpose: "Block dosing, diagnosis or treatment language" },
    ],
  },
  {
    id: "data_quality_scan",
    name: "Data-quality scan",
    description: "Checks a patient's recent readings for gaps and errors a clinician should know about.",
    runnable: true,
    trigger: "control_center",
    steps: [
      { agentId: "health-timeline-agent", purpose: "Assemble observations" },
      { agentId: "data-quality-agent", purpose: "Flag gaps, duplicates and implausible values" },
    ],
  },
  {
    id: "conversation_to_journal",
    name: "Conversation turn",
    description:
      "A patient talks to Nouri (typed for now; speech arrives with the device). Nouri replies, and the observations the patient explicitly stated are extracted, verified and held for their confirmation.",
    runnable: true,
    trigger: "companion",
    steps: [
      { agentId: "memory-agent", purpose: "Load only what the patient chose to share" },
      { agentId: "conversation-agent", purpose: "Understand and reply warmly (AI or mock)" },
      { agentId: "emotion-support-agent", purpose: "Notice the mood the patient expressed" },
      { agentId: "sleep-journal-agent", purpose: "Extract sleep the patient described" },
      { agentId: "meal-tracking-agent", purpose: "Extract meals and water" },
      { agentId: "symptom-tracking-agent", purpose: "Extract symptoms, in their words" },
      { agentId: "glucose-logging-agent", purpose: "Log numbers the patient read aloud" },
      { agentId: "data-quality-agent", purpose: "Drop anything not in the patient's words" },
      { agentId: "emergency-request-agent", purpose: "Detect calls for help (simulated)" },
      { agentId: "safety-review-agent", purpose: "Screen Nouri's reply" },
      { agentId: "patient-confirmation", purpose: "Patient confirms what should be saved", human: true },
    ],
  },
  {
    id: "journal_confirmation",
    name: "Save confirmed observations",
    description: "After the patient confirms, entries are saved, the timeline is rebuilt and the Doctor Report Agent drafts an updated, reviewable visit brief.",
    runnable: true,
    trigger: "companion",
    steps: [
      { agentId: "health-timeline-agent", purpose: "Save structured, labelled journal entries" },
      { agentId: "doctor-report-agent", purpose: "Redraft the brief, with an AI overview that cites its sources" },
      { agentId: "clinical-evidence-agent", purpose: "Verify every statement links to real observations" },
      { agentId: "safety-review-agent", purpose: "Block dosing, diagnosis or treatment language" },
    ],
  },
  {
    id: "device_event",
    name: "Physical Nouri device event",
    description: "An authenticated ESP32-S3 device sends an event; it is verified, synced and routed.",
    runnable: false,
    plannedPhase: "Phase 5",
    steps: [
      { agentId: "hardware-connection-agent", purpose: "Authenticate the device server-side" },
      { agentId: "data-sync-agent", purpose: "Persist and de-duplicate the event" },
      { agentId: "master-orchestrator-agent", purpose: "Route to the right workflow" },
    ],
  },
  {
    id: "emergency_request",
    name: "Emergency request (simulated)",
    description: "A call for help is recognised and escalated to people. In the demo this is a simulation and never dials 911.",
    runnable: false,
    plannedPhase: "Phase 5",
    steps: [
      { agentId: "emergency-request-agent", purpose: "Recognise a call for help" },
      { agentId: "consent-agent", purpose: "Check who may be contacted" },
      { agentId: "escalation-agent", purpose: "Choose the right human" },
      { agentId: "caregiver-notification-agent", purpose: "Notify consented contacts (simulated)" },
    ],
  },
];

export const getWorkflow = (id: string) => WORKFLOWS.find((w) => w.id === id);

/* ───────────── Run traces (shared shape) ───────────── */

export type StepTrace = {
  agentId: string;
  agentName: string;
  /** Milliseconds from the start of the run. */
  startedMs: number;
  durationMs: number;
  /** waiting = a human step (e.g. patient confirmation) that hasn't happened yet. */
  status: "ok" | "warning" | "error" | "skipped" | "waiting";
  summary: string;
  details: string[];
};

export type RunTrace = {
  id: string;
  workflowId: WorkflowId;
  workflowName: string;
  patientId: string;
  patientName: string;
  requestedBy: string;
  /** Real server time the run happened (not the demo clock). */
  requestedAt: string;
  totalMs: number;
  status: "completed" | "completed_with_warnings" | "blocked" | "failed" | "awaiting_patient";
  steps: StepTrace[];
  output?: { briefId?: string; safetyPassed?: boolean; turnId?: string };
  /** Which AI provider handled model steps, if any. */
  ai?: { provider: AIProvider; model: string | null; fallbackReason?: string };
};
