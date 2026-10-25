import { guard, readText } from "@/lib/devices/api";
import { detectDosingQuestion, detectEmergency, screenText } from "@/lib/safety/boundaries";
import { SAFE_REPLY } from "@/lib/voice/languages";

/**
 * POST /api/v1/agent/safety: the Safety Agent's check, on what the user said ("input") or on a
 * reply before it is sent ("output").
 *   { "text": "...", "direction": "input" | "output" }
 * → { allowed, emergency, dosing_question, findings, safe_reply }
 */
export async function POST(request: Request) {
  const auth = await guard(request);
  if ("response" in auth) return auth.response;
  const input = await readText(request);
  if ("response" in input) return input.response;

  const output = input.body.direction === "output";
  const emergency = output ? null : detectEmergency(input.text);
  const dosing = output ? false : detectDosingQuestion(input.text);
  const findings = screenText(input.text);
  const safeReply = emergency ? SAFE_REPLY.emergency.en : dosing || findings.length ? SAFE_REPLY.dosing.en : null;

  return Response.json({
    allowed: !safeReply,
    emergency: emergency !== null,
    emergency_phrase: emergency,
    dosing_question: dosing,
    findings,
    // Emergencies are only detected here: nothing is dialled or sent anywhere.
    safe_reply: safeReply,
  });
}
