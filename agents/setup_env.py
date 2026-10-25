"""
Creates agents/.env with random agent seeds (once). Seeds decide each agent's address, so keep the
file: a new seed means a new agent on Agentverse. agents/.env is git-ignored; never commit it.
"""

import secrets
from pathlib import Path

ENV = Path(__file__).with_name(".env")
SEEDS = ["NOURI_COORDINATOR_SEED", "NOURI_SAFETY_SEED", "NOURI_COMPANION_SEED", "NOURI_PLANNING_SEED"]

existing = ENV.read_text(encoding="utf-8") if ENV.exists() else ""
lines = [] if existing else [
    "# Nouri agents. Git-ignored: never commit or share.",
    "NOURI_API_URL=http://localhost:3000",
    "# From: npm run device:issue -- fetch-coordinator   (run in the nouri-care folder)",
    "NOURI_AGENT_TOKEN=",
]
added = [s for s in SEEDS if f"{s}=" not in existing]
lines += [f"{s}={secrets.token_hex(32)}" for s in added]
if lines:
    with ENV.open("a", encoding="utf-8") as f:
        f.write(("\n" if existing and not existing.endswith("\n") else "") + "\n".join(lines) + "\n")
print(f"{ENV}: added {', '.join(added) if added else 'nothing (seeds already set)'}")
