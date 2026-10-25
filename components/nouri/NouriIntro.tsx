"use client";

import { useLayoutEffect, useRef } from "react";
import { NouriRobot } from "./NouriRobot";
import { applyPose, REST_POSE, SLEEP_POSE } from "./pose";
import { cameraAt, formatViewBox, INTRO_END, introPoseAt, REVEAL_DURATION, type Rect } from "./intro-timeline";
import { INTRO_FINISHED_EVENT, markIntroSeen, PLAY_INTRO_EVENT, shouldPlayIntro } from "./intro-preference";

const SKIP_FADE_MS = 500;

/**
 * Full-screen cinematic introduction. Everything runs imperatively on refs:
 * visibility is driven by `<html data-intro>` (set before paint by the boot
 * script) and the overlay's own `data-phase`, so there is no flash, no
 * hydration mismatch, and no React re-render per frame.
 */
export function NouriIntro() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    const svg = svgRef.current;
    if (!overlay || !svg) return;
    const html = document.documentElement;

    let raf = 0;
    let timer = 0;
    let running = false;

    const anchorRect = (): Rect | null => {
      const el = document.querySelector<SVGSVGElement>("[data-nouri-anchor] svg");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.width > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
    };

    const frame = (t: number) => {
      applyPose(svg, t >= INTRO_END ? REST_POSE : introPoseAt(t));
      const vb = cameraAt(t, { w: window.innerWidth, h: window.innerHeight }, anchorRect());
      svg.setAttribute("viewBox", formatViewBox(vb));
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      html.style.removeProperty("overflow");
    };

    const finish = (phase: "revealing" | "skipping") => {
      if (!running) return;
      markIntroSeen();
      overlay.dataset.phase = phase;
      html.setAttribute("data-intro", "done");
      const ms = phase === "revealing" ? REVEAL_DURATION * 1000 : SKIP_FADE_MS;
      if (phase === "skipping") cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        stop();
        delete overlay.dataset.phase;
        window.dispatchEvent(new Event(INTRO_FINISHED_EVENT));
      }, ms + 50);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish("skipping");
    };

    const play = () => {
      stop();
      running = true;
      delete overlay.dataset.phase;
      html.setAttribute("data-intro", "play");
      html.style.overflow = "hidden";
      window.scrollTo(0, 0);
      applyPose(svg, SLEEP_POSE);
      window.addEventListener("keydown", onKey);
      skipRef.current?.focus({ preventScroll: true });

      const start = performance.now();
      let revealing = false;
      const tick = (now: number) => {
        const t = (now - start) / 1000;
        frame(t);
        if (!revealing && t >= INTRO_END) {
          revealing = true;
          finish("revealing");
        }
        // Keep tracking the anchor while the backdrop fades, in case layout settles.
        if (t < INTRO_END + REVEAL_DURATION + 0.1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const onSkip = () => finish("skipping");
    const skip = skipRef.current;
    skip?.addEventListener("click", onSkip);
    window.addEventListener(PLAY_INTRO_EVENT, play);

    if (window.location.pathname === "/" && shouldPlayIntro()) {
      play();
    } else if (html.getAttribute("data-intro") !== "done") {
      html.setAttribute("data-intro", "skip");
    }

    return () => {
      stop();
      skip?.removeEventListener("click", onSkip);
      window.removeEventListener(PLAY_INTRO_EVENT, play);
    };
  }, []);

  return (
    <div ref={overlayRef} className="intro-overlay" aria-label="Nouri introduction">
      <div className="intro-backdrop" />
      <NouriRobot
        svgRef={svgRef}
        pose={SLEEP_POSE}
        viewBox="175 147 250 150"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      />
      <p className="sr-only" aria-live="polite">
        Nouri is waking up. Press Escape or use the Skip intro button to go straight to the site.
      </p>
      <button
        ref={skipRef}
        type="button"
        className="intro-skip absolute right-5 bottom-5 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium tracking-wide text-mist-300 backdrop-blur-md transition hover:border-glow-300/40 hover:text-white sm:right-8 sm:bottom-8"
      >
        Skip intro <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

/** Small client button that replays the intro from anywhere on the homepage. */
export function playNouriIntro() {
  window.dispatchEvent(new Event(PLAY_INTRO_EVENT));
}
