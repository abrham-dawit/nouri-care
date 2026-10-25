"""
Connects the Nouri Coordinator to an Agentverse mailbox without the browser inspector, and prints
every step so a failure says exactly where Agentverse refused.

Same calls as the inspector's Connect -> Mailbox (identity challenge, proof, registration), with
agent_type="mailbox", using the Coordinator's own seed, profile, protocols and endpoint.

    python connect_mailbox.py

The Agentverse API key is typed (hidden) at the prompt, used once and not stored or printed.
Get one at agentverse.ai -> profile -> API Keys. The output contains no secrets: paste it freely.
"""

import getpass
import os
from datetime import datetime, timezone
from secrets import token_bytes

import httpx
from uagents_core.config import AgentverseConfig
from uagents_core.registration import RegistrationRequest
from uagents_core.storage import compute_attestation

from agent import agent as coordinator

cfg = AgentverseConfig()
identity = coordinator._identity  # noqa: SLF001
address = coordinator.address


def short(res: httpx.Response) -> str:
    return f"HTTP {res.status_code} {res.text[:300].strip()}"


def mailbox_status() -> str:
    att = compute_attestation(identity, datetime.now(timezone.utc), 60, token_bytes(32))
    return short(httpx.get(f"{cfg.agents_api}/{address}/mailbox", headers={"Authorization": f"Agent {att}"}, timeout=20))


print(f"Coordinator: {address}")
print(f"Agentverse:  {cfg.url}")
print(f"[0] mailbox before:  {mailbox_status()}")

# AGENTVERSE_API_KEY in agents/.env (git-ignored) avoids pasting into the hidden prompt.
key = (os.getenv("AGENTVERSE_API_KEY") or "").strip() or getpass.getpass("Agentverse API key (input hidden): ").strip()
if not key:
    raise SystemExit("No key entered.")
print(f"    key: {len(key)} characters, starts with {key[:3]!r}" + ("" if key.startswith("eyJ") else "  <- Agentverse keys usually start with 'eyJ'"))
headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}

with httpx.Client(timeout=30) as http:
    r = http.get(f"{cfg.identity_api}/{address}/challenge", headers=headers)
    print(f"[1] challenge:       {short(r) if r.status_code != 200 else 'HTTP 200 ok'}")
    if r.status_code != 200:
        raise SystemExit("Stopped: Agentverse refused the key or the account (see [1]).")
    challenge = r.json()["challenge"]

    proof = {"address": address, "challenge": challenge, "challenge_response": identity.sign(challenge.encode())}
    r = http.post(cfg.identity_api, json=proof, headers=headers)
    print(f"[2] identity proof:  {short(r) if r.status_code != 200 else 'HTTP 200 ok'}")
    if r.status_code != 200:
        raise SystemExit("Stopped at the identity proof (see [2]).")

    details = RegistrationRequest(
        address=address,
        name=coordinator.name,
        agent_type="mailbox",
        profile=coordinator._build_registration_profile(),  # noqa: SLF001
        endpoints=coordinator._endpoints,  # noqa: SLF001
        protocols=list(coordinator.protocols.keys()),
        metadata=coordinator.metadata,
    )
    r = http.post(cfg.agents_api, content=details.model_dump_json(), headers=headers)
    print(f"[3] register agent:  {short(r)}")

    r = http.get(f"{cfg.agents_api}/{address}", headers=headers)
    print(f"[4] agent in account: {short(r)}")
key = ""

print(f"[5] mailbox after:   {mailbox_status()}")
