import { Cpu, MessageCircle, Settings2, Sparkles, Stethoscope } from "lucide-react";
import type { Source } from "@/lib/clinical/types";

const SOURCE: Record<Source, { label: string; icon: typeof Cpu; color: string; ring: string }> = {
  patient_report: { label: "Patient report", icon: MessageCircle, color: "text-source-patient", ring: "border-source-patient/25 bg-source-patient/[0.07]" },
  device_reading: { label: "Device reading", icon: Cpu, color: "text-source-device", ring: "border-source-device/25 bg-source-device/[0.07]" },
  clinician_entry: { label: "Clinician entry", icon: Stethoscope, color: "text-source-clinician", ring: "border-source-clinician/25 bg-source-clinician/[0.07]" },
  ai_estimate: { label: "AI estimate", icon: Sparkles, color: "text-source-ai", ring: "border-source-ai/30 bg-source-ai/[0.08]" },
  system: { label: "System", icon: Settings2, color: "text-mist-300", ring: "border-white/10 bg-white/[0.04]" },
};

export const SOURCE_LABEL = Object.fromEntries(Object.entries(SOURCE).map(([k, v]) => [k, v.label])) as Record<Source, string>;

/** Where a piece of information came from. Always icon + text, never color alone. */
export function SourceBadge({ source, compact = false }: { source: Source; compact?: boolean }) {
  const s = SOURCE[source];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${s.ring}`}>
      <s.icon className={`h-3.5 w-3.5 ${s.color}`} aria-hidden="true" />
      <span className="text-mist-100">{compact ? s.label.split(" ")[0] : s.label}</span>
    </span>
  );
}
