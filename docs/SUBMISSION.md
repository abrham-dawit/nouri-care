# Nouri Care: Cal Hacks 13.0 submission materials

## Devpost

**Tagline:** A gentle care companion that listens to older adults with diabetes, and turns what they say into a
visit summary their doctor can trust.

### Inspiration
Between doctor visits, older adults living with diabetes manage alone: blood sugar, sleep, meals, medications. The
details that matter most get lost by the next appointment, and many patients are lonely. We wanted a companion that
is warm to talk to, and also careful enough to be trusted with health information.

### What it does
- **Talk to Nouri:** the patient talks to Nouri (web companion today; a small ESP32 robot is in progress), and Nouri
  answers kindly in 1–2 short sentences.
- **Daily check-ins:** when the patient mentions sleep, meals, water, symptoms or a blood-sugar reading, Nouri writes
  down only what they actually said, quoting their words, and asks **"Should I save it?"** Nothing is saved
  until they say yes.
- **Doctor dashboard:** confirmed check-ins appear labelled "patient report", next to trends across all patients.
- **Reviewable visit brief:** Nouri drafts a summary for the clinician. Every sentence cites the observations it comes
  from, and the brief stays *pending review* until a clinician approves it.
- **Safety on every step:** emergencies get a fixed "call 911" reply; medication-dose questions get a fixed "ask your
  care team" reply; Nouri never diagnoses and never calls anyone.
- **Role-based logins:** patients, family members and clinicians each see only what they're allowed to.
- **Simulated device mode:** a clearly labelled `/simulator` page runs the exact device pipeline from typed text, so
  the full workflow can be demonstrated without hardware.

### How we built it
- **Backend and website:** Next.js 16 (App Router, Cache Components), TypeScript, Tailwind.
- **Claude** (`claude-opus-5-5`) with structured outputs writes Nouri's replies, extracts observations and drafts
  brief overviews. A Data Quality step drops anything not in the patient's exact words, and numbers must appear in
  what they said.
- **Orchestration:** every message runs an ordered, recorded workflow (Orchestrator → Memory → Conversation →
  Sleep/Meal/Symptom/Glucose → Data Quality → Emergency → Safety → patient confirmation; then Timeline →
  Doctor Report → Clinical Evidence → Safety).
- **Fetch.ai:** a Coordinator uAgent registered on Agentverse (mailbox, Agent Chat Protocol) runs Safety → routing →
  Companion or Planning → Safety, with typed messages between four uAgents. It is discoverable in ASI:One, and a
  reminder requested from ASI:One was created and stored by Nouri's Planning Agent.
- **Device API:** an ESP32-S3 sends 16 kHz WAV recordings; the server transcribes them (Whisper locally), runs the
  same conversation pipeline, and returns a 16 kHz WAV reply (Windows voices; ElevenLabs is supported when a key is
  configured).
- **Hardware:** Waveshare ESP32-S3 Touch LCD 1.85 in a 3D-printed enclosure we designed.

### Challenges
Venue Wi-Fi isolating devices and dropping connections; connecting a local mailbox agent to Agentverse; keeping
spoken replies short enough to feel conversational; and designing a confirmation step that is safe without being
annoying (Nouri only asks when real health information was mentioned).

### What we're proud of
The full care loop works in the web app: a patient tells Nouri how they're doing, hears a kind reply, says "yes",
and the doctor's dashboard and visit brief update, with every number traceable to the patient's own words.

### What's next
Finishing the robot's live conversation loop, persistent
storage, clinician verification and per-item sharing for family, reminders delivered on the device, and reviewed
translations of the safety messages.

### Built with
Next.js, TypeScript, Tailwind CSS, Claude (Anthropic API), Fetch.ai uAgents, Agentverse, ASI:One, Whisper
(transformers.js), ESP32-S3, Arduino, 3D printing. ElevenLabs supported (not configured in this demo).

## Verification status (honest)

| Item | Status |
|---|---|
| Next.js patient workflow: statement → Claude reply → pending observations → confirmation → saved → doctor dashboard → source-grounded brief | ✅ Verified |
| `/simulator` (labelled simulated device, same backend pipeline) | ✅ Verified |
| Agentverse mailbox: Agent Chat Protocol message delivered, acknowledged and answered by nouri-coordinator after Safety → Planning → Safety | ✅ Verified (test sender agent, via Agentverse) |
| Nouri listed on Agentverse and discoverable in ASI:One (agent page, search) | ✅ Verified |
| A conversation started directly in ASI:One executing nouri-coordinator | ✅ Verified 2026-10-25 08:19 PDT: from ASI:One ("Remind me to drink a glass of water every day" → "8:15 AM every day") the Coordinator ran Safety → route → Planning → Safety and stored reminder `rem-42a991e5` (8:15 AM daily, hydration) in the backend |
| Physical ESP32 live conversation | ❌ Not verified (pending the hardware team's confirmation) |
| ElevenLabs voice / speech-to-text | ⚠️ Supported integration; API key not configured |

## Demo script (3–4 minutes)

1. **Intro (15 s).** Open `http://localhost:3000/?intro`: Nouri wakes up, then the login page.
2. **Patient (60 s).** Log in as `margaret`, open **`/simulator`** (labelled *Simulated device*). Send: *"I didn't sleep
   well last night, maybe four hours, and my sugar was 148 before breakfast."* Nouri replies kindly and asks
   *"Should I save it?"* Click **Patient says yes**.
3. **The agents (30 s).** Show the ordered step list, including Data Quality quoting the patient's words.
4. **The doctor (60 s).** Log in as `dr.raman` → **Dashboard**: Margaret shows *"new from conversations"*. Open her
   record → the new visit brief, *pending review*, with each overview sentence citing its sources.
5. **Safety (20 s).** Send *"Should I take more insulin tonight?"* → the fixed safe reply.
6. **Fetch.ai (30 s).** Show nouri-coordinator on Agentverse (Active, ASI Available, Mailbox, README) and the agent
   code; explain the ordered Safety → route → specialist → Safety workflow.

## Known limitations
- All patients are synthetic; storage is in memory (a server restart clears new entries).
- The physical robot's live conversation is not yet verified.
- ElevenLabs is supported but not configured; the demo uses local Whisper and Windows voices (about 7–8 s per voice turn).
- No password reset or clinician-verification workflow; family members see the whole patient page.
- The device API uses plain HTTP on a local hotspot; venue Wi-Fi interruptions break the AI step (Nouri then says so).
- The safety screen is pattern-based plus the model's own flags: a demo, not a complete medical safety system.
