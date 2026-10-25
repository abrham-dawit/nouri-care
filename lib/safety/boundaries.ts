/**
 * Nouri's medical safety boundaries as simple, auditable patterns. This is a
 * screen, not a complete safety system: clinician review is always required.
 */

export const PROHIBITED: { label: string; pattern: RegExp }[] = [
  { label: "dosing instruction", pattern: /\b(take|inject|increase|decrease|reduce|double|skip)\b[^.]{0,40}\b\d+(\.\d+)?\s?(units?|mg|ml|tablets?|pills?)\b/i },
  { label: "insulin dose decision", pattern: /\b(safe to inject|insulin dose|units of insulin)\b/i },
  { label: "diagnosis", pattern: /\b(diagnos(is|ed|e)|you have (diabetes|an infection|dementia|depression)|indicates? (an? )?(infection|disease|condition))\b/i },
  {
    label: "treatment recommendation",
    pattern: /\b(should (start|stop|take|change|skip)|recommend(ed)? (starting|stopping|taking|increasing|decreasing)|stop taking|start taking)\b/i,
  },
];

export function screenText(text: string): string[] {
  return PROHIBITED.filter((r) => r.pattern.test(text)).map((r) => r.label);
}

const EMERGENCY =
  /\b(chest pains?|can'?t breathe|cannot breathe|trouble breathing|short of breath|i (fell|have fallen|'?ve fallen)|fell (down|over)|can'?t get up|call (911|an ambulance|for help)|i need help now|somebody help|having a stroke|passing out|passed out|unconscious|bleeding a lot)\b/i;

const DOSING_QUESTION =
  /\b(how (much|many)|should i|can i|could i|do i|is it (ok|okay|safe)|safe to|need to)\b[^.?!]{0,60}\b(insulin|units?|doses?|dosage|pills?|tablets?|medication|medicine|meds|inject(ion)?)\b/i;

/** Questions asking Nouri to decide a dose or whether to take/inject something. */
export function detectDosingQuestion(text: string) {
  return DOSING_QUESTION.test(text);
}

/** Phrases that should always get a safe "call for help" reply. Detection only; nothing is dialled. */
export function detectEmergency(text: string) {
  const m = text.match(EMERGENCY);
  return m ? m[0] : null;
}
