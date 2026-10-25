/**
 * Synthetic demo patients. Every person, reading and quote here is fictional
 * and generated deterministically (seeded), so renders are stable and
 * reproducible. Nothing here is real patient data.
 */

import { buildVisitBrief } from "./brief";
import { isFuture, localISO } from "./time";
import type {
  Appointment,
  CheckIn,
  GlucoseContext,
  GlucoseReading,
  HydrationEntry,
  MealEntry,
  MealKind,
  Mood,
  Patient,
  PatientRecord,
  ReminderEvent,
  SleepEntry,
  SleepQuality,
  SymptomReport,
} from "./types";

export const DEMO_CLINICIAN = "Dr. Priya Raman";
const HISTORY_DAYS = 60;

/* ───────────── Seeded randomness ───────────── */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = ReturnType<typeof mulberry32>;
const pick = <T,>(rng: Rng, list: readonly T[]) => list[Math.floor(rng() * list.length)];
const gauss = (rng: Rng) => {
  const u = Math.max(1e-9, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ───────────── Shared phrasing ───────────── */

const SLEEP_QUOTES: Record<SleepQuality, string[]> = {
  poor: ["I kept waking up last night.", "I was up a lot with my thoughts.", "Couldn't get comfortable at all.", "I tossed and turned most of the night."],
  fair: ["I slept okay, woke up once or twice.", "Not bad, not great.", "I got some sleep, but not enough."],
  good: ["I slept like a baby!", "I had a good night's sleep.", "Feeling rested this morning.", "Slept right through."],
};

const MOOD_QUOTES: Record<Mood, string[]> = {
  good: ["I'm feeling good today.", "Lovely morning, I'm in good spirits.", "Pretty cheerful today!"],
  okay: ["I'm alright.", "Doing okay, a little slow today.", "Same as usual, I suppose."],
  low: ["Feeling a bit down today.", "It's been a lonely week.", "I'm not in the best mood."],
};

const GLUCOSE_OFFSET: Record<GlucoseContext, number> = {
  fasting: -14,
  before_meal: -4,
  after_meal: 34,
  bedtime: 10,
  unspecified: 0,
};

type GlucoseSlot = { context: GlucoseContext; time: [number, number] };

type PatientSeed = {
  seed: number;
  patient: Patient;
  glucose: { base: number; spread: number; trend: number; slots: GlucoseSlot[]; deviceShare: number; lows?: { daysAgo: number; slot: number; value: number }[] };
  sleep: { base: number; spread: number; overrides?: Record<number, { hours: number; quote?: string }> };
  moodBias: number;
  adherence: number;
  meals: Record<Exclude<MealKind, "snack">, string[]> & { snack: string[] };
  symptoms: (Omit<SymptomReport, "id" | "source" | "at"> & { daysAgo: number; time: [number, number] })[];
  appointments: (Omit<Appointment, "id" | "source" | "at" | "status"> & { daysAgo: number; time: [number, number] })[];
  briefs: { daysAgo: number; status: "pending_review" | "approved" }[];
};

const carePlanBase = (approvedDaysAgo: number) => ({
  source: "clinician_entry" as const,
  approvedBy: DEMO_CLINICIAN,
  approvedAt: localISO(approvedDaysAgo, 10, 30),
  glucoseTarget: { low: 80, high: 180, unit: "mg/dL" as const },
});

const SEEDS: PatientSeed[] = [
  {
    seed: 1001,
    patient: {
      id: "demo-patient-001",
      name: "Margaret Ellis",
      preferredName: "Margaret",
      pronouns: "she/her",
      age: 78,
      birthYear: 1948,
      location: "Oakland, CA",
      livingSituation: "Lives alone with her cat, Biscuit",
      conditions: ["Type 2 diabetes", "Hypertension"],
      deviceId: "nouri-001",
      primaryClinician: DEMO_CLINICIAN,
      enrolledAt: localISO(120, 10),
      caregivers: [
        { name: "Sarah Ellis", relationship: "Daughter", sharing: ["check_ins", "reminders", "glucose", "visit_summaries", "emergency"] },
        { name: "Tom Reyes", relationship: "Neighbor", sharing: ["emergency"] },
      ],
      carePlan: {
        ...carePlanBase(34),
        medications: [
          { name: "Metformin 500 mg", times: ["08:00", "18:00"], instructions: "Take with breakfast and dinner, as prescribed." },
          { name: "Lisinopril 10 mg", times: ["08:00"], instructions: "Once daily in the morning, as prescribed." },
        ],
        checkIns: ["Morning check-in at 9:00 AM", "Evening check-in at 8:00 PM"],
        goals: ["Walk 15 minutes after lunch", "Keep a regular bedtime", "Log a fasting reading each morning"],
        notes: "Prefers short, friendly reminders. Hard of hearing in the left ear; Nouri speaks a little slower.",
      },
      interests: ["Growing tomatoes", "Granddaughter Lily (age 9)", "Ella Fitzgerald records"],
    },
    glucose: {
      base: 138,
      spread: 16,
      trend: 16,
      deviceShare: 0.8,
      slots: [
        { context: "fasting", time: [7, 30] },
        { context: "after_meal", time: [13, 40] },
        { context: "bedtime", time: [21, 30] },
      ],
    },
    sleep: {
      base: 6.7,
      spread: 0.7,
      overrides: {
        0: { hours: 4.5, quote: "I didn't sleep well last night." },
        1: { hours: 5.0 },
        2: { hours: 5.5 },
        4: { hours: 5.0 },
      },
    },
    moodBias: 0.1,
    adherence: 0.9,
    meals: {
      breakfast: ["Oatmeal with blueberries", "Toast with peanut butter", "Scrambled eggs and toast", "Yogurt and a banana"],
      lunch: ["Turkey sandwich", "Tomato soup and crackers", "Leftover chicken and rice", "A salad with garden tomatoes"],
      dinner: ["Baked salmon and green beans", "Pasta with tomato sauce", "Chicken stew", "A frozen dinner"],
      snack: ["A cookie with tea", "An apple", "A handful of almonds"],
    },
    symptoms: [
      { daysAgo: 0, time: [9, 5], symptom: "Tiredness", severityReported: "mild", quote: "I'm a bit tired today. I didn't sleep well." },
      { daysAgo: 2, time: [15, 20], symptom: "Dizziness when standing", severityReported: "mild", quote: "I felt a little dizzy getting up from the couch this afternoon." },
      { daysAgo: 9, time: [20, 10], symptom: "Swollen ankles", severityReported: "mild", quote: "My ankles look a bit puffy tonight." },
    ],
    appointments: [
      { daysAgo: 34, time: [10, 0], kind: "Quarterly diabetes follow-up", clinician: DEMO_CLINICIAN, summary: "Reviewed recent readings. Continue current plan. Encouraged a short walk after lunch." },
      { daysAgo: -4, time: [10, 30], kind: "Diabetes follow-up", clinician: DEMO_CLINICIAN },
    ],
    briefs: [{ daysAgo: 0, status: "pending_review" }],
  },
  {
    seed: 2002,
    patient: {
      id: "demo-patient-002",
      name: "Walter Okafor",
      preferredName: "Walt",
      pronouns: "he/him",
      age: 82,
      birthYear: 1944,
      location: "Berkeley, CA",
      livingSituation: "Lives with his wife, Grace",
      conditions: ["Type 2 diabetes", "Osteoarthritis"],
      deviceId: "nouri-002",
      primaryClinician: DEMO_CLINICIAN,
      enrolledAt: localISO(150, 11),
      caregivers: [
        { name: "Grace Okafor", relationship: "Spouse", sharing: ["check_ins", "reminders", "glucose", "visit_summaries", "emergency"] },
        { name: "David Okafor", relationship: "Son", sharing: ["visit_summaries", "emergency"] },
      ],
      carePlan: {
        ...carePlanBase(20),
        medications: [
          { name: "Metformin 1000 mg", times: ["08:00", "20:00"], instructions: "Twice daily with meals, as prescribed." },
          { name: "Atorvastatin 20 mg", times: ["21:00"], instructions: "Once daily at bedtime, as prescribed." },
        ],
        checkIns: ["Morning check-in at 8:30 AM"],
        goals: ["Gentle knee exercises three times a week", "Fasting reading every morning"],
        notes: "Enjoys chatting about jazz. Grace often helps with readings.",
      },
      interests: ["Jazz trumpet", "Chess with his grandson", "Cooking jollof rice"],
    },
    glucose: {
      base: 126,
      spread: 12,
      trend: -8,
      deviceShare: 0.4,
      slots: [
        { context: "fasting", time: [7, 15] },
        { context: "after_meal", time: [19, 45] },
      ],
    },
    sleep: { base: 7.2, spread: 0.6 },
    moodBias: 0.35,
    adherence: 0.95,
    meals: {
      breakfast: ["Whole-wheat toast and eggs", "Oatmeal", "Akara with pap", "Bran cereal and milk"],
      lunch: ["Jollof rice with chicken", "Vegetable soup", "Tuna salad", "Bean stew"],
      dinner: ["Grilled fish and plantain", "Chicken and vegetables", "Okra soup", "Turkey meatballs"],
      snack: ["Peanuts", "An orange", "Crackers and cheese"],
    },
    symptoms: [
      { daysAgo: 5, time: [10, 15], symptom: "Knee pain", severityReported: "moderate", quote: "My knee's been aching on the stairs this week." },
    ],
    appointments: [
      { daysAgo: 20, time: [14, 0], kind: "Annual wellness visit", clinician: DEMO_CLINICIAN, summary: "Readings trending down. Knee exercises discussed. No plan changes." },
      { daysAgo: -11, time: [9, 0], kind: "Diabetes follow-up", clinician: DEMO_CLINICIAN },
    ],
    briefs: [{ daysAgo: 21, status: "approved" }],
  },
  {
    seed: 3003,
    patient: {
      id: "demo-patient-003",
      name: "Rosa Delgado",
      preferredName: "Rosa",
      pronouns: "she/her",
      age: 74,
      birthYear: 1952,
      location: "Fremont, CA",
      livingSituation: "Lives with her son's family",
      conditions: ["Type 2 diabetes (insulin-treated)", "Hypertension"],
      deviceId: "nouri-003",
      primaryClinician: DEMO_CLINICIAN,
      enrolledAt: localISO(90, 9),
      caregivers: [{ name: "Miguel Delgado", relationship: "Son", sharing: ["check_ins", "reminders", "glucose", "visit_summaries", "emergency"] }],
      carePlan: {
        ...carePlanBase(14),
        medications: [
          {
            name: "Insulin glargine",
            times: ["21:00"],
            instructions: "Dose exactly as prescribed by Dr. Raman. Nouri only reminds; it never suggests or changes doses.",
          },
          { name: "Amlodipine 5 mg", times: ["09:00"], instructions: "Once daily in the morning, as prescribed." },
        ],
        checkIns: ["Morning check-in at 8:00 AM", "Evening check-in at 9:30 PM"],
        goals: ["Readings before each meal and at bedtime", "Keep juice nearby, per the low-glucose plan"],
        notes: "Prefers check-ins in English with occasional Spanish phrases. Spanish voice support is planned.",
      },
      interests: ["Telenovelas", "Baking conchas", "Sunday rosary group"],
    },
    glucose: {
      base: 150,
      spread: 24,
      trend: 6,
      deviceShare: 0.9,
      slots: [
        { context: "fasting", time: [7, 0] },
        { context: "before_meal", time: [12, 0] },
        { context: "after_meal", time: [14, 10] },
        { context: "bedtime", time: [22, 0] },
      ],
      lows: [
        { daysAgo: 3, slot: 0, value: 64 },
        { daysAgo: 11, slot: 0, value: 68 },
      ],
    },
    sleep: { base: 6.9, spread: 0.8 },
    moodBias: 0.2,
    adherence: 0.82,
    meals: {
      breakfast: ["Huevos rancheros", "Toast and café con leche", "Oatmeal with cinnamon", "A concha and coffee"],
      lunch: ["Chicken tortilla soup", "Rice and beans", "Tamales", "Chicken salad"],
      dinner: ["Carne asada and vegetables", "Pozole", "Enchiladas", "Grilled chicken and rice"],
      snack: ["A small glass of juice", "Fruit cup", "Crackers"],
    },
    symptoms: [
      { daysAgo: 3, time: [7, 20], symptom: "Shakiness before breakfast", severityReported: "moderate", quote: "I felt shaky before breakfast, so I had some juice like the plan says." },
      { daysAgo: 11, time: [7, 25], symptom: "Shakiness before breakfast", severityReported: "mild", quote: "A little shaky this morning, juice helped." },
      { daysAgo: 6, time: [21, 40], symptom: "Night sweats", severityReported: "mild", quote: "I woke up sweaty last night." },
    ],
    appointments: [
      { daysAgo: 14, time: [11, 0], kind: "Endocrinology consult", clinician: "Dr. Alan Chu", summary: "Insulin plan reviewed and documented by endocrinology. Continue logging fasting readings." },
      { daysAgo: -2, time: [13, 30], kind: "Diabetes follow-up", clinician: DEMO_CLINICIAN },
    ],
    briefs: [{ daysAgo: 0, status: "pending_review" }],
  },
  {
    seed: 4004,
    patient: {
      id: "demo-patient-004",
      name: "Harold Kim",
      preferredName: "Harold",
      pronouns: "he/him",
      age: 86,
      birthYear: 1940,
      location: "San Leandro, CA",
      livingSituation: "Lives alone; daughter visits on Sundays",
      conditions: ["Hypertension", "Prediabetes"],
      deviceId: "nouri-004",
      primaryClinician: DEMO_CLINICIAN,
      enrolledAt: localISO(70, 15),
      caregivers: [{ name: "Jenny Kim", relationship: "Daughter", sharing: ["check_ins", "reminders", "emergency"] }],
      carePlan: {
        ...carePlanBase(45),
        medications: [{ name: "Losartan 50 mg", times: ["08:00"], instructions: "Once daily in the morning, as prescribed." }],
        checkIns: ["Morning check-in at 9:30 AM", "Evening chat at 7:00 PM"],
        goals: ["Fasting reading twice a week", "Daily conversation with Nouri or family"],
        notes: "Widowed last year. Responds well to conversation about music and his late wife June's garden.",
      },
      interests: ["Classical piano", "Oakland A's memories", "June's rose garden"],
    },
    glucose: {
      base: 106,
      spread: 8,
      trend: 2,
      deviceShare: 1,
      slots: [{ context: "fasting", time: [7, 45] }],
    },
    sleep: { base: 7.5, spread: 0.6 },
    moodBias: -0.3,
    adherence: 0.72,
    meals: {
      breakfast: ["Rice porridge", "Toast and tea", "A boiled egg and fruit"],
      lunch: ["Kimchi fried rice", "Noodle soup", "A sandwich from the deli"],
      dinner: ["Doenjang stew", "Grilled mackerel and rice", "Leftover bulgogi", "Soup his daughter dropped off"],
      snack: ["Persimmon", "Rice crackers"],
    },
    symptoms: [{ daysAgo: 1, time: [10, 0], symptom: "Headache", severityReported: "mild", quote: "Bit of a headache this morning." }],
    appointments: [
      { daysAgo: 45, time: [9, 30], kind: "Blood pressure check", clinician: DEMO_CLINICIAN, summary: "Blood pressure stable on current dose. Encouraged social activity." },
      { daysAgo: -18, time: [10, 0], kind: "Routine follow-up", clinician: DEMO_CLINICIAN },
    ],
    briefs: [],
  },
  {
    seed: 5005,
    patient: {
      id: "demo-patient-005",
      name: "Evelyn Brooks",
      preferredName: "Evie",
      pronouns: "she/her",
      age: 80,
      birthYear: 1946,
      location: "Richmond, CA",
      livingSituation: "Lives alone; grandson stops by most evenings",
      conditions: ["Type 2 diabetes", "Mild cognitive impairment"],
      deviceId: "nouri-005",
      primaryClinician: DEMO_CLINICIAN,
      enrolledAt: localISO(100, 12),
      caregivers: [{ name: "Marcus Brooks", relationship: "Grandson", sharing: ["check_ins", "reminders", "glucose", "visit_summaries", "emergency"] }],
      carePlan: {
        ...carePlanBase(28),
        medications: [
          { name: "Metformin 500 mg", times: ["08:00", "18:00"], instructions: "Take with breakfast and dinner, as prescribed." },
          { name: "Donepezil 5 mg", times: ["21:00"], instructions: "Once daily at bedtime, as prescribed." },
        ],
        checkIns: ["Morning check-in at 9:00 AM", "Evening check-in at 7:30 PM"],
        goals: ["Fasting reading each morning", "Weekly choir practice"],
        notes: "Repeat reminders gently and kindly. Marcus confirms evening medication when visiting.",
      },
      interests: ["Church choir", "Crossword puzzles", "Motown, especially the Supremes"],
    },
    glucose: {
      base: 146,
      spread: 18,
      trend: 10,
      deviceShare: 0.3,
      slots: [
        { context: "fasting", time: [8, 15] },
        { context: "after_meal", time: [19, 0] },
      ],
    },
    sleep: { base: 6.3, spread: 0.9 },
    moodBias: 0.15,
    adherence: 0.84,
    meals: {
      breakfast: ["Grits and an egg", "Cornflakes", "Toast with jam", "Oatmeal"],
      lunch: ["Chicken noodle soup", "Ham sandwich", "Collard greens and cornbread", "Leftover meatloaf"],
      dinner: ["Baked chicken and sweet potato", "Fish and greens", "Red beans and rice", "Spaghetti"],
      snack: ["A piece of pound cake", "Peanut butter crackers", "Grapes"],
    },
    symptoms: [
      { daysAgo: 4, time: [20, 30], symptom: "Unsure whether evening medication was taken", severityReported: "mild", quote: "I couldn't remember if I took my evening pill." },
      { daysAgo: 13, time: [9, 10], symptom: "Thirst", severityReported: "mild", quote: "I've been so thirsty lately." },
    ],
    appointments: [
      { daysAgo: 28, time: [13, 0], kind: "Memory and diabetes review", clinician: DEMO_CLINICIAN, summary: "Discussed medication routine with Marcus present. Continue current plan." },
      { daysAgo: -7, time: [11, 0], kind: "Diabetes follow-up", clinician: DEMO_CLINICIAN },
    ],
    briefs: [{ daysAgo: 1, status: "pending_review" }],
  },
  {
    seed: 6006,
    patient: {
      id: "demo-patient-006",
      name: "Frank Moretti",
      preferredName: "Frank",
      pronouns: "he/him",
      age: 76,
      birthYear: 1950,
      location: "Alameda, CA",
      livingSituation: "Lives with his wife, Lucia",
      conditions: ["Type 2 diabetes", "Recovering from hip replacement"],
      deviceId: "nouri-006",
      primaryClinician: DEMO_CLINICIAN,
      enrolledAt: localISO(55, 10),
      caregivers: [{ name: "Lucia Moretti", relationship: "Spouse", sharing: ["check_ins", "reminders", "glucose", "visit_summaries", "emergency"] }],
      carePlan: {
        ...carePlanBase(10),
        medications: [{ name: "Metformin 850 mg", times: ["08:00", "20:00"], instructions: "Twice daily with meals, as prescribed." }],
        checkIns: ["Morning check-in at 8:00 AM", "Physical-therapy reminder at 3:00 PM"],
        goals: ["Physical-therapy exercises daily", "Short walks with a walker, increasing slowly"],
        notes: "Six weeks after hip replacement. Orthopedics manages recovery; this plan covers diabetes and check-ins.",
      },
      interests: ["San Francisco Giants", "Making tomato sauce", "Bocce with friends"],
    },
    glucose: {
      base: 132,
      spread: 14,
      trend: -10,
      deviceShare: 0.85,
      slots: [
        { context: "fasting", time: [7, 10] },
        { context: "after_meal", time: [13, 15] },
        { context: "bedtime", time: [22, 15] },
      ],
    },
    sleep: { base: 6.8, spread: 0.7 },
    moodBias: 0.25,
    adherence: 0.93,
    meals: {
      breakfast: ["Eggs and whole-wheat toast", "Greek yogurt", "Oatmeal with walnuts"],
      lunch: ["Minestrone", "Turkey sandwich", "Pasta e fagioli", "Caprese salad"],
      dinner: ["Chicken cacciatore", "Grilled fish and vegetables", "Whole-wheat spaghetti", "Lentil soup"],
      snack: ["An orange", "Biscotti", "A few olives"],
    },
    symptoms: [
      { daysAgo: 1, time: [16, 0], symptom: "Hip soreness after exercises", severityReported: "mild", quote: "The hip's a bit sore after my exercises today." },
      { daysAgo: 7, time: [15, 30], symptom: "Hip soreness after exercises", severityReported: "moderate", quote: "Exercises were tough today, the hip is sore." },
    ],
    appointments: [
      { daysAgo: 10, time: [9, 0], kind: "Post-op orthopedic check", clinician: "Dr. Sam Whitfield", summary: "Healing as expected. Continue physical therapy." },
      { daysAgo: -9, time: [14, 30], kind: "Diabetes follow-up", clinician: DEMO_CLINICIAN },
    ],
    briefs: [{ daysAgo: 10, status: "approved" }],
  },
];

/* ───────────── Generation ───────────── */

function generate(seed: PatientSeed): PatientRecord {
  const rng = mulberry32(seed.seed);
  const { patient } = seed;
  const pid = patient.id;
  const glucose: GlucoseReading[] = [];
  const sleep: SleepEntry[] = [];
  const meals: MealEntry[] = [];
  const hydration: HydrationEntry[] = [];
  const reminders: ReminderEvent[] = [];
  const checkIns: CheckIn[] = [];

  for (let d = HISTORY_DAYS - 1; d >= 0; d--) {
    const recency = 1 - d / (HISTORY_DAYS - 1); // 0 → 1 as we approach today
    const happened = (at: string) => !isFuture(at);

    // Glucose: readings at the patient's usual times; occasionally skipped.
    seed.glucose.slots.forEach((slot, i) => {
      const at = localISO(d, slot.time[0], slot.time[1] + Math.floor(rng() * 20) - 10);
      const skip = rng() < 0.08;
      if (!happened(at) || skip) return;
      const low = seed.glucose.lows?.find((l) => l.daysAgo === d && l.slot === i);
      const value = low
        ? low.value
        : Math.round(clamp(seed.glucose.base + seed.glucose.trend * recency + GLUCOSE_OFFSET[slot.context] + gauss(rng) * seed.glucose.spread, 84, 320));
      glucose.push({
        id: `${pid}-glu-${d}-${i}`,
        at,
        value,
        unit: "mg/dL",
        context: slot.context,
        source: rng() < seed.glucose.deviceShare ? "device_reading" : "patient_report",
      });
    });

    // Sleep: reported during the morning check-in.
    const sleepAt = localISO(d, 8, 40 + Math.floor(rng() * 30));
    if (happened(sleepAt) && rng() > 0.08) {
      const override = seed.sleep.overrides?.[d];
      const hours = override?.hours ?? Math.round(clamp(seed.sleep.base + gauss(rng) * seed.sleep.spread, 3.5, 9.5) * 2) / 2;
      const quality: SleepQuality = hours < 5.5 ? "poor" : hours < 6.75 ? "fair" : "good";
      sleep.push({ id: `${pid}-slp-${d}`, at: sleepAt, hoursReported: hours, quality, quote: override?.quote ?? pick(rng, SLEEP_QUOTES[quality]), source: "patient_report" });
    }

    // Check-ins: mood in the patient's words.
    (["morning", "evening"] as const).forEach((kind) => {
      const at = kind === "morning" ? localISO(d, 9, Math.floor(rng() * 25)) : localISO(d, 19, 30 + Math.floor(rng() * 25));
      if (!happened(at) || rng() < 0.06) return;
      const r = rng() + seed.moodBias * 0.6;
      const mood: Mood = r > 0.55 ? "good" : r > 0.18 ? "okay" : "low";
      checkIns.push({ id: `${pid}-chk-${d}-${kind}`, at, kind, mood, quote: pick(rng, MOOD_QUOTES[mood]), source: "patient_report" });
    });

    // Meals and hydration, as described by the patient.
    const mealTimes: [MealKind, number, number][] = [
      ["breakfast", 8, 0],
      ["lunch", 12, 30],
      ["dinner", 18, 30],
    ];
    if (rng() < 0.35) mealTimes.push(["snack", 15, 30]);
    mealTimes.forEach(([meal, h, m]) => {
      const at = localISO(d, h, m + Math.floor(rng() * 40));
      if (!happened(at) || rng() < 0.12) return;
      const entry: MealEntry = { id: `${pid}-meal-${d}-${meal}`, at, meal, description: pick(rng, seed.meals[meal]), source: "patient_report" };
      if (rng() < 0.45) entry.aiCalorieEstimate = { kcal: Math.round((meal === "snack" ? 120 + rng() * 150 : 280 + rng() * 380) / 10) * 10, source: "ai_estimate" };
      meals.push(entry);
    });
    const hydrationAt = localISO(d, 20, 5);
    if (happened(hydrationAt) && rng() > 0.1) {
      hydration.push({ id: `${pid}-h2o-${d}`, at: hydrationAt, glasses: Math.round(clamp(5.5 + gauss(rng) * 1.4, 2, 9)), source: "patient_report" });
    }

    // Medication reminders: Nouri logs whether the patient acknowledged.
    patient.carePlan.medications.forEach((med, mi) => {
      med.times.forEach((time, ti) => {
        const [hh, mm] = time.split(":").map(Number);
        const at = localISO(d, hh, mm);
        if (!happened(at)) return;
        const r = rng();
        const miss = 1 - seed.adherence;
        const response = r < seed.adherence ? "acknowledged" : r < seed.adherence + miss * 0.45 ? "snoozed" : "no_response";
        const event: ReminderEvent = { id: `${pid}-rem-${d}-${mi}-${ti}`, at, medication: med.name, response, source: "device_reading" };
        if (response !== "no_response") event.respondedAt = localISO(d, hh, mm + (response === "acknowledged" ? 1 + Math.floor(rng() * 5) : 10));
        reminders.push(event);
      });
    });
  }

  const symptoms: SymptomReport[] = seed.symptoms
    .map((s, i) => ({
      id: `${pid}-sym-${i}`,
      at: localISO(s.daysAgo, s.time[0], s.time[1]),
      symptom: s.symptom,
      severityReported: s.severityReported,
      quote: s.quote,
      source: "patient_report" as const,
    }))
    .filter((s) => !isFuture(s.at));

  const appointments: Appointment[] = seed.appointments.map((a, i) => {
    const at = localISO(a.daysAgo, a.time[0], a.time[1]);
    return {
      id: `${pid}-apt-${i}`,
      at,
      kind: a.kind,
      clinician: a.clinician,
      summary: a.summary,
      status: isFuture(at) ? "scheduled" : "completed",
      source: "clinician_entry",
    };
  });

  const sortDesc = <T extends { at: string }>(list: T[]) => list.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const record: PatientRecord = {
    patient,
    glucose: sortDesc(glucose),
    sleep: sortDesc(sleep),
    meals: sortDesc(meals),
    hydration: sortDesc(hydration),
    reminders: sortDesc(reminders),
    symptoms: sortDesc(symptoms),
    checkIns: sortDesc(checkIns),
    appointments: sortDesc(appointments),
    briefs: [],
  };
  record.briefs = seed.briefs.map((b) => buildVisitBrief(record, { createdDaysAgo: b.daysAgo, status: b.status, reviewer: DEMO_CLINICIAN }));
  return record;
}

let cache: PatientRecord[] | null = null;

/** All synthetic patient records (generated once per process). */
export function getAllRecords(): PatientRecord[] {
  cache ??= SEEDS.map(generate);
  return cache;
}

export function getRecord(id: string): PatientRecord | undefined {
  return getAllRecords().find((r) => r.patient.id === id);
}

/**
 * A copy of the record limited to the last `days` days, for sending to the
 * browser. Visit briefs stay intact (their sources fall inside the window).
 */
export function recentRecord(record: PatientRecord, days = 31): PatientRecord {
  const since = Date.parse(localISO(days - 1, 0));
  const keep = <T extends { at: string }>(list: T[]) => list.filter((e) => Date.parse(e.at) >= since);
  return {
    ...record,
    glucose: keep(record.glucose),
    sleep: keep(record.sleep),
    meals: keep(record.meals),
    hydration: keep(record.hydration),
    reminders: keep(record.reminders),
    symptoms: keep(record.symptoms),
    checkIns: keep(record.checkIns),
    appointments: record.appointments,
  };
}

export function getPatientIds() {
  return SEEDS.map((s) => s.patient.id);
}
