import { connection } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { DEMO_CLINICIAN } from "@/lib/clinical/synthetic";
import { listRuns, runWorkflow, WorkflowError } from "@/lib/orchestration/runtime";
import type { WorkflowId } from "@/lib/orchestration/workflows";

/**
 * Agent run log and trigger.
 *
 * Verified clinicians only: traces reference patient data.
 */

function requireClinician(request: Request) {
  const auth = requireUser(request);
  if ("response" in auth) return auth;
  if (auth.user.role !== "clinician" || !auth.user.verified) return { response: Response.json({ error: "Only the care team can see agent runs." }, { status: 403 }) };
  return auth;
}

export async function GET(request: Request) {
  await connection(); // the log lives in memory; never prerender it
  const auth = requireClinician(request);
  if ("response" in auth) return auth.response;
  return Response.json({ runs: listRuns() });
}

export async function POST(request: Request) {
  const auth = requireClinician(request);
  if ("response" in auth) return auth.response;
  let body: { workflowId?: unknown; patientId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  if (typeof body.workflowId !== "string" || typeof body.patientId !== "string") {
    return Response.json({ error: "workflowId and patientId are required strings." }, { status: 400 });
  }
  try {
    const run = runWorkflow(body.workflowId as WorkflowId, body.patientId, auth.user.name || DEMO_CLINICIAN);
    return Response.json({ run }, { status: 201 });
  } catch (err) {
    if (err instanceof WorkflowError) return Response.json({ error: err.message }, { status: err.status });
    console.error("Workflow run failed", err instanceof Error ? err.message : err);
    return Response.json({ error: "The workflow could not be run." }, { status: 500 });
  }
}
