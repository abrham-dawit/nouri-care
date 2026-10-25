# Nouri device API (v1)

For the ESP32-S3 Nouri. The patient speaks, the device uploads the recording, and Nouri replies with text and
(when configured) a WAV to play. Everything runs in the existing Nouri Care Next.js backend.

```
patient speaks → ESP32 records WAV → POST /api/v1/voice → speech-to-text → Nouri conversation + safety
              ← JSON reply + audio_url ← GET /api/v1/audio/{id} (16 kHz WAV) → ESP32 plays it
```

What runs each step (first one available on the server):

| Step | Service |
|---|---|
| Speech-to-text | OpenAI → Groq → **local Whisper on the server** (no key needed) |
| Conversation + visit brief | **Claude** (`ANTHROPIC_API_KEY`) → OpenAI → rule-based mock |
| Spoken reply | **ElevenLabs** (Nouri's voice, "Elise") → OpenAI → **Windows voices on the server** (no key needed; also the fallback if ElevenLabs fails) |

## 1. Get a device credential (once per device)

On the computer running the backend:

```powershell
npm run device:issue -- nouri-001
```

This prints a credential **once** (it starts with `nouri_dev_`). The server keeps only its SHA-256 hash in
`.data/devices.json` and maps `nouri-001` → `demo-patient-001` (synthetic patient "Margaret").

- Put the credential in the device's local config (e.g. `secrets.h`, git-ignored), **not** in shared firmware.
- The device never sends a patient ID. The server decides the patient from the credential.
- Re-running the command replaces the old credential. Revoke with `npm run device:issue -- --revoke nouri-001`.
- **No AI keys on the device.** Claude and OpenAI keys live only in the server's `.env.local`.

## 2. Send a recording: `POST /api/v1/voice`

| | |
|---|---|
| Header | `Authorization: Bearer <credential>` |
| Header | `Content-Type: audio/wav` |
| Body | the raw WAV file bytes (not multipart, not base64) |
| Format | 16-bit PCM WAV. Expected: **16 000 Hz, mono** (8–48 kHz and stereo are accepted). Header chunks are parsed, so it doesn't have to be exactly 44 bytes |
| Length | 0.3–30 s, max 1.1 MB (Abrham's 5 s file is 160 044 bytes) |

Send `Content-Length` if you can; chunked uploads also work.

### Response `200`

```json
{
  "interaction_id": "turn-1-mvmeq5fz",
  "device_id": "nouri-001",
  "transcript": "I didn't sleep well last night and my blood sugar was 162 this morning.",
  "reply": "I'm sorry you had a rough night, Margaret. … I wrote down what I heard. Please check it before I save anything.",
  "reply_language": "en",
  "checkin_saved": false,
  "confirmation_required": true,
  "pending_observations": [
    { "id": "turn-1-…-obs-0", "kind": "sleep", "description": "You slept poorly", "quote": "I didn't sleep well last night" },
    { "id": "turn-1-…-obs-1", "kind": "glucose", "description": "Blood sugar 162 mg/dL", "quote": "blood sugar was 162" }
  ],
  "audio_url": "http://192.168.1.20:3000/api/v1/audio/turn-1-mvmeq5fz",
  "audio": { "sample_rate": 16000, "channels": 1, "bits_per_sample": 16, "duration_s": 5, "level_rms": 0.0886 },
  "stt": { "provider": "local", "model": "onnx-community/whisper-base" },
  "tts": { "provider": "windows", "model": "Windows System.Speech", "voice": "Microsoft Zira Desktop" },
  "safety": { "emergency_detected": false, "dosing_question": false, "reply_replaced": false },
  "timing_ms": { "total": 2840, "stt": 1210, "conversation": 950, "tts": 680 }
}
```

- **`checkin_saved` is always `false` here.** Nothing the patient mentions is saved until they confirm (step 4).
- **`audio_url` is `null`** when speech generation failed or no voice speaks the reply's language (e.g. Amharic
  on Windows voices); `tts.error` says why. Then show/speak `reply` another way.
- A silent or unclear recording returns `transcript: ""` and a "Sorry, I didn't catch that" reply (no AI call).
- If `safety.emergency_detected` is true, the reply tells the patient to call 911. **The demo never calls anyone.**

### Errors

| Status | `code` | Meaning |
|---|---|---|
| 401 | `unauthorized` | Missing/invalid/revoked credential |
| 413 | `too_large` | Over 1.1 MB |
| 415 | `unsupported_media_type` | Content-Type isn't `audio/wav` |
| 422 | `invalid_wav`, `too_short`, `too_long` | Not 16-bit PCM WAV, or wrong length |
| 429 | `rate_limited` | More than 20 requests a minute from one device |
| 502 | `stt_failed` | Speech-to-text error (retry later; local Whisper may still be loading on first start) |

## 3. Play the reply: `GET /api/v1/audio/{interaction_id}`

Same `Authorization` header. Returns `audio/wav`: **16 000 Hz, mono, 16-bit PCM, 44-byte header**, with
`Content-Length`. Only the device that sent the recording can fetch it; replies expire after 15 minutes
(404 afterwards).

## 4. Save what the patient confirmed: `POST /api/v1/voice/{interaction_id}/confirm`

After Nouri asks "should I save this?", send the patient's answer (voice "yes", a button, etc.):

```json
{ "accept": "all" }          // or "none", or a list of pending_observations ids
```

Returns `{ "checkin_saved": true, "saved_observations": 2, "brief_updated": true }`. The entries then appear in
the doctor dashboard and patient profile, and the visit brief is redrafted. Answering twice returns `409`.

## Test before connecting Wi-Fi

1. Start the backend: `npm.cmd run dev` (for the ESP32 on Wi-Fi: `npm.cmd run dev -- -H 0.0.0.0`, then use the
   PC's LAN IP and allow port 3000 in Windows Firewall).
2. Copy Abrham's recording to `hardware/test-audio/nouri_voice.wav`.
3. Run, in PowerShell:

```powershell
$env:NOURI_DEVICE_TOKEN = "<credential from step 1>"
.\scripts\test-voice.ps1 -Wav .\hardware\test-audio\nouri_voice.wav
```

Add `-Confirm all` to also test saving. The reply WAV is saved as `hardware/test-audio/nouri_reply.wav`.

Or with `curl.exe` (built into Windows 10/11):

```powershell
curl.exe -X POST "http://localhost:3000/api/v1/voice" `
  -H "Authorization: Bearer $env:NOURI_DEVICE_TOKEN" `
  -H "Content-Type: audio/wav" `
  --data-binary "@hardware/test-audio/nouri_voice.wav"
```

**With no keys at all** the whole pipeline still runs: local Whisper transcribes, the rule-based mock replies,
and a Windows voice speaks. To skip transcription in a test, start the server with
`$env:NOURI_ALLOW_TEST_TRANSCRIPT = "1"` and pass `-TestTranscript "I didn't sleep well last night."`.

## ESP32 notes

- Use `HTTPClient` with `addHeader("Authorization", "Bearer " + token)` and `addHeader("Content-Type", "audio/wav")`,
  then `POST(buffer, length)` with the whole WAV (header + samples).
- Set a generous timeout (**60 s**): speech-to-text + reply + speech generation takes a few seconds.
- Download `audio_url` with the same header and stream the PCM after the 44-byte header to I²S at 16 kHz.
- On the local network this is plain HTTP for the demo. A real deployment needs HTTPS so the credential and audio
  can't be intercepted.

## Server configuration (`.env.local`, never on the device)

| Variable | Default | |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Claude writes Nouri's replies and the visit brief overview |
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | Claude model |
| `OPENAI_API_KEY` | — | OpenAI speech-to-text and voices (and replies, if no Claude key) |
| `OPENAI_STT_MODEL` / `OPENAI_TTS_MODEL` | `whisper-1` / `tts-1` | OpenAI speech models |
| `OPENAI_TTS_VOICE` | from the patient's Voice Studio profile | e.g. `nova`, `alloy`, `shimmer` |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` | — | Nouri's voice for spoken replies |
| `ELEVENLABS_MODEL` | `eleven_flash_v2_5` | ElevenLabs model |
| `GROQ_API_KEY` | — | Groq's hosted Whisper for speech-to-text |
| `NOURI_LOCAL_STT` | on | `0` turns local Whisper off |
| `NOURI_LOCAL_STT_MODEL` | `onnx-community/whisper-base` | Local Whisper model (downloaded once, ~80 MB) |
| `NOURI_WINDOWS_TTS` | on (Windows only) | `0` turns Windows voices off |
| `NOURI_ALLOW_TEST_TRANSCRIPT` | off | `1` lets tests supply the transcript in a header |

The reply language and voice personality come from the patient's settings in **Voice Studio**.
