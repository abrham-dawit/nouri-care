import { Ban, Check } from "lucide-react";
import { Reveal } from "@/components/site/Reveal";
import { SectionHeading } from "./SectionHeading";

const NEVER = [
  "Invents patient measurements",
  "Diagnoses illnesses on its own",
  "Prescribes medication or insulin doses",
  "Decides if an injection is safe from a calorie estimate",
  "Changes a care plan without clinician verification",
  "Places real emergency calls in this demo (they're simulated)",
];

const ALWAYS = [
  "Labels every entry: patient report, device reading or AI estimate",
  "Keeps prescribed instructions separate from AI suggestions",
  "Distinguishes a reminder acknowledgment from actual intake",
  "Traces every summary statement to its source observations",
  "Shares only what the patient has consented to share",
  "Uses synthetic data only in this prototype",
];

export function Safety() {
  return (
    <section aria-labelledby="safety-title" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
      <SectionHeading
        id="safety-title"
        eyebrow="Safety by design"
        title="A companion, not a physician"
        description="Nouri manages information and offers companionship. Medical decisions stay with qualified humans."
      />
      <div className="mt-14 grid gap-5 lg:grid-cols-2">
        <Reveal>
          <div className="glass h-full rounded-3xl p-7 sm:p-8">
            <h3 className="text-lg font-semibold text-white">Nouri never…</h3>
            <ul className="mt-5 grid gap-3.5">
              {NEVER.map((item) => (
                <li key={item} className="flex gap-3 text-mist-300">
                  <Ban className="mt-0.5 h-5 w-5 shrink-0 text-ember-300" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div className="glass h-full rounded-3xl p-7 sm:p-8">
            <h3 className="text-lg font-semibold text-white">Nouri always…</h3>
            <ul className="mt-5 grid gap-3.5">
              {ALWAYS.map((item) => (
                <li key={item} className="flex gap-3 text-mist-300">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-tide-300" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
