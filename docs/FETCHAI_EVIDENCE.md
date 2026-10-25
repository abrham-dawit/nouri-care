# Fetch.ai evidence: ASI:One → nouri-coordinator → stored reminder

Captured 2026-10-25 (Cal Hacks 13.0). Synthetic demo patient ("Margaret", `demo-patient-001`).

## Conversation (in the registered nouri-coordinator chat in ASI:One)

Chat link: `https://asi1.ai/ai/agent1qwqjh2cw8ugymjq0rfjvffnk3n3r08quxdn6pzt46cd2xzr0jkx3j8hcjjt`

1. **User:** "Remind me to drink a glass of water every day."
   **Nouri:** "What time should I remind you to drink a glass of water?
   — Nouri agents: 🛡 Safety ✓ → 🧭 Coordinator: reminder → 📅 Planning: needs a time → 🛡 Safety ✓"
2. **User:** "8:15 AM every day, Pacific time."
   **Nouri:** expected "Done! I'll remind you every day at 8:15 AM: “Drink a glass of water”." with the trace line
   (screenshot from ASI:One to be attached).

## Coordinator log (Agent Chat Protocol messages via the Agentverse mailbox)

```
[nouri-coordinator]: message from agent1qw5w6pw96f…: @agent1qwqjh2cw8ugymjq0rfjvffnk3n3r08quxdn6pzt46cd2xzr0jkx3j8hcjjt Remind me to …
[nouri-safety]: input check: allowed=True emergency=False dosing=False
POST http://localhost:3000/api/v1/agent/route "HTTP/1.1 200 OK"
[nouri-safety]: output check: allowed=True emergency=False dosing=False

[nouri-coordinator]: message from agent1qw5w6pw96f…: @agent1qwqjh2cw8ugymjq0rfjvffnk3n3r08quxdn6pzt46cd2xzr0jkx3j8hcjjt 8:15 AM every …
[nouri-safety]: input check: allowed=True emergency=False dosing=False
POST http://localhost:3000/api/v1/agent/route "HTTP/1.1 200 OK"
POST http://localhost:3000/api/v1/reminders "HTTP/1.1 201 Created"
[nouri-planning]: created reminder rem-42a991e5 08:15 daily kind=hydration
[nouri-safety]: output check: allowed=True emergency=False dosing=False
```

`agent1qw5w6pw96f…` is the ASI:One user agent; `agent1qwqjh2cw8u…hcjjt` is the registered nouri-coordinator.

## Reminder read back from the Nouri backend (`GET /api/v1/reminders`)

```json
{
  "id": "rem-42a991e5",
  "patientId": "demo-patient-001",
  "title": "Drink a glass of water",
  "time": "08:15",
  "time_label": "8:15 AM",
  "repeat": "daily",
  "kind": "hydration",
  "createdBy": "nouri-planning",
  "createdAt": "2026-10-25T15:19:55.656Z"
}
```

Agentverse listing at capture time: `status=active, type=mailbox, interactions=13`.

## What this does and doesn't show

- ✅ The message from ASI:One reached the registered Coordinator through the Agentverse mailbox (Agent Chat Protocol).
- ✅ The Coordinator ran its fixed workflow: Safety → route → Planning → Safety, on both turns.
- ✅ The second turn kept the hydration intent (the Coordinator remembers the pending reminder per conversation).
- ✅ A real reminder record was created by the Planning Agent and stored in the backend, readable by ID.
- ⚠️ The time is stored as the patient's local time ("08:15"); there is no separate time-zone field (the demo runs on
  Pacific time).
- ⚠️ The reminder is stored on the patient's care schedule; delivering it at 8:15 (a notification or a spoken
  prompt on the device) is not built yet.
- ⚠️ Storage is in memory: restarting the backend clears it.
