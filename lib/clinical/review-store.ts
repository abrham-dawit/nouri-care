"use client";

import { useSyncExternalStore } from "react";

/**
 * Clinician review decisions for the demo. They are stored in this browser
 * (localStorage) until the server-side store arrives with the AI workflow phase.
 * useSyncExternalStore renders the empty server snapshot during hydration, then
 * the stored one, so there's no hydration mismatch.
 */

export type ReviewDecision = {
  status: "approved" | "changes_requested" | "reviewed";
  note?: string;
  reviewer: string;
  at: string;
};

type Decisions = Record<string, ReviewDecision>;

const KEY = "nouri:review-decisions";
const EMPTY: Decisions = {};
const listeners = new Set<() => void>();
let snapshot: Decisions | null = null;

function read(): Decisions {
  if (snapshot) return snapshot;
  try {
    snapshot = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Decisions;
  } catch {
    snapshot = {};
  }
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      snapshot = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function write(next: Decisions) {
  snapshot = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: decisions last for this page view only.
  }
  listeners.forEach((l) => l());
}

export function useReviewDecisions() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function recordDecision(id: string, decision: Omit<ReviewDecision, "at">) {
  write({ ...read(), [id]: { ...decision, at: new Date().toISOString() } });
}

export function clearDecision(id: string) {
  const next = { ...read() };
  delete next[id];
  write(next);
}
