import type { Metadata } from "next";
import { DeviceSimulator } from "@/components/simulator/DeviceSimulator";
import { getAllRecords } from "@/lib/clinical/synthetic";

export const metadata: Metadata = { title: "Simulated device" };

export default function SimulatorPage() {
  const patients = getAllRecords().map((r) => ({ id: r.patient.id, name: r.patient.name }));
  return (
    <section className="mx-auto max-w-4xl px-5 pt-32 pb-12 sm:px-8">
      <p className="text-sm font-semibold tracking-widest text-glow-300 uppercase">Demo tool</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">Simulated Nouri device</h1>
      <p className="mt-4 mb-8 max-w-2xl text-lg leading-relaxed text-mist-300">
        For when the robot isn&apos;t connected: send what a patient says to Nouri and watch the agents work in order,
        then confirm and see it reach the doctor&apos;s dashboard and visit brief.
      </p>
      <DeviceSimulator patients={patients} />
    </section>
  );
}
