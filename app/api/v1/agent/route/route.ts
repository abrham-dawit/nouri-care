import { routeIntent } from "@/lib/ai/route-intent";
import { guard, readText } from "@/lib/devices/api";

/**
 * POST /api/v1/agent/route: the Nouri Coordinator's routing step.
 *   { "text": "...", "awaiting_confirmation": false }
 * → { intent, reminder, provider }
 */
export async function POST(request: Request) {
  const auth = await guard(request);
  if ("response" in auth) return auth.response;
  const input = await readText(request);
  if ("response" in input) return input.response;
  const routed = await routeIntent(input.text, input.body.awaiting_confirmation === true);
  return Response.json({ intent: routed.intent, reminder: routed.reminder, provider: routed.provider, fallback_reason: routed.fallbackReason ?? null });
}
