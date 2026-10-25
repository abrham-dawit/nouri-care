import type { Metadata } from "next";
import { CompanionView } from "@/components/companion/CompanionView";
import { getAllRecords } from "@/lib/clinical/synthetic";

export const metadata: Metadata = { title: "Talk to Nouri" };

export default function CompanionPage() {
  const patients = getAllRecords().map((r) => ({ id: r.patient.id, name: r.patient.name, preferredName: r.patient.preferredName }));
  return <CompanionView patients={patients} />;
}
