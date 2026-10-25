import "server-only";

/**
 * Server-side speech for device recordings: speech-to-text, and text-to-speech for Nouri's replies
 * (returned as 16 kHz mono 16-bit WAV). Keys never leave the server.
 *
 * Speech-to-text, first available: OpenAI (OPENAI_API_KEY) → ElevenLabs Scribe (ELEVENLABS_API_KEY) →
 * Groq (GROQ_API_KEY) → local Whisper (also the fallback if ElevenLabs can't be reached).
 * Text-to-speech, first available: ElevenLabs (Nouri's voice, ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID)
 * → OpenAI (OPENAI_API_KEY) → the voices built into Windows (also the fallback if ElevenLabs fails).
 * Claude handles the conversation itself (see provider.ts) but has no speech API.
 */

import { encodeWav, pcm16, resample, type WavInfo } from "@/lib/audio/wav";
import type { VoicePreferences } from "@/lib/voice/preferences";
import { elevenLabsConfigured, elevenLabsModel, elevenLabsSttConfigured, elevenLabsSttModel, synthesizeWithElevenLabs, transcribeWithElevenLabs } from "./elevenlabs";
import { localSttModel, transcribeLocally } from "./local-stt";
import { AIProviderError } from "./provider";
import { NoWindowsVoiceError, synthesizeWithWindows, windowsTtsAvailable } from "./windows-tts";

const OPENAI_STT_URL = "https://api.openai.com/v1/audio/transcriptions";
const GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";
const TIMEOUT_MS = 30_000;
const OPENAI_PCM_RATE = 24_000; // response_format "pcm" is 24 kHz, 16-bit, mono
export const REPLY_SAMPLE_RATE = 16_000;

export type SttProvider = "openai" | "elevenlabs" | "groq" | "local";
export type TtsProvider = "elevenlabs" | "openai" | "windows";

const openaiKey = () => process.env.OPENAI_API_KEY?.trim() || null;
const groqKey = () => process.env.GROQ_API_KEY?.trim() || null;

/** The speech-to-text service in use, or null if none is available. */
export function sttInfo(): { provider: SttProvider; model: string } | null {
  if (openaiKey()) return { provider: "openai", model: process.env.OPENAI_STT_MODEL?.trim() || "whisper-1" };
  if (elevenLabsSttConfigured()) return { provider: "elevenlabs", model: elevenLabsSttModel() };
  if (groqKey()) return { provider: "groq", model: process.env.GROQ_STT_MODEL?.trim() || "whisper-large-v3-turbo" };
  if (process.env.NOURI_LOCAL_STT !== "0") return { provider: "local", model: localSttModel() };
  return null;
}

/** The text-to-speech service in use, or null if none is available. */
export function ttsInfo(): { provider: TtsProvider; model: string } | null {
  if (elevenLabsConfigured()) return { provider: "elevenlabs", model: elevenLabsModel() };
  if (openaiKey()) return { provider: "openai", model: process.env.OPENAI_TTS_MODEL?.trim() || "tts-1" };
  if (windowsTtsAvailable()) return { provider: "windows", model: "Windows System.Speech" };
  return null;
}

async function post(url: string, init: RequestInit, what: string, service: string) {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new AIProviderError(timedOut ? `${what} timed out.` : `Could not reach the ${what} service.`);
  }
  if (!res.ok) {
    console.error(`${service} ${what} failed with status ${res.status}`); // status only: bodies can echo input
    throw new AIProviderError(
      res.status === 401 ? `${service} rejected the API key.` : res.status === 429 ? `${service} rate limit was reached.` : `${what} failed (${res.status}).`,
      res.status,
    );
  }
  return res;
}

/** Transcribes a WAV recording. `language` is an ISO-639-1 hint (2 letters) or omitted. */
export async function transcribe(wav: Buffer, info: WavInfo, language?: string): Promise<{ text: string; provider: SttProvider; model: string }> {
  const stt = sttInfo();
  if (!stt) throw new AIProviderError("No speech-to-text service is configured.");

  const local = async () => {
    try {
      return { text: await transcribeLocally(wav, info, language), provider: "local" as const, model: localSttModel() };
    } catch (err) {
      console.error("Local speech-to-text failed:", err instanceof Error ? err.message : "unknown error");
      throw new AIProviderError("Local speech-to-text failed. The Whisper model may still be downloading; try again in a minute.");
    }
  };
  if (stt.provider === "local") return local();

  if (stt.provider === "elevenlabs") {
    try {
      return { text: await transcribeWithElevenLabs(wav, language), ...stt };
    } catch (err) {
      // Venue Wi-Fi drops out: fall back to Whisper on this computer rather than failing the turn.
      if (process.env.NOURI_LOCAL_STT === "0") throw err;
      console.error("ElevenLabs speech-to-text failed, using local Whisper:", err instanceof Error ? err.message : "unknown error");
      return local();
    }
  }

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "nouri_voice.wav");
  form.append("model", stt.model);
  form.append("response_format", "json");
  if (language && /^[a-z]{2}$/.test(language)) form.append("language", language);
  const [url, key, service] = stt.provider === "openai" ? [OPENAI_STT_URL, openaiKey(), "OpenAI"] : [GROQ_STT_URL, groqKey(), "Groq"];
  const res = await post(url, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form }, "speech-to-text", service);
  const data = (await res.json()) as { text?: string };
  return { text: (data.text ?? "").trim(), ...stt };
}

const OPENAI_VOICE_FOR_PROFILE: Record<VoicePreferences["profile"], string> = {
  friendly: "nova",
  calm: "alloy",
  cheerful: "shimmer",
  gentle: "nova",
  robot: "echo",
};
const PROFILE_SPEED: Record<VoicePreferences["profile"], number> = { friendly: 0.95, calm: 0.85, cheerful: 1.02, gentle: 0.8, robot: 0.8 };

/** Speaks the reply (written in `language`, ISO-639-1) and returns a 16 kHz mono 16-bit WAV. */
export async function synthesize(
  text: string,
  language: string,
  prefs: Pick<VoicePreferences, "profile" | "rate">,
): Promise<{ wav: Buffer; provider: TtsProvider; model: string; voice: string }> {
  const tts = ttsInfo();
  if (!tts) throw new AIProviderError("No text-to-speech service is configured.");
  const speed = Math.min(1.6, Math.max(0.5, PROFILE_SPEED[prefs.profile] * prefs.rate));

  if (tts.provider === "elevenlabs") {
    try {
      return { ...(await synthesizeWithElevenLabs(text, { language, speed })), ...tts };
    } catch (err) {
      // Nouri should still speak if ElevenLabs is down or out of credit.
      if (!windowsTtsAvailable()) throw err;
      console.error("ElevenLabs failed, using a Windows voice:", err instanceof Error ? err.message : "unknown error");
      return synthesizeFallback(text, language, speed, prefs);
    }
  }

  if (tts.provider === "windows") return synthesizeFallback(text, language, speed, prefs);

  const voice = process.env.OPENAI_TTS_VOICE?.trim() || OPENAI_VOICE_FOR_PROFILE[prefs.profile];
  const res = await post(
    OPENAI_TTS_URL,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: tts.model, voice, input: text.slice(0, 1000), response_format: "pcm", speed }),
    },
    "text-to-speech",
    "OpenAI",
  );
  const pcm = Buffer.from(await res.arrayBuffer());
  const samples = resample(pcm16(pcm), OPENAI_PCM_RATE, REPLY_SAMPLE_RATE);
  return { wav: encodeWav(samples, REPLY_SAMPLE_RATE), ...tts, voice };
}

/** The voices built into Windows: the offline fallback. */
async function synthesizeFallback(
  text: string,
  language: string,
  speed: number,
  prefs: Pick<VoicePreferences, "profile" | "rate">,
): Promise<{ wav: Buffer; provider: TtsProvider; model: string; voice: string }> {
  try {
    const robot = prefs.profile === "robot";
    const out = await synthesizeWithWindows(text, {
      language,
      rate: speed,
      gender: prefs.profile === "calm" || robot ? "Male" : "Female",
      // Gentle Robot: lower and evenly paced, with a short pause at each comma and sentence end.
      style: robot ? { pitch: "-18%", pauseMs: 220 } : undefined,
    });
    return { ...out, provider: "windows", model: "Windows System.Speech" };
  } catch (err) {
    if (err instanceof NoWindowsVoiceError) throw new AIProviderError(err.message);
    console.error("Windows speech failed:", err instanceof Error ? err.message : "unknown error");
    throw new AIProviderError("Windows speech generation failed.");
  }
}
