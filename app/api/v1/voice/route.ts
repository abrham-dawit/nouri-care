import { randomUUID } from "node:crypto";
import { AIProviderError } from "@/lib/ai/provider";
import { sttInfo, synthesize, transcribe, ttsInfo, type SttProvider, type TtsProvider } from "@/lib/ai/speech";
import { parseWav, WavError } from "@/lib/audio/wav";
import { saveReplyAudio } from "@/lib/devices/audio-store";
import { allowRequest, authenticateDevice, registryIsEmpty } from "@/lib/devices/registry";
import { describeObservation } from "@/lib/journal/observations";
import { recentTurns } from "@/lib/journal/store";
import { DEMO_CLINICIAN } from "@/lib/clinical/synthetic";
import { confirmTurn, runConversationTurn } from "@/lib/orchestration/conversation";
import { WorkflowError } from "@/lib/orchestration/runtime";
import { NOURI_INTRO } from "@/lib/voice/languages";
import { getPreferences } from "@/lib/voice/store";

/**
 * POST /api/v1/voice: a physical Nouri sends what the patient said.
 *
 *   Authorization: Bearer <device credential>     (from `npm run device:issue`)
 *   Content-Type:  audio/wav                      (16-bit PCM; 16 kHz mono expected)
 *   Body:          the raw WAV bytes
 *
 * The patient is taken from the server's device registry, never from the request. Observations
 * are held for the patient's confirmation (POST /api/v1/voice/{interaction_id}/confirm), never
 * saved automatically.
 */

const MAX_BYTES = 1_100_000; // ~34 s at 16 kHz mono 16-bit
const MAX_SECONDS = 30;
const MIN_SECONDS = 0.3;
const SILENCE_RMS = 0.003;
const WAV_TYPES = new Set(["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave", "application/octet-stream"]);
const NOT_HEARD = "Sorry, I didn't quite catch that. Could you say it again?";
const STT_NAME: Record<SttProvider, string> = { openai: "OpenAI", elevenlabs: "ElevenLabs Scribe", groq: "Groq", local: "local Whisper" };
// No device turn for this long means Nouri was asleep: the next reply starts with its introduction.
const SESSION_GAP_MS = 10 * 60_000;
// A spoken answer to "Should I save it?" within a few minutes of the question.
const CONFIRM_WINDOW_MS = 5 * 60_000;
const YES = /^\W*(yes|yeah|yep|yup|sure|okay|ok|please|save( it)?|go ahead|correct|that'?s right|right|of course|absolutely)\b/i;
const NO = /^\W*(no|nope|nah|don'?t|do not|not now|cancel|never ?mind|forget it)\b/i;

const fail = (status: number, code: string, error: string) => Response.json({ error, code }, { status });

/**
 * The origin the device used to reach us. request.url reflects the bind address, which is
 * 0.0.0.0 under `next dev -H 0.0.0.0` and unreachable from the device, so prefer the Host header.
 */
function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? "";
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const scheme = proto === "https" || proto === "http" ? proto : url.protocol.replace(":", "");
  return /^[A-Za-z0-9.\-]+(:\d{1,5})?$|^\[[0-9A-Fa-f:.]+\](:\d{1,5})?$/.test(host) ? `${scheme}://${host}` : url.origin;
}

/** Reads the body without accepting more than `max` bytes (works with or without Content-Length). */
async function readLimited(request: Request, max: number): Promise<Buffer | null> {
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function POST(request: Request) {
  const t0 = performance.now();

  const device = authenticateDevice(request);
  if (!device) {
    return fail(401, "unauthorized", registryIsEmpty() ? "No devices are registered on this server yet. Run: npm run device:issue -- nouri-001" : "Missing or invalid device credential.");
  }
  if (!allowRequest(device.deviceId)) return fail(429, "rate_limited", "Too many requests from this device. Please wait a moment.");

  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!WAV_TYPES.has(type)) return fail(415, "unsupported_media_type", "Send the raw WAV bytes with Content-Type: audio/wav.");
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES) return fail(413, "too_large", `Recording is larger than ${MAX_BYTES} bytes.`);

  const wav = await readLimited(request, MAX_BYTES);
  if (!wav) return fail(413, "too_large", `Recording is larger than ${MAX_BYTES} bytes.`);

  let info;
  try {
    info = parseWav(wav);
  } catch (err) {
    if (err instanceof WavError) return fail(422, "invalid_wav", err.message);
    throw err;
  }
  if (info.durationSec < MIN_SECONDS) return fail(422, "too_short", `Recording is only ${info.durationSec.toFixed(2)} s.`);
  if (info.durationSec > MAX_SECONDS) return fail(422, "too_long", `Recording is ${info.durationSec.toFixed(1)} s; the limit is ${MAX_SECONDS} s.`);

  const prefs = getPreferences(device.patientId);
  const audioInfo = { sample_rate: info.sampleRate, channels: info.channels, bits_per_sample: info.bitsPerSample, duration_s: +info.durationSec.toFixed(2), level_rms: +info.rms.toFixed(4) };

  // ── speech-to-text ──
  let transcript = "";
  let stt: { provider: SttProvider | "none"; model: string | null; note?: string };
  const tStt = performance.now();
  // For pipeline tests only, a server started with NOURI_ALLOW_TEST_TRANSCRIPT=1 accepts a
  // transcript in the X-Nouri-Test-Transcript header instead of transcribing the audio.
  const testText = process.env.NOURI_ALLOW_TEST_TRANSCRIPT === "1" ? request.headers.get("x-nouri-test-transcript")?.trim() : undefined;
  const sttService = sttInfo();
  if (testText) {
    transcript = testText.slice(0, 500);
    stt = { provider: "none", model: null, note: "Used the X-Nouri-Test-Transcript header (test mode); the audio was not transcribed." };
  } else if (info.rms < SILENCE_RMS) {
    stt = { provider: "none", model: null, note: "Recording is silent; nothing to transcribe." };
  } else if (sttService) {
    try {
      const out = await transcribe(wav, info, prefs.language);
      transcript = out.text;
      stt = { provider: out.provider, model: out.model };
    } catch (err) {
      const message = err instanceof AIProviderError ? err.message : "Speech-to-text failed.";
      return fail(502, "stt_failed", message);
    }
  } else {
    stt = { provider: "none", model: null, note: "No speech-to-text service is available (local Whisper is turned off and no key is set)." };
  }
  const sttMs = performance.now() - tStt;

  // ── text-to-speech (16 kHz mono 16-bit WAV), shared by every kind of reply ──
  const speak = async (id: string, text: string, language: string) => {
    const tTts = performance.now();
    let audioUrl: string | null = null;
    let tts: { provider: TtsProvider | "none"; model?: string; voice?: string; error?: string };
    if (ttsInfo()) {
      try {
        const out = await synthesize(text, language, prefs);
        saveReplyAudio(id, device.deviceId, out.wav);
        audioUrl = new URL(`/api/v1/audio/${encodeURIComponent(id)}`, publicOrigin(request)).href;
        tts = { provider: out.provider, model: out.model, voice: out.voice };
      } catch (err) {
        tts = { provider: "none", error: err instanceof AIProviderError ? err.message : "Text-to-speech failed." };
      }
    } else {
      tts = { provider: "none", error: "No text-to-speech service is available on this server." };
    }
    return { audioUrl, tts, ttsMs: Math.round(performance.now() - tTts) };
  };

  // The first turn after a quiet spell (Nouri just woke up) starts with Nouri introducing itself.
  const lastTurn = recentTurns(device.patientId, 1)[0];
  const newSession = !lastTurn || Date.now() - Date.parse(lastTurn.receivedAt) > SESSION_GAP_MS;

  if (!transcript) {
    const id = `voice-${randomUUID()}`;
    const notHeard = newSession ? `${NOURI_INTRO} ${NOT_HEARD}` : NOT_HEARD;
    const spoken = await speak(id, notHeard, "en");
    return Response.json({
      interaction_id: id,
      device_id: device.deviceId,
      transcript: "",
      reply: notHeard,
      reply_language: "en",
      checkin_saved: false,
      confirmation_required: false,
      pending_observations: [],
      audio_url: spoken.audioUrl,
      audio: audioInfo,
      stt,
      tts: spoken.tts,
      timing_ms: { total: Math.round(performance.now() - t0), stt: Math.round(sttMs), tts: spoken.ttsMs },
    });
  }

  // ── a spoken "yes" / "no" right after Nouri asked "Should I save it?" answers that question ──
  const pending = recentTurns(device.patientId, 1).find(
    // Only turns where Nouri actually asked out loud (mood-only turns don't ask).
    (t) => t.status === "awaiting_confirmation" && t.observations.some((o) => o.kind !== "mood") && Date.now() - Date.parse(t.receivedAt) < CONFIRM_WINDOW_MS,
  );
  const answer = pending ? (YES.test(transcript) ? "yes" : NO.test(transcript) ? "no" : null) : null;
  if (pending && answer) {
    const tConfirm = performance.now();
    let saved = 0;
    try {
      const { turn: updated } = await confirmTurn({ turnId: pending.id, acceptIds: answer === "yes" ? pending.observations.map((o) => o.id) : [], requestedBy: DEMO_CLINICIAN });
      saved = updated.savedObservationIds.length;
    } catch (err) {
      if (!(err instanceof WorkflowError)) console.error("Voice confirmation failed:", err instanceof Error ? err.message : "unknown error");
      return fail(err instanceof WorkflowError ? err.status : 500, "confirm_failed", "Nouri couldn't save that answer.");
    }
    const reply = saved ? "Saved. Your care team will see it in your next visit summary." : "Okay, I won't save it.";
    const id = `voice-${randomUUID()}`;
    const spoken = await speak(id, reply, "en");
    return Response.json({
      interaction_id: id,
      confirmed_interaction_id: pending.id,
      device_id: device.deviceId,
      transcript,
      reply,
      reply_language: "en",
      checkin_saved: saved > 0,
      saved_observations: saved,
      confirmation_required: false,
      pending_observations: [],
      audio_url: spoken.audioUrl,
      audio: audioInfo,
      stt,
      tts: spoken.tts,
      timing_ms: { total: Math.round(performance.now() - t0), stt: Math.round(sttMs), conversation: Math.round(performance.now() - tConfirm - spoken.ttsMs), tts: spoken.ttsMs },
    });
  }

  // ── the existing conversation + safety pipeline ──
  const history = recentTurns(device.patientId, 3).flatMap((t) => [
    { role: "user" as const, content: t.message },
    { role: "assistant" as const, content: t.reply },
  ]);
  let turn;
  const tConv = performance.now();
  try {
    ({ turn } = await runConversationTurn({
      patientId: device.patientId,
      message: transcript,
      history,
      requestedBy: `Device ${device.deviceId}`,
      preSteps: [
        { agentId: "hardware-connection-agent", agentName: "Hardware Connection Agent", durationMs: 0, status: "ok", summary: `Authenticated ${device.deviceId} by its server-issued credential.`, details: ["Patient taken from the server's device registry, not from the request."] },
        {
          agentId: "voice-processing-agent",
          agentName: "Voice Processing Agent",
          durationMs: sttMs,
          status: stt.provider !== "none" ? "ok" : "warning",
          summary: stt.provider !== "none" ? `Transcribed ${audioInfo.duration_s} s of ${info.sampleRate / 1000} kHz audio (${STT_NAME[stt.provider]}, ${stt.model}).` : (stt.note ?? "No transcription."),
          details: [`Transcript: “${transcript}”`],
        },
      ],
    }));
  } catch (err) {
    if (err instanceof WorkflowError) return fail(err.status, "conversation_rejected", err.message);
    console.error("Voice turn failed:", err instanceof Error ? err.message : "unknown error");
    return fail(500, "conversation_failed", "Nouri couldn't process that recording.");
  }
  const convMs = performance.now() - tConv;
  // Emergency replies always come first, unprefixed; the intro is English, so only for English replies.
  const reply = newSession && !turn.safety.emergency && turn.replyLanguage.code === "en" ? `${NOURI_INTRO} ${turn.reply}` : turn.reply;
  const { audioUrl, tts, ttsMs } = await speak(turn.id, reply, turn.replyLanguage.code);

  return Response.json({
    interaction_id: turn.id,
    device_id: device.deviceId,
    transcript,
    reply,
    reply_language: turn.replyLanguage.code,
    // Nothing is saved until the patient confirms; see confirmation_required.
    checkin_saved: false,
    confirmation_required: turn.status === "awaiting_confirmation",
    pending_observations: turn.observations.map((o) => ({ id: o.id, kind: o.kind, description: describeObservation(o), quote: o.quote })),
    audio_url: audioUrl,
    audio: audioInfo,
    stt,
    tts,
    safety: { emergency_detected: Boolean(turn.safety.emergency), dosing_question: turn.safety.dosingQuestion, reply_replaced: turn.safety.replyReplaced },
    timing_ms: { total: Math.round(performance.now() - t0), stt: Math.round(sttMs), conversation: Math.round(convMs), tts: ttsMs },
  });
}
