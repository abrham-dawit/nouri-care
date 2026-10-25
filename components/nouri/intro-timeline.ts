import { FACE_CENTER, NOURI_BOUNDS, type NouriPose } from "./pose";

/** Seconds. The overlay then spends REVEAL_DURATION fading its backdrop away. */
export const INTRO_END = 8.9;
export const REVEAL_DURATION = 0.9;

const CAMERA_START = 5.3;
const CAMERA_END = 8.7;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

type Keyframes = readonly (readonly [time: number, value: number])[];

/** Piecewise interpolation between keyframes with a gentle ease on every segment. */
function track(keys: Keyframes, t: number) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      return lerp(v0, v1, easeInOutSine((t - t0) / (t1 - t0)));
    }
  }
  return keys[keys.length - 1][1];
}

function blinkAt(t: number, at: number, duration = 0.24) {
  const p = (t - at) / duration;
  return p > 0 && p < 1 ? Math.sin(Math.PI * p) : 0;
}

const OPEN: Keyframes = [[0.9, 0], [1.5, 0.45], [1.85, 0.38], [2.35, 1]];
const GLOW: Keyframes = [[0.9, 0], [2.4, 1]];
const LOOK_X: Keyframes = [[2.8, 0], [3.3, -7], [3.6, -7], [4.1, 7], [4.4, 7], [4.85, 0]];
const LOOK_Y: Keyframes = [[2.8, 0], [3.3, -3], [4.4, -2], [4.85, 0]];
const TILT: Keyframes = [[2.8, 0], [3.3, -4], [3.6, -4], [4.1, 3], [4.4, 3], [4.9, 0]];
const BROW: Keyframes = [[2.7, 0], [3.2, -6], [4.4, -6], [4.9, -2], [5.7, -4]];
const SMILE: Keyframes = [[4.7, 0], [5.5, 1]];
const SOFTEN: Keyframes = [[4.9, 0], [5.7, 1]];
const LIGHT: Keyframes = [[5.6, 0], [8.4, 1]];

export function introPoseAt(t: number): NouriPose {
  return {
    open: track(OPEN, t),
    blink: Math.max(blinkAt(t, 2.5), blinkAt(t, 4.55), blinkAt(t, 7.3, 0.22)),
    lookX: track(LOOK_X, t),
    lookY: track(LOOK_Y, t),
    tilt: track(TILT, t),
    brow: track(BROW, t),
    smile: track(SMILE, t),
    soften: track(SOFTEN, t),
    light: track(LIGHT, t),
    glow: track(GLOW, t),
  };
}

export type Rect = { left: number; top: number; width: number; height: number };
export type ViewBox = { x: number; y: number; w: number; h: number };

/** Close-up framing: just the eyes and smile, filling the screen. */
const CLOSE_UP = { w: 250, h: 150 };

/**
 * The camera is parametrised by zoom (screen px per scene unit) and the screen
 * position of the face centre. Zoom interpolates logarithmically so the pull-back
 * feels constant-speed; the face glides in screen space so it never swings.
 */
export function cameraAt(t: number, viewport: { w: number; h: number }, anchor: Rect | null): ViewBox {
  const { w: W, h: H } = viewport;

  const k0 = Math.min(W / CLOSE_UP.w, H / CLOSE_UP.h);
  const s0 = { x: W / 2, y: H / 2 };

  // Final framing maps NOURI_BOUNDS onto the homepage robot's on-screen rect
  // (same math as the SVG's default xMidYMid meet), so the hand-off is pixel-identical.
  const target = anchor ?? fallbackAnchor(W, H);
  const k1 = Math.min(target.width / NOURI_BOUNDS.w, target.height / NOURI_BOUNDS.h);
  const offX = target.left + (target.width - NOURI_BOUNDS.w * k1) / 2;
  const offY = target.top + (target.height - NOURI_BOUNDS.h * k1) / 2;
  const s1 = {
    x: offX + (FACE_CENTER.x - NOURI_BOUNDS.x) * k1,
    y: offY + (FACE_CENTER.y - NOURI_BOUNDS.y) * k1,
  };

  const e = smootherstep(clamp01((t - CAMERA_START) / (CAMERA_END - CAMERA_START)));
  const k = Math.exp(lerp(Math.log(k0), Math.log(k1), e));
  const sx = lerp(s0.x, s1.x, e);
  const sy = lerp(s0.y, s1.y, e);

  return { x: FACE_CENTER.x - sx / k, y: FACE_CENTER.y - sy / k, w: W / k, h: H / k };
}

function fallbackAnchor(W: number, H: number): Rect {
  const height = H * 0.6;
  const width = (height * NOURI_BOUNDS.w) / NOURI_BOUNDS.h;
  return { left: (W - width) / 2, top: (H - height) / 2, width, height };
}

export const formatViewBox = (v: ViewBox) => `${v.x.toFixed(3)} ${v.y.toFixed(3)} ${v.w.toFixed(3)} ${v.h.toFixed(3)}`;
