"""
Nouri's step-by-step pipeline, called by agent.py for every chat message:

    1. (agent.py) acknowledge the ChatMessage
    2. Safety Agent checks the user's words      (emergency / dosing question → fixed safe reply, stop)
    3. route: what does the user want?           (Nouri backend; Claude when configured)
    4. one specialist acts                       (Companion Agent or Planning Agent)
    5. Safety Agent reviews the reply             (blocked → fixed safe reply)
    6. (agent.py) send the reply as a ChatMessage

Per-conversation state (keyed by the sender's address) remembers what Nouri is waiting for:
observations to confirm, or the time for a reminder.
"""

import os

from uagents import Context
from uagents_core.identity import Identity

from backend import BackendError, call
from protocols import (
    AgentFailure,
    CompanionRequest,
    CompanionResult,
    PlanRequest,
    PlanResult,
    SafetyCheck,
    SafetyVerdict,
)

STEP_TIMEOUT = 60  # seconds; the Companion step waits for Claude
GREETING = (
    "Hi, I'm Nouri, a gentle care companion. I can do a daily check-in (tell me how you slept, ate or feel, "
    "or a blood sugar reading, and I'll write it down for your care team once you say yes), or set a reminder, "
    "like “remind me to drink water every day at 3pm”. I'm not a doctor and never give medical advice."
)


def seed(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} is not set. Run: python setup_env.py")
    return value


# The specialists run in their own process (specialists.py); their addresses follow from their seeds.
SAFETY = ("nouri-safety", Identity.from_seed(seed("NOURI_SAFETY_SEED"), 0).address)
COMPANION = ("nouri-companion", Identity.from_seed(seed("NOURI_COMPANION_SEED"), 0).address)
PLANNING = ("nouri-planning", Identity.from_seed(seed("NOURI_PLANNING_SEED"), 0).address)


async def ask(ctx: Context, agent: tuple[str, str], msg, expect: type):
    """One step: send to a specialist and wait for its typed answer."""
    name, address = agent
    reply, status = await ctx.send_and_receive(address, msg, response_type={expect, AgentFailure}, timeout=STEP_TIMEOUT)
    if isinstance(reply, AgentFailure):
        raise BackendError(f"{reply.step}: {reply.error}")
    if not isinstance(reply, expect):
        raise BackendError(f"{name} did not answer ({status}).")
    return reply


def state_key(sender: str) -> str:
    return f"session:{sender}"


def finish(reply: str, trace: list[str]) -> str:
    return f"{reply}\n\n— Nouri agents: {' → '.join(trace)}"


async def run_pipeline(ctx: Context, sender: str, text: str) -> str:
    state = ctx.storage.get(state_key(sender)) or {}
    trace: list[str] = []

    # Step 2: safety on what the user said.
    verdict: SafetyVerdict = await ask(ctx, SAFETY, SafetyCheck(text=text, direction="input"), SafetyVerdict)
    if verdict.emergency:
        trace.append("\U0001f6e1 Safety: emergency → fixed safe reply")
        return finish(verdict.safe_reply, trace)
    if not verdict.allowed:
        trace.append("\U0001f6e1 Safety: dosing question → fixed safe reply")
        return finish(verdict.safe_reply, trace)
    trace.append("\U0001f6e1 Safety ✓")

    # Step 3: route. A reminder waiting for its time gets the answer folded in.
    pending_reminder = state.get("pending_reminder")
    routed_text = (
        f"Remind me to {pending_reminder['title']}{' every day' if pending_reminder['repeat'] == 'daily' else ''} at {text}"
        if pending_reminder
        else text
    )
    route = await call("POST", "/api/v1/agent/route", {"text": routed_text, "awaiting_confirmation": bool(state.get("pending_interaction"))})
    intent = route["intent"]
    trace.append(f"\U0001f9ed Coordinator: {intent.replace('_', ' ')}")

    # Step 4: one specialist acts.
    if intent == "reminder" and route.get("reminder"):
        r = route["reminder"]
        plan: PlanResult = await ask(ctx, PLANNING, PlanRequest(title=r["title"], time=r["time"], repeat=r["repeat"], kind=r["kind"]), PlanResult)
        state["pending_reminder"] = {"title": r["title"], "repeat": r["repeat"]} if plan.needs_time else None
        trace.append("\U0001f4c5 Planning: " + ("reminder created ✓" if plan.created else "needs a time"))
        reply = plan.reply
    elif intent in ("confirm_save", "decline_save") and state.get("pending_interaction"):
        action = "confirm" if intent == "confirm_save" else "decline"
        result: CompanionResult = await ask(ctx, COMPANION, CompanionRequest(action=action, interaction_id=state["pending_interaction"]), CompanionResult)
        state["pending_interaction"] = None
        trace.append(f"\U0001f4ac Companion: {'saved ' + str(result.saved_observations) if action == 'confirm' else 'nothing saved'}")
        reply = result.reply
    else:
        state["pending_reminder"] = None
        result = await ask(ctx, COMPANION, CompanionRequest(action="message", text=text), CompanionResult)
        state["pending_interaction"] = result.interaction_id if result.confirmation_required else None
        reply = result.reply
        if result.confirmation_required:
            lines = "\n".join(f"• {o.description} (you said “{o.quote}”)" for o in result.pending)
            reply += f"\n\nI wrote down:\n{lines}\n\nShould I save this to your care journal? (yes / no)"
            trace.append(f"\U0001f4ac Companion: {len(result.pending)} to confirm")
        else:
            trace.append("\U0001f4ac Companion ✓")
    ctx.storage.set(state_key(sender), state)

    # Step 5: safety on the reply before it leaves.
    out: SafetyVerdict = await ask(ctx, SAFETY, SafetyCheck(text=reply, direction="output"), SafetyVerdict)
    if not out.allowed:
        trace.append("\U0001f6e1 Safety: reply blocked → fixed safe reply")
        return finish(out.safe_reply, trace)
    trace.append("\U0001f6e1 Safety ✓")
    return finish(reply, trace)
