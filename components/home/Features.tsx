import { BellRing, Droplet, FileHeart, HeartHandshake, MessageCircleHeart, Moon } from "lucide-react";
import { Reveal } from "@/components/site/Reveal";
import { SectionHeading } from "./SectionHeading";

const FEATURES = [
  {
    icon: MessageCircleHeart,
    title: "A friend, not a gadget",
    body: "Nouri remembers grandchildren's names, favourite songs and yesterday's worries, and asks about them warmly.",
    tint: "from-blush-300/20",
    color: "text-blush-300",
  },
  {
    icon: Moon,
    title: "Gentle daily check-ins",
    body: "Morning and evening chats capture sleep, mood and energy in the patient's own words.",
    tint: "from-glow-300/20",
    color: "text-glow-300",
  },
  {
    icon: Droplet,
    title: "Glucose & meal journals",
    body: "Readings are logged from a device or read aloud by the patient, never estimated by AI.",
    tint: "from-tide-300/20",
    color: "text-tide-300",
  },
  {
    icon: BellRing,
    title: "Reminders, honestly reported",
    body: "Clinician-approved reminders, with a clear difference between “I heard you” and “I took it.”",
    tint: "from-amber-300/20",
    color: "text-amber-300",
  },
  {
    icon: FileHeart,
    title: "Visit briefs for clinicians",
    body: "AI-drafted summaries a doctor reviews, with every statement linked back to its source.",
    tint: "from-glow-300/20",
    color: "text-glow-200",
  },
  {
    icon: HeartHandshake,
    title: "Consent-first family sharing",
    body: "The patient chooses who sees what. Caregivers get calm, approved updates.",
    tint: "from-blush-300/20",
    color: "text-blush-300",
  },
];

export function Features() {
  return (
    <section aria-labelledby="features-title" className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28">
      <SectionHeading
        id="features-title"
        eyebrow="What Nouri does"
        title="Warm for patients. Clear for care teams."
        description="Two experiences, one source of truth: a companion that feels like a friend, and a platform that respects a clinician's time."
      />
      <ul className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal as="li" key={f.title} delay={(i % 3) * 90}>
            <article className="group glass relative h-full overflow-hidden rounded-3xl p-7 transition duration-500 hover:-translate-y-1 hover:border-white/15">
              <div
                className={`pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-gradient-to-br ${f.tint} to-transparent opacity-60 blur-2xl transition-opacity duration-500 group-hover:opacity-100`}
                aria-hidden="true"
              />
              <span className={`relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] ${f.color}`}>
                <f.icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <h3 className="relative mt-6 text-xl font-semibold text-white">{f.title}</h3>
              <p className="relative mt-3 leading-relaxed text-mist-300">{f.body}</p>
            </article>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
