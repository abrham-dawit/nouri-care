"""
Runs all four Nouri agents with one command: python run.py

Same as running these two in separate terminals:
    python specialists.py   (Safety, Companion, Planning on port 8000)
    python agent.py         (the Coordinator on port 8001, connected to Agentverse)
"""

import subprocess
import sys
from pathlib import Path

from agent import agent
from pipeline import COMPANION, PLANNING, SAFETY

HERE = Path(__file__).parent

if __name__ == "__main__":
    print(f"{'nouri-coordinator':20} {agent.address}")
    for name, address in (SAFETY, COMPANION, PLANNING):
        print(f"{name:20} {address}")
    print(flush=True)

    specialists = subprocess.Popen([sys.executable, str(HERE / "specialists.py")], cwd=HERE)
    try:
        agent.run()
    finally:
        specialists.terminate()
