"use client";

import { Search } from "lucide-react";
import type { PatientListItem } from "@/lib/clinical/dashboard";

export function PatientSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="relative flex min-w-0 flex-1 items-center sm:max-w-sm">
      <span className="sr-only">Search patients</span>
      <Search className="pointer-events-none absolute left-3.5 h-5 w-5 text-mist-500" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by name, condition or device"
        className="w-full rounded-xl border border-white/[0.08] bg-night-850 py-2.5 pr-3 pl-11 text-[0.95rem] text-white placeholder:text-mist-500 focus:border-glow-300/40 focus:outline-none"
      />
    </label>
  );
}

export function matchPatient(p: PatientListItem, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [p.name, p.preferredName, p.location, p.deviceId, ...p.conditions].some((field) => field.toLowerCase().includes(q));
}
