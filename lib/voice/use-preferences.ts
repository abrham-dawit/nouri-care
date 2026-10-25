"use client";

import { useCallback, useEffect, useState } from "react";
import { defaultPreferences, type VoicePreferences } from "./preferences";

/** Loads a patient's voice preferences from the server and saves changes back. */
export function useVoicePreferences(patientId: string) {
  const [prefs, setPrefs] = useState<VoicePreferences>(() => defaultPreferences(patientId));
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/voice/preferences?patientId=${encodeURIComponent(patientId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Could not load voice settings."))))
      .then((d: { preferences: VoicePreferences }) => {
        if (cancelled) return;
        setPrefs(d.preferences);
        setLoadedFor(patientId);
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Could not load voice settings."));
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const save = useCallback(
    async (next: VoicePreferences) => {
      setPrefs(next);
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/voice/preferences?patientId=${encodeURIComponent(patientId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        const data = (await res.json()) as { preferences?: VoicePreferences; error?: string };
        if (!res.ok || !data.preferences) throw new Error(data.error ?? "Could not save voice settings.");
        setPrefs(data.preferences);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save voice settings.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [patientId],
  );

  return { prefs: loadedFor === patientId ? prefs : null, setPrefs, save, saving, error };
}
