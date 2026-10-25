/**
 * Nouri's 30 agents are specialised workflows coordinated by the Master
 * Orchestrator, not 30 separate models. Status is reported honestly:
 *
 * - functional: implemented and executed by the orchestrator in this build.
 * - prototype:  runs, but as a partial or rule-based stand-in for the intended design.
 * - planned:    not built yet. Never shown with activity.
 */

export type AgentStatus = "functional" | "prototype" | "planned";
/** ai_with_mock: uses the configured AI model (Claude or OpenAI); falls back to a rule-based mock without a key. */
export type AgentEngine = "rule_based" | "ai_with_mock" | "none";

export type AgentTeamId = "companionship" | "health" | "progress" | "doctor" | "safety" | "platform";

export type AgentTeam = {
  id: AgentTeamId;
  number: number;
  name: string;
  purpose: string;
};

export type Agent = {
  id: string;
  number: number;
  name: string;
  team: AgentTeamId;
  summary: string;
  status: AgentStatus;
  engine: AgentEngine;
  /** What exists today, or what is missing. */
  statusNote: string;
  /** Where the implementation lives, for functional/prototype agents. */
  implementation?: string;
  /** Build phase in which a planned agent is scheduled. */
  plannedPhase?: string;
};

export const AGENT_TEAMS: AgentTeam[] = [
  { id: "companionship", number: 1, name: "Patient Companionship", purpose: "Warm daily conversation, emotional support and gentle check-ins." },
  { id: "health", number: 2, name: "Health & Nutrition", purpose: "Patient-reported glucose, meals, symptoms and reminder acknowledgments." },
  { id: "progress", number: 3, name: "Patient Progress", purpose: "Trends, adherence and data quality across the patient's own records." },
  { id: "doctor", number: 4, name: "Doctor Support", purpose: "Reviewable visit briefs traceable to their source observations." },
  { id: "safety", number: 5, name: "Safety & Emergency", purpose: "Consent, escalation and caregiver notification (simulated in the demo)." },
  { id: "platform", number: 6, name: "Platform & Hardware", purpose: "Device connection, voice, scheduling, sync and orchestration." },
];

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

type AgentInput = Omit<Agent, "id" | "number" | "name" | "team" | "summary">;

const planned = (phase: string, note: string): AgentInput => ({ status: "planned", engine: "none", plannedPhase: phase, statusNote: note });

const a = (number: number, name: string, team: AgentTeamId, summary: string, info: AgentInput): Agent => ({
  id: slug(name),
  number,
  name,
  team,
  summary,
  ...info,
});

const CONVERSATION = "lib/ai/understand.ts › understand";

export const AGENTS: Agent[] = [
  a(1, "Conversation Agent", "companionship", "Holds natural, patient conversations in Nouri's warm voice.", {
    status: "prototype",
    engine: "ai_with_mock",
    statusNote: "Replies in the patient's chosen language (130 available; quality varies). Claude or OpenAI when configured; the rule-based mock speaks English only.",
    implementation: CONVERSATION,
  }),
  a(2, "Emotion Support Agent", "companionship", "Notices loneliness or low mood in conversation and responds with care.", {
    status: "prototype",
    engine: "ai_with_mock",
    statusNote: "Notes the mood a patient expresses in a message and answers kindly. No longer-term tracking yet.",
    implementation: CONVERSATION,
  }),
  a(3, "Memory Agent", "companionship", "Remembers names, stories and preferences the patient chooses to share.", {
    status: "prototype",
    engine: "rule_based",
    statusNote: "Gives the model only the interests the patient chose to share. It doesn't learn new memories yet.",
    implementation: "lib/orchestration/conversation.ts",
  }),
  a(4, "Daily Check-in Agent", "companionship", "Runs a friendly morning and evening check-in routine.", planned("Phase 5", "Scheduled check-ins need the device; demo check-ins are synthetic.")),
  a(5, "Sleep Journal Agent", "companionship", "Turns what the patient says about their sleep into journal entries.", {
    status: "prototype",
    engine: "ai_with_mock",
    statusNote: "Extracts sleep the patient describes. Hours only if stated. Saved only after the patient confirms.",
    implementation: CONVERSATION,
  }),

  a(6, "Glucose Logging Agent", "health", "Records glucose readings from a device or read aloud by the patient, and never estimates them.", {
    status: "prototype",
    engine: "ai_with_mock",
    statusNote: "Logs numbers the patient reads aloud, verified against their words. Device ingestion arrives in Phase 5.",
    implementation: CONVERSATION,
  }),
  a(7, "Nutrition Agent", "health", "Offers general nutrition information, clearly labelled as AI-generated.", planned("a later phase", "Nouri gives no nutrition advice yet. Demo calorie figures are synthetic placeholders.")),
  a(8, "Meal Tracking Agent", "health", "Logs meals and hydration the patient describes.", {
    status: "prototype",
    engine: "ai_with_mock",
    statusNote: "Extracts meals and glasses of water in the patient's words. Never estimates calories.",
    implementation: CONVERSATION,
  }),
  a(9, "Medication Reminder Agent", "health", "Delivers clinician-approved reminders and records acknowledgment, which is not proof of ingestion.", planned("Phase 5", "Reminder events are synthetic; no device delivers them yet.")),
  a(10, "Symptom Tracking Agent", "health", "Captures patient-reported symptoms for clinician review, without diagnosing.", {
    status: "prototype",
    engine: "ai_with_mock",
    statusNote: "Extracts symptoms in the patient's words; severity only if they described it.",
    implementation: CONVERSATION,
  }),

  a(11, "Progress Analysis Agent", "progress", "Summarises how the patient's reported data changes over time.", {
    status: "functional",
    engine: "rule_based",
    statusNote: "Compares the last 7 days with the 7 before: glucose, time in target, sleep and acknowledgments.",
    implementation: "lib/orchestration/agents.ts › progressAnalysis",
  }),
  a(12, "Trend Agent", "progress", "Surfaces daily, weekly and monthly patterns in recorded data.", {
    status: "functional",
    engine: "rule_based",
    statusNote: "Computes daily glucose means and a least-squares slope over 14 days. Descriptive only.",
    implementation: "lib/orchestration/agents.ts › trend",
  }),
  a(13, "Adherence Reporting Agent", "progress", "Reports reminder acknowledgments separately from confirmed intake.", {
    status: "functional",
    engine: "rule_based",
    statusNote: "Counts acknowledged, snoozed and unanswered reminders; never reports them as doses taken.",
    implementation: "lib/orchestration/agents.ts › adherenceReporting",
  }),
  a(14, "Data Quality Agent", "progress", "Flags gaps, duplicates and implausible entries for human review.", {
    status: "functional",
    engine: "rule_based",
    statusNote: "Flags missing days, near-duplicates and implausible values. Drops conversation observations that aren't in the patient's own words.",
    implementation: "lib/orchestration/agents.ts › dataQuality",
  }),
  a(15, "Health Timeline Agent", "progress", "Builds a chronological, source-labelled timeline of observations.", {
    status: "functional",
    engine: "rule_based",
    statusNote: "Merges every record type into one feed, labelled by source.",
    implementation: "lib/clinical/timeline.ts › buildTimeline",
  }),

  a(16, "Doctor Report Agent", "doctor", "Drafts a visit summary that a clinician reviews and approves.", {
    status: "prototype",
    engine: "ai_with_mock",
    statusNote: "Template statements plus an overview that must cite them (AI when configured). A clinician must approve it.",
    implementation: "lib/clinical/brief.ts + lib/ai/narrative.ts",
  }),
  a(17, "Visit Preparation Agent", "doctor", "Gathers questions and observations ahead of an appointment.", planned("a later phase", "Patient questions are not collected yet.")),
  a(18, "Care Plan Agent", "doctor", "Displays the approved care plan; changes require clinician verification.", {
    status: "prototype",
    engine: "rule_based",
    statusNote: "Reads and verifies the clinician-approved plan. A change-request workflow is not built.",
    implementation: "lib/orchestration/agents.ts › carePlan",
  }),
  a(19, "Clinical Evidence Agent", "doctor", "Links summary statements back to the observations they came from.", {
    status: "functional",
    engine: "rule_based",
    statusNote: "Verifies every brief statement resolves to real source observations.",
    implementation: "lib/orchestration/agents.ts › clinicalEvidence",
  }),
  a(20, "Report Explanation Agent", "doctor", "Explains a clinician-approved report in plain, friendly language.", planned("a later phase", "Needs approvals stored on the server before anything is explained to a patient.")),

  a(21, "Emergency Request Agent", "safety", "Recognises calls for help. In this prototype, emergency calls are simulated.", {
    status: "prototype",
    engine: "rule_based",
    statusNote: "Detects emergency phrases and tells the patient to call 911. Simulated: it never places a call or alerts anyone.",
    implementation: "lib/safety/boundaries.ts › detectEmergency",
  }),
  a(22, "Caregiver Notification Agent", "safety", "Sends consented updates to family and caregivers.", planned("a later phase", "No messages are sent anywhere in this build.")),
  a(23, "Safety Review Agent", "safety", "Checks every AI output against Nouri's medical safety boundaries.", {
    status: "prototype",
    engine: "rule_based",
    statusNote: "Screens Nouri's replies, briefs and AI overviews for dosing, diagnosis and treatment language. Not a complete safety system.",
    implementation: "lib/safety/boundaries.ts",
  }),
  a(24, "Consent Agent", "safety", "Enforces who may see what, based on the patient's sharing choices.", planned("a later phase", "Sharing preferences are displayed but not yet enforced.")),
  a(25, "Escalation Agent", "safety", "Routes concerning reports to the right human, quickly.", planned("Phase 5", "Data flags are shown to clinicians; nothing is routed automatically.")),

  a(26, "Hardware Connection Agent", "platform", "Authenticates and monitors physical Nouri devices.", {
    status: "prototype",
    engine: "rule_based",
    statusNote: "Authenticates devices by server-issued credentials and maps them to a patient on the server. No device health monitoring yet.",
    implementation: "lib/devices/registry.ts",
  }),
  a(27, "Voice Processing Agent", "platform", "Handles speech-to-text and Nouri's spoken replies.", {
    status: "prototype",
    engine: "ai_with_mock",
    statusNote: "Device audio: validates WAV, transcribes it (OpenAI, Groq or local Whisper) and returns a 16 kHz WAV reply (OpenAI or Windows voices). In the browser: speaks with installed voices.",
    implementation: "lib/ai/speech.ts + lib/voice/speech.ts",
  }),
  a(28, "Scheduling Agent", "platform", "Manages reminders, check-ins and appointments.", {
    status: "prototype",
    engine: "ai_with_mock",
    statusNote: "Fetch.ai Planning Agent creates reminders asked for in ASI:One (asks for a time, never stores a dose). Delivery to the device isn't built yet.",
    implementation: "agents/specialists.py + lib/reminders/store.ts",
  }),
  a(29, "Data Sync Agent", "platform", "Keeps the device, dashboard and journals in sync.", planned("Phase 5", "There is no persistent store to sync yet.")),
  a(30, "Master Orchestrator Agent", "platform", "Routes each request to the right agents and records who handled it.", {
    status: "prototype",
    engine: "rule_based",
    statusNote: "Runs fixed workflows (visit brief, data quality, conversation, confirmation) and records a full trace of each.",
    implementation: "lib/orchestration/runtime.ts + conversation.ts",
  }),
];

export const STATUS_LABEL: Record<AgentStatus, string> = {
  functional: "Functional",
  prototype: "Prototype",
  planned: "Planned",
};

export const ENGINE_LABEL: Record<AgentEngine, string> = {
  rule_based: "Rule-based",
  ai_with_mock: "AI model (rule-based mock without a key)",
  none: "Not built",
};

export function agentsByTeam(team: AgentTeamId) {
  return AGENTS.filter((agent) => agent.team === team);
}

export function getAgent(id: string) {
  return AGENTS.find((agent) => agent.id === id);
}
