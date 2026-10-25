![tag:innovationlab](https://img.shields.io/badge/innovationlab-3D8BD3)
![tag:hackathon](https://img.shields.io/badge/hackathon-5F43F1)

# Nouri Care

A gentle AI care companion for older adults living with diabetes, built at Cal Hacks 13.0. Patients talk to
**Nouri** (a small ESP32 robot, the web companion, or ASI:One). Nouri runs daily check-ins and reminders, and
turns what the patient says into a reviewable, source-linked visit brief for their care team.

**Safety first:** Nouri never diagnoses, never decides or repeats medication doses, saves nothing the patient
hasn't confirmed, and never calls anyone (emergencies get a fixed "call 911" reply). All patient data in this
repo is synthetic.

## Pieces

| Part | Where | What it does |
|---|---|---|
| Web app + backend | `app/`, `lib/` (Next.js) | Dashboards, companion chat, visit briefs, agent traces, device API |
| Fetch.ai agents | [`agents/`](agents/README.md) | Nouri Coordinator on Agentverse (Agent Chat Protocol, usable in ASI:One) plus Safety, Companion and Planning agents, run in a fixed order |
| Device API | [`docs/hardware-api.md`](docs/hardware-api.md) | ESP32 uploads a WAV → transcript → Claude → spoken 16 kHz WAV reply |
| Enclosure | `hardware/` | 3D-printable front and back case |

**AI:** Claude (`ANTHROPIC_API_KEY`) writes Nouri's replies, routes agent requests and drafts brief overviews.
Speech-to-text runs locally (Whisper) and replies are spoken with Windows voices, so no other keys are needed.

## Fetch.ai agents

| Agent | Address |
|---|---|
| `nouri-coordinator` (Agentverse, Chat Protocol) | `agent1qwqjh2cw8ugymjq0rfjvffnk3n3r08quxdn6pzt46cd2xzr0jkx3j8hcjjt` |
| `nouri-safety` | `agent1q0jqkmwpd7ex0krmjya93m4apqglunzm0ymzm0nqupcsu2qje5t4gts033c` |
| `nouri-companion` | `agent1qghaj8jam5gtezwtg3sjhclmuz6z8cmez3c7xe5e7jtezu5mf8g9sxyaymh` |
| `nouri-planning` | `agent1qdsq55ltpdpgyllhw35lg2wgwe35vpm8zsypx6tvzn7fs4r8m89v2qgsyr3` |

Setup, the step order and how to connect to Agentverse: [`agents/README.md`](agents/README.md).

## Run

```powershell
npm install
copy .env.example .env.local     # then add ANTHROPIC_API_KEY
npm run dev                      # http://localhost:3000  (for devices on Wi-Fi: npm run dev -- -H 0.0.0.0)
```

Then start the agents (see `agents/README.md`) and/or connect a Nouri device (see `docs/hardware-api.md`).
