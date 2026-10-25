"use client";

import { useEffect, useState } from "react";
import type { Role } from "./access";

export type Me = { user: { name: string; role: Role; patientIds: string[]; verified: boolean } | null; home?: string; nav?: string[] };

let cached: Promise<Me> | null = null;

/** The signed-in user for menus and pickers (UI only; the server enforces access). */
export function useMe(): Me | undefined {
  const [me, setMe] = useState<Me>();
  useEffect(() => {
    cached ??= fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json() as Promise<Me>)
      .catch(() => ({ user: null }));
    let live = true;
    cached.then((m) => live && setMe(m));
    return () => {
      live = false;
    };
  }, []);
  return me;
}
