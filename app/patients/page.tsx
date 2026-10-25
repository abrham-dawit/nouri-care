import type { Metadata } from "next";
import { PatientDirectory } from "@/components/clinical/PatientDirectory";
import { getPatientList } from "@/lib/clinical/dashboard";

export const metadata: Metadata = { title: "Patients" };

export default function PatientsPage() {
  return <PatientDirectory patients={getPatientList()} />;
}
