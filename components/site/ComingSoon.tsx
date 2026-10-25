import Link from "next/link";
import { ArrowLeft, CircleDashed } from "lucide-react";

type ComingSoonProps = {
  eyebrow: string;
  title: string;
  description: string;
  phase: string;
  planned: string[];
};

/** Honest placeholder for sections scheduled in later build phases. */
export function ComingSoon({ eyebrow, title, description, phase, planned }: ComingSoonProps) {
  return (
    <section className="mx-auto max-w-4xl px-5 pt-36 pb-10 sm:px-8">
      <p className="text-sm font-semibold tracking-widest text-glow-300 uppercase">{eyebrow}</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-mist-300">{description}</p>

      <div className="glass mt-10 rounded-3xl p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-sm font-medium text-amber-300">
            <CircleDashed className="h-4 w-4" aria-hidden="true" /> Not built yet
          </span>
          <span className="text-sm text-mist-400">Scheduled for {phase}</span>
        </div>
        <h2 className="mt-6 text-lg font-semibold text-white">What this page will include</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {planned.map((item) => (
            <li key={item} className="flex gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-mist-300">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-glow-400" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <Link href="/" className="mt-10 inline-flex items-center gap-2 text-mist-300 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to home
      </Link>
    </section>
  );
}
