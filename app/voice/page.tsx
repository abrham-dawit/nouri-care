import type { Metadata } from "next";
import { VoiceStudio } from "@/components/voice/VoiceStudio";
import { getAllRecords } from "@/lib/clinical/synthetic";

export const metadata: Metadata = { title: "Voice Studio" };

export default function VoicePage() {
  const patients = getAllRecords().map((r) => ({ id: r.patient.id, name: r.patient.name, preferredName: r.patient.preferredName }));
  return <VoiceStudio patients={patients} />;
}
