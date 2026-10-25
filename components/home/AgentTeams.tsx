import Link from "next/link";
import { Activity, ArrowRight, HeartPulse, MessageCircleHeart, ShieldCheck, Stethoscope, Workflow } from "lucide-react";
import { AGENT_TEAMS, agentsByTeam, STATUS_LABEL, type AgentTeamId } from "@/lib/agents";
import { Reveal } from "@/components/site/Reveal";
import { SectionHeading } from "./SectionHeading";

const TEAM_ICON: Record<AgentTeamId, typeof Activity> = {
  companionship: MessageCircleHeart,
  health: HeartPulse,
  progress: Activity,
  doctor: Stethoscope,
  safety: ShieldCheck,
  platform: Workflow,
};

export function AgentTeams() {
  return (
    <section aria-labelledby="agents-title" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28">
      <SectionHeading
        id="agents-title"
        eyebrow="Under the hood"
        title="30 specialised agents, one orchestrator"
        description="Six teams of focused workflows, coordinated by a Master Orchestrator that records which agents handled every request. Statuses are shown honestly: functional, prototype or planned."
      />
      <ul className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {AGENT_TEAMS.map((team, i) => {
          const Icon = TEAM_ICON[team.id];
          const agents = agentsByTeam(team.id);
          return (
            <Reveal as="li" key={team.id} delay={(i % 3) * 90}>
              <article className="glass h-full rounded-3xl p-6">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-glow-300/10 text-glow-300">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-medium text-mist-500">Team {team.number}</span>
                </div>
                <h3 className="mt-5 text-xl font-semibold text-white">{team.name}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-mist-400">{team.purpose}</p>
                <ul className="mt-5 grid gap-1.5">
                  {agents.map((agent) => (
                    <li key={agent.id} className="flex items-center justify-between gap-3 text-[0.95rem]">
                      <span className="text-mist-300">
                        <span className="mr-2 text-mist-500 tabular-nums">{String(agent.number).padStart(2, "0")}</span>
                        {agent.name.replace(/ Agent$/, "")}
                      </span>
                      <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[0.7rem] font-medium text-mist-400">
                        {STATUS_LABEL[agent.status]}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          );
        })}
      </ul>
      <Reveal className="mt-10 text-center">
        <Link href="/agents" className="inline-flex items-center gap-2 text-lg font-semibold text-glow-300 hover:text-glow-200">
          Explore the Agent Control Center <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </Link>
      </Reveal>
    </section>
  );
}
