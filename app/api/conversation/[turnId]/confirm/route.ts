import { requirePatient } from "@/lib/auth/session";
import { DEMO_CLINICIAN } from "@/lib/clinical/synthetic";
import { getTurn } from "@/lib/journal/store";
import { confirmTurn } from "@/lib/orchestration/conversation";
import { WorkflowError } from "@/lib/orchestration/runtime";

/**
 * The patient's decision on what Nouri heard. Only the observation ids listed
 * in `acceptIds` are saved; an empty list saves nothing.
 */
export async function POST(request: Request, { params }: { params: Promise<{ turnId: string }> }) {
  const { turnId } = await params;
  const turnRecord = getTurn(turnId);
  if (!turnRecord) return Response.json({ error: "Conversation turn not found." }, { status: 404 });
  // Only the patient themself (or a verified clinician) answers what Nouri heard; family can't.
  const auth = requirePatient(request, turnRecord.patientId);
  if ("response" in auth) return auth.response;
  if (auth.user.role === "family") return Response.json({ error: "Only the patient can confirm what they said." }, { status: 403 });
  let body: { acceptIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  if (!Array.isArray(body.acceptIds) || !body.acceptIds.every((id) => typeof id === "string")) {
    return Response.json({ error: "acceptIds must be an array of strings." }, { status: 400 });
  }
  try {
    // Briefs drafted here are attributed to the demo clinician as their reviewer-of-record.
    const { turn, run, brief } = await confirmTurn({ turnId, acceptIds: body.acceptIds as string[], requestedBy: DEMO_CLINICIAN });
    return Response.json({ turn, runId: run.id, steps: run.steps, briefId: brief?.id ?? null });
  } catch (err) {
    if (err instanceof WorkflowError) return Response.json({ error: err.message }, { status: err.status });
    const detail = err instanceof Error ? err.message : "unknown error";
    console.error("Confirmation failed:", detail);
    return Response.json(
      { error: "Your answer couldn't be saved. Please try again.", ...(process.env.NODE_ENV !== "production" && { detail }) },
      { status: 500 },
    );
  }
}
