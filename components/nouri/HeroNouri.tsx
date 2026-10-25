"use client";

import { useEffect, useRef } from "react";
import { NouriRobot } from "./NouriRobot";
import { applyPose, REST_POSE } from "./pose";

/**
 * The homepage robot. It is also the intro's landing target (`data-nouri-anchor`):
 * the intro camera ends exactly on this element, rendered in the same REST_POSE.
 * Once the intro is over Nouri blinks and gently follows the pointer.
 */
export function HeroNouri({ className }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const html = document.documentElement;
    const target = { x: 0, y: 0 };
    const look = { x: 0, y: 0 };
    let nextBlink = performance.now() + 2600;
    let blinkStart = -1;
    let doubleBlink = false;
    let visible = true;
    let raf = 0;

    const onPointer = (e: PointerEvent) => {
      const r = svg.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / Math.max(320, r.width);
      const dy = (e.clientY - (r.top + r.height * 0.32)) / Math.max(320, r.height);
      target.x = Math.max(-1, Math.min(1, dx)) * 7;
      target.y = Math.max(-1, Math.min(1, dy)) * 4;
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      // Hold the exact rest pose while the intro is landing on us.
      if (!visible || html.getAttribute("data-intro") === "play") return;

      look.x += (target.x - look.x) * 0.06;
      look.y += (target.y - look.y) * 0.06;

      let blink = 0;
      if (blinkStart < 0 && now >= nextBlink) blinkStart = now;
      if (blinkStart >= 0) {
        const p = (now - blinkStart) / 220;
        if (p >= 1) {
          blinkStart = doubleBlink ? now + 120 : -1;
          doubleBlink = !doubleBlink && Math.random() < 0.18;
          if (blinkStart < 0) nextBlink = now + 2400 + Math.random() * 3600;
        } else if (p > 0) {
          blink = Math.sin(Math.PI * p);
        }
      }

      applyPose(svg, {
        ...REST_POSE,
        blink,
        lookX: look.x,
        lookY: look.y,
        tilt: look.x * 0.35,
        brow: REST_POSE.brow - Math.max(0, -look.y) * 0.6,
      });
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(svg);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div data-nouri-anchor className={className}>
      <NouriRobot svgRef={svgRef} pose={REST_POSE} className="block h-full w-full" label="Nouri, a friendly white companion robot with glowing cyan eyes, smiling" />
    </div>
  );
}
