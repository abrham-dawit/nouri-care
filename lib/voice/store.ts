import "server-only";

/** In-memory voice preferences per patient (prototype; cleared on restart). */

import { defaultPreferences, type VoicePreferences } from "./preferences";

const g = globalThis as unknown as { __nouriVoice?: Map<string, VoicePreferences> };
g.__nouriVoice ??= new Map();

export const getPreferences = (patientId: string) => g.__nouriVoice!.get(patientId) ?? defaultPreferences(patientId);
export const setPreferences = (prefs: VoicePreferences) => void g.__nouriVoice!.set(prefs.patientId, prefs);
