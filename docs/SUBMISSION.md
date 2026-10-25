# Nouri Care: Cal Hacks 13.0 submission materials

## Devpost

**Tagline:** A gentle robot companion that listens to older adults with diabetes, and turns what they say into a
visit summary their doctor can trust.

### Inspiration
Between doctor visits, older adults living with diabetes manage alone: blood sugar, sleep, meals, medications. The
details that matter most get lost by the next appointment, and many patients are lonely. We wanted a companion that
is warm to talk to, and also careful enough to be trusted with health information.

### What it does
- **Talk to Nouri:** a small ESP32 robot (or the web companion) listens, and Nouri answers out loud in a calm voice.
- **Daily check-ins:** when the patient mentions sleep, meals, water, symptoms or a blood-sugar reading, Nouri writes
  down only what they actually said, quoting their words, and asks **"Should I save it?"** Nothing is saved
  until they say yes.
- **Doctor dashboard:** confirmed check-ins appear labelled "patient report", next to trends across all patients.
- **Reviewable visit brief:** Nouri drafts a summary for the clinician. Every sentence cites the observations it comes
  from, and the brief stays *pending review* until a clinician approves it.
- **Care reminders from ASI:One:** through Fetch.ai, a family member can ask Nouri to set a reminder ("remind Mom to
  drink water every day at 3pm"). Nouri asks for a time if none was given, and never stores a medication dose.
- **Safety on every step:** emergencies get a fixed "call 911" reply; medication-dose questions get a fixed "ask your
  care team" reply; Nouri never diagnoses.
- **Role-based logins:** patients, family members and clinicians each see only what they're allowed to.

### How we built it
- **Backend and website:** Next.js 16 (App Router, Cache Components), TypeScript, Tailwind.
- **Claude** (`claude-opus-5-5`) with structured outputs writes Nouri's replies, extracts observations and drafts
  brief overviews. A Data Quality step drops anything not in the patient's exact words, and numbers must appear in
  what they said.
- **Orchestration:** every message runs an ordered, recorded workflow (Orchestrator → Memory → Conversation →
  Sleep/Meal/Symptom/Glucose → Data Quality → Emergency → Safety → patient confirmation; then Timeline →
  Doctor Report → Clinical Evidence → Safety).
- **Fetch.ai:** a Coordinator uAgent on Agentverse speaks the Agent Chat Protocol and runs Safety → routing →
  Companion or Planning → Safety, with typed messages between four uAgents.
- **Voice:** the ESP32-S3 records 16 kHz WAV; the server transcribes it (ElevenLabs Scribe, or Whisper locally),
  runs the conversation, and returns a 16 kHz WAV reply (ElevenLabs, or Windows voices offline).
- **Hardware:** Waveshare ESP32-S3 Touch LCD 1.85 in a 3D-printed enclosure we designed.

### Challenges
Venue Wi-Fi isolating devices and dropping connections; making a mailbox agent reachable from Agentverse; keeping
spoken replies short enough to feel conversational; and designing a confirmation step that is safe without being
annoying (Nouri only asks when real health information was mentioned).

### What we're proud of
The whole loop works: a patient says something to a physical robot, hears a kind reply, says "yes", and the doctor's
dashboard and visit brief update, with every number traceable to the patient's own words.

### What's next
Persistent storage, clinician verification and per-item sharing for family, reminders delivered on the device, and
reviewed translations of the safety messages for more languages.

### Built with
Next.js, TypeScript, Tailwind CSS, Claude (Anthropic API), Fetch.ai uAgents, Agentverse, ASI:One, ElevenLabs,
Whisper (transformers.js), ESP32-S3, Arduino, 3D printing.

## Demo script (3–4 minutes)

1. **Intro (15 s).** Open `http://localhost:3000/?intro`: Nouri wakes up, then the login page.
2. **The robot (60 s).** Tap Nouri's face. Say: *"I didn't sleep well last night, maybe four hours, and my sugar was
   148 before breakfast."* Nouri replies kindly and asks *"Should I save it?"* Say *"Yes."* Nouri: *"Saved."*
   - No hardware? Log in as `margaret`, open **`/simulator`** (labelled *Simulated device*), send the same sentence,
     click **Patient says yes**.
3. **The agents (30 s).** Show the ordered step list on the simulator, or **Agents** as `dr.raman`: each agent's step,
   in order, with the Data Quality check quoting the patient's words.
4. **The doctor (60 s).** Log in as `dr.raman` → **Dashboard**: Margaret shows *"new from conversations"*. Open her
   record → the new visit brief, *pending review*, with each overview sentence citing its sources.
5. **Safety (20 s).** Say or type *"Should I take more insulin tonight?"* → the fixed safe reply.
6. **Fetch.ai (30 s).** Agentverse → nouri-coordinator → **Chat with Agent**: *"Remind me to drink a glass of water
   every day"* → *"What time?"* → *"3pm"* → *"Done!"*, ending with the agent trace line.

## Working features (verified)
- Website, intro (plays or can be skipped), logins by role, doctor dashboard, patient records, agents page.
- Full workflow: statement → Claude reply → pending observations → confirmation → saved → dashboard → brief.
- Simulated device mode (`/simulator`), same pipeline as the device API.
- ESP32 voice round trip (`POST /api/v1/voice` → WAV reply), spoken "yes"/"no" confirmation.
- Fetch.ai Coordinator: Agent Chat Protocol exchange through the Agentverse mailbox (message delivered, acknowledged,
  answered after running Safety → Planning → Safety); listed and found in Agentverse search.

## Known limitations
- All patients are synthetic; storage is in memory (a server restart clears new entries).
- A full conversation started from the ASI:One interface itself was not verified at the time of writing.
- No password reset or clinician-verification workflow; family members see the whole patient page.
- The device API uses plain HTTP on a local hotspot; venue Wi-Fi interruptions break the AI step (Nouri then says so).
- The safety screen is pattern-based plus the model's own flags: a demo, not a complete medical safety system.
- Turn latency is about 7–8 s with local speech; faster with ElevenLabs.
