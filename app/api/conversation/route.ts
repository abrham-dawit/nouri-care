import { runConversationTurn } from "@/lib/orchestration/conversation";
import { WorkflowError } from "@/lib/orchestration/runtime";
import type { ChatMessage } from "@/lib/ai/provider";
import { requirePatient } from "@/lib/auth/session";

/**
 * A patient message to Nouri. Returns Nouri's reply and the observations held
 * for the patient to confirm. Nothing is saved by this endpoint.
 *
 * The signed-in account must be allowed to see the patient named in the body.
 */
export async function POST(request: Request) {
  let body: { patientId?: unknown; message?: unknown; history?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  if (typeof body.patientId !== "string" || typeof body.message !== "string") {
    return Response.json({ error: "patientId and message are required strings." }, { status: 400 });
  }
  const auth = requirePatient(request, body.patientId);
  if ("response" in auth) return auth.response;
  const history = Array.isArray(body.history) ? (body.history as ChatMessage[]) : [];
  try {
    const { turn, run } = await runConversationTurn({ patientId: body.patientId, message: body.message, history, requestedBy: auth.user.name });
    return Response.json({ turn, runId: run.id, steps: run.steps }, { status: 201 });
  } catch (err) {
    if (err instanceof WorkflowError) return Response.json({ error: err.message }, { status: err.status });
    const detail = err instanceof Error ? err.message : "unknown error";
    console.error("Conversation turn failed:", detail);
    return Response.json(
      { error: "Nouri couldn't process that message. Please try again.", ...(process.env.NODE_ENV !== "production" && { detail }) },
      { status: 500 },
    );
  }
}
