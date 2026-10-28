import "server-only";

/**
 * Understands one thing a patient said to Nouri: a warm reply, the mood they
 * expressed, and any observations they explicitly stated. The AI path and
 * the mock path produce the same shape and go through the same verification:
 * every observation must quote the patient's actual words, and numbers must
 * appear in what they said. Nothing is inferred or estimated.
 */

import type { GlucoseContext, MealKind, Mood, SleepQuality } from "@/lib/clinical/types";
import type { ProposedObservation } from "@/lib/journal/observations";
import { detectDosingQuestion, detectEmergency, screenText } from "@/lib/safety/boundaries";
import { getLanguage, languageInstruction, SAFE_REPLY } from "@/lib/voice/languages";
import { AIProviderError, completeJSON, providerInfo, type AIProvider, type ChatMessage } from "./provider";

/** Asked whenever something the patient said was written down; nothing is saved until they answer yes. */
export const SAVE_QUESTION = "I wrote that down. Should I save it?";

export type PatientContext ={ preferredName: string; interests: string[]; caregiverName?: string };
export type LanguageChoice = { code: string; region: string | null };

export type Understanding = {
  reply: string;
  /** English translation of the reply (identical for English). Used for safety screening and the care team. */
  replyEnglish: string;
  language: LanguageChoice;
  /** The language `reply` is actually written in (English when the mock or a fixed English safety message was used). */
  replyLanguage: LanguageChoice;
  /** Set when the reply could not be given in the chosen language. */
  languageNote?: string;
  mood: Mood | null;
  observations: ProposedObservation[];
  provider: AIProvider;
  model: string | null;
  /** Why the mock was used even though a key is configured, if it was. */
  fallbackReason?: string;
  /** Observations removed because they could not be verified against the message. */
  dropped: string[];
  safety: { emergency: string | null; dosingQuestion: boolean; replyFindings: string[]; replyReplaced: boolean };
};

/* ───────────── Prompt & schema ───────────── */

function systemPrompt(p: PatientContext, language: LanguageChoice) {
  const lang = languageInstruction(language.code, language.region);
  return [
    "You are Nouri, a warm, patient companion robot for an older adult.",
    "Do not address the person by name or start replies with a name; just talk to them warmly (\"you\").",
    `Always reply in ${lang}, in its usual native script, with simple everyday words suited to an older adult. Put a faithful English translation of your reply in reply_english.`,
    "The patient may write in any language; understand them either way.",
    `Things they have chosen to share with you: ${p.interests.join("; ") || "nothing yet"}.`,
    "Speak simply and kindly in 1–2 short sentences (your words are read aloud, so keep them brief). Ask at most one gentle follow-up question.",
    "Use the earlier messages for context, answer what they just said, and don't repeat a greeting you already gave.",
    "You are NOT a doctor. Never diagnose. Never give, suggest or change any medication or insulin dose, and never say whether an injection is safe.",
    `If they mention a health concern, acknowledge it warmly and suggest sharing it with their doctor${p.caregiverName ? ` or ${p.caregiverName}` : ""}.`,
    "If they describe an emergency (chest pain, trouble breathing, a fall, calling for help), tell them to call 911 or press their emergency button right away.",
    "",
    "Also extract observations the patient EXPLICITLY stated in their latest message only:",
    "- sleep (quality poor/fair/good; hours only if they said a number)",
    "- meal (breakfast/lunch/dinner/snack and what they ate, in their words)",
    "- hydration (glasses of water, only if they said a number)",
    "- symptom (in their words; severity only if they described it, otherwise not_stated)",
    "- glucose (only if they said a number; context only if they said it, otherwise unspecified)",
    "- mood (only if they expressed how they feel)",
    "For every observation, `quote` must be copied exactly, character for character, from the patient's latest message in its original language.",
    `Write symptom names and meal descriptions in English for the care team, and put a very short description in ${lang} in patient_label for the patient to confirm.`,
    "Never infer, estimate or round values. Never estimate calories. If nothing was stated, return an empty list.",
    "Set emergency to true if the patient describes an emergency. Set dosing_question to true if they ask about medication or insulin doses, or whether to take or inject something.",
    "Unused fields must be null.",
  ].join("\n");
}

const nullable = (type: string, extra: { enum?: (string | null)[] } = {}) =>
  extra.enum ? { anyOf: [{ type, enum: extra.enum.filter((v) => v !== null) }, { type: "null" }] } : { type: [type, "null"] };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "reply_english", "emergency", "dosing_question", "mood", "observations"],
  properties: {
    reply: { type: "string" },
    reply_english: { type: "string" },
    emergency: { type: "boolean" },
    dosing_question: { type: "boolean" },
    mood: nullable("string", { enum: ["good", "okay", "low", null] }),
    observations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "kind",
          "quote",
          "patient_label",
          "sleep_quality",
          "sleep_hours",
          "meal",
          "meal_description",
          "glasses",
          "symptom",
          "severity",
          "glucose_value",
          "glucose_context",
          "mood",
        ],
        properties: {
          kind: { type: "string", enum: ["sleep", "meal", "hydration", "symptom", "glucose", "mood"] },
          quote: { type: "string" },
          patient_label: nullable("string"),
          sleep_quality: nullable("string", { enum: ["poor", "fair", "good", null] }),
          sleep_hours: nullable("number"),
          meal: nullable("string", { enum: ["breakfast", "lunch", "dinner", "snack", null] }),
          meal_description: nullable("string"),
          glasses: nullable("number"),
          symptom: nullable("string"),
          severity: nullable("string", { enum: ["mild", "moderate", "severe", "not_stated", null] }),
          glucose_value: nullable("number"),
          glucose_context: nullable("string", { enum: ["fasting", "before_meal", "after_meal", "bedtime", "unspecified", null] }),
          mood: nullable("string", { enum: ["good", "okay", "low", null] }),
        },
      },
    },
  },
} as const;

type RawObservation = {
  kind: ProposedObservation["kind"];
  quote: string;
  patient_label: string | null;
  sleep_quality: SleepQuality | null;
  sleep_hours: number | null;
  meal: MealKind | null;
  meal_description: string | null;
  glasses: number | null;
  symptom: string | null;
  severity: "mild" | "moderate" | "severe" | "not_stated" | null;
  glucose_value: number | null;
  glucose_context: GlucoseContext | null;
  mood: Mood | null;
};
type RawTurn = { reply: string; reply_english: string; emergency: boolean; dosing_question: boolean; mood: Mood | null; observations: RawObservation[] };

/* ───────────── Mock (no API key) ───────────── */

const SYMPTOMS: [RegExp, string][] = [
  [/\bdizz(y|iness)\b/i, "Dizziness"],
  [/\bheadaches?\b/i, "Headache"],
  [/\b(tired|exhausted|tiredness|fatigued?)\b/i, "Tiredness"],
  [/\bnause(a|ous)\b/i, "Nausea"],
  [/\bshaky|shakiness\b/i, "Shakiness"],
  [/\bthirsty|thirst\b/i, "Thirst"],
  [/\b(knee|hip|back|leg|foot|feet|arm|shoulder|stomach|chest)\s+(pain|hurts?|aches?|aching|is sore|sore)\b/i, ""],
  [/\b(swollen|puffy)\s+(ankles?|feet|legs?)\b/i, "Swelling"],
  [/\bshort of breath|trouble breathing|can'?t breathe\b/i, "Trouble breathing"],
  [/\bcough(ing)?\b/i, "Cough"],
];

function mockUnderstand(message: string, p: PatientContext): RawTurn {
  const obs: RawObservation[] = [];
  const blank = (): Omit<RawObservation, "kind" | "quote"> => ({
    patient_label: null,
    sleep_quality: null,
    sleep_hours: null,
    meal: null,
    meal_description: null,
    glasses: null,
    symptom: null,
    severity: null,
    glucose_value: null,
    glucose_context: null,
    mood: null,
  });
  const sentences = message.split(/(?<=[.!?])\s+/);
  const sentenceWith = (re: RegExp) => sentences.find((s) => re.test(s))?.trim() ?? message.trim();

  // Sleep
  const poorSleep = /\b(didn'?t|did not|couldn'?t|could not) sleep|slept (badly|poorly|terribly)|bad night|kept waking|tossed and turned|up all night\b/i;
  const goodSleep = /\bslept (well|great|fine|like a baby)|good night'?s sleep|slept through\b/i;
  const okaySleep = /\bslept (okay|ok|alright|so-so)\b/i;
  const sleepRe = poorSleep.test(message) ? poorSleep : goodSleep.test(message) ? goodSleep : okaySleep.test(message) ? okaySleep : null;
  if (sleepRe) {
    const hours = message.match(/\b(\d{1,2}(?:\.\d)?)\s*(?:hours?|hrs?)\b/i);
    obs.push({
      ...blank(),
      kind: "sleep",
      quote: sentenceWith(sleepRe),
      sleep_quality: sleepRe === poorSleep ? "poor" : sleepRe === goodSleep ? "good" : "fair",
      sleep_hours: hours ? Number(hours[1]) : null,
    });
  }

  // Meals: "had oatmeal for breakfast" / "for lunch I had soup"
  const mealA = message.match(/\b(?:had|ate|eaten)\s+(?:some\s+)?([^.,!?]{2,60}?)\s+for\s+(breakfast|lunch|dinner|supper|a snack)\b/i);
  const mealB = message.match(/\bfor\s+(breakfast|lunch|dinner|supper|a snack),?\s+i\s+(?:had|ate)\s+([^.,!?]{2,60})/i);
  if (mealA || mealB) {
    const kindRaw = (mealA ? mealA[2] : mealB![1]).toLowerCase();
    const description = (mealA ? mealA[1] : mealB![2]).trim();
    obs.push({
      ...blank(),
      kind: "meal",
      quote: (mealA ?? mealB)![0],
      meal: kindRaw === "supper" ? "dinner" : kindRaw === "a snack" ? "snack" : (kindRaw as MealKind),
      meal_description: description[0].toUpperCase() + description.slice(1),
    });
  }

  // Hydration
  const water = message.match(/\b(\d{1,2})\s+glass(?:es)?\s+of\s+water\b/i);
  if (water) obs.push({ ...blank(), kind: "hydration", quote: water[0], glasses: Number(water[1]) });

  // Glucose: only when a number is stated next to a glucose word
  const glucose = message.match(/\b(?:blood sugar|glucose|sugar|reading|meter)\b[^.!?\d]{0,25}(\d{2,3})\b/i);
  if (glucose) {
    const ctx: GlucoseContext = /\bfasting|before breakfast\b/i.test(message)
      ? "fasting"
      : /\bafter (breakfast|lunch|dinner|eating|my meal)\b/i.test(message)
        ? "after_meal"
        : /\bbefore (lunch|dinner|eating|my meal)\b/i.test(message)
          ? "before_meal"
          : /\b(bedtime|before bed)\b/i.test(message)
            ? "bedtime"
            : "unspecified";
    obs.push({ ...blank(), kind: "glucose", quote: glucose[0], glucose_value: Number(glucose[1]), glucose_context: ctx });
  }

  // Symptoms, in the patient's words
  for (const [re, label] of SYMPTOMS) {
    const m = message.match(re);
    if (!m) continue;
    const name = label || `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} pain`;
    if (obs.some((o) => o.kind === "symptom" && o.symptom === name)) continue;
    const sentence = sentenceWith(re);
    const severity = /\b(severe|terrible|awful|unbearable|worst)\b/i.test(sentence)
      ? "severe"
      : /\b(really|very|quite|pretty bad|bad)\b/i.test(sentence)
        ? "moderate"
        : /\b(a little|a bit|slight(ly)?|mild)\b/i.test(sentence)
          ? "mild"
          : "not_stated";
    obs.push({ ...blank(), kind: "symptom", quote: sentence, symptom: name, severity });
  }

  // Mood
  const low = /\b(lonely|sad|(feel(ing)?|a bit|so) (down|blue|low)|depressed|miss (him|her|them|my \w+)|upset|worried|anxious)\b/i;
  const good = /\b(happy|great|wonderful|lovely|good mood|cheerful|feeling good|feel good)\b/i;
  const mood: Mood | null = low.test(message) ? "low" : good.test(message) ? "good" : null;
  if (mood) obs.push({ ...blank(), kind: "mood", quote: sentenceWith(mood === "low" ? low : good), mood });

  // A short, warm reply: acknowledge the most important thing, then (if needed) ask to confirm.
  const has = (k: RawObservation["kind"]) => obs.find((o) => o.kind === k);
  const opener = has("symptom")
    ? `Thank you for telling me. If it keeps bothering you, it's worth mentioning to your doctor${p.caregiverName ? ` or ${p.caregiverName}` : ""}.`
    : mood === "low"
      ? "I'm here with you. Would you like to talk for a little while?"
      : has("sleep")?.sleep_quality === "poor"
        ? "I'm sorry you had a rough night. Maybe a gentle rest later today would help."
        : has("sleep")
          ? "I'm glad you got some rest."
          : has("glucose")
            ? "Thanks for reading me your number."
            : has("meal")
              ? "That sounds tasty."
              : "It's lovely to hear from you. How has your day been?";
  const reply = obs.some((o) => o.kind !== "mood") ? `${opener} ${SAVE_QUESTION}` : opener;

  // The mock only speaks English; emergency and dosing detection rely on the shared English patterns.
  return { reply, reply_english: reply, emergency: false, dosing_question: false, mood, observations: obs };
}

/* ───────────── Verification (both providers) ───────────── */

const norm = (s: string) =>
  s.normalize("NFC").toLowerCase().replace(/[’‘]/g, "'").replace(/[“”«»]/g, '"').replace(/\s+/g, " ").trim();

/** Arabic-Indic and Persian digits → ASCII, so "٢٥٠" counts as the patient saying 250. */
const asciiDigits = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/** Small English number words patients (and speech-to-text) often use: "maybe four hours", "two glasses". */
const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];

function verify(raw: RawTurn, message: string, turnId: string): { observations: ProposedObservation[]; dropped: string[] } {
  const msg = norm(message);
  const numbers = new Set((asciiDigits(message).match(/\d+(\.\d+)?/g) ?? []).map(Number));
  // A spelled-out number counts only if that word is actually in what they said.
  for (const w of msg.match(/[a-z]+/g) ?? []) if (NUMBER_WORDS.includes(w)) numbers.add(NUMBER_WORDS.indexOf(w));
  const observations: ProposedObservation[] = [];
  const dropped: string[] = [];

  raw.observations.slice(0, 8).forEach((o, i) => {
    const id = `${turnId}-obs-${i}`;
    const quote = (o.quote ?? "").trim();
    const localLabel = o.patient_label?.trim().slice(0, 120) || undefined;
    const base = { id, quote, localLabel };
    const reject = (why: string) => dropped.push(`${o.kind}: ${why}`);
    if (!quote || !msg.includes(norm(quote))) return reject("quote not found in the patient's words");

    switch (o.kind) {
      case "sleep":
        if (!o.sleep_quality) return reject("no sleep quality stated");
        if (o.sleep_hours !== null && (!numbers.has(o.sleep_hours) || o.sleep_hours < 0 || o.sleep_hours > 16)) return reject("hours not stated by the patient");
        return void observations.push({ ...base, kind: "sleep", quality: o.sleep_quality, hours: o.sleep_hours });
      case "meal":
        if (!o.meal || !o.meal_description?.trim()) return reject("meal not described");
        return void observations.push({ ...base, kind: "meal", meal: o.meal, description: o.meal_description.trim().slice(0, 120) });
      case "hydration":
        if (o.glasses === null || !numbers.has(o.glasses) || o.glasses > 30) return reject("number of glasses not stated");
        return void observations.push({ ...base, kind: "hydration", glasses: o.glasses });
      case "symptom":
        if (!o.symptom?.trim()) return reject("symptom not named");
        return void observations.push({ ...base, kind: "symptom", symptom: o.symptom.trim().slice(0, 80), severity: o.severity ?? "not_stated" });
      case "glucose":
        if (o.glucose_value === null || !numbers.has(o.glucose_value)) return reject("value not stated by the patient");
        if (o.glucose_value < 20 || o.glucose_value > 600) return reject("implausible value, left for human follow-up");
        return void observations.push({ ...base, kind: "glucose", value: o.glucose_value, context: o.glucose_context ?? "unspecified" });
      case "mood":
        if (!o.mood) return reject("no mood expressed");
        return void observations.push({ ...base, kind: "mood", mood: o.mood });
    }
  });
  return { observations, dropped };
}

/* ───────────── Entry point ───────────── */

export async function understand(opts: {
  turnId: string;
  message: string;
  history: ChatMessage[];
  patient: PatientContext;
  language: LanguageChoice;
}): Promise<Understanding> {
  const info = providerInfo();
  const language = getLanguage(opts.language.code) ? opts.language : { code: "en", region: "US" };
  const langName = getLanguage(language.code)!.name;
  let raw: RawTurn;
  let provider: Understanding["provider"] = "mock";
  let fallbackReason: string | undefined;

  if (info.provider !== "mock") {
    try {
      raw = await completeJSON<RawTurn>({
        schemaName: "nouri_turn",
        schema: SCHEMA as unknown as Record<string, unknown>,
        messages: [{ role: "system", content: systemPrompt(opts.patient, language) }, ...opts.history, { role: "user", content: opts.message }],
      });
      provider = info.provider;
    } catch (err) {
      fallbackReason = err instanceof AIProviderError ? err.message : "Unexpected AI provider error.";
      raw = mockUnderstand(opts.message, opts.patient);
      // Say honestly that the AI couldn't be reached, rather than a canned reply that ignores what they said.
      // The rule-based extraction still runs, so anything they reported can still be confirmed and saved.
      const apology = "Sorry, I'm having trouble connecting right now, so I may not have understood. Could you say that again in a moment?";
      raw.reply = raw.reply_english = raw.observations.some((o) => o.kind !== "mood") ? `${apology} ${SAVE_QUESTION}` : apology;
    }
  } else {
    raw = mockUnderstand(opts.message, opts.patient);
  }

  const { observations, dropped } = verify(raw, opts.message, opts.turnId);
  const replyInEnglishOnly = provider === "mock" && language.code !== "en";
  const languageNote = replyInEnglishOnly
    ? `The rule-based mock only speaks English. Set ANTHROPIC_API_KEY (or OPENAI_API_KEY) to reply in ${langName}.`
    : undefined;

  // Safety: emergencies and dosing questions always get a fixed reply. Detection combines the English
  // patterns with the model's own flags, since the patterns can't read every language.
  const confirmNote = observations.some((o) => o.kind !== "mood") ? ` ${SAVE_QUESTION}` : "";
  let reply = (raw.reply ?? "").trim().slice(0, 900) || "I'm here with you.";
  let replyEnglish = (raw.reply_english ?? "").trim().slice(0, 900) || reply;
  const emergencyPhrase = detectEmergency(opts.message) ?? (raw.emergency ? "emergency flagged by the AI model" : null);
  const dosingQuestion = detectDosingQuestion(opts.message) || raw.dosing_question === true;
  const replyFindings = [...new Set([...screenText(reply), ...screenText(replyEnglish)])];
  let replyReplaced = false;
  const english: LanguageChoice = { code: "en", region: "US" };
  let replyLanguage: LanguageChoice = replyInEnglishOnly ? english : language;

  const fixed = (kind: "emergency" | "dosing") => {
    const englishText = `${SAFE_REPLY[kind].en}${kind === "dosing" ? confirmNote : ""}`;
    // Fixed messages aren't AI-generated, so the translated one is used even in mock mode.
    const local = SAFE_REPLY[kind][language.code];
    reply = language.code === "en" || !local ? englishText : local;
    replyEnglish = englishText;
    replyLanguage = language.code === "en" || !local ? english : language;
    replyReplaced = true;
  };
  if (emergencyPhrase) fixed("emergency");
  else if (dosingQuestion || replyFindings.length) fixed("dosing");
  // Always ask before saving, so the question is heard on the device too (not only shown on screen).
  // Mood alone ("it's been amazing") isn't worth interrupting small talk for; it can still be saved on screen.
  if (observations.some((o) => o.kind !== "mood") && !replyReplaced && replyLanguage.code === "en" && !reply.includes(SAVE_QUESTION)) {
    reply = `${reply} ${SAVE_QUESTION}`;
    replyEnglish = `${replyEnglish} ${SAVE_QUESTION}`;
  }

  const fixedNote =
    replyReplaced && language.code !== "en"
      ? SAFE_REPLY.emergency[language.code]
        ? `Fixed ${langName} safety message (draft translation pending native-speaker review).`
        : `No ${langName} safety message yet, so the fixed English message was used.`
      : undefined;

  return {
    reply,
    replyEnglish,
    language,
    replyLanguage,
    languageNote: (replyReplaced ? fixedNote : languageNote) || undefined,
    mood: raw.mood ?? null,
    observations,
    provider,
    model: provider === "mock" ? null : info.model,
    fallbackReason,
    dropped,
    safety: { emergency: emergencyPhrase, dosingQuestion, replyFindings, replyReplaced },
  };
}
