"use client";

/**
 * Text-to-speech with the voices installed on this device (Web Speech API).
 * Availability varies by device and browser. Voices with `localService: false`
 * send text to an online service, so they're hidden unless explicitly allowed,
 * because Nouri's replies may contain health information.
 */

import { useSyncExternalStore } from "react";
import { VOICE_PROFILES, type VoicePreferences } from "./preferences";

const supported = () => typeof window !== "undefined" && "speechSynthesis" in window;

let cache: SpeechSynthesisVoice[] = [];
const EMPTY: SpeechSynthesisVoice[] = [];

function subscribe(listener: () => void) {
  if (!supported()) return () => undefined;
  const update = () => {
    cache = window.speechSynthesis.getVoices();
    listener();
  };
  window.speechSynthesis.addEventListener("voiceschanged", update);
  update();
  return () => window.speechSynthesis.removeEventListener("voiceschanged", update);
}

/** All installed voices (empty during SSR, or before the browser loads them). */
export function useVoices() {
  return useSyncExternalStore(subscribe, () => cache, () => EMPTY);
}

export const speechSupported = supported;

const tagOf = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-").toLowerCase();

/** Voices for a language, best region match first. */
export function voicesFor(voices: SpeechSynthesisVoice[], code: string, region: string | null, allowOnline: boolean) {
  const want = (region ? `${code}-${region}` : code).toLowerCase();
  return voices
    .filter((v) => (allowOnline || v.localService) && (tagOf(v) === code || tagOf(v).startsWith(`${code}-`)))
    .sort((a, b) => Number(tagOf(b) === want) - Number(tagOf(a) === want) || Number(b.localService) - Number(a.localService));
}

/** Any voice at all for the language on this device (including online ones). */
export const hasAnyVoice = (voices: SpeechSynthesisVoice[], code: string) => voices.some((v) => tagOf(v) === code || tagOf(v).startsWith(`${code}-`));

export function speak(text: string, prefs: Pick<VoicePreferences, "profile" | "rate" | "volume" | "language" | "region">, voice: SpeechSynthesisVoice | null, onEnd?: () => void) {
  if (!supported()) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const profile = VOICE_PROFILES[prefs.profile];
  const u = new SpeechSynthesisUtterance(text);
  u.lang = prefs.region ? `${prefs.language}-${prefs.region}` : prefs.language;
  if (voice) u.voice = voice;
  u.rate = Math.min(2, Math.max(0.5, profile.rate * prefs.rate));
  u.pitch = profile.pitch;
  u.volume = prefs.volume;
  if (onEnd) {
    u.onend = onEnd;
    u.onerror = onEnd;
  }
  synth.speak(u);
  return true;
}

export function stopSpeaking() {
  if (supported()) window.speechSynthesis.cancel();
}

/** The device-specific voice the user picked for a language tag (kept in this browser only). */
export function rememberedVoice(tag: string) {
  try {
    return window.localStorage.getItem(`nouri:voice:${tag}`);
  } catch {
    return null;
  }
}

export function rememberVoice(tag: string, voiceURI: string) {
  try {
    window.localStorage.setItem(`nouri:voice:${tag}`, voiceURI);
  } catch {
    // Storage unavailable: the best-matching voice is used instead.
  }
}
