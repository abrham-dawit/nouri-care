import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PatientProfileView } from "@/components/patient/PatientProfileView";
import { DEMO_CLINICIAN, getAllRecords, getPatientIds, getRecord, recentRecord } from "@/lib/clinical/synthetic";

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return getPatientIds().map((id) => ({ id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: getRecord(id)?.patient.name ?? "Patient not found" };
}

async function PatientContent({ params }: Props) {
  const { id } = await params;
  const record = getRecord(id);
  if (!record) notFound();
  const index = getAllRecords().indexOf(record);
  return <PatientProfileView record={recentRecord(record)} index={index} reviewer={DEMO_CLINICIAN} />;
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 pt-28 pb-10 sm:px-8" aria-busy="true" aria-label="Loading patient profile">
      <div className="h-4 w-24 rounded bg-white/[0.06]" />
      <div className="mt-5 flex items-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-white/[0.06]" />
        <div className="h-10 w-72 rounded-xl bg-white/[0.06]" />
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/[0.04]" />
        ))}
      </div>
      <div className="mt-6 h-96 rounded-3xl bg-white/[0.03]" />
    </div>
  );
}

export default function PatientPage({ params }: Props) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <PatientContent params={params} />
    </Suspense>
  );
}
