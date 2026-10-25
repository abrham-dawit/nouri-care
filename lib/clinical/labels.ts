import type { GlucoseContext, SleepEntry, SymptomReport } from "./types";

export const GLUCOSE_CONTEXT_LABEL: Record<GlucoseContext, string> = {
  fasting: "Fasting",
  before_meal: "Before meal",
  after_meal: "After meal",
  bedtime: "Bedtime",
  unspecified: "Context not stated",
};

/** "described as mild", or "severity not stated" (never a guessed grade). */
export function severityPhrase(s: Pick<SymptomReport, "severityReported">) {
  return s.severityReported === "not_stated" ? "severity not stated" : `described as ${s.severityReported}`;
}

export function sleepHoursText(e: Pick<SleepEntry, "hoursReported">) {
  return e.hoursReported === null ? "Hours not stated" : `About ${e.hoursReported} h`;
}
