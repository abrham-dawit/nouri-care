"""
Nouri Care Coordinator: the ASI:One-compatible uAgent registered on Agentverse.
Same structure as Fetch.ai's "ASI:One compatible uAgent" example (Agent Chat Protocol):
Agent(..., mailbox=True) → Protocol(spec=chat_protocol_spec) → handle_message / handle_ack →
agent.include(protocol, publish_manifest=True) → agent.run().

handle_message runs Nouri's step-by-step pipeline (pipeline.py) with the specialist agents
(specialists.py), which must be running too:  python specialists.py

    python agent.py
"""

import os
from datetime import datetime, timezone
from uuid import uuid4

import loop_compat  # noqa: F401  (Python 3.14+: gives uAgents an event loop; must come before Agent())
from dotenv import load_dotenv
from uagents import Agent, Context, Protocol
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement,
    ChatMessage,
    EndSessionContent,
    StartSessionContent,
    TextContent,
    chat_protocol_spec,
)

from backend import BackendError
from pipeline import GREETING, run_pipeline, seed

load_dotenv()

agent = Agent(
    name="nouri-coordinator",
    seed=seed("NOURI_COORDINATOR_SEED"),
    port=int(os.getenv("NOURI_COORDINATOR_PORT", "8001")),
    mailbox=True,  # keeps the agent reachable via Agentverse
    publish_agent_details=True,  # lists the agent on Agentverse
    readme_path=os.path.join(os.path.dirname(os.path.abspath(__file__)), "AGENT_PROFILE.md"),
    description="Nouri Care: an elder-care companion that runs daily check-ins and sets care reminders, with a safety agent on every step.",
)

protocol = Protocol(spec=chat_protocol_spec)


def create_text_chat(text: str, end_session: bool = False) -> ChatMessage:
    content = [TextContent(type="text", text=text)]
    if end_session:
        content.append(EndSessionContent(type="end-session"))
    return ChatMessage(timestamp=datetime.now(timezone.utc), msg_id=uuid4(), content=content)


@protocol.on_message(ChatMessage)
async def handle_message(ctx: Context, sender: str, msg: ChatMessage):
    await ctx.send(sender, ChatAcknowledgement(timestamp=datetime.now(timezone.utc), acknowledged_msg_id=msg.msg_id))

    text = "".join(c.text for c in msg.content if isinstance(c, TextContent)).strip()
    if not text:
        if any(isinstance(c, StartSessionContent) for c in msg.content):
            await ctx.send(sender, create_text_chat(GREETING))
        return

    ctx.logger.info(f"message from {sender[:16]}…: {text[:80]}")
    try:
        reply = await run_pipeline(ctx, sender, text[:1000])
    except BackendError as err:
        ctx.logger.error(f"pipeline failed: {err}")
        reply = f"Sorry, I couldn't finish that just now ({err}). Please try again in a moment."
    # The session stays open so Nouri can ask "should I save this?" and hear the answer.
    await ctx.send(sender, create_text_chat(reply))


@protocol.on_message(ChatAcknowledgement)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass


agent.include(protocol, publish_manifest=True)  # publishes AgentChatProtocol for discovery

if __name__ == "__main__":
    agent.run()
