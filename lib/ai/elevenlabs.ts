import "server-only";

/**
 * Nouri's main voice: an ElevenLabs voice (e.g. "Elise"), chosen with ELEVENLABS_VOICE_ID.
 * Asks for raw 16 kHz PCM, so the reply is already at the ESP32's rate and only gets a WAV header.
 * The key stays on the server. Note: the reply text is sent to ElevenLabs to be spoken.
 */

import { encodeWav, pcm16 } from "@/lib/audio/wav";
import { AIProviderError } from "./provider";

const API = "https://api.elevenlabs.io/v1/text-to-speech";
const RATE = 16_000;
const TIMEOUT_MS = 30_000;

const key = () => process.env.ELEVENLABS_API_KEY?.trim() || null;
const voiceId = () => process.env.ELEVENLABS_VOICE_ID?.trim() || null;
export const elevenLabsModel = () => process.env.ELEVENLABS_MODEL?.trim() || "eleven_flash_v2_5";
export const elevenLabsConfigured = () => Boolean(key() && voiceId());

export const elevenLabsSttModel = () => process.env.ELEVENLABS_STT_MODEL?.trim() || "scribe_v2";
/** Speech-to-text needs only the key (no voice). */
export const elevenLabsSttConfigured = () => Boolean(key()) && process.env.ELEVENLABS_STT !== "0";

/** Transcribes a WAV recording with ElevenLabs Scribe. `language` is an ISO-639-1 hint or omitted. */
export async function transcribeWithElevenLabs(wav: Buffer, language?: string): Promise<string> {
  if (!key()) throw new AIProviderError("ElevenLabs is not configured.");
  const form = new FormData();
  form.append("model_id", elevenLabsSttModel());
  form.append("file", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "nouri_voice.wav");
  if (language && /^[a-z]{2}$/.test(language)) form.append("language_code", language);
  form.append("tag_audio_events", "false");
  let res: Response;
  try {
    res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": key()! }, body: form, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new AIProviderError(timedOut ? "ElevenLabs speech-to-text timed out." : "Could not reach ElevenLabs.");
  }
  if (!res.ok) {
    console.error(`ElevenLabs speech-to-text failed with status ${res.status}`);
    throw new AIProviderError(res.status === 401 ? "ElevenLabs rejected the API key." : `ElevenLabs speech-to-text failed (${res.status}).`, res.status);
  }
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

/** Speaks `text` (written in `language`, ISO-639-1) and returns a 16 kHz mono 16-bit WAV. */
export async function synthesizeWithElevenLabs(text: string, opts: { language: string; speed: number }): Promise<{ wav: Buffer; voice: string }> {
  const id = voiceId();
  if (!key() || !id) throw new AIProviderError("ElevenLabs is not configured.");
  const model = elevenLabsModel();
  let res: Response;
  try {
    res = await fetch(`${API}/${encodeURIComponent(id)}?output_format=pcm_${RATE}`, {
      method: "POST",
      headers: { "xi-api-key": key()!, "Content-Type": "application/json", Accept: "audio/pcm" },
      body: JSON.stringify({
        text: text.slice(0, 1000),
        model_id: model,
        // The multilingual v2 model rejects language_code; the flash/turbo models use it.
        ...(/^[a-z]{2}$/.test(opts.language) && !model.includes("multilingual_v2") ? { language_code: opts.language } : {}),
        voice_settings: { stability: 0.55, similarity_boost: 0.75, speed: Math.min(1.2, Math.max(0.7, opts.speed)) },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new AIProviderError(timedOut ? "ElevenLabs timed out." : "Could not reach ElevenLabs.");
  }
  if (!res.ok) {
    console.error(`ElevenLabs text-to-speech failed with status ${res.status}`); // status only: bodies can echo input
    throw new AIProviderError(
      res.status === 401 ? "ElevenLabs rejected the API key." : res.status === 429 || res.status === 402 ? "ElevenLabs quota or rate limit reached." : `ElevenLabs failed (${res.status}).`,
      res.status,
    );
  }
  const pcm = Buffer.from(await res.arrayBuffer());
  if (pcm.length < 2) throw new AIProviderError("ElevenLabs returned no audio.");
  return { wav: encodeWav(pcm16(pcm), RATE), voice: id };
}
