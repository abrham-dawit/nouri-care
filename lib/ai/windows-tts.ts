import "server-only";

/**
 * Offline text-to-speech with the voices built into Windows (System.Speech / SAPI). No key and no
 * account; the reply text never leaves the computer. Windows writes 16 kHz mono 16-bit directly,
 * which is re-encoded with a standard 44-byte header for the ESP32.
 */

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encodeWav, monoSamples, parseWav } from "@/lib/audio/wav";

const RATE = 16_000;
const TIMEOUT_MS = 25_000;
const NO_VOICE_EXIT = 3;

// The text arrives base64-encoded in an environment variable, so it is never parsed as PowerShell.
const SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:NOURI_TTS_TEXT))
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voices = @($s.GetInstalledVoices() | Where-Object { $_.Enabled } | ForEach-Object { $_.VoiceInfo })
$match = @($voices | Where-Object { $_.Culture.TwoLetterISOLanguageName -eq $env:NOURI_TTS_LANG })
if (-not $match.Count) { exit ${NO_VOICE_EXIT} }
$pick = $match | Where-Object { $_.Gender -eq $env:NOURI_TTS_GENDER } | Select-Object -First 1
if (-not $pick) { $pick = $match[0] }
$s.SelectVoice($pick.Name)
$s.Rate = [int]$env:NOURI_TTS_RATE
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(${RATE}, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$s.SetOutputToWaveFile($env:NOURI_TTS_OUT, $fmt)
if ($env:NOURI_TTS_SSML -eq '1') {
  $s.SpeakSsml("<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='$($pick.Culture.Name)'>$text</speak>")
} else {
  $s.Speak($text)
}
$s.Dispose()
[Console]::Out.Write($pick.Name)
`;

export class NoWindowsVoiceError extends Error {}

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** SSML body (inside <speak>): the escaped text at a different pitch, with pauses after punctuation. */
function styledSsml(text: string, style: { pitch: string; pauseMs: number }) {
  const pitch = /^[+-]\d{1,2}%$/.test(style.pitch) ? style.pitch : "-10%";
  const pause = Math.max(0, Math.min(1000, Math.round(style.pauseMs)));
  const body = escapeXml(text).replace(/([,;:.!?])\s+/g, `$1<break time="${pause}ms"/> `);
  return `<prosody pitch="${pitch}">${body}</prosody>`;
}

export const windowsTtsAvailable = () => process.platform === "win32" && process.env.NOURI_WINDOWS_TTS !== "0";

/**
 * Speaks `text` with an installed Windows voice for `language` (ISO-639-1). `rate` is Nouri's
 * speed multiplier (1 = normal). Throws NoWindowsVoiceError if no voice speaks that language.
 */
export async function synthesizeWithWindows(
  text: string,
  opts: { language: string; rate: number; gender: "Female" | "Male"; style?: { pitch: string; pauseMs: number } },
): Promise<{ wav: Buffer; voice: string }> {
  const out = join(tmpdir(), `nouri-tts-${randomUUID()}.wav`);
  // SAPI rate is -10..10; roughly ±10% per step around normal speed.
  const sapiRate = Math.max(-10, Math.min(10, Math.round((opts.rate - 1) * 10)));
  const spoken = text.slice(0, 1000);
  const payload = opts.style ? styledSsml(spoken, opts.style) : spoken;
  try {
    const voice = await new Promise<string>((resolve, reject) => {
      execFile(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", SCRIPT],
        {
          timeout: TIMEOUT_MS,
          windowsHide: true,
          env: {
            ...process.env,
            NOURI_TTS_TEXT: Buffer.from(payload, "utf8").toString("base64"),
            NOURI_TTS_SSML: opts.style ? "1" : "0",
            NOURI_TTS_LANG: opts.language,
            NOURI_TTS_GENDER: opts.gender,
            NOURI_TTS_RATE: String(sapiRate),
            NOURI_TTS_OUT: out,
          },
        },
        (err, stdout) => {
          if (err && (err as { code?: number }).code === NO_VOICE_EXIT) reject(new NoWindowsVoiceError(`No Windows voice is installed for language "${opts.language}".`));
          else if (err) reject(new Error(err.killed ? "Windows speech timed out." : "Windows speech failed."));
          else resolve(stdout.trim());
        },
      );
    });
    const raw = await readFile(out);
    return { wav: encodeWav(monoSamples(raw, parseWav(raw)), RATE), voice };
  } finally {
    await rm(out, { force: true });
  }
}
