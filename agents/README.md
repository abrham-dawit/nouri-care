![tag:innovationlab](https://img.shields.io/badge/innovationlab-3D8BD3)
![tag:hackathon](https://img.shields.io/badge/hackathon-5F43F1)

# Nouri agents (Fetch.ai uAgents)

Four uAgents that run Nouri Care's work in a fixed order. The **Nouri Coordinator** is registered on
Agentverse as a mailbox agent and speaks the **Agent Chat Protocol**. Verified: a Chat Protocol message sent through
Agentverse was delivered, acknowledged and answered. Nouri is listed and discoverable in **ASI:One**; a conversation
started directly in ASI:One has **not** been verified yet.

| Agent | Address | Role |
|---|---|---|
| `nouri-coordinator` | `agent1qwqjh2cw8ugymjq0rfjvffnk3n3r08quxdn6pzt46cd2xzr0jkx3j8hcjjt` | Chat Protocol entry point (Agentverse mailbox). Runs the steps below and keeps per-conversation state |
| `nouri-safety` | `agent1q0jqkmwpd7ex0krmjya93m4apqglunzm0ymzm0nqupcsu2qje5t4gts033c` | Checks every incoming message (emergency, dosing questions) and every outgoing reply |
| `nouri-companion` | `agent1qghaj8jam5gtezwtg3sjhclmuz6z8cmez3c7xe5e7jtezu5mf8g9sxyaymh` | Daily check-ins: writes down what the patient reports, saves it only after they say yes |
| `nouri-planning` | `agent1qdsq55ltpdpgyllhw35lg2wgwe35vpm8zsypx6tvzn7fs4r8m89v2qgsyr3` | Creates real reminders on the care schedule; asks for a time instead of guessing; never stores a dose |

(Addresses come from the seeds in `agents/.env`. A new seed means a new address, so update this table if you regenerate.)

## The order every message follows

```
ASI:One ──ChatMessage──▶ nouri-coordinator
   1. ChatAcknowledgement back to the sender
   2. nouri-safety     SafetyCheck(input)    → SafetyVerdict    emergency / dose question → fixed safe reply, stop
   3. coordinator      route the request     (Nouri backend; Claude decides check_in / reminder / confirm / chat)
   4. nouri-companion  CompanionRequest      → CompanionResult  (check-in, chat, save after "yes")
      or nouri-planning PlanRequest          → PlanResult       (reminder created, or "what time?")
   5. nouri-safety     SafetyCheck(output)   → SafetyVerdict    blocked → fixed safe reply
   6. ChatMessage reply, ending with the steps that ran
```

Specialists answer with exactly one typed result or an `AgentFailure` (`protocols.py`), and the Coordinator waits
for each step (`ctx.send_and_receive`) before starting the next.

**Keys:** the agents hold no AI keys. They call the Nouri Care backend (the Next.js app in this repo) with a
Nouri device credential; Claude and the safety rules run there.

## Run it

Needs Python 3.10+ (tested on 3.15) and the Nouri backend running (`npm run dev` in the repo root, with
`ANTHROPIC_API_KEY` in `.env.local` for Claude).

```powershell
cd agents
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python setup_env.py                          # creates agents/.env with the agent seeds (once)
```

Create the agents' backend credential (run in the repo root) and paste it into `agents/.env` as `NOURI_AGENT_TOKEN`:

```powershell
npm run device:issue -- fetch-coordinator
```

Test locally, without Agentverse (a test client sends Chat Protocol messages to the Coordinator):

```powershell
python test_chat.py
```

Run for real, in two terminals (or both at once with `python run.py`):

```powershell
python specialists.py    # Safety, Companion, Planning (port 8000)
python agent.py          # the Coordinator (port 8001), same layout as Fetch.ai's ASI:One example
```

| File | What it is |
|---|---|
| `agent.py` | The Coordinator, laid out like Fetch.ai's "ASI:One compatible uAgent" example: `Agent(mailbox=True)`, `Protocol(spec=chat_protocol_spec)`, `handle_message`, `handle_ack`, `include(publish_manifest=True)`, `run()` |
| `pipeline.py` | The step-by-step order `handle_message` runs (Safety → route → specialist → Safety) |
| `specialists.py` | The Safety, Companion and Planning agents |
| `protocols.py` | The typed messages between agents |

## Put it on Agentverse and ASI:One

1. With the agents running, open the **Agent inspector** link printed for `nouri-coordinator` (port 8001).
   In Chrome, allow **Local network access** for agentverse.ai when asked, or the inspector can't find the agent.
2. Click **Connect** → **Mailbox** and sign in to Agentverse. The log should say
   "Successfully registered as mailbox agent in Agentverse". (Or run `python connect_mailbox.py` with an
   Agentverse API key in `agents/.env` as `AGENTVERSE_API_KEY`.)
3. In Agentverse, open the agent's profile: set the name (e.g. "Nouri Care") and a handle, and check that the
   README from `AGENT_PROFILE.md` is shown. ASI:One uses it to decide when to route people to Nouri.
4. Click **Chat with Agent** to talk to Nouri in ASI:One.

Try:
- "I didn't sleep well last night and my blood sugar was 162 this morning." → "yes"
- "Remind me to drink a glass of water every day" → "3pm"
- "Should I take more insulin tonight?"

Keep the agents and the Nouri backend running while judges test it.
