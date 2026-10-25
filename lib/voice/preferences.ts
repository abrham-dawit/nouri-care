/** Voice and language preferences for one patient's Nouri. Client-safe. */

import { getLanguage } from "./languages";

export type VoiceProfile = "friendly" | "calm" | "cheerful" | "gentle" | "robot";

export type VoicePreferences = {
  patientId: string;
  /** Base language code from the registry, e.g. "am". */
  language: string;
  /** Region/accent code, e.g. "ET", or null for the default. */
  region: string | null;
  profile: VoiceProfile;
  /** 0.6–1.4 multiplier on the profile's base speed. */
  rate: number;
  /** 0–1. */
  volume: number;
  /** Speak Nouri's replies aloud on screens that support it. */
  readAloud: boolean;
  /** Allow browser voices that stream text to an online service (off by default for privacy). */
  allowOnlineVoices: boolean;
  updatedAt: string | null;
};

export const VOICE_PROFILES: Record<VoiceProfile, { label: string; description: string; rate: number; pitch: number }> = {
  friendly: { label: "Friendly", description: "Warm and natural, Nouri's default", rate: 0.95, pitch: 1.05 },
  calm: { label: "Calm", description: "Slower and lower, for relaxed conversations", rate: 0.82, pitch: 0.92 },
  cheerful: { label: "Cheerful", description: "A little brighter and livelier", rate: 1.02, pitch: 1.18 },
  gentle: { label: "Gentle", description: "Soft and unhurried, good for hearing difficulties", rate: 0.78, pitch: 1.0 },
  robot: { label: "Gentle Robot", description: "Slow, soft and steady, with small pauses, like a friendly care robot", rate: 0.74, pitch: 0.8 },
};

export const defaultPreferences = (patientId: string): VoicePreferences => ({
  patientId,
  language: "en",
  region: "US",
  profile: "friendly",
  rate: 1,
  volume: 0.9,
  readAloud: false,
  allowOnlineVoices: false,
  updatedAt: null,
});

/** Validates untrusted input into preferences, or returns an error message. */
export function parsePreferences(patientId: string, input: unknown): VoicePreferences | string {
  if (!input || typeof input !== "object") return "Preferences must be an object.";
  const i = input as Record<string, unknown>;
  const lang = typeof i.language === "string" ? getLanguage(i.language) : undefined;
  if (!lang) return "Unknown language.";
  const region = i.region === null || i.region === undefined ? null : String(i.region);
  if (region !== null && !lang.regions.some((r) => r.code === region)) return "Unknown region for that language.";
  if (typeof i.profile !== "string" || !(i.profile in VOICE_PROFILES)) return "Unknown voice profile.";
  const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);
  const rate = num(i.rate, 0.6, 1.4);
  const volume = num(i.volume, 0, 1);
  if (rate === null || volume === null) return "Speed and volume must be numbers.";
  return {
    patientId,
    language: lang.code,
    region,
    profile: i.profile as VoiceProfile,
    rate,
    volume,
    readAloud: i.readAloud === true,
    allowOnlineVoices: i.allowOnlineVoices === true,
    updatedAt: new Date().toISOString(),
  };
}
