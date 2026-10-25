/**
 * Nouri's face and body are driven by a single "pose". The same pose → attribute
 * mapping is used for the server-rendered SVG and for per-frame imperative
 * updates, so the face can never drift away from the head it is drawn on.
 */

export type NouriPose = {
  /** 0 = eyes shut, 1 = fully open */
  open: number;
  /** 0 = no blink, 1 = eyes closed by a blink */
  blink: number;
  /** pupil offset in scene units */
  lookX: number;
  lookY: number;
  /** head tilt in degrees */
  tilt: number;
  /** brow offset in scene units (negative = raised) */
  brow: number;
  /** 0..1 smile drawn */
  smile: number;
  /** 0..1 warmth: softer eyes, rosy cheeks */
  soften: number;
  /** 0..1 how much of the white body is lit */
  light: number;
  /** 0..1 eye glow intensity */
  glow: number;
};

export const SLEEP_POSE: NouriPose = {
  open: 0,
  blink: 0,
  lookX: 0,
  lookY: 0,
  tilt: 0,
  brow: 0,
  smile: 0,
  soften: 0,
  light: 0,
  glow: 0,
};

/** Where the intro ends and where the homepage robot rests. */
export const REST_POSE: NouriPose = {
  open: 1,
  blink: 0,
  lookX: 0,
  lookY: 0,
  tilt: 0,
  brow: -4,
  smile: 1,
  soften: 1,
  light: 1,
  glow: 1,
};

/** Scene-space bounding box of the full robot (ears, antenna, feet, shadow). */
export const NOURI_BOUNDS = { x: 84, y: 44, w: 432, h: 540 } as const;
export const NOURI_VIEWBOX = `${NOURI_BOUNDS.x} ${NOURI_BOUNDS.y} ${NOURI_BOUNDS.w} ${NOURI_BOUNDS.h}`;

export const EYE_L = { x: 238, y: 195 } as const;
export const EYE_R = { x: 362, y: 195 } as const;
export const HEAD_PIVOT = { x: 300, y: 330 } as const;
/** Centre of the face (between eyes and smile) — the intro camera's focus. */
export const FACE_CENTER = { x: 300, y: 222 } as const;

export type NouriPart =
  | "head"
  | "litHead"
  | "litBody"
  | "eyeL"
  | "eyeR"
  | "pupilL"
  | "pupilR"
  | "browL"
  | "browR"
  | "haloL"
  | "haloR"
  | "smile"
  | "smileHalo"
  | "cheeks";

type PartAttrs = { transform?: string; opacity?: string; strokeDashoffset?: string };

const n = (v: number) => (Math.round(v * 1000) / 1000).toString();
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function eyeTransform(p: NouriPose, c: { x: number; y: number }) {
  const lid = Math.max(0.02, clamp01(p.open) * (1 - clamp01(p.blink)));
  const sy = lid * (1 - 0.12 * p.soften);
  const sx = 1 + 0.04 * p.soften;
  const dx = p.lookX * 0.35;
  const dy = p.lookY * 0.35 - 3 * p.soften;
  return `translate(${n(c.x + dx)} ${n(c.y + dy)}) scale(${n(sx)} ${n(sy)}) translate(${-c.x} ${-c.y})`;
}

export function poseAttributes(p: NouriPose): Record<NouriPart, PartAttrs> {
  const eyeOpacity = n(clamp01(p.open * 4));
  const pupil = `translate(${n(p.lookX)} ${n(p.lookY)})`;
  const brow = `translate(${n(p.lookX * 0.3)} ${n(p.brow + p.lookY * 0.2)})`;
  const browOpacity = n(clamp01((p.open - 0.5) * 2) * (1 - clamp01(p.blink) * 0.3));
  const smileOffset = n(1 - clamp01(p.smile));
  const smileOpacity = n(clamp01(p.smile * 6));
  return {
    head: { transform: `rotate(${n(p.tilt)} ${HEAD_PIVOT.x} ${HEAD_PIVOT.y})` },
    litHead: { opacity: n(clamp01(p.light)) },
    litBody: { opacity: n(clamp01(p.light)) },
    eyeL: { transform: eyeTransform(p, EYE_L), opacity: eyeOpacity },
    eyeR: { transform: eyeTransform(p, EYE_R), opacity: eyeOpacity },
    pupilL: { transform: pupil },
    pupilR: { transform: pupil },
    browL: { transform: brow, opacity: browOpacity },
    browR: { transform: brow, opacity: browOpacity },
    haloL: { opacity: n(clamp01(p.glow) * clamp01(p.open * 2) * 0.9) },
    haloR: { opacity: n(clamp01(p.glow) * clamp01(p.open * 2) * 0.9) },
    smile: { strokeDashoffset: smileOffset, opacity: smileOpacity },
    smileHalo: { strokeDashoffset: smileOffset, opacity: n(clamp01(p.smile * 6) * 0.35) },
    cheeks: { opacity: n(clamp01(p.soften) * 0.3) },
  };
}

const DOM_ATTR: Record<keyof PartAttrs, string> = {
  transform: "transform",
  opacity: "opacity",
  strokeDashoffset: "stroke-dashoffset",
};

/** Per-frame update without React re-renders. Element lookups are cached per SVG. */
const partCache = new WeakMap<SVGSVGElement, Map<NouriPart, Element>>();

export function applyPose(svg: SVGSVGElement, pose: NouriPose) {
  let parts = partCache.get(svg);
  if (!parts) {
    parts = new Map();
    svg.querySelectorAll<SVGElement>("[data-part]").forEach((el) => {
      parts!.set(el.dataset.part as NouriPart, el);
    });
    partCache.set(svg, parts);
  }
  const attrs = poseAttributes(pose);
  for (const [part, values] of Object.entries(attrs) as [NouriPart, PartAttrs][]) {
    const el = parts.get(part);
    if (!el) continue;
    for (const [key, value] of Object.entries(values) as [keyof PartAttrs, string][]) {
      el.setAttribute(DOM_ATTR[key], value);
    }
  }
}
