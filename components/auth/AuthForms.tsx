"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { HeartHandshake, Loader2, Stethoscope, UserRound } from "lucide-react";
import type { Role } from "@/lib/auth/access";

const inputCls =
  "mt-2 block w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-lg text-white placeholder:text-mist-500 outline-none transition focus:border-glow-300/60 focus:bg-white/[0.06]";
const buttonCls =
  "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-glow-300 px-5 py-3.5 text-lg font-semibold text-night-950 shadow-[0_0_30px_-6px_var(--color-glow-400)] transition hover:bg-glow-200 disabled:opacity-60";

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-base font-medium text-mist-200">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-sm text-mist-400">{hint}</span>}
    </label>
  );
}

async function post(url: string, body: unknown): Promise<{ redirect?: string; error?: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return await res.json();
  } catch {
    return { error: "Couldn't reach Nouri. Check your connection and try again." };
  }
}

/** Full page load so every server-rendered part sees the new session. */
function go(redirect: string) {
  const next = new URLSearchParams(window.location.search).get("next");
  window.location.assign(next && next.startsWith("/") && !next.startsWith("//") ? next : redirect);
}

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const out = await post("/api/auth/login", { username: f.get("username"), password: f.get("password") });
    if (out.redirect) return go(out.redirect);
    setBusy(false);
    setError(out.error ?? "Something went wrong. Please try again.");
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <Field label="Username">
        <input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required className={inputCls} />
      </Field>
      <Field label="Password">
        <input name="password" type="password" autoComplete="current-password" required className={inputCls} />
      </Field>
      {error && (
        <p role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-rose-200">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={buttonCls}>
        {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />} Log in
      </button>
      <p className="text-center text-base text-mist-300">
        New to Nouri?{" "}
        <Link href="/signup" className="font-semibold text-glow-300 hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}

const ROLE_CHOICES: { role: Role; title: string; body: string; icon: typeof UserRound }[] = [
  { role: "patient", title: "I'm the patient", body: "Talk to Nouri, my reminders, my journal", icon: UserRound },
  { role: "family", title: "I'm family or a guardian", body: "Updates the patient chose to share", icon: HeartHandshake },
  { role: "clinician", title: "I'm a doctor or nurse", body: "My patients and visit briefs", icon: Stethoscope },
];

const CODE_FIELD: Partial<Record<Role, { label: string; hint: string }>> = {
  patient: { label: "Enrollment code", hint: "Your clinic gives you this code. It links your account to your care record." },
  family: { label: "Family invite code", hint: "The patient shares this code with the relatives they choose." },
};

export function SignupForm() {
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("confirm")) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    const out = await post("/api/auth/signup", { role, name: f.get("name"), username: f.get("username"), password: f.get("password"), code: f.get("code") ?? "" });
    if (out.redirect) return go(out.redirect);
    setBusy(false);
    setError(out.error ?? "Something went wrong. Please try again.");
  }

  if (!role) {
    return (
      <div className="grid gap-3">
        <h2 className="text-xl font-semibold text-white">Who are you?</h2>
        {ROLE_CHOICES.map(({ role: r, title, body, icon: Icon }) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-glow-300/50 hover:bg-white/[0.06]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-glow-300/15 text-glow-300">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-lg font-semibold text-white">{title}</span>
              <span className="block text-mist-400">{body}</span>
            </span>
          </button>
        ))}
        <p className="mt-2 text-center text-base text-mist-300">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-glow-300 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    );
  }

  const choice = ROLE_CHOICES.find((c) => c.role === role)!;
  const code = CODE_FIELD[role];
  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">{choice.title}</h2>
        <button type="button" onClick={() => (setRole(null), setError(null))} className="text-sm font-medium text-glow-300 hover:underline">
          Change
        </button>
      </div>
      <Field label="Full name">
        <input name="name" autoComplete="name" required className={inputCls} />
      </Field>
      {code && (
        <Field label={code.label} hint={code.hint}>
          <input name="code" autoCapitalize="characters" spellCheck={false} required className={`${inputCls} uppercase`} />
        </Field>
      )}
      {role === "clinician" && (
        <p className="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-amber-100">
          New doctor and nurse accounts see no patients until your clinic verifies you.
        </p>
      )}
      <Field label="Username" hint="3–32 letters or numbers. You'll use it to log in.">
        <input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required className={inputCls} />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <input name="password" type="password" autoComplete="new-password" required minLength={8} className={inputCls} />
      </Field>
      <Field label="Confirm password">
        <input name="confirm" type="password" autoComplete="new-password" required className={inputCls} />
      </Field>
      {error && (
        <p role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-rose-200">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={buttonCls}>
        {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />} Create account
      </button>
    </form>
  );
}
