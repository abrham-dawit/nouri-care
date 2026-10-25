import { authenticateDevice } from "@/lib/devices/registry";
import { getTurn } from "@/lib/journal/store";
import { confirmTurn } from "@/lib/orchestration/conversation";
import { WorkflowError } from "@/lib/orchestration/runtime";
import { DEMO_CLINICIAN } from "@/lib/clinical/synthetic";

/**
 * POST /api/v1/voice/{interaction_id}/confirm: the patient's answer, relayed by the device
 * (e.g. they said "yes, save it" or pressed a button).
 *
 *   { "accept": "all" }   save every pending observation
 *   { "accept": "none" }  save nothing
 *   { "accept": ["<observation id>", …] }  save only these
 */
export async function POST(request: Request, { params }: { params: Promise<{ interactionId: string }> }) {
  const device = authenticateDevice(request);
  if (!device) return Response.json({ error: "Missing or invalid device credential.", code: "unauthorized" }, { status: 401 });
  const { interactionId } = await params;
  const turn = getTurn(interactionId);
  // Devices can only answer for their own patient's turns.
  if (!turn || turn.patientId !== device.patientId) return Response.json({ error: "Interaction not found.", code: "not_found" }, { status: 404 });

  let body: { accept?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body must be JSON, e.g. {"accept":"all"}.', code: "bad_request" }, { status: 400 });
  }
  const accept =
    body.accept === "all" ? turn.observations.map((o) => o.id) : body.accept === "none" ? [] : Array.isArray(body.accept) && body.accept.every((x) => typeof x === "string") ? (body.accept as string[]) : null;
  if (!accept) return Response.json({ error: 'accept must be "all", "none" or a list of observation ids.', code: "bad_request" }, { status: 400 });

  try {
    const { turn: updated, brief } = await confirmTurn({ turnId: interactionId, acceptIds: accept, requestedBy: DEMO_CLINICIAN });
    return Response.json({
      interaction_id: updated.id,
      checkin_saved: updated.status === "saved",
      saved_observations: updated.savedObservationIds.length,
      brief_updated: Boolean(brief),
    });
  } catch (err) {
    if (err instanceof WorkflowError) return Response.json({ error: err.message, code: "conflict" }, { status: err.status });
    console.error("Device confirmation failed:", err instanceof Error ? err.message : "unknown error");
    return Response.json({ error: "Could not save the answer.", code: "confirm_failed" }, { status: 500 });
  }
}
