import { requirePatient } from "@/lib/auth/session";
import { describeObservation } from "@/lib/journal/observations";
import { recentTurns } from "@/lib/journal/store";
import { runConversationTurn } from "@/lib/orchestration/conversation";
import { WorkflowError } from "@/lib/orchestration/runtime";

/**
 * POST /api/simulate/device  { patientId, text }
 * SIMULATED DEVICE MODE: typed text stands in for what the ESP32 would have heard, then runs the
 * same conversation + safety pipeline as POST /api/v1/voice. Every trace is labelled simulated.
 * Nothing is saved until the patient confirms (POST /api/conversation/{id}/confirm).
 */
export async function POST(request: Request) {
  let body: { patientId?: unknown; text?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const patientId = typeof body.patientId === "string" ? body.patientId : "";
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 1000) : "";
  if (!patientId || !text) return Response.json({ error: "patientId and text are required." }, { status: 400 });
  const auth = requirePatient(request, patientId);
  if ("response" in auth) return auth.response;

  const history = recentTurns(patientId, 3).flatMap((t) => [
    { role: "user" as const, content: t.message },
    { role: "assistant" as const, content: t.reply },
  ]);
  try {
    const { turn, run } = await runConversationTurn({
      patientId,
      message: text,
      history,
      requestedBy: `Simulated device (${auth.user.name})`,
      preSteps: [
        {
          agentId: "hardware-connection-agent",
          agentName: "Hardware Connection Agent",
          durationMs: 0,
          status: "warning",
          summary: "SIMULATED DEVICE: no hardware connected. Typed text stands in for the ESP32's recording.",
          details: ["Same pipeline as POST /api/v1/voice, without audio."],
        },
        {
          agentId: "voice-processing-agent",
          agentName: "Voice Processing Agent",
          durationMs: 0,
          status: "warning",
          summary: "Skipped speech-to-text (simulated input).",
          details: [`Simulated transcript: “${text}”`],
        },
      ],
    });
    return Response.json({
      simulated: true,
      interaction_id: turn.id,
      reply: turn.reply,
      confirmation_required: turn.status === "awaiting_confirmation",
      pending_observations: turn.observations.map((o) => ({ id: o.id, kind: o.kind, description: describeObservation(o), quote: o.quote })),
      provider: turn.provider,
      run: { id: run.id, status: run.status, steps: run.steps.map((s) => ({ agent: s.agentName, status: s.status, summary: s.summary })) },
    });
  } catch (err) {
    if (err instanceof WorkflowError) return Response.json({ error: err.message }, { status: err.status });
    console.error("Simulated device turn failed:", err instanceof Error ? err.message : "unknown error");
    return Response.json({ error: "Nouri couldn't process that message." }, { status: 500 });
  }
}
