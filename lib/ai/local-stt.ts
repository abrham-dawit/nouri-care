/**
 * Offline speech-to-text: a small Whisper model running on this computer (transformers.js, CPU).
 * No key and no account. The model (~80 MB) is downloaded once from the Hugging Face Hub on first
 * use and cached; the recording itself never leaves the computer.
 *
 * Server-only in practice (transformers.js needs Node). No "server-only" import, because
 * instrumentation.ts preloads it outside the React server bundle.
 */

import { monoSamples, resample, type WavInfo } from "@/lib/audio/wav";

const WHISPER_RATE = 16_000;
export const localSttModel = () => process.env.NOURI_LOCAL_STT_MODEL?.trim() || "onnx-community/whisper-base";

type Transcriber = (audio: Float32Array, opts: { language?: string; task: "transcribe" }) => Promise<{ text: string } | { text: string }[]>;

const g = globalThis as typeof globalThis & { __nouriWhisper?: Promise<Transcriber> };

function load(): Promise<Transcriber> {
  g.__nouriWhisper ??= import("@huggingface/transformers")
    .then(({ pipeline }) => pipeline("automatic-speech-recognition", localSttModel(), { dtype: "q8", device: "cpu" }))
    .then((asr) => asr as unknown as Transcriber)
    .catch((err) => {
      g.__nouriWhisper = undefined; // let the next request retry
      throw err;
    });
  return g.__nouriWhisper;
}

/** Starts loading the model in the background so the first recording isn't slow. */
export function warmLocalStt() {
  load().catch(() => {});
}

export async function transcribeLocally(wav: Buffer, info: WavInfo, language?: string): Promise<string> {
  const asr = await load();
  const samples = resample(monoSamples(wav, info), info.sampleRate, WHISPER_RATE);
  const audio = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) audio[i] = samples[i] / 32768;
  const out = await asr(audio, { language: language && /^[a-z]{2}$/.test(language) ? language : undefined, task: "transcribe" });
  return (Array.isArray(out) ? out.map((o) => o.text).join(" ") : out.text).trim();
}
