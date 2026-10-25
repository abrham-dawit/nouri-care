"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Play } from "lucide-react";
import { playNouriIntro } from "@/components/nouri/NouriIntro";

export function ReplayIntroButton({ className }: { className?: string }) {
  const pathname = usePathname();
  const content = (
    <>
      <Play className="h-4 w-4" aria-hidden="true" /> Replay Nouri&apos;s intro
    </>
  );
  const cls = `inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-mist-300 transition hover:border-glow-300/40 hover:text-white ${className ?? ""}`;

  // The intro lives on the homepage; elsewhere, link there with the replay flag.
  if (pathname !== "/") {
    return (
      <Link href="/?intro" className={cls}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={playNouriIntro} className={cls}>
      {content}
    </button>
  );
}
