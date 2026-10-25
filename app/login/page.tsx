import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/AuthForms";
import { DEMO_ACCOUNTS, ENROLLMENT_CODES, FAMILY_INVITE_CODES } from "@/lib/auth/demo-accounts";
import { ROLE_LABEL } from "@/lib/auth/access";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to Nouri Care"
      footer={
        <details className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-4 text-mist-300">
          <summary className="cursor-pointer font-medium text-mist-200">Demo accounts (synthetic data, for judges)</summary>
          <ul className="mt-3 grid gap-1.5 text-sm">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.username}>
                <span className="text-mist-400">{ROLE_LABEL[a.role]}:</span> <code className="text-glow-200">{a.username}</code> /{" "}
                <code className="text-glow-200">{a.password}</code>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-mist-400">
            To try sign-up: patient code <code className="text-glow-200">{Object.keys(ENROLLMENT_CODES)[0]}</code>, family code{" "}
            <code className="text-glow-200">{Object.keys(FAMILY_INVITE_CODES)[0]}</code>.
          </p>
        </details>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
