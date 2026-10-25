"""
Client for the Nouri Care backend (the Next.js app). All AI keys stay in that backend; the agents
only hold a Nouri device credential, issued with `npm run device:issue -- fetch-coordinator`.
"""

import os

import httpx
from dotenv import load_dotenv

load_dotenv()

API_URL = os.getenv("NOURI_API_URL", "http://localhost:3000").rstrip("/")
TOKEN = os.getenv("NOURI_AGENT_TOKEN", "")
TIMEOUT = httpx.Timeout(45.0, connect=5.0)


class BackendError(Exception):
    pass


async def call(method: str, path: str, json: dict | None = None) -> dict:
    if not TOKEN:
        raise BackendError("NOURI_AGENT_TOKEN is not set (see agents/README.md).")
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            res = await client.request(method, f"{API_URL}{path}", json=json, headers={"Authorization": f"Bearer {TOKEN}"})
    except httpx.HTTPError as err:
        raise BackendError(f"Could not reach the Nouri backend at {API_URL} ({type(err).__name__}).") from err
    data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
    if res.status_code >= 400:
        raise BackendError(data.get("error") or f"Nouri backend returned HTTP {res.status_code}.")
    return data
