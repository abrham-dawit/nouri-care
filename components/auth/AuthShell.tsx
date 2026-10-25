import type { ReactNode } from "react";
import { NouriMark } from "@/components/site/NouriMark";

/** Centered card used by the login and sign-up pages. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-5 pt-28 pb-12">
      <div className="mb-8 text-center">
        <NouriMark className="mx-auto h-12 w-16" />
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-3 text-lg text-mist-300">{subtitle}</p>
      </div>
      <div className="glass rounded-3xl p-6 sm:p-8">{children}</div>
      {footer}
    </section>
  );
}
