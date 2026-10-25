"""
Typed messages between Nouri's agents. Every specialist answers a request with exactly one
response model, or an AgentFailure, so the Coordinator always knows how a step ended.

    Coordinator ── SafetyCheck ──────▶ Safety Agent    ── SafetyVerdict
    Coordinator ── CompanionRequest ─▶ Companion Agent ── CompanionResult
    Coordinator ── PlanRequest ──────▶ Planning Agent  ── PlanResult
                                    (any specialist)  ── AgentFailure
"""

from typing import Literal, Optional

from uagents import Model, Protocol


class AgentFailure(Model):
    step: str
    error: str


# ── Safety Agent ──
class SafetyCheck(Model):
    text: str
    direction: Literal["input", "output"]


class SafetyVerdict(Model):
    allowed: bool
    emergency: bool
    dosing_question: bool
    findings: list[str]
    safe_reply: Optional[str] = None


# ── Companion Agent ──
class CompanionRequest(Model):
    action: Literal["message", "confirm", "decline"]
    text: str = ""
    interaction_id: Optional[str] = None


class PendingObservation(Model):
    id: str
    kind: str
    description: str
    quote: str


class CompanionResult(Model):
    reply: str
    interaction_id: Optional[str] = None
    confirmation_required: bool = False
    pending: list[PendingObservation] = []
    saved_observations: int = 0
    brief_updated: bool = False


# ── Planning Agent ──
class PlanRequest(Model):
    title: str
    time: Optional[str]  # 24-hour "HH:MM", or None if the user didn't say
    repeat: Literal["daily", "once"]
    kind: str


class PlanResult(Model):
    created: bool
    reply: str
    reminder_id: Optional[str] = None
    needs_time: bool = False


# One protocol per specialist, so each agent's manifest says exactly what it accepts.
safety_protocol = Protocol(name="NouriSafety", version="1.0.0")
companion_protocol = Protocol(name="NouriCompanion", version="1.0.0")
planning_protocol = Protocol(name="NouriPlanning", version="1.0.0")
