"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CircleCheck, Cpu, Loader2, TriangleAlert } from "lucide-react";
import { useMe } from "@/lib/auth/use-me";

type Step = { agent: string; status: string; summary: string };
type Result = {
  interaction_id: string;
  reply: string;
  confirmation_required: boolean;
  pending_observations: { id: string; kind: string; description: string; quote: string }[];
  provider: string;
  run: { id: string; status: string; steps: Step[] };
};

const EXAMPLES = [
  "I slept badly last night, maybe four hours, and my sugar was 148 before breakfast.",
  "I had oatmeal for breakfast and two glasses of water.",
  "Should I take more insulin tonight?",
];

const STATUS_CLS: Record<string, string> = {
  ok: "text-emerald-300",
  warning: "text-amber-300",
  waiting: "text-sky-300",
  error: "text-rose-300",
  blocked: "text-rose-300",
};

/** SIMULATED DEVICE MODE: typed text stands in for the ESP32, through the same pipeline. */
export function DeviceSimulator({ patients }: { patients: { id: string; name: string }[] }) {
  const me = useMe();
  const allowed = me?.user?.role === "clinician" ? patients : patients.filter((p) => me?.user?.patientIds.includes(p.id));
  const [patientId, setPatientId] = useState<string>("");
  const [text, setText] = useState(EXAMPLES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const pid = patientId || allowed[0]?.id || "";

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch("/api/simulate/device", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId: pid, text }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(accept: boolean) {
    if (!result) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/conversation/${encodeURIComponent(result.interaction_id)}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptIds: accept ? result.pending_observations.map((o) => o.id) : [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save.");
      setSaved(accept ? `Saved ${data.turn.savedObservationIds.length} observation(s). The visit brief was redrafted for clinician review.` : "Nothing was saved.");
      setResult({ ...result, confirmation_required: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  if (!me) return <p className="text-mist-400">Loading…</p>;
  if (!allowed.length) return <p className="text-mist-300">No patient is linked to this account.</p>;

  return (
    <div className="grid gap-6">
      <p className="flex items-start gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-amber-100">
        <Cpu className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <span>
          <strong>Simulated device mode.</strong> No Nouri robot is connected: what you type stands in for what the ESP32 would have heard,
          and runs through the same agents as the real device API. Synthetic demo patients only.
        </span>
      </p>

      <form onSubmit={send} className="glass grid gap-4 rounded-3xl p-5 sm:p-6">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-mist-300">Patient</span>
          <select value={pid} onChange={(e) => setPatientId(e.target.value)} className="rounded-xl border border-white/10 bg-night-900 px-3 py-2.5 text-white">
            {allowed.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-mist-300">What the patient says to Nouri</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-lg text-white" />
        </label>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setText(ex)} className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-mist-300 hover:border-glow-300/50 hover:text-white">
              {ex.length > 48 ? `${ex.slice(0, 48)}…` : ex}
            </button>
          ))}
        </div>
        <button type="submit" disabled={busy || !text.trim()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-glow-300 px-5 py-3 font-semibold text-night-950 disabled:opacity-60">
          {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />} Send as simulated device
        </button>
      </form>

      {error && (
        <p role="alert" className="flex gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-rose-200">
          <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden="true" /> {error}
        </p>
      )}

      {result && (
        <section className="glass grid gap-5 rounded-3xl p-5 sm:p-6" aria-live="polite">
          <div>
            <h2 className="text-sm font-semibold tracking-widest text-mist-400 uppercase">Nouri replied ({result.provider === "mock" ? "rule-based fallback" : result.provider})</h2>
            <p className="mt-2 text-lg leading-relaxed text-white">{result.reply}</p>
          </div>

          <div>
            <h2 className="text-sm font-semibold tracking-widest text-mist-400 uppercase">Agent steps, in order (run {result.run.id})</h2>
            <ol className="mt-3 grid gap-1.5">
              {result.run.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="w-5 shrink-0 text-right text-mist-500">{i + 1}.</span>
                  <span className={`w-16 shrink-0 font-medium ${STATUS_CLS[s.status] ?? "text-mist-300"}`}>{s.status}</span>
                  <span className="text-mist-200">
                    <span className="font-semibold text-white">{s.agent}:</span> {s.summary}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {result.pending_observations.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold tracking-widest text-mist-400 uppercase">Observations waiting for the patient&apos;s confirmation</h2>
              <ul className="mt-3 grid gap-2">
                {result.pending_observations.map((o) => (
                  <li key={o.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                    <span className="font-semibold text-white">{o.description}</span>
                    <span className="block text-sm text-mist-400">Patient&apos;s words: “{o.quote}”</span>
                  </li>
                ))}
              </ul>
              {result.confirmation_required && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" disabled={busy} onClick={() => confirm(true)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 font-semibold text-night-950 disabled:opacity-60">
                    <CircleCheck className="h-5 w-5" aria-hidden="true" /> Patient says yes: save
                  </button>
                  <button type="button" disabled={busy} onClick={() => confirm(false)} className="rounded-xl border border-white/15 px-4 py-2.5 font-medium text-mist-200 disabled:opacity-60">
                    Patient says no
                  </button>
                </div>
              )}
            </div>
          )}

          {saved && (
            <p className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-emerald-100">
              {saved}{" "}
              <Link href={`/patients/${pid}`} className="font-semibold underline">
                Open the patient&apos;s record and visit brief
              </Link>
            </p>
          )}
        </section>
      )}
    </div>
  );
}
