![tag:innovationlab](https://img.shields.io/badge/innovationlab-3D8BD3)
![tag:hackathon](https://img.shields.io/badge/hackathon-5F43F1)

# Nouri Care Coordinator

Nouri is a gentle care companion for older adults living with diabetes. Talk to it like a friend.

**What it does**
- **Daily check-in:** tell Nouri how you slept, what you ate, how you feel, or a blood sugar reading. It writes
  down only what you actually said, shows it to you, and saves it to the care journal **only after you say yes**.
  The care team then sees it in the next visit summary.
- **Care reminders:** "Remind me to drink a glass of water every day at 3pm." Nouri's Planning Agent creates the
  reminder on the care schedule. It asks for a time if you didn't give one and never puts a medication dose in a
  reminder.

**How it works (step by step, every message)**
1. 🛡 Safety Agent checks your message: emergencies and medication-dose questions get a fixed safe reply.
2. 🧭 Coordinator works out what you want.
3. 💬 Companion Agent (check-ins, conversation) or 📅 Planning Agent (reminders) does the work.
4. 🛡 Safety Agent reviews the reply before it is sent.

Each reply ends with the steps that ran.

**Try**
- "I didn't sleep well last night and my blood sugar was 162 this morning." → then "yes"
- "Remind me to take my evening walk every day at 6pm."
- "Should I take more insulin tonight?" (Nouri won't decide doses)

**Limits:** a hackathon prototype using a synthetic demo patient ("Margaret"). Nouri is not a doctor, never
diagnoses or advises on doses, and never calls anyone; in an emergency, call 911.
