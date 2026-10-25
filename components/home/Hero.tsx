import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, HeartHandshake } from "lucide-react";
import { HeroNouri } from "@/components/nouri/HeroNouri";

const delay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as CSSProperties;

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="mx-auto grid min-h-[100svh] max-w-7xl items-center gap-10 px-5 pt-28 pb-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6 lg:pt-24">
        {/* Copy */}
        <div className="order-2 text-center lg:order-1 lg:text-left">
          <p
            data-reveal
            style={delay(100)}
            className="inline-flex items-center gap-2 rounded-full border border-glow-300/20 bg-glow-300/[0.06] px-4 py-1.5 text-sm font-medium text-glow-200"
          >
            <span className="h-2 w-2 rounded-full bg-tide-400 shadow-[0_0_10px_var(--color-tide-400)]" aria-hidden="true" />
            An AI companion for older adults
          </p>
          <h1
            data-reveal
            style={delay(220)}
            className="mt-6 font-display text-[2.6rem] leading-[1.04] font-semibold tracking-tight text-white sm:text-6xl lg:text-[3.6rem] xl:text-[4.4rem]"
          >
            Care that <span className="text-gradient italic">remembers.</span>
            <br />
            Companionship that matters.
          </h1>
          <p
            data-reveal
            style={delay(360)}
            className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-mist-300 sm:text-xl lg:mx-0"
          >
            Nouri is a friendly desktop robot that keeps older adults company, listens to how they&apos;re really doing,
            and, with their permission, helps their doctors and family understand what matters between visits.
          </p>
          <div
            data-reveal
            style={delay(500)}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"
          >
            <Link
              href="/dashboard"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-glow-300 px-6 py-4 text-lg font-semibold text-night-950 shadow-[0_0_40px_-8px_var(--color-glow-400)] transition hover:bg-glow-200 sm:w-auto"
            >
              Open doctor dashboard
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            <Link
              href="/caregivers"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.03] px-6 py-4 text-lg font-semibold text-white transition hover:border-white/25 hover:bg-white/[0.06] sm:w-auto"
            >
              <HeartHandshake className="h-5 w-5 text-blush-300" aria-hidden="true" />
              Caregiver portal
            </Link>
          </div>
          <ul
            data-reveal
            style={delay(640)}
            className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-mist-400 lg:justify-start"
          >
            <li>Synthetic data only</li>
            <li aria-hidden="true">·</li>
            <li>Clinician-reviewed summaries</li>
            <li aria-hidden="true">·</li>
            <li>Never diagnoses or doses</li>
          </ul>
        </div>

        {/* Nouri — the intro camera lands exactly on this robot */}
        <div className="relative order-1 flex justify-center lg:order-2">
          <div
            data-reveal
            style={delay(0)}
            className="glow-pulse pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(34_211_238/0.22),rgb(45_212_191/0.06)_55%,transparent)]"
            aria-hidden="true"
          />
          <div className="relative">
            <div className="nouri-float">
              <HeroNouri className="aspect-[432/540] w-[min(58vw,250px)] sm:w-[300px] lg:w-[min(100%,420px)]" />
            </div>
            <div
              data-reveal
              style={delay(300)}
              aria-hidden="true"
              className="pointer-events-none absolute bottom-[1%] left-1/2 -z-10 h-[9%] w-[90%] -translate-x-1/2 rounded-[50%] border border-glow-300/25 shadow-[0_0_40px_0_rgb(34_211_238/0.2)]"
            />

            <figure
              data-reveal
              style={delay(800)}
              className="glass absolute top-[2%] -left-[62%] hidden w-56 rounded-2xl rounded-br-md p-4 text-left shadow-2xl sm:block lg:hidden xl:block xl:-left-[52%]"
            >
              <figcaption className="text-xs font-semibold tracking-widest text-glow-300 uppercase">Nouri</figcaption>
              <p className="mt-1.5 text-[0.95rem] leading-snug text-mist-100">
                Good morning, Margaret. Did you sleep well last night?
              </p>
            </figure>
            <figure
              data-reveal
              style={delay(1000)}
              className="glass absolute -right-[66%] bottom-[14%] hidden w-60 rounded-2xl rounded-bl-md p-4 text-left shadow-2xl sm:block lg:hidden xl:block xl:-right-[40%]"
            >
              <figcaption className="flex items-center justify-between text-xs font-semibold tracking-widest uppercase">
                <span className="text-blush-300">Patient report</span>
                <span className="rounded-full bg-amber-300/10 px-2 py-0.5 text-[0.65rem] text-amber-300">Awaiting OK</span>
              </figcaption>
              <p className="mt-1.5 text-[0.95rem] leading-snug text-mist-100">
                &ldquo;I didn&apos;t sleep well.&rdquo; Save this to your sleep journal?
              </p>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}
