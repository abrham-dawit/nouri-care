"""
Nouri's specialist agents. Each does one job and answers the Coordinator with one typed result.

- Safety Agent:    checks the user's words (emergency, dosing questions) and every reply before it goes out.
- Companion Agent: daily check-ins and conversation; writes down what the patient reports, but saves
                   it only after they say yes.
- Planning Agent:  creates real reminders on the patient's care schedule (never with a dose).
"""

import os

import loop_compat  # noqa: F401  (must come before any Agent is created)
from uagents import Agent, Context

from backend import BackendError, call
from protocols import (
    AgentFailure,
    CompanionRequest,
    CompanionResult,
    PendingObservation,
    PlanRequest,
    PlanResult,
    SafetyCheck,
    SafetyVerdict,
    companion_protocol,
    planning_protocol,
    safety_protocol,
)


def _seed(name: str) -> str:
    seed = os.getenv(name)
    if not seed:
        raise RuntimeError(f"{name} is not set. Run: python setup_env.py")
    return seed


safety_agent = Agent(name="nouri-safety", seed=_seed("NOURI_SAFETY_SEED"))
companion_agent = Agent(name="nouri-companion", seed=_seed("NOURI_COMPANION_SEED"))
planning_agent = Agent(name="nouri-planning", seed=_seed("NOURI_PLANNING_SEED"))


# ── Safety Agent ──
@safety_protocol.on_message(SafetyCheck, replies={SafetyVerdict, AgentFailure})
async def check_safety(ctx: Context, sender: str, msg: SafetyCheck):
    try:
        data = await call("POST", "/api/v1/agent/safety", {"text": msg.text, "direction": msg.direction})
    except BackendError as err:
        await ctx.send(sender, AgentFailure(step="safety", error=str(err)))
        return
    ctx.logger.info(f"{msg.direction} check: allowed={data['allowed']} emergency={data['emergency']} dosing={data['dosing_question']}")
    await ctx.send(
        sender,
        SafetyVerdict(
            allowed=data["allowed"],
            emergency=data["emergency"],
            dosing_question=data["dosing_question"],
            findings=data["findings"],
            safe_reply=data.get("safe_reply"),
        ),
    )


# ── Companion Agent ──
@companion_protocol.on_message(CompanionRequest, replies={CompanionResult, AgentFailure})
async def companion(ctx: Context, sender: str, msg: CompanionRequest):
    try:
        if msg.action == "message":
            data = await call("POST", "/api/v1/agent/message", {"text": msg.text, "agent": "nouri-companion"})
            pending = [PendingObservation(**o) for o in data["pending_observations"]]
            result = CompanionResult(
                reply=data["reply"],
                interaction_id=data["interaction_id"],
                confirmation_required=data["confirmation_required"],
                pending=pending,
            )
        else:
            if not msg.interaction_id:
                raise BackendError("There is nothing waiting to be saved.")
            accept = "all" if msg.action == "confirm" else "none"
            data = await call("POST", f"/api/v1/voice/{msg.interaction_id}/confirm", {"accept": accept})
            saved = data["saved_observations"]
            reply = (
                f"Saved {saved} {'entry' if saved == 1 else 'entries'} to the care journal. Your care team will see "
                f"{'it' if saved == 1 else 'them'} in your next visit summary."
                if saved
                else "Okay, I didn't save anything."
            )
            result = CompanionResult(reply=reply, interaction_id=msg.interaction_id, saved_observations=saved, brief_updated=data["brief_updated"])
    except BackendError as err:
        await ctx.send(sender, AgentFailure(step="companion", error=str(err)))
        return
    ctx.logger.info(f"{msg.action}: interaction={result.interaction_id} pending={len(result.pending)} saved={result.saved_observations}")
    await ctx.send(sender, result)


# ── Planning Agent ──
@planning_protocol.on_message(PlanRequest, replies={PlanResult, AgentFailure})
async def plan(ctx: Context, sender: str, msg: PlanRequest):
    if not msg.time:
        # Never guess a time for someone's care schedule: ask.
        await ctx.send(sender, PlanResult(created=False, needs_time=True, reply=f"What time should I remind you to {msg.title.rstrip('.').lower()}?"))
        return
    try:
        data = await call("POST", "/api/v1/reminders", {"title": msg.title, "time": msg.time, "repeat": msg.repeat, "kind": msg.kind, "agent": "nouri-planning"})
    except BackendError as err:
        await ctx.send(sender, AgentFailure(step="planning", error=str(err)))
        return
    r = data["reminder"]
    when = f"every day at {r['time_label']}" if r["repeat"] == "daily" else f"at {r['time_label']}"
    reply = f"Done! I'll remind you {when}: “{r['title']}”."
    if r.get("safetyNote"):
        reply += " (I left out the dose. Please follow your care plan for how much to take.)"
    ctx.logger.info(f"created reminder {r['id']} {r['time']} {r['repeat']} kind={r['kind']}")
    await ctx.send(sender, PlanResult(created=True, reminder_id=r["id"], reply=reply))


safety_agent.include(safety_protocol, publish_manifest=True)
companion_agent.include(companion_protocol, publish_manifest=True)
planning_agent.include(planning_protocol, publish_manifest=True)

SPECIALISTS_PORT = int(os.getenv("NOURI_SPECIALISTS_PORT", "8000"))

if __name__ == "__main__":
    from uagents import Bureau

    # Reachable only on this computer: the Coordinator (same machine) is their only caller.
    Bureau(
        agents=[safety_agent, companion_agent, planning_agent],
        port=SPECIALISTS_PORT,
        endpoint=[f"http://127.0.0.1:{SPECIALISTS_PORT}/submit"],
    ).run()
