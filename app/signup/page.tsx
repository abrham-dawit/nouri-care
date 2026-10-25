import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <AuthShell title="Create your account" subtitle="Everyone sees only the information they're allowed to.">
      <SignupForm />
    </AuthShell>
  );
}
