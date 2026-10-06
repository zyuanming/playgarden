// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) 2026 YuanMing. Original procedural Canvas perspective art; no external assets.
import { pose } from "../vendor/cloudrunner/player/index";
import { LANE_X } from "../vendor/cloudrunner/track/index";
import {
  routePoint,
  routeFrame,
  upcomingTurn,
  TURN_NOTICE,
  type RunnerState,
} from "./cloudrunnerLogic";
type Vec = { x: number; y: number; z: number };
type Ink = { depth: number; draw: () => void };
export type SceneCamera = { turnCount: number; lag: number };
const palette = {
  road: "#fff2d6",
  edge: "#d7bc86",
  dark: "#253f3d",
  coral: "#cc6953",
  mint: "#548978",
  gold: "#e6ad46",
};
export function drawRunner(
  canvas: HTMLCanvasElement,
  state: RunnerState,
  camera: SceneCamera,
  dt: number,
  reduced: boolean,
): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  const ctx: CanvasRenderingContext2D = context;
  const bounds = canvas.getBoundingClientRect(),
    w = Math.max(1, bounds.width),
    h = Math.max(1, bounds.height),
    dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  if (
    canvas.width !== Math.round(w * dpr) ||
    canvas.height !== Math.round(h * dpr)
  ) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#b7d8ce");
  sky.addColorStop(0.6, "#e2e7cf");
  sky.addColorStop(1, "#f2ead5");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // Sun, clouds, and distant mountain silhouettes are drawn in original vectors.
  ctx.fillStyle = "#fff3d0";
  ctx.beginPath();
  ctx.arc(w * 0.76, h * 0.18, Math.min(w, h) * 0.068, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    const x = (i * 0.213 * w + w * 0.07) % (w * 1.13),
      y = h * (0.18 + (i % 3) * 0.09);
    ctx.fillStyle = i % 2 ? "#dfebd9" : "#eef0dc";
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.1, h * 0.015, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let layer = 0; layer < 2; layer++) {
    ctx.fillStyle = layer ? "#a3c3ad" : "#bfd2bb";
    ctx.beginPath();
    ctx.moveTo(0, h * 0.47);
    for (let i = 0; i <= 12; i++)
      ctx.lineTo(
        (i * w) / 12,
        h * (0.37 + layer * 0.045) - Math.sin(i * 1.91 + layer) * h * 0.045,
      );
    ctx.lineTo(w, h * 0.56);
    ctx.lineTo(0, h * 0.56);
    ctx.fill();
  }
  const distance = state.game.distance;
  if (camera.turnCount !== state.turnCount) {
    const latest = state.turns[Math.max(0, state.nextTurn - 1)];
    camera.lag += latest?.direction === "right" ? -Math.PI / 2 : Math.PI / 2;
    camera.turnCount = state.turnCount;
  }
  camera.lag = reduced ? 0 : camera.lag * Math.exp(-Math.max(0, dt) * 8);
  const base = routeFrame(state.turns, distance),
    heading = base.heading + camera.lag;
  const forward = { x: Math.sin(heading), z: Math.cos(heading) },
    right = { x: Math.cos(heading), z: -Math.sin(heading) };
  const eye = { x: base.x - forward.x * 18, z: base.z - forward.z * 18, y: 11 };
  const focal = Math.min(h * 0.91, w * 1.22),
    pitch = 0.16,
    cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  function project(v: Vec) {
    const dx = v.x - eye.x,
      dz = v.z - eye.z,
      dy = v.y - eye.y,
      dep = dx * forward.x + dz * forward.z;
    const depth = dep * cp - dy * sp;
    return {
      x: w / 2 + ((dx * right.x + dz * right.z) * focal) / depth,
      y: h * 0.47 - ((dy * cp + dep * sp) * focal) / depth,
      depth,
    };
  }
  const ink: Ink[] = [];
  function poly(vertices: Vec[], fill: string, stroke?: string) {
    const p = vertices.map(project);
    if (p.some((v) => v.depth < 1)) return;
    ink.push({
      depth: p.reduce((n, v) => n + v.depth, 0) / p.length,
      draw: () => {
        ctx.beginPath();
        p.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y)));
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      },
    });
  }
  function point(d: number, lateral: number, y = 0): Vec {
    const p = routePoint(state.turns, d, lateral);
    return { x: p.x, z: p.z, y };
  }
  function box(
    d: number,
    lateral: number,
    width: number,
    height: number,
    length: number,
    colors: string[],
    bottom = 0,
  ) {
    const a = point(d - length / 2, lateral - width / 2, bottom),
      b = point(d - length / 2, lateral + width / 2, bottom),
      c = point(d + length / 2, lateral + width / 2, bottom),
      e = point(d + length / 2, lateral - width / 2, bottom);
    const up = (v: Vec) => ({ ...v, y: v.y + height });
    poly([a, b, up(b), up(a)], colors[0]);
    poly([b, c, up(c), up(b)], colors[1] ?? colors[0]);
    poly([e, a, up(a), up(e)], colors[1] ?? colors[0]);
    poly([up(a), up(b), up(c), up(e)], colors[2] ?? colors[0]);
  }
  function orb(v: Vec, radius: number, fill: string, ring = false) {
    const p = project(v);
    if (p.depth < 1) return;
    ink.push({
      depth: p.depth,
      draw: () => {
        const r = Math.max(1, (radius * focal) / p.depth);
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (ring) {
          ctx.strokeStyle = "#fff4cd";
          ctx.lineWidth = Math.max(1, r * 0.2);
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 0.65, 0, Math.PI * 2);
          ctx.stroke();
        }
      },
    });
  }
  // Actual connected path in world coordinates. Nothing is drawn straight through a turn.
  const ends = [Math.max(0, distance - 22)];
  for (let d = Math.ceil(ends[0] / 8) * 8; d < distance + 150; d += 8)
    if (d > ends[0]) ends.push(d);
  for (const t of state.turns)
    if (t.z > ends[0] && t.z < distance + 150) ends.push(t.z);
  ends.sort((a, b) => a - b);
  for (let i = 0; i < ends.length - 1; i++) {
    const a = ends[i],
      b = ends[i + 1];
    if (b - a < 0.01) continue;
    // Tangent is constant inside each segment; sample just shy of a corner for its edge.
    const start = a + 0.001,
      end = b - 0.001;
    poly(
      [point(start, -6), point(start, 6), point(end, 6), point(end, -6)],
      Math.floor(a / 8) % 2 ? "#f8ebcf" : "#fff2d9",
    );
    for (const side of [-1, 1]) {
      poly(
        [
          point(start, side * 6),
          point(end, side * 6),
          point(end, side * 6, -1.1),
          point(start, side * 6, -1.1),
        ],
        palette.edge,
      );
      poly(
        [
          point(start, side * 5.85, 0.025),
          point(start, side * 5.65, 0.025),
          point(end, side * 5.65, 0.025),
          point(end, side * 5.85, 0.025),
        ],
        "#c49b57",
      );
    }
    if (Math.floor(a / 8) % 2 === 0)
      for (const x of [-2, 2])
        poly(
          [
            point(start, x - 0.035, 0.03),
            point(start, x + 0.035, 0.03),
            point(end, x + 0.035, 0.03),
            point(end, x - 0.035, 0.03),
          ],
          "#d9c8a3",
        );
  }
  for (const t of state.turns) {
    if (t.z < distance - 20 || t.z > distance + 140) continue;
    const p = routeFrame(state.turns, t.z);
    poly(
      [
        { x: p.x - 6, y: 0.01, z: p.z - 6 },
        { x: p.x + 6, y: 0.01, z: p.z - 6 },
        { x: p.x + 6, y: 0.01, z: p.z + 6 },
        { x: p.x - 6, y: 0.01, z: p.z + 6 },
      ],
      "#ead8a8",
    );
  }
  // Floating gardens and cypress-like topiary, all generated from stable path positions.
  for (
    let d = Math.floor((distance - 18) / 24) * 24;
    d < distance + 144;
    d += 24
  ) {
    if (d < 8 || state.turns.some((t) => Math.abs(t.z - d) < 18)) continue;
    for (const side of [-1, 1]) {
      const x = side * (9 + (Math.floor(d / 24) % 3));
      box(d, x, 4, 1.3, 5, ["#789c80", "#638971", "#a9ba83"], -1.8);
      box(d, x, 0.3, 2.6, 0.3, ["#816e49"]);
      orb(point(d, x, 3.4), 1.35, side === 1 ? "#6b9274" : "#7b9d77");
      orb(point(d + 0.2, x, 4.6), 0.87, "#86a780");
      if (Math.floor(d / 24) % 2 === 0) {
        box(d - 2, side * 6.5, 0.24, 3.2, 0.24, ["#677e60"]);
        orb(point(d - 2, side * 6.5, 3.3), 0.38, "#f2c467");
      }
    }
  }
  for (const item of state.placements) {
    if (item.z < distance - 7 || item.z > distance + 120) continue;
    const x = LANE_X[item.lane],
      d = item.z - 2;
    if (item.type === "coin") {
      orb(point(d, x, 1.3), 0.5, "#dba43a", true);
      continue;
    }
    if (item.type === "full-block") {
      box(d, x, 2.75, 4.2, 2.6, ["#bf8549", "#a36c3d", "#e0aa61"]);
      box(d, x, 2.9, 0.3, 2.8, ["#d9a865", "#b78248", "#ebc385"], 3.65);
      box(d - 0.05, x, 0.46, 0.7, 2.64, ["#f4d596"], 1.8);
    }
    if (item.type === "obstacle-low") {
      box(d, x, 3.1, 0.85, 1.3, ["#c06350", "#a54d41", "#e8a181"]);
      for (const sx of [-0.9, 0.9])
        box(d - 0.67, x + sx, 0.35, 0.56, 0.04, ["#fff0ce"], 0.13);
    }
    if (item.type === "obstacle-high") {
      for (const sx of [-1.7, 1.7])
        box(d, x + sx, 0.3, 3.6, 0.7, ["#598777", "#386758", "#91baa0"]);
      box(d, x, 3.7, 1.75, 1, ["#518675", "#386758", "#96bea0"], 1.85);
      box(d - 0.51, x, 2.6, 0.15, 0.025, ["#e5edd3"], 2.5);
    }
  }
  const turn = upcomingTurn(state);
  if (turn && turn.z - distance < TURN_NOTICE) {
    const d = turn.z - 9,
      sign = turn.direction === "left" ? -1 : 1;
    for (let n = 0; n < 3; n++) {
      const z = d - 4 * n;
      poly(
        [
          point(z, sign * 2, 0.08),
          point(z - 2, -sign * 0.5, 0.08),
          point(z - 1, -sign * 1, 0.08),
          point(z + 1, sign * 0.5, 0.08),
          point(z + 3, -sign * 1, 0.08),
          point(z + 4, -sign * 0.5, 0.08),
        ],
        "#618978",
      );
    }
  }
  if (state.lesson !== null) {
    const finish =
      state.lesson === 0
        ? 112
        : state.lesson === 1 || state.lesson === 2
          ? 136
          : state.lesson === 3 || state.lesson === 4
            ? 168
            : 432;
    if (finish - distance < 140 && finish - distance > -5) {
      for (const side of [-1, 1])
        box(finish, side * 6.2, 0.4, 7, 0.4, ["#617a63"]);
      box(finish, 0, 12.8, 1.3, 0.3, ["#c9964c", "#c9964c", "#eecb84"], 5.7);
    }
  }
  // Original courier: cream hat, amber scarf, teal jacket and a tiny seed satchel.
  const p = pose(state.player),
    stride =
      state.player.mode === "grounded" && state.game.phase === "playing"
        ? Math.sin(state.elapsed * 16)
        : 0;
  const root = point(distance, p.x, p.y),
    local = (x: number, y: number, z = 0): Vec => ({
      x: root.x + Math.cos(base.heading) * x + Math.sin(base.heading) * z,
      y: root.y + y,
      z: root.z - Math.sin(base.heading) * x + Math.cos(base.heading) * z,
    });
  // Shadow is on the actual occupied lane, including tween positions.
  const shadow = project(point(distance, p.x, 0.055));
  if (shadow.depth > 1)
    ink.push({
      depth: shadow.depth + 0.05,
      draw: () => {
        ctx.fillStyle = "rgba(55,69,45,.19)";
        ctx.beginPath();
        ctx.ellipse(
          shadow.x,
          shadow.y,
          (1.05 * focal) / shadow.depth,
          (0.3 * focal) / shadow.depth,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      },
    });
  function limb(x: number, y: number, z: number, r: number, color: string) {
    orb(local(x, y * p.squash, z), r, color);
  }
  const low = p.squash;
  limb(-0.38, 0.37, 0.18 + stride * 0.25, 0.25, "#354d49");
  limb(0.38, 0.37, -0.18 - stride * 0.25, 0.25, "#354d49");
  limb(-0.3, 0.79, stride * 0.12, 0.24, "#466e66");
  limb(0.3, 0.79, -stride * 0.12, 0.24, "#466e66");
  limb(0, 1.3, 0, 0.6, "#4b8375");
  limb(0, 1.35, -0.4, 0.38, "#cc9b59");
  limb(-0.68, 1.43, -stride * 0.25, 0.19, "#d6aa83");
  limb(0.68, 1.43, stride * 0.25, 0.19, "#d6aa83");
  limb(0, 2.1, 0, 0.41, "#e2bd91");
  limb(0, 2.46, 0, 0.49, "#f7e4bd");
  poly(
    [
      local(-0.73, 2.27 * low, -0.32),
      local(0.73, 2.27 * low, -0.32),
      local(0.73, 2.27 * low, 0.33),
      local(-0.73, 2.27 * low, 0.33),
    ],
    "#e2c18d",
  );
  poly(
    [
      local(-0.45, 1.87 * low, -0.45),
      local(0.4, 1.87 * low, -0.45),
      local(0.68 + stride * 0.09, 1.36 * low, -1.2),
      local(0.15, 1.47 * low, -1.1),
    ],
    "#d99b48",
  );
  ink.sort((a, b) => b.depth - a.depth).forEach((x) => x.draw());
  // A subtle near-field vignette keeps the runner readable without external effects.
  const shade = ctx.createLinearGradient(0, h * 0.7, 0, h);
  shade.addColorStop(0, "rgba(39,69,58,0)");
  shade.addColorStop(1, "rgba(39,69,58,.13)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, h * 0.7, w, h * 0.3);
}
