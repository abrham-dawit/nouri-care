import { getReplyAudio } from "@/lib/devices/audio-store";
import { authenticateDevice } from "@/lib/devices/registry";

/**
 * GET /api/v1/audio/{interaction_id}: Nouri's spoken reply as a 16 kHz mono 16-bit PCM WAV.
 * Requires the same device credential; only the device that sent the recording can fetch it.
 * Replies are kept in memory for 15 minutes.
 */
export async function GET(request: Request, { params }: { params: Promise<{ interactionId: string }> }) {
  const device = authenticateDevice(request);
  if (!device) return Response.json({ error: "Missing or invalid device credential.", code: "unauthorized" }, { status: 401 });
  const { interactionId } = await params;
  const wav = getReplyAudio(interactionId, device.deviceId);
  if (!wav) return Response.json({ error: "No reply audio for this interaction (it may have expired).", code: "not_found" }, { status: 404 });
  return new Response(new Uint8Array(wav), {
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": String(wav.length),
      "Cache-Control": "no-store",
    },
  });
}
