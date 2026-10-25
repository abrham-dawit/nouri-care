// Nouri companion robot: parametric, print-ready enclosure built around its electronics.
//
//   cd hardware/nouri-robot && npm install && npm run build
//
// Coordinates (mm): X = width (right +), Y = up, Z = toward the viewer (front +).
// The feet stand below Y = 0; the front/back shells split at Z = 0.
// Outputs: ./print/*.stl (already oriented flat for printing), ./preview/*, fit report.
//
// Face: Waveshare ESP32-S3-Touch-LCD-1.85, a round 360×360 display with the ESP32-S3, microphone,
// speaker amplifier (PCM5101), battery charger and TF slot on its own board. Dimensions are from
// Waveshare's outline drawing (published for the ESP32-S3-LCD-1.85; verify the Touch version
// with calipers). The board can't drive a camera, so a separate Seeed XIAO ESP32-S3 Sense
// handles the camera behind the lens hole.

import Module from "manifold-3d";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";

/* ═══════════════ 1. HARDWARE: measure your parts and edit these ═══════════════ */

const HW = {
  display: {
    // "enclosed": the unit in Waveshare's round case (55 × 55 mm footprint, 14.6 mm thick).
    // "bare": the board without its case (uses the glass/PCB numbers below).
    mode: "enclosed",
    case: { d: 55.0, t: 14.6, usbZ: 8.5 }, // usbZ: USB-C opening centre, measured from the case front
    enclosedTabAngles: [35, 145, 215, 325], // four hold-down tabs on the case's back edge
    glass: 48.08, // round display glass ⌀
    tab: [12, 1.9], // ribbon tab below the glass (width, how far it sticks out)
    active: 45.68, // visible circle ⌀ → the window in the visor
    pcb: 47.86, // round board ⌀
    // Measured overall: ~17 mm from the glass front to the tallest part on the back.
    stack: 5.0, // glass front → back of the board (assumed split of the 17 mm)
    back: 12.0, // connectors, TF slot and buttons behind the board (17 − 5)
    usb: { w: 9.2, protrude: 1.83 }, // USB-C on the bottom edge
    // USB-C plug + cable: hangs straight down through the neck (right-angle cables also fit)
    usbPlug: [12.5, 7, 26],
    offsetY: -6, // display centre relative to the head centre (camera sits above)
    // Hold-down tabs press the board's edge here (angles seen from the front, 0° = right).
    // 180° and −44° sit on the two M2 holes from the drawing; 120° is a free edge near the top.
    tabAngles: [180, -44, 120],
  },
  camera: {
    module: [8.6, 8.6], // OV2640 module on the XIAO ESP32-S3 Sense
    depth: 7,
    lens: 7.2,
    y: 31, // relative to head centre
    board: [22, 18, 16], // XIAO ESP32-S3 Sense with camera expansion board
  },
  speaker: { size: [30, 20], depth: 5 }, // "2030" 8 Ω 2 W speaker for the board's SPK connector
  led: { d: 5 }, // 5 mm LED / through-hole WS2812 in the antenna
  battery: { size: [62, 36, 11] }, // optional 3.7 V LiPo for the board's MX1.25 battery connector
  usbc: { slot: [9.6, 3.8], board: [14, 12, 10] }, // panel-mount USB-C extension at the back
  screws: { insertHole: 4.2, insertDepth: 7, clearance: 3.4, head: 6.6, selfTapM2: 1.8 },
};

/* ═══════════════ 2. SHAPE: proportions of the Nouri character ═══════════════ */

const S = {
  wall: 2.4,
  chamfer: 1.6, // 45° edge chamfer (prints cleanly face-down, unlike a round)
  head: { w: 130, h: 90, d: 56, r: 28 },
  visor: { w: 108, h: 70, r: 20 },
  neck: { w: 60, h: 6, d: 48, r: 3 }, // deep enough for the display's USB-C plug to pass
  body: { w: 100, h: 82, d: 50, r: 24 },
  badge: { size: 36, r: 9, y: 47, groove: 1.2, depth: 0.8 }, // heart badge / speaker grille
  label: { text: "Nouri", height: 9, stroke: 1.4, y: 16 },
  ear: { d: 26, h: 40, t: 8, peg: 4, pegLen: 2.2, pegOffset: 12, vent: 2.5 }, // oval pods with a vent
  antenna: { len: 26, w: 12, h: 10, stem: 6, stemLen: 8 },
  foot: { d: 32, h: 10, x: 26, peg: 8, pegLen: 9 },
  fit: 0.3, // clearance for parts that slot together
};

/* ═══════════════ setup ═══════════════ */

const here = dirname(fileURLToPath(import.meta.url));
const wasm = await Module();
wasm.setup();
const { Manifold, CrossSection } = wasm;

const W = S.wall;
const bodyCY = S.body.h / 2;
const neckY0 = S.body.h - 1, neckY1 = S.body.h + S.neck.h + 1;
const headCY = S.body.h + S.neck.h + S.head.h / 2;
const headTop = headCY + S.head.h / 2;
const headFrontIn = S.head.d / 2 - W; // inner face of the head's front wall
const bodyFrontIn = S.body.d / 2 - W;

const rr = (w, h, r, segs = 96) => CrossSection.square([Math.max(0.01, w - 2 * r), Math.max(0.01, h - 2 * r)], true).offset(r, "Round", 2, segs);
const disc = (d, segs = 128) => CrossSection.circle(d / 2, segs);
const box = (size, center) => Manifold.cube(size, true).translate(center);
const cylZ = (h, r, segs = 64) => Manifold.cylinder(h, r, r, segs); // along +Z from z=0
const cylX = (h, r, segs = 64) => cylZ(h, r, segs).rotate([0, 90, 0]); // along +X from x=0
const cylY = (h, r, segs = 64) => cylZ(h, r, segs).rotate([-90, 0, 0]); // along +Y from y=0
const U = (list) => Manifold.union(list.filter(Boolean));
/** Extrude centred on Z = 0. (The library's own `center` flag gave wrong volumes here.) */
const extC = (cs, h) => cs.extrude(h).translate([0, 0, -h / 2]);

/** Rounded box with 45° chamfered front/back edges, centred at (0, cy, 0). */
function chamferedBox(w, h, d, r, c, cy) {
  const mid = extC(rr(w, h, r), d - 2 * c);
  const cap = extC(rr(w - 2 * c, h - 2 * c, Math.max(1, r - c)), 0.01);
  return Manifold.hull([mid, cap.translate([0, 0, d / 2 - 0.005]), cap.translate([0, 0, -d / 2 + 0.005])]).translate([0, cy, 0]);
}
const roundedBox = (w, h, d, r, cy) => extC(rr(w, h, r), d).translate([0, cy, 0]);

/* ═══════════════ shell ═══════════════ */

const outer = U([
  chamferedBox(S.head.w, S.head.h, S.head.d, S.head.r, S.chamfer, headCY),
  roundedBox(S.neck.w, neckY1 - neckY0, S.neck.d, S.neck.r, (neckY0 + neckY1) / 2),
  chamferedBox(S.body.w, S.body.h, S.body.d, S.body.r, S.chamfer, bodyCY),
]);
const inner = U([
  roundedBox(S.head.w - 2 * W, S.head.h - 2 * W, S.head.d - 2 * W, S.head.r - W, headCY),
  roundedBox(S.neck.w - 2 * W, S.neck.h + 2 * W + 4, S.neck.d - 2 * W, Math.max(1, S.neck.r - W), (neckY0 + neckY1) / 2),
  roundedBox(S.body.w - 2 * W, S.body.h - 2 * W, S.body.d - 2 * W, S.body.r - W, bodyCY),
]);
let shell = outer.subtract(inner);

/* ── joining bosses: M3 heat-set insert in the front, countersunk screw from the back ── */
const joins = [
  [52, headCY + 34], [-52, headCY + 34], [52, headCY - 36], [-52, headCY - 36],
  [38, 12], [-38, 12], [38, 70], [-38, 70],
];
const halfDepthAt = (y) => (y > S.body.h + S.neck.h / 2 ? S.head.d / 2 : S.body.d / 2);
const joinBosses = U(joins.map(([x, y]) => cylZ(halfDepthAt(y) * 2, 4, 40).translate([x, y, -halfDepthAt(y)]))).intersect(outer);

/* ── speaker frame behind the heart (2030 rectangular speaker) ── */
const spk = HW.speaker;
const speakerFrame = rr(spk.size[0] + 4.6, spk.size[1] + 4.6, 2.5)
  .subtract(rr(spk.size[0] + 0.6, spk.size[1] + 0.6, 1))
  .extrude(4)
  .translate([0, S.badge.y, bodyFrontIn - 4]);

/* ── feet sockets: front-to-back ribs on the floor (vertical when printed, so no supports) ── */
const footBosses = U([S.foot.x, -S.foot.x].map((x) => box([14, 12, S.body.d - 2 * W + 1], [x, 6, 0]))).intersect(outer);

shell = U([shell, joinBosses, speakerFrame, footBosses]);

/* ── cuts through walls ── */
const heart = (() => {
  const pts = Array.from({ length: 90 }, (_, i) => {
    const t = (2 * Math.PI * i) / 90;
    return [16 * Math.sin(t) ** 3, 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)];
  });
  return new CrossSection([pts], "NonZero").scale(0.78).translate([0, S.badge.y + 1]);
})();
const grilleHoles = (() => {
  const holes = [];
  for (let gy = -20; gy <= 20; gy += 3.2)
    for (let gx = -20; gx <= 20; gx += 3.4) {
      const x = gx + ((Math.round(gy / 3.2) & 1) * 1.7), y = S.badge.y + gy;
      holes.push(CrossSection.circle(0.95, 16).translate([x, y]));
    }
  return CrossSection.union(holes).intersect(heart.offset(-0.6, "Round"));
})();

/** Single-stroke lettering for the label (engraved). */
function strokeText(text, height, stroke) {
  const k = height / 9; // glyphs are drawn on a 9-unit cap height
  const arc = (cx, cy, rx, ry, a0, a1, n = 14) => Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
  const glyphs = {
    N: { w: 6, paths: [[[0, 0], [0, 9], [6, 0], [6, 9]]] },
    o: { w: 5.8, paths: [arc(2.9, 3.15, 2.9, 3.15, 0, 360, 28)] },
    u: { w: 5.4, paths: [[[0, 6.3], ...arc(2.7, 2.7, 2.7, 2.7, 180, 360), [5.4, 6.3]], [[5.4, 6.3], [5.4, 0]]] },
    r: { w: 3.8, paths: [[[0, 0], [0, 6.3]], arc(3.8, 3.6, 3.8, 2.7, 180, 90)] },
    i: { w: 0, paths: [[[0, 0], [0, 6.3]]], dots: [[0, 8.5]] },
  };
  const gap = 2.2;
  let cursor = 0;
  const parts = [];
  for (const ch of text) {
    const g = glyphs[ch];
    if (!g) throw new Error(`No glyph for "${ch}" (add it to strokeText)`);
    for (const path of g.paths) {
      for (let i = 0; i < path.length - 1; i++) {
        const [x0, y0] = path[i], [x1, y1] = path[i + 1];
        const len = Math.hypot(x1 - x0, y1 - y0);
        if (len < 1e-6) continue;
        parts.push(CrossSection.square([len * k, stroke], true).rotate((Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI).translate([((x0 + x1) / 2 + cursor) * k, ((y0 + y1) / 2) * k]));
      }
      for (const [x, y] of path) parts.push(CrossSection.circle(stroke / 2, 12).translate([(x + cursor) * k, y * k]));
    }
    for (const [x, y] of g.dots ?? []) parts.push(CrossSection.circle(stroke * 0.65, 16).translate([(x + cursor) * k, y * k]));
    cursor += g.w + gap;
  }
  const cs = CrossSection.union(parts);
  const b = cs.bounds();
  return cs.translate([-(b.min[0] + b.max[0]) / 2, 0]);
}

const frontFaceCut = (cs, depth, zFace) => cs.extrude(depth + 0.01).translate([0, 0, zFace - depth]);
const badgeGroove = rr(S.badge.size, S.badge.size, S.badge.r).subtract(rr(S.badge.size - 2 * S.badge.groove, S.badge.size - 2 * S.badge.groove, S.badge.r - S.badge.groove)).translate([0, S.badge.y]);

const cuts = U([
  // visor opening
  rr(S.visor.w, S.visor.h, S.visor.r).extrude(W + 2).translate([0, headCY, headFrontIn - 1]),
  // heart speaker grille, badge outline and "Nouri" label (engraved)
  grilleHoles.extrude(W + 2).translate([0, 0, bodyFrontIn - 1]),
  frontFaceCut(badgeGroove, S.badge.depth, S.body.d / 2),
  frontFaceCut(strokeText(S.label.text, S.label.height, S.label.stroke).translate([0, S.label.y]), S.badge.depth, S.body.d / 2),
  // antenna stem hole
  cylY(W + 2, S.antenna.stem / 2 + S.fit / 2, 32).translate([0, headTop - W - 1, 0]),
  // ears: vent hole (helps the display board's microphone hear) + two pegs each side
  ...[1, -1].flatMap((sx) => [
    cylX(W + 2, S.ear.vent / 2 + 0.25, 24).translate([sx > 0 ? S.head.w / 2 - W - 1 : -S.head.w / 2 - 1, headCY, 0]),
    ...[1, -1].map((sy) => cylX(W + 2, S.ear.peg / 2 + S.fit / 2, 24).translate([sx > 0 ? S.head.w / 2 - W - 1 : -S.head.w / 2 - 1, headCY + sy * S.ear.pegOffset, 0])),
  ]),
  // USB-C slot in the back of the body
  rr(HW.usbc.slot[0], HW.usbc.slot[1], HW.usbc.slot[1] / 2).extrude(W + 2).translate([0, 14, -S.body.d / 2 - 1]),
  // feet peg holes
  ...[S.foot.x, -S.foot.x].map((x) => cylY(10, S.foot.peg / 2 + S.fit / 2, 32).translate([x, -0.5, 0])),
  // joining: insert holes (front) and screw holes + countersinks (back)
  ...joins.flatMap(([x, y]) => {
    const hd = halfDepthAt(y);
    const cs = (HW.screws.head - HW.screws.clearance) / 2;
    return [
      cylZ(HW.screws.insertDepth, HW.screws.insertHole / 2, 32).translate([x, y, 0]),
      cylZ(hd + 1, HW.screws.clearance / 2, 32).translate([x, y, -hd - 0.5]),
      Manifold.cylinder(cs + 0.01, HW.screws.head / 2, HW.screws.clearance / 2, 32).translate([x, y, -hd - 0.005]),
    ];
  }),
]);
shell = shell.subtract(cuts);

const frontShell = shell.trimByPlane([0, 0, 1], 0);
const backShell = shell.trimByPlane([0, 0, -1], 0);

/* ═══════════════ visor bezel (print in black) with the round display mount ═══════════════ */

const disp = HW.display;
const dispCY = headCY + disp.offsetY;
const flange = 2.6;
const bezelPlugZ0 = headFrontIn, bezelFlangeZ0 = headFrontIn - 1.6;
const enclosed = disp.mode === "enclosed";
const holdD = enclosed ? disp.case.d : disp.glass; // the outline the ring locates
const holdDepth = enclosed ? disp.case.t : disp.stack; // front → back face the tabs press on
const pcbBackZ = bezelFlangeZ0 - holdDepth; // back face of the case (or of the bare board)
const ringH = enclosed ? 6 : disp.stack;
const ringID = holdD + 0.5, ringOD = ringID + 4;
const tabR = ringOD / 2 + 3.2; // hold-down screw radius from the display centre
const pressR = enclosed ? disp.case.d / 2 - 2.5 : disp.pcb / 2 - 1.5; // where each tab presses
const tabAngles = enclosed ? disp.enclosedTabAngles : disp.tabAngles;
const polar = (deg, r) => [r * Math.cos((deg * Math.PI) / 180), dispCY + r * Math.sin((deg * Math.PI) / 180)];
const tabPts = tabAngles.map((a) => polar(a, tabR));

let bezel = U([
  rr(S.visor.w - S.fit, S.visor.h - S.fit, S.visor.r - S.fit / 2).extrude(W).translate([0, headCY, bezelPlugZ0]),
  rr(S.visor.w + 2 * flange, S.visor.h + 2 * flange, S.visor.r + flange).extrude(1.6).translate([0, headCY, bezelFlangeZ0]),
  // locating ring around the round case (or bare glass + board)
  disc(ringOD).subtract(disc(ringID)).extrude(ringH).translate([0, dispCY, bezelFlangeZ0 - ringH]),
  // bosses for the hold-down tabs (M2 self-tapping), reaching the back face
  ...tabPts.map(([x, y]) => cylZ(holdDepth, 3, 32).translate([x, y, pcbBackZ])),
  // camera holder behind the lens hole
  box([HW.camera.module[0] + 4, HW.camera.module[1] + 4, 6], [0, headCY + HW.camera.y, bezelFlangeZ0 - 3]),
]);
bezel = bezel.subtract(
  U([
    // round window onto the visible screen
    disc(disp.active + 0.6).extrude(10).translate([0, dispCY, bezelFlangeZ0 - 2]),
    // gap in the ring at the bottom for the USB-C plug (and the ribbon tab on a bare board)
    box([Math.max(disp.tab[0], disp.usb.w, disp.usbPlug[0]) + 3, 8, ringH + 0.2], [0, dispCY - ringID / 2 - 1.5, bezelFlangeZ0 - ringH / 2 - 0.1]),
    // camera pocket and lens hole
    box([HW.camera.module[0], HW.camera.module[1], 6.02], [0, headCY + HW.camera.y, bezelFlangeZ0 - 3 - 0.01]),
    cylZ(10, HW.camera.lens / 2, 40).translate([0, headCY + HW.camera.y, bezelFlangeZ0 - 1]),
    // tab pilot holes
    ...tabPts.map(([x, y]) => cylZ(Math.min(8, holdDepth) + 0.02, HW.screws.selfTapM2 / 2, 20).translate([x, y, pcbBackZ - 0.01])),
    // notches around shell bosses that pass beside the flange
    ...joins.filter(([, y]) => y > S.body.h).map(([x, y]) => cylZ(10, 4 + S.fit + 0.2, 32).translate([x, y, bezelFlangeZ0 - 5])),
  ]),
);

/* ═══════════════ small parts ═══════════════ */

// Hold-down tabs: screw onto the bezel bosses and press the edge of the case (or bare board).
const tabLen = tabR - pressR;
const displayTabs = U(
  tabAngles.map((a, i) => {
    const [x, y] = tabPts[i];
    // from 3 mm outside the screw to exactly the pressing point on the board edge
    const bar = rr(tabLen + 3, 6, 3).extrude(2.5).translate([(3 - tabLen) / 2, 0, 0]).subtract(cylZ(3, 1.15, 20).translate([0, 0, -0.5]));
    return bar.rotate([0, 0, a]).translate([x, y, pcbBackZ - 2.5]);
  }),
);

const earAt = (sx) => {
  const x0 = sx > 0 ? S.head.w / 2 : -S.head.w / 2 - S.ear.t;
  const oval = (len, r) => cylX(len, r, 72).scale([1, S.ear.h / S.ear.d, 1]); // tall oval, like the character
  let e = oval(S.ear.t, S.ear.d / 2).translate([x0, headCY, 0]);
  // decorative oval ring groove on the outer face (fill with cyan paint, or print the ring in cyan)
  const ringX = sx > 0 ? x0 + S.ear.t - 1 : x0 - 0.01;
  e = e.subtract(oval(1.01, S.ear.d / 2 - 3).translate([ringX, headCY, 0]).subtract(oval(1.2, S.ear.d / 2 - 5).translate([ringX - 0.1, headCY, 0])));
  e = e.subtract(cylX(S.ear.t + 2, S.ear.vent / 2, 20).translate([x0 - 1, headCY, 0])); // vent
  const pegX = sx > 0 ? x0 - S.ear.pegLen : x0 + S.ear.t;
  return e.add(U([1, -1].map((sy) => cylX(S.ear.pegLen, S.ear.peg / 2, 24).translate([pegX, headCY + sy * S.ear.pegOffset, 0]))));
};
const ears = { left: earAt(-1), right: earAt(1) };

const antenna = (() => {
  const a = S.antenna;
  const top = rr(a.len, a.w, a.w / 2).extrude(a.h).rotate([-90, 0, 0]).translate([0, headTop - 0.01, 0]);
  const stem = cylY(a.stemLen, a.stem / 2, 32).translate([0, headTop - a.stemLen, 0]);
  const led = cylY(a.stemLen + 7, HW.led.d / 2 + 0.2, 32).translate([0, headTop - a.stemLen - 0.01, 0]);
  return top.add(stem).subtract(led);
})();

const footAt = (x) => {
  const f = S.foot;
  return cylY(f.h, f.d / 2, 72).translate([x, -f.h, 0]).add(cylY(f.pegLen, f.peg / 2, 32).translate([x, -0.01, 0]));
};
const feet = U([footAt(S.foot.x), footAt(-S.foot.x)]);

/* ═══════════════ hardware keep-out volumes (for fit checks & preview) ═══════════════ */

// [width, thickness, length]: the USB-C plug hangs straight down from the bottom edge
const plugBox = (topY, z) => box([disp.usbPlug[0], disp.usbPlug[2], disp.usbPlug[1]], [0, topY - disp.usbPlug[2] / 2, z]);
const displayComps = enclosed
  ? {
      display: disc(disp.case.d).extrude(disp.case.t - 0.1).translate([0, dispCY, pcbBackZ + 0.05]),
      "usb plug": plugBox(dispCY - disp.case.d / 2 - 0.05, bezelFlangeZ0 - disp.case.usbZ),
    }
  : {
      display: U([
        disc(disp.glass).extrude(disp.stack - 0.1).translate([0, dispCY, pcbBackZ + 0.05]),
        box([disp.tab[0], disp.tab[1] + 1, disp.stack - 0.1], [0, dispCY - disp.glass / 2 - disp.tab[1] / 2 + 0.5, pcbBackZ + disp.stack / 2]),
      ]),
      // Parts on the back of the board, inside the 1.6 mm edge band that the hold-down tabs press on
      "display back": disc(disp.pcb - 3.6).extrude(disp.back).translate([0, dispCY, pcbBackZ - disp.back - 0.05]),
      // The USB-C receptacle is on the back of the board, so the plug stays behind the glass
      "usb plug": plugBox(dispCY - disp.pcb / 2 - disp.usb.protrude, pcbBackZ - disp.usbPlug[1] / 2 - 0.05),
    };
// The camera board sits behind the display's depth so it never overlaps it.
const displayBackZ = enclosed ? pcbBackZ : pcbBackZ - disp.back;
const camBoardZ = Math.min(bezelFlangeZ0 - HW.camera.depth, displayBackZ) - HW.camera.board[2] / 2 - 1;
const comps = {
  ...displayComps,
  camera: box([HW.camera.module[0] - 0.2, HW.camera.module[1] - 0.2, HW.camera.depth], [0, headCY + HW.camera.y, bezelFlangeZ0 - HW.camera.depth / 2 - 0.05]),
  "camera board": box(HW.camera.board, [0, headCY + HW.camera.y - 4, camBoardZ]),
  speaker: box([spk.size[0], spk.size[1], spk.depth], [0, S.badge.y, bodyFrontIn - spk.depth / 2 - 0.05]),
  led: cylY(5, HW.led.d / 2, 24).translate([0, headTop - S.antenna.stemLen + 0.3, 0]),
  battery: box(HW.battery.size, [0, 46, -S.body.d / 2 + W + HW.battery.size[2] / 2 + 0.05]),
  "usb-c port": box(HW.usbc.board, [0, 14, -S.body.d / 2 + W + HW.usbc.board[2] / 2 + 0.05]),
};

/* ═══════════════ fit checks ═══════════════ */

const solids = { "front shell": frontShell, "back shell": backShell, bezel, "display tabs": displayTabs, ears: U([ears.left, ears.right]), antenna, feet };
const checks = [];
for (const [name, c] of Object.entries(comps)) {
  const hits = Object.entries(solids)
    .map(([sn, s]) => [sn, c.intersect(s).volume()])
    .filter(([, v]) => v > 0.05)
    .map(([sn, v]) => `${sn} (${v.toFixed(1)} mm³)`);
  const others = Object.entries(comps)
    .filter(([n]) => n !== name)
    .map(([n, o]) => [n, c.intersect(o).volume()])
    .filter(([, v]) => v > 0.05)
    .map(([n]) => n);
  const outside = name === "led" ? 0 : c.subtract(inner).volume();
  checks.push({ component: name, ok: !hits.length && !others.length && outside < 0.05, collidesWith: [...hits, ...others], outsideCavity_mm3: +outside.toFixed(1) });
}
const okAll = checks.every((c) => c.ok);
console.log("\nHardware fit check");
for (const c of checks) {
  console.log(`  ${c.ok ? "✓" : "✗"} ${c.component.padEnd(13)} ${c.ok ? "fits" : `collides with ${c.collidesWith.join(", ") || "-"}${c.outsideCavity_mm3 ? `; ${c.outsideCavity_mm3} mm³ outside the cavity` : ""}`}`);
}

/* ═══════════════ output ═══════════════ */

function writeSTL(path, m) {
  const { vertProperties: v, triVerts: t, numProp: np } = m.getMesh();
  const n = t.length / 3;
  const buf = Buffer.alloc(84 + n * 50);
  buf.write("Nouri robot - generate.mjs (mm)", 0, "ascii");
  buf.writeUInt32LE(n, 80);
  for (let i = 0; i < n; i++) {
    const p = [0, 1, 2].map((k) => [v[t[i * 3 + k] * np], v[t[i * 3 + k] * np + 1], v[t[i * 3 + k] * np + 2]]);
    const a = p[1].map((x, j) => x - p[0][j]), b = p[2].map((x, j) => x - p[0][j]);
    const nr = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const l = Math.hypot(...nr) || 1;
    nr.forEach((x, j) => buf.writeFloatLE(x / l, 84 + i * 50 + j * 4));
    p.flat().forEach((x, j) => buf.writeFloatLE(x, 84 + i * 50 + 12 + j * 4));
  }
  writeFileSync(path, buf);
}

/** Lay a part flat for printing: rotate, then drop onto the bed centred at the origin. */
function forPrint(m, rotation) {
  const r = m.rotate(rotation);
  const b = r.boundingBox();
  return r.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2, -b.min[2]]);
}

const printDir = join(here, "print"), previewDir = join(here, "preview");
rmSync(printDir, { recursive: true, force: true }); // regenerated from scratch every build
mkdirSync(printDir, { recursive: true });
mkdirSync(previewDir, { recursive: true });

const printParts = {
  // name: [part, rotation that puts its best face on the bed, material note]
  "front-shell": [frontShell, [180, 0, 0], "white · face down · no supports"],
  "back-shell": [backShell, [0, 0, 0], "white · back down · no supports"],
  "visor-bezel": [bezel, [180, 0, 0], "black · face down · no supports"],
  "display-tabs": [displayTabs, [0, 0, 0], `any · flat (${tabAngles.length} tabs)`],
  "ear-left": [ears.left, [0, -90, 0], "white · outer face down"],
  "ear-right": [ears.right, [0, 90, 0], "white · outer face down"],
  antenna: [antenna, [-90, 0, 0], "translucent / white · top down"],
  feet: [feet, [90, 0, 0], "white or cyan · flat side down, pegs up"],
};

console.log("\nPrint parts");
const partInfo = [];
const oriented = {};
const singleDir = join(printDir, "single-parts");
mkdirSync(singleDir, { recursive: true });
for (const [name, [m, rot, note]] of Object.entries(printParts)) {
  const p = forPrint(m, rot);
  oriented[name] = p;
  writeSTL(join(singleDir, `${name}.stl`), p);
  const b = p.boundingBox();
  const size = [0, 1, 2].map((i) => +(b.max[i] - b.min[i]).toFixed(1));
  partInfo.push({ name, size_mm: size, volume_cm3: +(m.volume() / 1000).toFixed(1), note });
  console.log(`  ${name.padEnd(13)} ${size.join(" × ").padEnd(20)} ${String(+(m.volume() / 1000).toFixed(1)).padStart(5)} cm³  ${note}`);
}

/* ═══════════════ two print plates (Bambu A1 / P1 / X1: 256 × 256 mm bed) ═══════════════ */

const BED = 256, MARGIN = 6, GAP = 6;

/** Rotate a flat part about Z, then move its footprint's corner to (x, y). */
function place(m, x, y, rotZ = 0) {
  const r = rotZ ? m.rotate([0, 0, rotZ]) : m;
  const b = r.boundingBox();
  return r.translate([x - b.min[0], y - b.min[1], -b.min[2]]);
}
const footprint = (m) => { const b = m.boundingBox(); return [b.max[0] - b.min[0], b.max[1] - b.min[1]]; };

/** Big shell in the left column, smaller parts stacked down a right column. */
function layoutPlate(shellName, side) {
  const items = [{ name: shellName, mesh: place(oriented[shellName], MARGIN, MARGIN) }];
  const colX = MARGIN + footprint(oriented[shellName])[0] + GAP;
  let y = MARGIN, rowX = colX, rowH = 0;
  for (const [name, rotZ] of side) {
    const fp = footprint(rotZ ? oriented[name].rotate([0, 0, rotZ]) : oriented[name]);
    if (rowX + fp[0] > BED - MARGIN) { y += rowH + GAP; rowX = colX; rowH = 0; }
    items.push({ name, mesh: place(oriented[name], rowX, y, rotZ) });
    rowX += fp[0] + GAP;
    rowH = Math.max(rowH, fp[1]);
  }
  return items;
}

const plates = {
  "Nouri-FRONT": layoutPlate("front-shell", [["visor-bezel", 90], ["display-tabs", 0], ["antenna", 0]]),
  "Nouri-BACK": layoutPlate("back-shell", [["feet", 0], ["ear-left", 0], ["ear-right", 0]]),
};

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = ~0; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return ~c >>> 0; };

/** Minimal ZIP writer (deflate), enough for a 3MF package. */
function zip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, content] of files) {
    const data = Buffer.from(content), comp = deflateRawSync(data), nameBuf = Buffer.from(name);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0x21, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8); central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12); central.writeUInt16LE(0x21, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, comp);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

/** 3MF with one named object per part, so each can get its own filament in Bambu Studio. */
function write3MF(path, items) {
  const objects = items.map(({ name, mesh }, i) => {
    const { vertProperties: v, triVerts: t, numProp: np } = mesh.getMesh();
    const verts = [], tris = [];
    for (let k = 0; k < v.length / np; k++) verts.push(`<vertex x="${v[k * np].toFixed(4)}" y="${v[k * np + 1].toFixed(4)}" z="${v[k * np + 2].toFixed(4)}"/>`);
    for (let k = 0; k < t.length; k += 3) tris.push(`<triangle v1="${t[k]}" v2="${t[k + 1]}" v3="${t[k + 2]}"/>`);
    return `<object id="${i + 1}" name="${name}" type="model"><mesh><vertices>${verts.join("")}</vertices><triangles>${tris.join("")}</triangles></mesh></object>`;
  });
  const model = `<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">${basename(path)}</metadata><metadata name="Application">Nouri generate.mjs</metadata><resources>${objects.join("")}</resources><build>${items.map((_, i) => `<item objectid="${i + 1}"/>`).join("")}</build></model>`;
  writeFileSync(
    path,
    zip([
      ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`],
      ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`],
      ["3D/3dmodel.model", model],
    ]),
  );
}

console.log(`\nPrint plates (${BED} × ${BED} mm bed)`);
const plateInfo = {};
for (const [plate, items] of Object.entries(plates)) {
  const all = U(items.map((i) => i.mesh));
  const b = all.boundingBox();
  const fits = b.max[0] <= BED && b.max[1] <= BED && b.min[0] >= 0 && b.min[1] >= 0;
  const overlap = items.some((a, i) => items.some((c, j) => j > i && a.mesh.intersect(c.mesh).volume() > 0.01));
  write3MF(join(printDir, `${plate}.3mf`), items);
  writeSTL(join(printDir, `${plate}.stl`), all);
  plateInfo[plate] = { parts: items.map((i) => i.name), extent_mm: [+b.max[0].toFixed(1), +b.max[1].toFixed(1)], fits, overlap };
  console.log(`  ${fits && !overlap ? "✓" : "✗"} ${plate.padEnd(12)} uses ${b.max[0].toFixed(0)} × ${b.max[1].toFixed(0)} mm: ${items.map((i) => i.name).join(", ")}${overlap ? "  (PARTS OVERLAP)" : ""}`);
  if (!fits || overlap) process.exitCode = 1;
}

const assembly = U([frontShell, backShell, bezel, U([ears.left, ears.right]), antenna, feet]);
writeSTL(join(previewDir, "assembled.stl"), assembly);
writeSTL(join(previewDir, "cutaway-front-half.stl"), U([frontShell, bezel, displayTabs]));
writeSTL(join(previewDir, "components.stl"), U(Object.values(comps)));
writeSTL(join(previewDir, "interior-back-half.stl"), backShell);

// Preview only: the round display with Nouri's face on it
const glassZ = bezelFlangeZ0 - 0.6;
const screen = disc(disp.active + 1).extrude(0.6).translate([0, dispCY, glassZ]);
const faceArt = (() => {
  const ring = (x) => CrossSection.circle(1, 48).scale([5.5, 7]).subtract(CrossSection.circle(1, 48).scale([3.5, 5])).translate([x, dispCY + 4]);
  const pupils = [-11, 11].map((x) => CrossSection.circle(1.3, 16).translate([x - 1.6, dispCY + 6.5]));
  const smile = Array.from({ length: 13 }, (_, i) => {
    const a = Math.PI * (1.15 + (0.7 * i) / 12);
    return CrossSection.circle(0.9, 12).translate([7 * Math.cos(a), dispCY - 4 + 5 * Math.sin(a)]);
  });
  return CrossSection.union([ring(-11), ring(11), ...pupils, ...smile]).extrude(0.3).translate([0, 0, glassZ + 0.6]);
})();
writeSTL(join(previewDir, "colour-white.stl"), U([frontShell, backShell, ears.left, ears.right]));
writeSTL(join(previewDir, "colour-black.stl"), U([bezel, screen]));
writeSTL(join(previewDir, "colour-accent.stl"), U([antenna, feet, faceArt]));

const ab = assembly.boundingBox();
const overall = [0, 1, 2].map((i) => +(ab.max[i] - ab.min[i]).toFixed(1));
console.log(`\nAssembled robot: ${overall.join(" × ")} mm (W × H × D)${okAll ? "" : "  — FIT PROBLEMS ABOVE"}`);
writeFileSync(join(previewDir, "report.json"), JSON.stringify({ overall_mm: overall, fitOk: okAll, fit: checks, plates: plateInfo, parts: partInfo, hardware: HW, shape: S }, null, 2));
if (!okAll) process.exitCode = 1;
