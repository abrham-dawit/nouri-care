import { Cpu, Ear, Eye, Hand, Mic, Wifi } from "lucide-react";
import { Reveal } from "@/components/site/Reveal";
import { NouriMark } from "@/components/site/NouriMark";
import { SectionHeading } from "./SectionHeading";

const SPECS = [
  { icon: Cpu, label: "ESP32-S3 core", detail: "Low-power microcontroller with Wi-Fi" },
  { icon: Mic, label: "Voice first", detail: "Microphone and speaker for natural talk" },
  { icon: Eye, label: "Expressive eyes", detail: "A glowing face that blinks, looks and smiles" },
  { icon: Wifi, label: "Secure sync", detail: "Device identity verified on the server" },
];

const PRINCIPLES = [
  { icon: Ear, text: "No screens, apps or passwords to learn" },
  { icon: Hand, text: "Patient confirms before anything is saved" },
];

export function PhysicalNouri() {
  return (
    <section aria-labelledby="hardware-title" className="relative overflow-hidden py-24 sm:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-[520px] -translate-y-1/2 bg-[radial-gradient(60%_60%_at_30%_50%,rgb(34_211_238/0.08),transparent)]"
      />
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-2">
        <div>
          <SectionHeading
            align="left"
            id="hardware-title"
            eyebrow="Physical Nouri"
            title="A little friend on the kitchen table"
            description="Nouri is a desktop companion robot designed for older adults. It says good morning, listens without judgement, and makes it easy to share how they're feeling, in their own words."
          />
          <Reveal delay={120} className="mt-8">
            <ul className="grid gap-3">
              {PRINCIPLES.map((p) => (
                <li key={p.text} className="flex items-center gap-3 text-lg text-mist-100">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-tide-400/10 text-tide-300">
                    <p.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  {p.text}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal delay={100}>
          <div className="glass relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <NouriMark className="h-9 w-11" />
                <div>
                  <p className="font-semibold text-white">nouri-001</p>
                  <p className="text-sm text-mist-400">Demo device · simulated events</p>
                </div>
              </div>
              <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-300">
                Hardware in progress
              </span>
            </div>

            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {SPECS.map((s) => (
                <li key={s.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <s.icon className="h-5 w-5 text-glow-300" aria-hidden="true" />
                  <p className="mt-3 font-semibold text-white">{s.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-mist-400">{s.detail}</p>
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-2xl border border-white/[0.06] bg-night-950/70 p-4 font-mono text-[0.8rem] leading-relaxed text-mist-300">
              <p className="mb-2 text-xs font-sans font-semibold tracking-widest text-mist-500 uppercase">Example device event</p>
              <pre className="overflow-x-auto whitespace-pre">
                {`{
  "device_id": "nouri-001",
  "event_type": "patient_observation",
  "message": "I didn't sleep well last night",
  "timestamp": "2026-10-24T09:00:00Z"
}`}
              </pre>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
