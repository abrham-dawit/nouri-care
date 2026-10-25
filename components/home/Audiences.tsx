import Link from "next/link";
import { ArrowRight, HeartHandshake, Stethoscope } from "lucide-react";
import { Reveal } from "@/components/site/Reveal";
import { SectionHeading } from "./SectionHeading";

const PORTALS = [
  {
    href: "/dashboard",
    icon: Stethoscope,
    eyebrow: "For clinicians",
    title: "Doctor portal",
    body: "Patient overviews, glucose and journal trends, a source-labelled timeline, and AI-drafted visit briefs awaiting your review.",
    cta: "Open the dashboard",
    accent: "text-glow-300",
    ring: "hover:border-glow-300/30",
    glow: "bg-glow-300/15",
  },
  {
    href: "/caregivers",
    icon: HeartHandshake,
    eyebrow: "For family & caregivers",
    title: "Caregiver portal",
    body: "Daily check-in reports, reminders and peace of mind, shared only with the patient's consent.",
    cta: "Visit the caregiver portal",
    accent: "text-blush-300",
    ring: "hover:border-blush-300/30",
    glow: "bg-blush-300/15",
  },
];

export function Audiences() {
  return (
    <section aria-labelledby="portals-title" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
      <SectionHeading id="portals-title" eyebrow="Portals" title="Everyone in the circle of care" />
      <div className="mt-14 grid gap-5 lg:grid-cols-2">
        {PORTALS.map((p, i) => (
          <Reveal key={p.href} delay={i * 100}>
            <Link
              href={p.href}
              className={`group glass relative flex h-full flex-col overflow-hidden rounded-[2rem] p-8 transition duration-500 hover:-translate-y-1 sm:p-10 ${p.ring}`}
            >
              <span aria-hidden="true" className={`pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full blur-3xl ${p.glow}`} />
              <p.icon className={`relative h-9 w-9 ${p.accent}`} aria-hidden="true" />
              <p className="relative mt-8 text-sm font-semibold tracking-widest text-mist-400 uppercase">{p.eyebrow}</p>
              <h3 className="relative mt-2 font-display text-3xl font-semibold text-white sm:text-4xl">{p.title}</h3>
              <p className="relative mt-4 max-w-md text-lg leading-relaxed text-mist-300">{p.body}</p>
              <span className={`relative mt-8 inline-flex items-center gap-2 text-lg font-semibold ${p.accent}`}>
                {p.cta}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
