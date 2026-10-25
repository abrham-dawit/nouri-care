"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CircleAlert, Globe2, Loader2, Play, Search, Square, Volume2 } from "lucide-react";
import { Card, CardHeader } from "@/components/clinical/ui";
import { providerLabel, type AIProvider } from "@/lib/ai/labels";
import { getLanguage, LANGUAGES, languageTag, SAFE_REPLY, SAMPLE_GREETING, TEXT_QUALITY_LABEL, type Language } from "@/lib/voice/languages";
import { VOICE_PROFILES, type VoicePreferences, type VoiceProfile } from "@/lib/voice/preferences";
import { hasAnyVoice, rememberedVoice, rememberVoice, speak, speechSupported, stopSpeaking, useVoices, voicesFor } from "@/lib/voice/speech";
import { useVoicePreferences } from "@/lib/voice/use-preferences";

type PatientOption = { id: string; name: string; preferredName: string };

const QUALITY_STYLE = {
  strong: "border-status-good/30 text-status-good",
  fair: "border-status-warning/30 text-status-warning",
  limited: "border-status-serious/30 text-status-serious",
} as const;

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <span>
        <span className="block font-semibold text-white">{label}</span>
        <span className="block text-sm text-mist-400">{description}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-6 w-6 shrink-0 accent-[var(--color-glow-400)]" />
    </label>
  );
}

export function VoiceStudio({ patients }: { patients: PatientOption[] }) {
  const [patientId, setPatientId] = useState(patients[0].id);
  const { prefs, setPrefs, save, saving, error } = useVoicePreferences(patientId);
  const voices = useVoices();
  const [query, setQuery] = useState("");
  const [onlyWithVoice, setOnlyWithVoice] = useState(false);
  const [voiceURI, setVoiceURI] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [ai, setAi] = useState<{ provider: AIProvider; model: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/ai/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAi(d))
      .catch(() => undefined);
    return () => stopSpeaking();
  }, []);

  const lang = prefs ? getLanguage(prefs.language)! : null;
  const tag = prefs ? languageTag(prefs.language, prefs.region) : "en";
  const matching = useMemo(() => (prefs ? voicesFor(voices, prefs.language, prefs.region, prefs.allowOnlineVoices) : []), [voices, prefs]);
  const preferredURI = voiceURI ?? (typeof window !== "undefined" ? rememberedVoice(tag) : null);
  const voice = matching.find((v) => v.voiceURI === preferredURI) ?? matching[0] ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LANGUAGES.filter(
      (l) => (!q || l.name.toLowerCase().includes(q) || l.nativeName.toLowerCase().includes(q) || l.code === q) && (!onlyWithVoice || hasAnyVoice(voices, l.code)),
    );
  }, [query, onlyWithVoice, voices]);

  const update = (patch: Partial<VoicePreferences>) => prefs && setPrefs({ ...prefs, ...patch });
  const pickLanguage = (l: Language) => {
    stopSpeaking();
    setPlaying(false);
    setVoiceURI(null);
    update({ language: l.code, region: l.regions[0]?.code ?? null });
  };

  const sample = prefs ? (SAMPLE_GREETING[prefs.language] ?? SAMPLE_GREETING.en) : "";
  const sampleIsFallback = prefs ? !SAMPLE_GREETING[prefs.language] : false;

  const preview = () => {
    if (!prefs) return;
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }
    const ok = speak(sample, sampleIsFallback ? { ...prefs, language: "en", region: "US" } : prefs, sampleIsFallback ? null : voice, () => setPlaying(false));
    setPlaying(ok);
  };

  const onSave = async () => {
    if (!prefs) return;
    if (voice) rememberVoice(tag, voice.voiceURI);
    if (await save(prefs)) setSavedAt(new Date().toISOString());
  };

  const hasSafeTranslation = prefs ? Boolean(SAFE_REPLY.emergency[prefs.language]) : false;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-28 pb-10 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-glow-300 uppercase">Nouri&apos;s voice</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">Voice Studio</h1>
          <p className="mt-3 max-w-3xl text-lg leading-relaxed text-mist-300">
            Choose the language, accent and personality Nouri uses with each person: {LANGUAGES.length} languages, including Amharic, Tigrinya, Arabic,
            Spanish and English. What works for each language is shown honestly below.
          </p>
        </div>
        <label className="grid gap-1.5 text-sm text-mist-400">
          Patient (synthetic)
          <select
            value={patientId}
            onChange={(e) => {
              stopSpeaking();
              setPlaying(false);
              setSavedAt(null);
              setPatientId(e.target.value);
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
      </header>

      {!prefs || !lang ? (
        <p className="mt-10 flex items-center gap-2 text-mist-400">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> {error ?? "Loading voice settings…"}
        </p>
      ) : (
        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="grid min-w-0 content-start gap-6">
            {/* Language */}
            <Card labelledBy="lang-title">
              <CardHeader
                id="lang-title"
                title="Language"
                subtitle="Nouri replies in this language. Quality labels are estimates and haven't been checked with native speakers yet."
                action={
                  <span className="inline-flex items-center gap-1.5 text-sm text-mist-400">
                    <Globe2 className="h-4 w-4" aria-hidden="true" /> {LANGUAGES.length} languages
                  </span>
                }
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative flex flex-1 items-center">
                  <span className="sr-only">Search languages</span>
                  <Search className="pointer-events-none absolute left-3.5 h-5 w-5 text-mist-500" aria-hidden="true" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search, e.g. Amharic, ትግርኛ, العربية"
                    className="w-full rounded-xl border border-white/[0.08] bg-night-850 py-2.5 pr-3 pl-11 text-[0.95rem] text-white placeholder:text-mist-500 focus:border-glow-300/40 focus:outline-none"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-mist-300">
                  <input type="checkbox" checked={onlyWithVoice} onChange={(e) => setOnlyWithVoice(e.target.checked)} className="h-4 w-4 accent-[var(--color-glow-400)]" />
                  Only languages with a voice on this device
                </label>
              </div>
              <ul role="listbox" aria-label="Languages" className="mt-4 grid max-h-[26rem] gap-1.5 overflow-auto pr-1 sm:grid-cols-2">
                {filtered.map((l) => {
                  const selected = l.code === prefs.language;
                  const voiceHere = hasAnyVoice(voices, l.code);
                  return (
                    <li key={l.code} role="option" aria-selected={selected}>
                      <button
                        type="button"
                        onClick={() => pickLanguage(l)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
                          selected ? "border-glow-300/45 bg-glow-300/[0.08]" : "border-white/[0.05] bg-white/[0.015] hover:border-white/15"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-white" lang={l.code} dir={l.dir}>
                            {l.nativeName}
                          </span>
                          <span className="block truncate text-sm text-mist-400">{l.name}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {voiceHere && <Volume2 className="h-4 w-4 text-glow-300" aria-label="Has a voice on this device" />}
                          {selected && <Check className="h-4 w-4 text-glow-300" aria-hidden="true" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {!filtered.length && <li className="text-mist-400">No languages match.</li>}
              </ul>
            </Card>

            {/* Accent */}
            <Card labelledBy="accent-title">
              <CardHeader
                id="accent-title"
                title={`Accent for ${lang.name}`}
                subtitle="Sets the regional voice and, where it differs, the dialect Nouri writes in."
              />
              {lang.regions.length ? (
                <div role="radiogroup" aria-label="Accent" className="flex flex-wrap gap-2">
                  {lang.regions.map((r) => {
                    const on = prefs.region === r.code;
                    const voiceHere = voicesFor(voices, lang.code, r.code, true).some((v) => v.lang.replace("_", "-").toLowerCase() === `${lang.code}-${r.code}`.toLowerCase());
                    return (
                      <button
                        key={r.code}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => {
                          setVoiceURI(null);
                          update({ region: r.code });
                        }}
                        className={`rounded-xl border px-3.5 py-2 text-left transition ${on ? "border-glow-300/45 bg-glow-300/[0.08] text-white" : "border-white/10 text-mist-300 hover:text-white"}`}
                      >
                        <span className="block font-semibold">{r.name}</span>
                        <span className="block text-xs text-mist-400">
                          {r.dialect ?? `${lang.name} (${r.code})`}
                          {voiceHere ? " · voice installed" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-mist-400">No regional accents are listed for {lang.name} yet. Nouri uses the standard form.</p>
              )}
            </Card>

            {/* Personality, speed, volume */}
            <Card labelledBy="style-title">
              <CardHeader id="style-title" title="Personality & pacing" />
              <div role="radiogroup" aria-label="Voice personality" className="grid gap-2.5 sm:grid-cols-2">
                {(Object.keys(VOICE_PROFILES) as VoiceProfile[]).map((k) => {
                  const p = VOICE_PROFILES[k];
                  const on = prefs.profile === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => update({ profile: k })}
                      className={`rounded-2xl border p-4 text-left transition ${on ? "border-glow-300/45 bg-glow-300/[0.08]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/15"}`}
                    >
                      <span className="block text-lg font-semibold text-white">{p.label}</span>
                      <span className="block text-sm text-mist-400">{p.description}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="flex justify-between text-sm font-medium text-mist-300">
                    Speaking speed <span className="text-white tabular-nums">{prefs.rate.toFixed(2)}×</span>
                  </span>
                  <input type="range" min={0.6} max={1.4} step={0.05} value={prefs.rate} onChange={(e) => update({ rate: Number(e.target.value) })} className="accent-[var(--color-glow-400)]" />
                </label>
                <label className="grid gap-2">
                  <span className="flex justify-between text-sm font-medium text-mist-300">
                    Volume <span className="text-white tabular-nums">{Math.round(prefs.volume * 100)}%</span>
                  </span>
                  <input type="range" min={0} max={1} step={0.05} value={prefs.volume} onChange={(e) => update({ volume: Number(e.target.value) })} className="accent-[var(--color-glow-400)]" />
                </label>
              </div>
              <div className="mt-5 grid gap-3">
                <Toggle checked={prefs.readAloud} onChange={(v) => update({ readAloud: v })} label="Read Nouri's replies aloud" description="On the Talk to Nouri screen, using the voice below." />
                <Toggle
                  checked={prefs.allowOnlineVoices}
                  onChange={(v) => {
                    setVoiceURI(null);
                    update({ allowOnlineVoices: v });
                  }}
                  label="Allow online voices"
                  description="Some browser voices send the text to an online service. Off by default, since replies can include health details."
                />
              </div>
            </Card>
          </div>

          {/* Preview & capabilities */}
          <aside className="grid content-start gap-6" aria-label="Preview and capabilities">
            <Card labelledBy="preview-title">
              <CardHeader id="preview-title" title="Preview" />
              <p className="rounded-2xl bg-white/[0.03] p-4 text-xl leading-relaxed text-white" lang={sampleIsFallback ? "en" : tag} dir={sampleIsFallback ? "ltr" : lang.dir}>
                {sample}
              </p>
              {sampleIsFallback && <p className="mt-2 text-sm text-mist-400">No built-in {lang.name} sample yet, so the preview uses English.</p>}
              {!sampleIsFallback && prefs.language !== "en" && <p className="mt-2 text-xs text-mist-500">Sample phrase not yet reviewed by a native speaker.</p>}

              <label className="mt-4 grid gap-1.5 text-sm text-mist-400">
                Voice on this device
                <select
                  value={voice?.voiceURI ?? ""}
                  onChange={(e) => setVoiceURI(e.target.value)}
                  disabled={!matching.length}
                  className="rounded-xl border border-white/10 bg-night-850 px-3 py-2.5 text-[0.95rem] text-white focus:border-glow-300/40 focus:outline-none disabled:opacity-60"
                >
                  {!matching.length && <option value="">No {lang.name} voice available</option>}
                  {matching.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} · {v.lang}
                      {v.localService ? "" : " · online"}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={preview}
                disabled={!speechSupported() || (!voice && !sampleIsFallback)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-glow-300 px-5 py-3.5 text-lg font-semibold text-night-950 transition hover:bg-glow-200 disabled:opacity-50"
              >
                {playing ? <Square className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
                {playing ? "Stop" : "Play preview"}
              </button>
              {!matching.length && !sampleIsFallback && (
                <p className="mt-3 flex items-start gap-2 text-sm text-mist-300">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" aria-hidden="true" />
                  This device has no {lang.name} voice{prefs.allowOnlineVoices ? "" : " that works offline"}. Nouri can still reply in {lang.name} text. Spoken{" "}
                  {lang.name} needs an installed voice pack or a cloud speech service (not connected yet).
                </p>
              )}

              <button
                type="button"
                onClick={() => void onSave()}
                disabled={saving}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 px-5 py-3.5 font-semibold text-white transition hover:bg-white/[0.05] disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Check className="h-5 w-5" aria-hidden="true" />}
                Save for {patients.find((p) => p.id === patientId)!.preferredName}
              </button>
              {savedAt && !error && <p className="mt-2 text-center text-sm text-status-good">Saved. Talk to Nouri will use these settings.</p>}
              {error && (
                <p role="alert" className="mt-2 text-center text-sm text-status-serious">
                  {error}
                </p>
              )}
            </Card>

            <Card labelledBy="cap-title">
              <CardHeader id="cap-title" title={`What works in ${lang.name}`} />
              <dl className="grid gap-4 text-[0.95rem]">
                <div>
                  <dt className="font-semibold text-white">Written replies</dt>
                  <dd className="mt-1 text-mist-300">
                    {prefs.language === "en"
                      ? "Supported by the AI model and by the rule-based mock."
                      : ai && ai.provider !== "mock"
                        ? `Generated by the AI model (${providerLabel(ai.provider, ai.model)}).`
                        : `Needs the AI model. In mock mode (no AI key on the server) Nouri replies in English.`}
                  </dd>
                  <dd className="mt-1.5">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${QUALITY_STYLE[lang.textQuality]}`}>{TEXT_QUALITY_LABEL[lang.textQuality]}</span>
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-white">Spoken replies on this device</dt>
                  <dd className="mt-1 text-mist-300">
                    {!speechSupported()
                      ? "This browser doesn't support speech."
                      : matching.length
                        ? `${matching.length} voice${matching.length === 1 ? "" : "s"} available.`
                        : hasAnyVoice(voices, lang.code)
                          ? "Only online voices are available. Turn on “Allow online voices” to use them."
                          : "No voice installed."}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-white">Safety messages</dt>
                  <dd className="mt-1 text-mist-300">
                    {prefs.language === "en"
                      ? "Fixed emergency and dosing messages in English."
                      : hasSafeTranslation
                        ? "Fixed emergency and dosing messages in a draft translation, with the English shown alongside. Needs native-speaker review."
                        : "No translated safety message yet: emergencies and dosing questions get the fixed English message."}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-white">Listening (speech to text)</dt>
                  <dd className="mt-1 text-mist-300">Not built yet. The patient types for now; speech input arrives with the physical Nouri.</dd>
                </div>
              </dl>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
