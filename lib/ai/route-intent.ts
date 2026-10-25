import "server-only";

/**
 * The Coordinator's routing decision: what the user wants, so the right specialist agent runs.
 * Claude (or OpenAI) when configured; otherwise simple keyword rules. Reminder details are taken
 * only from what the user said: a missing time stays null rather than being guessed.
 */

import type { ReminderKind } from "@/lib/reminders/store";
import { AIProviderError, completeJSON, providerInfo, type AIProvider } from "./provider";

export type Intent = "check_in" | "reminder" | "confirm_save" | "decline_save" | "chat";
export type RoutedIntent = {
  intent: Intent;
  reminder: { title: string; time: string | null; repeat: "daily" | "once"; kind: ReminderKind } | null;
  provider: AIProvider;
  fallbackReason?: string;
};

const KINDS: ReminderKind[] = ["medication", "check_in", "hydration", "meal", "appointment", "other"];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intent", "reminder"],
  properties: {
    intent: { type: "string", enum: ["check_in", "reminder", "confirm_save", "decline_save", "chat"] },
    reminder: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["title", "time", "repeat", "kind"],
          properties: {
            title: { type: "string" },
            time: { anyOf: [{ type: "string" }, { type: "null" }] },
            repeat: { type: "string", enum: ["daily", "once"] },
            kind: { type: "string", enum: KINDS },
          },
        },
        { type: "null" },
      ],
    },
  },
};

const SYSTEM = [
  "You route messages for Nouri, an elder-care companion. Classify the user's latest message:",
  "- reminder: they ask to be reminded of something, or to schedule a check-in, medication, water, meal or appointment reminder.",
  "- confirm_save: they say yes / save it / that's right, answering Nouri's question about saving what it wrote down.",
  "- decline_save: they say no / don't save it, answering that question.",
  "- check_in: they report how they slept, ate, feel, a symptom, or a blood sugar reading.",
  "- chat: anything else (greetings, stories, questions).",
  "Only choose confirm_save or decline_save if Nouri is waiting for an answer (stated below).",
  "For a reminder: title = a short, friendly reminder in plain words; time = 24-hour HH:MM only if they said a time (\"8am\" → \"08:00\"), else null;",
  "repeat = daily if they said every day/daily/each morning, else once; kind = the best match.",
  "Never put a medication dose, number of units or pills in the title. For medication use kind medication.",
  "If it is not a reminder, reminder must be null.",
].join("\n");

function mockRoute(text: string, awaitingConfirmation: boolean): Omit<RoutedIntent, "provider"> {
  const t = text.toLowerCase();
  if (awaitingConfirmation && /^\s*(yes|yeah|yep|sure|ok(ay)?|save( it)?|correct|that'?s right)\b/.test(t)) return { intent: "confirm_save", reminder: null };
  if (awaitingConfirmation && /^\s*(no|nope|don'?t|do not|cancel)\b/.test(t)) return { intent: "decline_save", reminder: null };
  if (/\bremind\b|\breminder\b|\bschedule\b/.test(t)) {
    const m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
    let time: string | null = null;
    if (m) {
      let h = Number(m[1]) % 12;
      if (m[3] === "pm") h += 12;
      time = `${String(h).padStart(2, "0")}:${m[2] ?? "00"}`;
    }
    const kind: ReminderKind = /medic|pill|insulin|meds\b/.test(t) ? "medication" : /water|drink/.test(t) ? "hydration" : /check.?in/.test(t) ? "check_in" : /breakfast|lunch|dinner|meal|eat/.test(t) ? "meal" : /appointment|doctor|visit/.test(t) ? "appointment" : "other";
    const title = text.replace(/^.*?\bremind (me|her|him)\b\s*(to\s+)?/i, "").replace(/\b(every day|daily|at \d.*)$/i, "").trim();
    return { intent: "reminder", reminder: { title: title || "Check in with Nouri", time, repeat: /every|daily|each/.test(t) ? "daily" : "once", kind } };
  }
  if (/\b(slept|sleep|ate|breakfast|lunch|dinner|glucose|blood sugar|sugar was|feel|feeling|tired|pain|dizzy|water)\b/.test(t)) return { intent: "check_in", reminder: null };
  return { intent: "chat", reminder: null };
}

export async function routeIntent(text: string, awaitingConfirmation: boolean): Promise<RoutedIntent> {
  const info = providerInfo();
  if (info.provider !== "mock") {
    try {
      const out = await completeJSON<Omit<RoutedIntent, "provider">>({
        schemaName: "nouri_route",
        schema: SCHEMA,
        messages: [
          { role: "system", content: `${SYSTEM}\nNouri ${awaitingConfirmation ? "IS" : "is NOT"} waiting for a yes/no answer about saving.` },
          { role: "user", content: text },
        ],
      });
      const time = out.reminder?.time && /^([01]\d|2[0-3]):[0-5]\d$/.test(out.reminder.time) ? out.reminder.time : null;
      const intent = !awaitingConfirmation && (out.intent === "confirm_save" || out.intent === "decline_save") ? "chat" : out.intent;
      return { intent, reminder: intent === "reminder" && out.reminder ? { ...out.reminder, time } : null, provider: info.provider };
    } catch (err) {
      return { ...mockRoute(text, awaitingConfirmation), provider: "mock", fallbackReason: err instanceof AIProviderError ? err.message : "Unexpected AI provider error." };
    }
  }
  return { ...mockRoute(text, awaitingConfirmation), provider: "mock" };
}
