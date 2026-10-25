import { AudioLines, BookHeart, CircleCheck, FileText, LayoutDashboard, Mic, ScanSearch } from "lucide-react";
import { Reveal } from "@/components/site/Reveal";
import { SectionHeading } from "./SectionHeading";

const STEPS = [
  { icon: Mic, title: "Patient talks to Nouri", body: "A natural conversation, no screens or buttons to learn." },
  { icon: AudioLines, title: "Nouri understands", body: "Speech is transcribed and understood in context." },
  { icon: ScanSearch, title: "Agents spot observations", body: "Sleep, meals, symptoms and readings the patient mentions." },
  { icon: CircleCheck, title: "Patient confirms", body: "Nothing is saved until the patient says it's right." },
  { icon: BookHeart, title: "Journal entries", body: "Structured, timestamped and labelled by source." },
  { icon: LayoutDashboard, title: "Dashboard updates", body: "The care team sees trends between visits." },
  { icon: FileText, title: "Visit brief drafted", body: "A summary the clinician reviews, traced to every source." },
];

export function Workflow() {
  return (
    <section aria-labelledby="workflow-title" className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
      <SectionHeading
        id="workflow-title"
        eyebrow="How Nouri works"
        title={
          <>
            From a friendly chat to a <span className="text-gradient">reviewable</span> visit brief
          </>
        }
        description="The patient stays in control at every step. Nouri records only what they confirm, and clinicians approve anything that reaches the care record."
      />

      <ol className="relative mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 xl:gap-3">
        {/* Connecting line on large screens */}
        <svg
          className="pointer-events-none absolute top-[38px] right-[7%] left-[7%] hidden h-1 w-[86%] xl:block"
          viewBox="0 0 100 2"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line x1="0" y1="1" x2="100" y2="1" stroke="#38e1f5" strokeOpacity="0.35" strokeWidth="2" className="flow-dash" vectorEffect="non-scaling-stroke" />
        </svg>
        {STEPS.map((step, i) => (
          <Reveal as="li" key={step.title} delay={i * 80} className="relative">
            <div className="glass h-full rounded-2xl p-5 xl:bg-transparent xl:p-3 xl:text-center xl:[border:0] xl:[backdrop-filter:none]">
              <div className="relative flex items-center gap-4 xl:flex-col xl:gap-0">
                <span className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl border border-glow-300/25 bg-night-800 text-glow-300 shadow-[0_0_24px_-6px_rgb(34_211_238/0.5)] xl:mx-auto">
                  <step.icon className="h-6 w-6" aria-hidden="true" />
                  <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-night-600 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                </span>
                <h3 className="text-lg leading-snug font-semibold text-white xl:mt-5 xl:text-base">{step.title}</h3>
              </div>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-mist-400 xl:text-sm">{step.body}</p>
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
