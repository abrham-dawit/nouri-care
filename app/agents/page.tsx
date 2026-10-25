import type { Metadata } from "next";
import { AgentControlCenter } from "@/components/agents/AgentControlCenter";
import { getAllRecords } from "@/lib/clinical/synthetic";

export const metadata: Metadata = { title: "AI Agent Control Center" };

export default function AgentsPage() {
  const patients = getAllRecords().map((r) => ({ id: r.patient.id, name: r.patient.name }));
  return <AgentControlCenter patients={patients} />;
}
