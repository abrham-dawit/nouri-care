import Link from "next/link";
import { MISSION, NAV_ITEMS } from "@/lib/site";
import { NouriMark } from "./NouriMark";
import { ReplayIntroButton } from "./ReplayIntroButton";

export function SiteFooter() {
  return (
    <footer data-reveal className="relative mt-24 border-t border-white/[0.06] bg-night-950/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <NouriMark className="h-7 w-9" />
            <span className="font-display text-xl font-semibold text-white">Nouri Care</span>
          </div>
          <p className="mt-4 max-w-sm font-display text-2xl leading-snug text-mist-100">{MISSION}</p>
          <ReplayIntroButton className="mt-6" />
        </div>

        <div>
          <h2 className="text-sm font-semibold tracking-widest text-mist-400 uppercase">Platform</h2>
          <ul className="mt-4 grid gap-2.5">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-mist-300 transition-colors hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold tracking-widest text-mist-400 uppercase">About this prototype</h2>
          <p className="mt-4 text-[0.95rem] leading-relaxed text-mist-400">
            Built for Cal Hacks. Nouri is an elderly-care companion and information-management prototype, not a medical
            device, and does not diagnose, prescribe or dose. All patient data shown is synthetic. Emergency calling is
            simulated. Nouri Care does not claim HIPAA compliance.
          </p>
        </div>
      </div>
      <div className="border-t border-white/[0.05] px-5 py-6 text-center text-sm text-mist-500">
        © 2026 Nouri · Made with care by Zemen &amp; team
      </div>
    </footer>
  );
}
