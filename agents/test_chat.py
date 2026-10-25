"""
Local end-to-end test without Agentverse: a test client sends Agent Chat Protocol messages to the
Coordinator (in the same Bureau) and prints each reply. Needs the Nouri backend running.

    python test_chat.py
    python test_chat.py "Remind me to drink water every day at 3pm"
"""

import asyncio
import sys
from datetime import datetime, timezone
from uuid import uuid4

from uagents import Agent, Bureau, Context
from uagents_core.contrib.protocols.chat import ChatAcknowledgement, ChatMessage, TextContent

from agent import agent as coordinator
from specialists import companion_agent, planning_agent, safety_agent

# Everything in one Bureau here, so messages are delivered locally (no endpoints needed).

SCRIPT = sys.argv[1:] or [
    "I didn't sleep well last night and my blood sugar was 162 this morning.",
    "yes",
    "Remind me to drink a glass of water every day",
    "3pm",
    "Remind me to take 10 units of insulin at 9pm",
    "Should I take more insulin tonight?",
    "I fell and I can't get up",
]

client = Agent(name="nouri-test-client", seed="nouri local test client (not a secret)")
replies: asyncio.Queue = asyncio.Queue()


@client.on_message(ChatMessage)
async def on_reply(ctx: Context, sender: str, msg: ChatMessage):
    await ctx.send(sender, ChatAcknowledgement(timestamp=datetime.now(timezone.utc), acknowledged_msg_id=msg.msg_id))
    await replies.put(" ".join(c.text for c in msg.content if isinstance(c, TextContent)))


@client.on_message(ChatAcknowledgement)
async def on_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass


@client.on_event("startup")
async def run_script(ctx: Context):
    await asyncio.sleep(2)
    for text in SCRIPT:
        print(f"\n\U0001f464 USER: {text}", flush=True)
        await ctx.send(coordinator.address, ChatMessage(timestamp=datetime.now(timezone.utc), msg_id=uuid4(), content=[TextContent(type="text", text=text)]))
        try:
            print(f"\U0001f916 NOURI: {await asyncio.wait_for(replies.get(), timeout=120)}", flush=True)
        except asyncio.TimeoutError:
            print("\U0001f916 NOURI: (no reply within 120 s)", flush=True)
    print("\nDONE", flush=True)


if __name__ == "__main__":
    Bureau(agents=[coordinator, safety_agent, companion_agent, planning_agent, client], port=8010).run()
