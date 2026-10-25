"use client";

import { LogOut } from "lucide-react";

export async function logout() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } finally {
    // A full page load on purpose: drops every cached, signed-in view from the client.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }
}

export function LogoutButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={logout}
      className={`inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-[0.95rem] font-medium text-mist-200 transition hover:border-white/20 hover:text-white ${className}`}
    >
      <LogOut className="h-4 w-4" aria-hidden="true" /> Log out
    </button>
  );
}
