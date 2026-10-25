import Link from "next/link";
import { ArrowLeft, Brain, Cpu, HeartHandshake, MapPin, Stethoscope } from "lucide-react";
import type { Caregiver, Patient } from "@/lib/clinical/types";
import { formatRelativeDay, formatTime } from "@/lib/clinical/time";
import { DemoDataNotice, PatientAvatar } from "@/components/clinical/ui";

const SHARING_LABEL: Record<Caregiver["sharing"][number], string> = {
  check_ins: "Check-ins",
  reminders: "Reminders",
  glucose: "Glucose",
  visit_summaries: "Visit summaries",
  emergency: "Emergency alerts",
};

export function PatientHeader({ patient, index, lastActivityAt }: { patient: Patient; index: number; lastActivityAt: string | null }) {
  return (
    <header>
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-mist-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Dashboard
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-start gap-4">
          <PatientAvatar name={patient.name} index={index} size="lg" />
          <div>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">{patient.name}</h1>
            <p className="mt-2 text-lg text-mist-300">
              Prefers &ldquo;{patient.preferredName}&rdquo; · {patient.pronouns} · {patient.age} (born {patient.birthYear})
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-mist-400">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" aria-hidden="true" /> {patient.location}
              </span>
              <span>{patient.livingSituation}</span>
            </p>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Conditions">
              {patient.conditions.map((c) => (
                <li key={c} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-mist-100">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <DemoDataNotice>Synthetic patient · not a real person</DemoDataNotice>
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="glass rounded-2xl p-4">
          <dt className="flex items-center gap-2 text-sm text-mist-400">
            <Cpu className="h-4 w-4 text-source-device" aria-hidden="true" /> Nouri device
          </dt>
          <dd className="mt-1.5 font-semibold text-white">{patient.deviceId}</dd>
          <dd className="text-sm text-mist-400">
            {lastActivityAt ? `Last event ${formatRelativeDay(lastActivityAt).toLowerCase()}, ${formatTime(lastActivityAt)}` : "No events yet"} · simulated
          </dd>
        </div>
        <div className="glass rounded-2xl p-4">
          <dt className="flex items-center gap-2 text-sm text-mist-400">
            <Stethoscope className="h-4 w-4 text-source-clinician" aria-hidden="true" /> Primary clinician
          </dt>
          <dd className="mt-1.5 font-semibold text-white">{patient.primaryClinician}</dd>
          <dd className="text-sm text-mist-400">Authorised to review and approve</dd>
        </div>
        <div className="glass rounded-2xl p-4 xl:col-span-1">
          <dt className="flex items-center gap-2 text-sm text-mist-400">
            <HeartHandshake className="h-4 w-4 text-blush-300" aria-hidden="true" /> Caregivers (patient consent)
          </dt>
          {patient.caregivers.map((c) => (
            <dd key={c.name} className="mt-1.5">
              <span className="font-semibold text-white">{c.name}</span> <span className="text-sm text-mist-400">· {c.relationship}</span>
              <span className="block text-sm text-mist-400">Sees: {c.sharing.map((s) => SHARING_LABEL[s]).join(", ")}</span>
            </dd>
          ))}
        </div>
        <div className="glass rounded-2xl p-4">
          <dt className="flex items-center gap-2 text-sm text-mist-400">
            <Brain className="h-4 w-4 text-glow-300" aria-hidden="true" /> Nouri remembers
          </dt>
          <dd className="mt-1.5 text-sm leading-relaxed text-mist-300">{patient.interests.join(" · ")}</dd>
          <dd className="mt-1 text-xs text-mist-500">Shared by the patient for conversation, not used clinically</dd>
        </div>
      </dl>
    </header>
  );
}
