"use client";

import { useEffect, useState } from "react";
import type { TimelineItem } from "@/lib/clinical/timeline";
import type { VisitBrief } from "@/lib/clinical/types";
import type { LiveEntries } from "./observations";

const CHANNEL = "nouri-live";

/** Tell other open tabs (e.g. the dashboard) that a patient's journal changed. */
export function announceJournalChange(patientId: string) {
  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.postMessage({ patientId });
    bc.close();
  } catch {
    // BroadcastChannel unsupported: other tabs refresh on focus instead.
  }
}

/** Re-runs `load` on mount, on window focus and when another tab announces a change. */
function useLiveRefresh(load: (signal: { cancelled: boolean }) => void, deps: unknown[]) {
  useEffect(() => {
    const signal = { cancelled: false };
    load(signal);
    const onFocus = () => load(signal);
    window.addEventListener("focus", onFocus);
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(CHANNEL);
      bc.onmessage = () => load(signal);
    } catch {
      bc = null;
    }
    return () => {
      signal.cancelled = true;
      window.removeEventListener("focus", onFocus);
      bc?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export type PatientLive = { entries: LiveEntries; brief: VisitBrief | null };

export function usePatientLive(patientId: string) {
  const [live, setLive] = useState<PatientLive | null>(null);
  useLiveRefresh(
    (signal) => {
      fetch(`/api/journal?patientId=${encodeURIComponent(patientId)}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: PatientLive | null) => {
          if (!signal.cancelled && data) setLive({ entries: data.entries, brief: data.brief });
        })
        .catch(() => undefined);
    },
    [patientId],
  );
  return live;
}

export type DashboardLivePatient = {
  patientId: string;
  patientName: string;
  newEntries: number;
  lastAt: string | null;
  items: TimelineItem[];
  brief: { id: string; createdAt: string; periodStart: string; periodEnd: string } | null;
};

export function useDashboardLive() {
  const [patients, setPatients] = useState<DashboardLivePatient[]>([]);
  useLiveRefresh((signal) => {
    fetch("/api/journal", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { patients: DashboardLivePatient[] } | null) => {
        if (!signal.cancelled && data) setPatients(data.patients);
      })
      .catch(() => undefined);
  }, []);
  return patients;
}
