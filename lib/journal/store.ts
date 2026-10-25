import "server-only";

/**
 * In-memory store for conversation turns and patient-confirmed journal
 * entries. Prototype only: data lives in this server process and is cleared
 * on restart. A real deployment needs a persistent, access-controlled
 * database with audit logging.
 */

import { DEMO_NOW } from "@/lib/clinical/time";
import type { Mood, VisitBrief } from "@/lib/clinical/types";
import type { Understanding } from "@/lib/ai/understand";
import { emptyLiveEntries, type LiveEntries, type ProposedObservation } from "./observations";

export type TurnStatus = "awaiting_confirmation" | "saved" | "dismissed" | "nothing_to_save";

export type ConversationTurn = {
  id: string;
  patientId: string;
  /** Demo-clock time (keeps live entries inside the demo's date ranges). */
  at: string;
  /** Real server time the message arrived. */
  receivedAt: string;
  message: string;
  reply: string;
  /** English translation of the reply (same as reply for English). */
  replyEnglish: string;
  language: Understanding["language"];
  replyLanguage: Understanding["replyLanguage"];
  languageNote?: string;
  mood: Mood | null;
  observations: ProposedObservation[];
  provider: Understanding["provider"];
  model: string | null;
  fallbackReason?: string;
  dropped: string[];
  safety: Understanding["safety"];
  status: TurnStatus;
  savedObservationIds: string[];
  runId: string;
  confirmRunId?: string;
};

type Store = {
  turns: Map<string, ConversationTurn>;
  live: Map<string, LiveEntries>;
  briefs: Map<string, VisitBrief>;
  seq: number;
};

const g = globalThis as unknown as { __nouriJournal?: Store };
g.__nouriJournal ??= { turns: new Map(), live: new Map(), briefs: new Map(), seq: 0 };
const store = g.__nouriJournal;

const MAX_TURNS = 200;
const NOW_MS = Date.parse(DEMO_NOW);

export function nextSeq() {
  store.seq += 1;
  return store.seq;
}

/** Demo-clock timestamp for new events: just before "now", strictly increasing. */
export function demoClockTimestamp(seq: number) {
  return new Date(NOW_MS - 10 * 60 * 1000 + Math.min(seq, 599) * 1000).toISOString();
}

export function saveTurn(turn: ConversationTurn) {
  store.turns.set(turn.id, turn);
  if (store.turns.size > MAX_TURNS) store.turns.delete(store.turns.keys().next().value!);
}

export const getTurn = (id: string) => store.turns.get(id);

export function recentTurns(patientId: string, limit = 20) {
  return [...store.turns.values()].filter((t) => t.patientId === patientId).slice(-limit);
}

export function liveEntries(patientId: string): LiveEntries {
  return store.live.get(patientId) ?? emptyLiveEntries();
}

export function addLiveEntries(patientId: string, add: LiveEntries) {
  const cur = liveEntries(patientId);
  store.live.set(patientId, {
    glucose: [...add.glucose, ...cur.glucose],
    sleep: [...add.sleep, ...cur.sleep],
    meals: [...add.meals, ...cur.meals],
    hydration: [...add.hydration, ...cur.hydration],
    symptoms: [...add.symptoms, ...cur.symptoms],
    checkIns: [...add.checkIns, ...cur.checkIns],
  });
}

export const liveBrief = (patientId: string) => store.briefs.get(patientId) ?? null;
export const setLiveBrief = (patientId: string, brief: VisitBrief) => void store.briefs.set(patientId, brief);

export function livePatientIds() {
  return new Set([...store.live.keys(), ...store.briefs.keys()]);
}
