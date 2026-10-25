import type { PatientRecord, VisitBrief } from "@/lib/clinical/types";
import type { LiveEntries } from "./observations";

const byNewest = <T extends { at: string }>(list: T[]) => list.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

/** Synthetic history plus confirmed live entries, newest first. Pure and client-safe. */
export function mergeLive(record: PatientRecord, live: LiveEntries | null | undefined, liveBrief?: VisitBrief | null): PatientRecord {
  if (!live && !liveBrief) return record;
  const l = live ?? { glucose: [], sleep: [], meals: [], hydration: [], symptoms: [], checkIns: [] };
  return {
    ...record,
    glucose: byNewest([...l.glucose, ...record.glucose]),
    sleep: byNewest([...l.sleep, ...record.sleep]),
    meals: byNewest([...l.meals, ...record.meals]),
    hydration: byNewest([...l.hydration, ...record.hydration]),
    symptoms: byNewest([...l.symptoms, ...record.symptoms]),
    checkIns: byNewest([...l.checkIns, ...record.checkIns]),
    briefs: liveBrief ? [liveBrief, ...record.briefs.filter((b) => b.id !== liveBrief.id)] : record.briefs,
  };
}
