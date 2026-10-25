import type { Metadata } from "next";
import { DashboardView } from "@/components/clinical/DashboardView";
import { getDashboardData } from "@/lib/clinical/dashboard";
import { DEMO_CLINICIAN } from "@/lib/clinical/synthetic";

export const metadata: Metadata = { title: "Doctor Dashboard" };

export default function DashboardPage() {
  return <DashboardView data={getDashboardData()} clinician={DEMO_CLINICIAN} />;
}
