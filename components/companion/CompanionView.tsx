"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, SendHorizontal, Sparkles, Square, Volume2, X } from "lucide-react";
import { providerLabel, type AIProvider } from "@/lib/ai/labels";
import { useMe } from "@/lib/auth/use-me";
import { getLanguage, LANGUAGES, languageTag, NOURI_INTRO, SAMPLE_GREETING } from "@/lib/voice/languages";
import { rememberedVoice, speak, stopSpeaking, useVoices, voicesFor } from "@/lib/voice/speech";
import { useVoicePreferences } from "@/lib/voice/use-preferences";
import { HeroNouri } from "@/components/nouri/HeroNouri";
import { describeObservation, OBSERVATION_JOURNAL, type ProposedObservation } from "@/lib/journal/observations";
import { announceJournalChange } from "@/lib/journal/live-client";
import type { StepTrace } from "@/lib/orchestration/workflows";

type PatientOption = { id: string; name: string; preferredName: string };
type TurnStatus = "awaiting_confirmation" | "saved" | "dismissed" | "nothing_to_save";
type Turn = {
  id: string;
  reply: string;
  replyEnglish: string;
  language: { code: string; region: string | null };
  replyLanguage: { code: string; region: string | null };
  languageNote?: string;
  observations: ProposedObservation[];
  provider: AIProvider;
  model: string | null;
  fallbackReason?: string;
  status: TurnStatus;
  savedObservationIds: string[];
  safety: { emergency: string | null };
};
type Message =
  | { role: "user"; content: string; id: string }
  | { role: "assistant"; content: string; id: string; turn?: Turn; steps?: StepTrace[]; confirmSteps?: StepTrace[] };

type AIStatus = { provider: AIProvider; model: string | null };

const SUGGESTIONS = [
  "I didn't sleep well last night.",
  "I had oatmeal with blueberries for breakfast.",
  "My blood sugar was 142 this morning before breakfast.",
  "I feel a bit dizzy today.",
  "I'm feeling a little lonely this week.",
];

let localSeq = 0;
const localId = () => `m-${++localSeq}`;

function StepsDisclosure({ steps, label }: { steps: StepTrace[]; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex items-center gap-1 text-sm text-mist-400 hover:text-white">
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        {label}
      </button>
      {open && (
        <ol className="mt-2 grid gap-1 rounded-xl border border-white/[0.06] bg-night-950/50 p-3 text-sm">
          {steps.map((s, i) => (
            <li key={`${s.agentId}-${i}`} className="grid gap-0.5 sm:grid-cols-[190px_1fr] sm:gap-3">
              <span className="font-medium text-mist-100">{s.agentName}</span>
              <span className="text-mist-400">{s.summary}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ConfirmCard({
  turn,
  preferredName,
  patientId,
  onDone,
}: {
  turn: Turn;
  preferredName: string;
  patientId: string;
  onDone: (turn: Turn, steps: StepTrace[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(turn.observations.map((o) => o.id)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answer = async (ids: string[]) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversation/${encodeURIComponent(turn.id)}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptIds: ids }),
      });
      const data = (await res.json()) as { turn?: Turn; steps?: StepTrace[]; error?: string };
      if (!res.ok || !data.turn) throw new Error(data.error ?? "Something went wrong. Please try again.");
      if (ids.length) announceJournalChange(patientId);
      onDone(data.turn, data.steps ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (turn.status === "saved") {
    const saved = turn.observations.filter((o) => turn.savedObservationIds.includes(o.id));
    return (
      <div className="mt-3 rounded-2xl border border-status-good/30 bg-status-good/[0.07] p-4">
        <p className="flex items-center gap-2 text-lg font-semibold text-white">
          <Check className="h-5 w-5 text-status-good" aria-hidden="true" /> Saved to your journal
        </p>
        <ul className="mt-2 grid gap-1 text-[1.05rem] text-mist-100">
          {saved.map((o) => (
            <li key={o.id}>• {describeObservation(o)}</li>
          ))}
        </ul>
        <p className="mt-2 text-mist-300">Your care team can see this now.</p>
      </div>
    );
  }
  if (turn.status === "dismissed") {
    return <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-lg text-mist-300">Okay, I didn&apos;t save anything.</p>;
  }

  return (
    <fieldset className="mt-3 rounded-2xl border border-glow-300/25 bg-glow-300/[0.05] p-4 sm:p-5" disabled={saving}>
      <legend className="sr-only">Choose what to save</legend>
      <p className="text-xl font-semibold text-white">Should I save this to your journal, {preferredName}?</p>
      <p className="mt-1 text-mist-300">Tap to untick anything that isn&apos;t right. Nothing is saved until you say so.</p>
      <ul className="mt-4 grid gap-2.5">
        {turn.observations.map((o) => {
          const on = selected.has(o.id);
          return (
            <li key={o.id}>
              <label className={`flex min-h-14 cursor-pointer items-start gap-3.5 rounded-xl border p-3.5 transition ${on ? "border-glow-300/40 bg-white/[0.05]" : "border-white/10 bg-transparent opacity-70"}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(o.id)) next.delete(o.id);
                      else next.add(o.id);
                      return next;
                    })
                  }
                  className="mt-1 h-6 w-6 shrink-0 accent-[var(--color-glow-400)]"
                />
                <span>
                  {o.localLabel && (
                    <span className="block text-lg font-semibold text-white" dir="auto">
                      {o.localLabel}
                    </span>
                  )}
                  <span className={`block ${o.localLabel ? "text-[0.95rem] text-mist-300" : "text-lg font-semibold text-white"}`}>{describeObservation(o)}</span>
                  <span className="block text-sm text-mist-400">
                    {OBSERVATION_JOURNAL[o.kind]} · You said: &ldquo;<bdi>{o.quote}</bdi>&rdquo;
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="mt-3 text-status-serious">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
        <button
          type="button"
          onClick={() => void answer([...selected])}
          disabled={!selected.size}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-glow-300 px-6 text-lg font-semibold text-night-950 transition hover:bg-glow-200 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Check className="h-5 w-5" aria-hidden="true" />}
          Yes, save {selected.size === turn.observations.length ? (selected.size === 1 ? "this" : "these") : `${selected.size} of ${turn.observations.length}`}
        </button>
        <button
          type="button"
          onClick={() => void answer([])}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-white/15 px-6 text-lg font-semibold text-white transition hover:bg-white/[0.05]"
        >
          <X className="h-5 w-5" aria-hidden="true" /> No, don&apos;t save
        </button>
      </div>
    </fieldset>
  );
}

/** Shows only the patients the signed-in account may talk for (the API enforces the same rule). */
export function CompanionView({ patients }: { patients: PatientOption[] }) {
  const me = useMe();
  if (!me) return <p className="mx-auto max-w-3xl px-5 pt-36 text-mist-400">Loading…</p>;
  const allowed = me.user?.role === "clinician" ? patients : patients.filter((p) => me.user?.patientIds.includes(p.id));
  if (!allowed.length) return <p className="mx-auto max-w-3xl px-5 pt-36 text-mist-300">There&apos;s no patient linked to this account yet.</p>;
  return <CompanionChat patients={allowed} />;
}

function CompanionChat({ patients }: { patients: PatientOption[] }) {
  const [patientId, setPatientId] = useState(patients[0].id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ai, setAi] = useState<AIStatus | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const patient = patients.find((p) => p.id === patientId)!;
  const { prefs, save: savePrefs } = useVoicePreferences(patientId);
  const voices = useVoices();
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const lang = getLanguage(prefs?.language ?? "en")!;

  useEffect(() => {
    fetch("/api/ai/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: AIStatus | null) => d && setAi(d))
      .catch(() => undefined);
    return () => stopSpeaking();
  }, []);

  const voiceFor = (code: string, region: string | null) => {
    const list = voicesFor(voices, code, region, prefs?.allowOnlineVoices ?? false);
    const remembered = rememberedVoice(languageTag(code, region));
    return list.find((v) => v.voiceURI === remembered) ?? list[0] ?? null;
  };

  /** Speaks a reply in the language it's written in. Returns false if no voice is available. */
  const sayAloud = (id: string, text: string, language: { code: string; region: string | null }) => {
    if (!prefs) return false;
    const voice = voiceFor(language.code, language.region);
    if (!voice) return false;
    setSpeakingId(id);
    return speak(text, { ...prefs, language: language.code, region: language.region }, voice, () => setSpeakingId(null));
  };

  const changeLanguage = (code: string, region: string | null) => {
    if (!prefs) return;
    stopSpeaking();
    void savePrefs({ ...prefs, language: code, region });
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    setDraft("");
    setError(null);
    const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: message, id: localId() }]);
    setSending(true);
    try {
      const res = await fetch("/api/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, message, history }),
      });
      const data = (await res.json()) as { turn?: Turn; steps?: StepTrace[]; error?: string };
      if (!res.ok || !data.turn) throw new Error(data.error ?? "Nouri couldn't answer just now.");
      setMessages((prev) => [...prev, { role: "assistant", content: data.turn!.reply, id: data.turn!.id, turn: data.turn, steps: data.steps }]);
      if (prefs?.readAloud) sayAloud(data.turn.id, data.turn.reply, data.turn.replyLanguage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nouri couldn't answer just now.");
    } finally {
      setSending(false);
    }
  };

  const updateTurn = (turn: Turn, confirmSteps: StepTrace[]) =>
    setMessages((prev) => prev.map((m) => (m.role === "assistant" && m.turn?.id === turn.id ? { ...m, turn, confirmSteps } : m)));

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 pt-28 pb-10 sm:px-8 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* Nouri */}
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="glass flex flex-col items-center rounded-[2rem] p-6 text-center">
          <div className="relative">
            <div aria-hidden="true" className="absolute inset-0 -z-10 scale-125 rounded-full bg-[radial-gradient(closest-side,rgb(34_211_238/0.2),transparent)]" />
            <HeroNouri className="aspect-[432/540] w-40 lg:w-56" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-semibold text-white">Talk to Nouri</h1>
          <p className="mt-1 text-lg text-mist-300" aria-live="polite">
            {sending ? "Nouri is thinking…" : `Nouri is listening, ${patient.preferredName}.`}
          </p>

          <label className="mt-5 grid w-full gap-1.5 text-left text-sm text-mist-400">
            Demo patient (synthetic)
            <select
              value={patientId}
              onChange={(e) => {
                stopSpeaking();
                setPatientId(e.target.value);
                setMessages([]);
                setError(null);
              }}
              className="rounded-xl border border-white/10 bg-night-850 px-3 py-2.5 text-[0.95rem] text-white focus:border-glow-300/40 focus:outline-none"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 grid w-full gap-1.5 text-left text-sm text-mist-400">
            Nouri speaks
            <select
              value={prefs?.language ?? "en"}
              disabled={!prefs}
              onChange={(e) => changeLanguage(e.target.value, getLanguage(e.target.value)?.regions[0]?.code ?? null)}
              className="rounded-xl border border-white/10 bg-night-850 px-3 py-2.5 text-[0.95rem] text-white focus:border-glow-300/40 focus:outline-none disabled:opacity-60"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeName === l.name ? l.name : `${l.nativeName} · ${l.name}`}
                </option>
              ))}
            </select>
          </label>
          {lang.regions.length > 1 && prefs && (
            <label className="mt-3 grid w-full gap-1.5 text-left text-sm text-mist-400">
              Accent
              <select
                value={prefs.region ?? ""}
                onChange={(e) => changeLanguage(prefs.language, e.target.value || null)}
                className="rounded-xl border border-white/10 bg-night-850 px-3 py-2.5 text-[0.95rem] text-white focus:border-glow-300/40 focus:outline-none"
              >
                {lang.regions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.dialect ? `${r.name} · ${r.dialect}` : r.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {prefs && (
            <label className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] px-3 py-2.5 text-left text-[0.95rem] text-white">
              Read replies aloud
              <input
                type="checkbox"
                role="switch"
                checked={prefs.readAloud}
                onChange={(e) => {
                  if (!e.target.checked) stopSpeaking();
                  void savePrefs({ ...prefs, readAloud: e.target.checked });
                }}
                className="h-5 w-5 accent-[var(--color-glow-400)]"
              />
            </label>
          )}
          {prefs && !voiceFor(prefs.language, prefs.region) && (
            <p className="mt-2 text-left text-xs text-mist-500">
              No {lang.name} voice on this device, so replies are shown as text. <Link href="/voice" className="text-glow-300 hover:underline">Voice Studio</Link>
            </p>
          )}

          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-sm text-mist-300">
            <Sparkles className="h-4 w-4 text-source-ai" aria-hidden="true" />
            {ai ? (ai.provider !== "mock" ? `AI: ${providerLabel(ai.provider, ai.model)}` : "Mock mode: no AI key set") : "Checking AI…"}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-mist-500">
            Typed messages stand in for speech until the physical Nouri is connected. Nouri is a companion, not a doctor, and saves nothing without your OK.
          </p>
        </div>
      </aside>

      {/* Conversation */}
      <section aria-label="Conversation with Nouri" className="flex min-h-[70vh] flex-col">
        <ol className="flex flex-1 flex-col gap-5" aria-live="polite">
          {!messages.length && (
            <li className="glass rounded-3xl rounded-tl-md p-5 text-xl leading-relaxed text-white sm:max-w-[85%]">
              {prefs && prefs.language !== "en" && SAMPLE_GREETING[prefs.language] && (
                <span className="mb-2 block" lang={prefs.language} dir={lang.dir}>
                  {SAMPLE_GREETING[prefs.language]}
                </span>
              )}
              {NOURI_INTRO} How are you feeling today? You can tell me how you slept, what you ate, or anything on your mind.
            </li>
          )}
          {messages.map((m) =>
            m.role === "user" ? (
              <li key={m.id} dir="auto" className="ml-auto max-w-[85%] rounded-3xl rounded-tr-md bg-blush-300/15 px-5 py-4 text-xl leading-relaxed text-white">
                <span className="sr-only">You said: </span>
                {m.content}
              </li>
            ) : (
              <li key={m.id} className="sm:max-w-[85%]">
                <div className={`glass rounded-3xl rounded-tl-md p-5 text-xl leading-relaxed text-white ${m.turn?.safety.emergency ? "border-status-serious/50" : ""}`}>
                  <span className="sr-only">Nouri said: </span>
                  <p lang={m.turn?.replyLanguage.code} dir={getLanguage(m.turn?.replyLanguage.code ?? "en")?.dir ?? "auto"}>
                    {m.content}
                  </p>
                  {m.turn && m.turn.replyEnglish !== m.turn.reply && (
                    <details className="mt-3 text-base text-mist-300">
                      <summary className="cursor-pointer text-sm text-mist-400">Show in English</summary>
                      <p className="mt-1" lang="en">
                        {m.turn.replyEnglish}
                      </p>
                    </details>
                  )}
                  {m.turn?.languageNote && <p className="mt-2 text-sm text-status-warning">{m.turn.languageNote}</p>}
                  {m.turn && voiceFor(m.turn.replyLanguage.code, m.turn.replyLanguage.region) && (
                    <button
                      type="button"
                      onClick={() => (speakingId === m.id ? (stopSpeaking(), setSpeakingId(null)) : sayAloud(m.id, m.content, m.turn!.replyLanguage))}
                      className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/12 px-3.5 py-1.5 text-sm font-medium text-mist-100 hover:bg-white/[0.06]"
                    >
                      {speakingId === m.id ? <Square className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
                      {speakingId === m.id ? "Stop" : "Listen"}
                    </button>
                  )}
                </div>
                {m.turn && m.turn.status !== "nothing_to_save" && (
                  <ConfirmCard turn={m.turn} preferredName={patient.preferredName} patientId={patientId} onDone={updateTurn} />
                )}
                {m.steps && <StepsDisclosure steps={m.steps} label="For the demo: how Nouri's agents handled this" />}
                {m.confirmSteps && m.confirmSteps.length > 0 && <StepsDisclosure steps={m.confirmSteps} label="For the demo: what happened after you answered" />}
                {m.turn?.status === "saved" && (
                  <p className="mt-2 text-sm text-mist-500">
                    Demo:{" "}
                    <Link href={`/patients/${patientId}`} className="text-glow-300 underline-offset-2 hover:underline">
                      see it in the clinician view
                    </Link>
                  </p>
                )}
              </li>
            ),
          )}
          {sending && (
            <li className="glass inline-flex w-fit items-center gap-2 rounded-3xl rounded-tl-md px-5 py-4 text-lg text-mist-300">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Nouri is thinking…
            </li>
          )}
        </ol>
        <div ref={endRef} />

        {error && (
          <p role="alert" className="mt-4 rounded-2xl border border-status-serious/30 bg-status-serious/10 px-4 py-3 text-lg text-white">
            {error}
          </p>
        )}

        <div className="sticky bottom-0 mt-6 bg-gradient-to-t from-night-900 via-night-900 to-transparent pt-4 pb-2">
          <ul className="mb-3 flex flex-wrap gap-2" aria-label="Things you could say">
            {SUGGESTIONS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => void send(s)}
                  disabled={sending}
                  className="rounded-full border border-white/12 bg-white/[0.03] px-4 py-2 text-[0.95rem] text-mist-100 transition hover:border-glow-300/40 hover:bg-white/[0.06] disabled:opacity-50"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
            className="flex items-end gap-3"
          >
            <label className="flex-1">
              <span className="sr-only">Your message to Nouri</span>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, 500))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(draft);
                  }
                }}
                rows={2}
                dir="auto"
                placeholder={`Type to Nouri in any language, ${patient.preferredName}…`}
                className="w-full resize-none rounded-2xl border border-white/12 bg-night-850 px-5 py-4 text-xl text-white placeholder:text-mist-500 focus:border-glow-300/50 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              aria-label="Send to Nouri"
              className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-glow-300 text-night-950 transition hover:bg-glow-200 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" /> : <SendHorizontal className="h-7 w-7" aria-hidden="true" />}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
