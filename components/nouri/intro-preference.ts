export const INTRO_SEEN_KEY = "nouri:intro-seen";
export const PLAY_INTRO_EVENT = "nouri:play-intro";
/** Fired on window once the intro has fully faded out (played or skipped). */
export const INTRO_FINISHED_EVENT = "nouri:intro-finished";

/**
 * Runs in <head> before first paint and sets <html data-intro="play|skip">.
 * The intro plays for first-time visitors without a reduced-motion preference;
 * `?intro` forces it (handy for demos). Kept in sync with `shouldPlayIntro`.
 */
export const INTRO_BOOT_SCRIPT = `(function(){var d=document.documentElement;d.setAttribute("data-js","");try{var f=/[?&]intro(=|&|$)/.test(location.search);var s=localStorage.getItem("${INTRO_SEEN_KEY}")==="1";var r=matchMedia("(prefers-reduced-motion: reduce)").matches;d.setAttribute("data-intro",location.pathname==="/"&&(f||(!s&&!r))?"play":"skip")}catch(e){d.setAttribute("data-intro","skip")}})()`;

export function shouldPlayIntro() {
  try {
    const forced = new URLSearchParams(window.location.search).has("intro");
    const seen = window.localStorage.getItem(INTRO_SEEN_KEY) === "1";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return forced || (!seen && !reduced);
  } catch {
    return false;
  }
}

export function markIntroSeen() {
  try {
    window.localStorage.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    // Storage can be unavailable (private mode); the intro simply plays again next time.
  }
}
