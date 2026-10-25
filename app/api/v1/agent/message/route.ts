import { guard, readText, apiError } from "@/lib/devices/api";
import { describeObservation } from "@/lib/journal/observations";
import { recentTurns } from "@/lib/journal/store";
import { runConversationTurn } from "@/lib/orchestration/conversation";
import { WorkflowError } from "@/lib/orchestration/runtime";

/**
 * POST /api/v1/agent/message: the Companion Agent's step. Runs the same conversation + safety
 * pipeline as the device voice endpoint, on text. Observations are held for confirmation
 * (POST /api/v1/voice/{interaction_id}/confirm), never saved automatically.
 *   { "text": "...", "agent": "<calling agent's name, for the audit trail>" }
 */
export async function POST(request: Request) {
  const auth = await guard(request);
  if ("response" in auth) return auth.response;
  const input = await readText(request);
  if ("response" in input) return input.response;
  const { device } = auth;
  const caller = typeof input.body.agent === "string" ? input.body.agent.slice(0, 60) : device.deviceId;

  const history = recentTurns(device.patientId, 3).flatMap((t) => [
    { role: "user" as const, content: t.message },
    { role: "assistant" as const, content: t.reply },
  ]);
  try {
    const { turn } = await runConversationTurn({
      patientId: device.patientId,
      message: input.text,
      history,
      requestedBy: `Agent ${caller}`,
      preSteps: [
        { agentId: "hardware-connection-agent", agentName: "Hardware Connection Agent", durationMs: 0, status: "ok", summary: `Authenticated ${device.deviceId} (${caller}) by its server-issued credential.`, details: ["Patient taken from the server's registry, not from the request."] },
      ],
    });
    return Response.json({
      interaction_id: turn.id,
      reply: turn.reply,
      reply_language: turn.replyLanguage.code,
      checkin_saved: false,
      confirmation_required: turn.status === "awaiting_confirmation",
      pending_observations: turn.observations.map((o) => ({ id: o.id, kind: o.kind, description: describeObservation(o), quote: o.quote })),
      safety: { emergency_detected: Boolean(turn.safety.emergency), dosing_question: turn.safety.dosingQuestion, reply_replaced: turn.safety.replyReplaced },
      provider: turn.provider,
    });
  } catch (err) {
    if (err instanceof WorkflowError) return apiError(err.status, "conversation_rejected", err.message);
    console.error("Agent turn failed:", err instanceof Error ? err.message : "unknown error");
    return apiError(500, "conversation_failed", "Nouri couldn't process that message.");
  }
}
