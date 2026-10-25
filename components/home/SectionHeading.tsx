import type { ReactNode } from "react";
import { Reveal } from "@/components/site/Reveal";

type SectionHeadingProps = {
  id?: string;
  eyebrow: string;
  title: ReactNode;
  description?: string;
  align?: "left" | "center";
};

export function SectionHeading({ id, eyebrow, title, description, align = "center" }: SectionHeadingProps) {
  const centered = align === "center";
  return (
    <Reveal className={centered ? "mx-auto max-w-3xl text-center" : "max-w-2xl"}>
      <p className="text-sm font-semibold tracking-[0.18em] text-glow-300 uppercase">{eyebrow}</p>
      <h2 id={id} className="mt-4 font-display text-4xl leading-[1.1] font-semibold tracking-tight text-white sm:text-5xl">
        {title}
      </h2>
      {description && <p className="mt-5 text-lg leading-relaxed text-mist-300">{description}</p>}
    </Reveal>
  );
}
