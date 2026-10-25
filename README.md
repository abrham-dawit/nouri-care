![tag:innovationlab](https://img.shields.io/badge/innovationlab-3D8BD3)
![tag:hackathon](https://img.shields.io/badge/hackathon-5F43F1)

# Nouri Care

A gentle AI care companion for older adults living with diabetes, built at Cal Hacks 13.0. Patients talk to
**Nouri** (a small ESP32 robot, the web companion, or ASI:One). Nouri runs daily check-ins and reminders, and turns
what the patient says into a reviewable, source-linked visit brief for their care team.

**Safety first:** Nouri never diagnoses, never decides or repeats medication doses, saves nothing the patient hasn't
confirmed, and never calls anyone (emergencies get a fixed "call 911" reply). **All patient data is synthetic.**

## How it works

```
patient speaks (ESP32) / types (web) / chats (ASI:One)
        │
        ▼
 Nouri backend (Next.js) ── Claude: reply + extract only what the patient explicitly said
        │                   ── Data Quality: every observation must quote the patient's words; numbers must appear in them
        │                   ── Safety: emergencies and dose questions get fixed safe replies
        ▼
 "I wrote that down. Should I save it?"  ──yes──▶ journal (labelled "patient report") ──▶ doctor dashboard
                                                                                      ──▶ visit brief, pending clinician review
```

Every request runs a fixed, ordered agent workflow, recorded step by step (see **Agents** in the app).

| Part | Where | What it does |
|---|---|---|
| Web app + backend | `app/`, `lib/`, `components/` (Next.js 16) | Logins by role, companion chat, doctor dashboard, patient records, visit briefs, agent traces, device API |
| Fetch.ai agents | [`agents/`](agents/README.md) | Nouri Coordinator on Agentverse (Agent Chat Protocol) + Safety, Companion, Planning agents, in a fixed order |
| Device API | [`docs/hardware-api.md`](docs/hardware-api.md) | ESP32 uploads a 16 kHz WAV → transcript → Claude → spoken 16 kHz WAV reply |
| Enclosure | `hardware/` | 3D-printable front and back case |

## Fetch.ai agents

| Agent | Address | Role |
|---|---|---|
| `nouri-coordinator` | `agent1qwqjh2cw8ugymjq0rfjvffnk3n3r08quxdn6pzt46cd2xzr0jkx3j8hcjjt` | Agentverse mailbox agent, Agent Chat Protocol. Runs every message in order: Safety → route → Companion/Planning → Safety |
| `nouri-safety` | `agent1q0jqkmwpd7ex0krmjya93m4apqglunzm0ymzm0nqupcsu2qje5t4gts033c` | Checks the user's words and every reply (emergencies, dose questions) |
| `nouri-companion` | `agent1qghaj8jam5gtezwtg3sjhclmuz6z8cmez3c7xe5e7jtezu5mf8g9sxyaymh` | Check-ins: writes down what the patient reports, saves only after "yes" |
| `nouri-planning` | `agent1qdsq55ltpdpgyllhw35lg2wgwe35vpm8zsypx6tvzn7fs4r8m89v2qgsyr3` | Creates care reminders; asks for a time instead of guessing; never stores a dose |

Details, message types and the step order: [`agents/README.md`](agents/README.md).

## Run it

Requires Node 20+, Python 3.10+ (tested on 3.15), Windows for the built-in voices.

**1. Backend + website**
```powershell
npm install
copy .env.example .env.local   # then fill in ANTHROPIC_API_KEY and NOURI_SESSION_SECRET (32+ random characters)
npm run dev -- -H 0.0.0.0      # http://localhost:3000
```
Demo logins (synthetic data) are listed in the "Demo accounts" box on the login page: patient `margaret`,
family `sarah`, doctor `dr.raman`.

**2. Try the full workflow without hardware:** log in, open **`/simulator`** (Simulated device mode, clearly labelled).
Type what a patient says → watch the agents run in order → "Patient says yes" → open the patient's record and the
doctor dashboard to see the saved observation and the redrafted visit brief.

**3. Fetch.ai agents**
```powershell
cd agents
python -m venv .venv; .\.venv\Scripts\activate
pip install -r requirements.txt
python setup_env.py                          # creates agents/.env with agent seeds (once)
# in the repo root: npm run device:issue -- fetch-coordinator   → paste the printed token as NOURI_AGENT_TOKEN in agents/.env
python run.py                                # Coordinator (port 8001) + Safety/Companion/Planning (port 8000)
```
Connect the Coordinator's mailbox once: open the printed Agent inspector link → **Connect → Mailbox** (in Chrome,
allow *Local network access*), or put `AGENTVERSE_API_KEY` in `agents/.env` and run `python connect_mailbox.py`.
Then on Agentverse open **nouri-coordinator → Chat with Agent**.

**4. A Nouri device (ESP32):** `npm run device:issue -- nouri-001` prints the device's credential once; the device
sends WAV recordings to `POST /api/v1/voice`. Full contract: [`docs/hardware-api.md`](docs/hardware-api.md).

## AI and privacy

- **Claude** (`claude-opus-5-5`) writes replies, routes agent requests and drafts brief overviews (`ANTHROPIC_API_KEY`).
- **Speech-to-text:** ElevenLabs Scribe if `ELEVENLABS_API_KEY` is set, otherwise Whisper running locally.
- **Voice:** ElevenLabs if configured, otherwise the voices built into Windows.
- Keys live only in the server's `.env.local`, never on the device. Device and agent credentials are stored as hashes.

## Limitations (prototype)

Synthetic patients only; in-memory storage (restarting clears new entries); no password reset or clinician
verification workflow; family members see the whole patient page (per-item sharing is not enforced yet);
plain HTTP on the local network; the safety screen is pattern-based and not a complete safety system.
