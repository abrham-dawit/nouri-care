"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { INTRO_FINISHED_EVENT } from "@/components/nouri/intro-preference";

/**
 * On the home page (only signed-out visitors reach it; proxy.ts sends signed-in users to their
 * area): once Nouri's intro has finished, or straight away if it isn't playing, go to the login.
 * Uses the app router (not a hard reload) so in-flight page loads finish cleanly.
 */
export function IntroThenLogin() {
  const router = useRouter();
  useEffect(() => {
    const toLogin = () => router.replace("/login");
    // The boot script and NouriIntro's layout effect have already decided whether the intro plays.
    if (document.documentElement.getAttribute("data-intro") !== "play") {
      toLogin();
      return;
    }
    window.addEventListener(INTRO_FINISHED_EVENT, toLogin, { once: true });
    return () => window.removeEventListener(INTRO_FINISHED_EVENT, toLogin);
  }, [router]);
  return null;
}
