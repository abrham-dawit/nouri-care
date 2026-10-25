import type { CSSProperties } from "react";
import { IntroThenLogin } from "@/components/auth/IntroThenLogin";
import { NouriIntro } from "@/components/nouri/NouriIntro";
import { Hero } from "@/components/home/Hero";
import { Workflow } from "@/components/home/Workflow";
import { Features } from "@/components/home/Features";
import { PhysicalNouri } from "@/components/home/PhysicalNouri";
import { Audiences } from "@/components/home/Audiences";
import { AgentTeams } from "@/components/home/AgentTeams";
import { Safety } from "@/components/home/Safety";

export default function Home() {
  return (
    <>
      <NouriIntro />
      <IntroThenLogin />
      <Hero />
      <div data-reveal style={{ "--reveal-delay": "900ms" } as CSSProperties}>
        <Workflow />
        <Features />
        <PhysicalNouri />
        <Audiences />
        <AgentTeams />
        <Safety />
      </div>
    </>
  );
}
