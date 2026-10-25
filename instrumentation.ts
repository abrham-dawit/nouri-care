export async function register() {
  // Preload local Whisper (speech-to-text, or the offline fallback for ElevenLabs), so a device's
  // first recording isn't slowed by loading the model.
  const cloudOnly = process.env.OPENAI_API_KEY?.trim() || process.env.GROQ_API_KEY?.trim();
  if (process.env.NEXT_RUNTIME === "nodejs" && !cloudOnly && process.env.NOURI_LOCAL_STT !== "0") {
    const { warmLocalStt } = await import("./lib/ai/local-stt");
    warmLocalStt();
  }
}
