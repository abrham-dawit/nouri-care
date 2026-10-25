import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LogoutButton } from "@/components/auth/LogoutButton";

export const metadata: Metadata = { title: "Account pending" };

export default function AccountPendingPage() {
  return (
    <AuthShell title="Almost there" subtitle="Your account was created.">
      <div className="grid gap-5 text-lg text-mist-200">
        <p className="flex gap-3">
          <Clock className="mt-1 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
          Doctor and nurse accounts are checked by the clinic before they can see any patient. You&apos;ll get access once
          you&apos;re verified.
        </p>
        <p className="text-base text-mist-400">This protects patients: nobody can read health records just by signing up.</p>
        <LogoutButton className="justify-self-start" />
      </div>
    </AuthShell>
  );
}
