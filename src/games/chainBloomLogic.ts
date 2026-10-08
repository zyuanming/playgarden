// SPDX-License-Identifier: GPL-3.0-only
// Original deterministic continuous-geometry game. No upstream game code or media.
export const BLOOM_ARENA = { width: 640, height: 420, inset: 14 } as const;
export const BLOOM_SAVE = "playgarden.chain-bloom.v1";
export type BloomPoint = { x: number; y: number };
export type BloomSeed = BloomPoint & { vx: number; vy: number; lit: boolean };
export type BloomRing = BloomPoint & { id: number; age: number };
export type BloomState = {
  level: number;
  phase: "watching" | "blooming" | "won" | "retry";
  elapsed: number;
  aim: BloomPoint | null;
  seeds: BloomSeed[];
  rings: BloomRing[];
};
type Route = readonly [x: number, y: number, vx: number, vy: number];
export type BloomStage = {
  title: string;
  lesson: string;
  target: number;
  radius: number;
  routes: readonly Route[];
};
export const BLOOM_LIFETIME = 2.5;
export const BLOOM_INITIAL_RADIUS = 82;
// Each layout introduces a different timing or bridge problem. No randomness,
// generated mirrors, or target-only variants are counted as additional stages.
export const chainBloomStages: readonly BloomStage[] = [
  { title: "第一朵花", target: 5, radius: 70,
    lesson: "先在中央试一朵。圈内的种子会停下来开花；每朵花都能接力。",
    routes: [[286,184,16,8],[323,171,-12,15],[354,195,-13,-9],[348,231,11,-13],[310,247,14,-10],[275,222,-9,12],[408,278,-18,-14],[208,139,18,12]] },
  { title: "一条花径", target: 7, radius: 66,
    lesson: "沿横向花径接力。中间起步能让花火向两边传播。",
    routes: [[94,193,22,4],[146,207,20,-5],[200,196,18,4],[252,211,16,-4],[310,196,12,5],[367,210,-14,-4],[421,194,-17,5],[477,209,-20,-4],[533,196,-22,4]] },
  { title: "等风相遇", target: 8, radius: 68,
    lesson: "两群种子正在靠近。等它们之间的空隙变小，再从交会处起步。",
    routes: [[150,160,36,12],[164,199,34,5],[139,237,38,-8],[194,179,29,9],[190,230,31,-6],[471,166,-34,10],[488,205,-36,-4],[467,245,-32,-12],[424,188,-29,4],[429,228,-31,-8]] },
  { title: "斜向交会", target: 8, radius: 65,
    lesson: "看箭头预判交点。种子要在花圈消散前赶到，不必一开始就在圈里。",
    routes: [[161,98,32,25],[203,126,29,25],[246,156,27,23],[290,184,25,20],[478,97,-30,26],[435,131,-29,23],[393,161,-28,22],[351,190,-25,20],[311,316,4,-35],[353,348,-6,-36],[279,344,9,-34]] },
  { title: "会反弹的风", target: 9, radius: 66,
    lesson: "边缘会反弹。右侧种子折返时，正好能把花火带回中央。",
    routes: [[564,115,43,14],[591,158,41,8],[559,204,45,-5],[596,246,39,-12],[551,289,42,-15],[501,133,38,11],[489,183,36,7],[498,231,34,-8],[478,280,35,-12],[428,166,30,10],[426,221,31,-6],[406,267,32,-10]] },
  { title: "小桥不能断", target: 10, radius: 65,
    lesson: "两簇之间只有几颗桥梁种子。让第一簇开花时，桥梁仍在接力范围内。",
    routes: [[151,168,12,13],[183,184,-10,8],[151,218,10,-12],[192,230,-8,-10],[229,201,17,0],[289,189,11,5],[350,204,-11,-4],[407,217,-15,-3],[450,185,11,9],[486,172,-10,11],[479,219,9,-9],[442,244,-9,-11]] },
  { title: "一圈花环", target: 11, radius: 72,
    lesson: "花环中央很空。靠近环上的种子点燃，接力才能沿圆周走下去。",
    routes: [[319,89,19,0],[377,101,16,10],[425,137,10,17],[448,189,0,20],[442,246,-9,18],[406,292,-17,11],[351,318,-20,0],[290,318,-18,-8],[238,291,-11,-17],[204,239,0,-20],[201,181,9,-18],[225,130,16,-12],[268,99,19,-5]] },
  { title: "接住快车", target: 10, radius: 64,
    lesson: "快速横穿的种子会很快离开。把预览放在它们前方，让花圈提前长大。",
    routes: [[77,151,67,3],[113,183,65,-2],[82,219,69,2],[128,249,63,-3],[250,162,13,7],[292,184,-10,5],[273,224,12,-8],[324,246,-12,-6],[447,172,-48,4],[491,208,-52,-3],[468,246,-49,-6],[536,182,-54,5],[563,228,-56,-4]] },
  { title: "三处花田", target: 12, radius: 68,
    lesson: "三簇种子的路线向内汇合。先观察哪一簇会最早把接力送到中心。",
    routes: [[147,96,25,22],[185,91,21,25],[167,138,24,20],[209,122,19,22],[482,110,-25,20],[444,94,-21,23],[466,149,-24,17],[425,132,-19,20],[279,337,9,-30],[318,352,0,-32],[358,331,-9,-28],[303,296,5,-26],[343,291,-6,-24],[318,212,4,7]] },
  { title: "错开的节拍", target: 12, radius: 65,
    lesson: "上下两条花径方向相反。选交错的接力点，别只追着最快的一群走。",
    routes: [[85,137,43,11],[142,144,41,9],[200,139,39,10],[260,145,37,8],[322,140,35,9],[551,279,-43,-11],[493,274,-41,-9],[436,281,-39,-10],[377,275,-37,-8],[316,280,-35,-9],[247,205,14,0],[305,216,-12,1],[367,204,10,-1],[422,213,-14,0],[191,232,20,-5]] },
  { title: "留住接力窗", target: 14, radius: 62,
    lesson: "这一关花圈较小。等分散的队伍靠近，优先照顾即将穿过空隙的种子。",
    routes: [[137,145,23,13],[181,143,21,14],[160,183,24,9],[198,202,19,7],[225,151,17,12],[276,176,12,7],[324,204,5,0],[368,226,-11,-5],[416,251,-17,-10],[459,270,-21,-12],[499,252,-24,-9],[479,216,-21,-7],[516,187,-25,4],[406,162,-14,10],[362,139,-9,15],[318,110,0,21],[266,264,13,-9]] },
  { title: "满园相逢", target: 17, radius: 68,
    lesson: "综合观察速度、反弹与桥梁。只需达到目标，不必追求点亮每一颗。",
    routes: [[116,89,31,23],[156,108,28,21],[191,82,25,26],[183,149,24,18],[532,105,-32,20],[490,85,-28,25],[461,132,-26,19],[503,156,-29,17],[120,319,32,-22],[160,337,29,-25],[197,292,25,-18],[173,253,24,-14],[516,320,-31,-23],[470,338,-26,-26],[448,288,-25,-18],[489,247,-27,-14],[274,207,13,0],[319,175,0,12],[365,211,-13,0],[321,249,0,-12]] },
];
export function bloomStage(level: number): BloomStage {
  return chainBloomStages[Math.max(0, Math.min(chainBloomStages.length - 1, Math.trunc(level) || 0))];
}
export function clampBloomPoint(point: BloomPoint): BloomPoint {
  return { x: Math.max(14, Math.min(626, point.x)), y: Math.max(14, Math.min(406, point.y)) };
}
export function createBloom(level: number): BloomState {
  const bounded = Math.max(0, Math.min(chainBloomStages.length - 1, Math.trunc(level) || 0));
  return { level: bounded, phase: "watching", elapsed: 0, aim: { x: 320, y: 210 },
    seeds: bloomStage(bounded).routes.map(([x,y,vx,vy]) => ({ x,y,vx,vy,lit: false })), rings: [] };
}
export function bloomRadius(ring: BloomRing, stage: BloomStage): number {
  const peak = ring.id === -1 ? BLOOM_INITIAL_RADIUS : stage.radius;
  if (ring.age < 0.8) return 4 + (peak - 4) * ring.age / 0.8;
  if (ring.age < 1.7) return peak;
  return Math.max(0, peak * (BLOOM_LIFETIME - ring.age) / 0.8);
}
export function igniteBloom(state: BloomState): BloomState {
  if (state.phase !== "watching" || !state.aim) return state;
  return { ...state, phase: "blooming", rings: [{ ...state.aim, id: -1, age: 0 }] };
}
export function bloomCount(state: BloomState): number {
  return state.seeds.filter((seed) => seed.lit).length;
}
export function stepBloom(state: BloomState, seconds: number): BloomState {
  if ((state.phase !== "watching" && state.phase !== "blooming") || !Number.isFinite(seconds) || seconds <= 0) return state;
  const stage = bloomStage(state.level);
  const duration = Math.min(seconds, 0.05);
  const steps = Math.ceil(duration * 120);
  const dt = duration / steps;
  const seeds = state.seeds.map((seed) => ({ ...seed }));
  let rings = state.rings.map((ring) => ({ ...ring }));
  let phase: BloomState["phase"] = state.phase;
  for (let step = 0; step < steps; step++) {
    for (const seed of seeds) {
      if (seed.lit) continue;
      seed.x += seed.vx * dt;
      seed.y += seed.vy * dt;
      if (seed.x < 14) { seed.x = 28 - seed.x; seed.vx = Math.abs(seed.vx); }
      if (seed.x > 626) { seed.x = 1252 - seed.x; seed.vx = -Math.abs(seed.vx); }
      if (seed.y < 14) { seed.y = 28 - seed.y; seed.vy = Math.abs(seed.vy); }
      if (seed.y > 406) { seed.y = 812 - seed.y; seed.vy = -Math.abs(seed.vy); }
    }
    if (phase !== "blooming") continue;
    rings = rings.map((ring) => ({ ...ring, age: ring.age + dt })).filter((ring) => ring.age < BLOOM_LIFETIME);
    // Each seed can trigger once. Newly born rings can catch nearby seeds in
    // this or the following 1/120-second microstep; there is no recursive timer.
    seeds.forEach((seed, id) => {
      if (!seed.lit && rings.some((ring) => Math.hypot(seed.x - ring.x, seed.y - ring.y) <= bloomRadius(ring, stage) + 6)) {
        seed.lit = true;
        rings.push({ id, x: seed.x, y: seed.y, age: 0 });
      }
    });
    if (!rings.length) {
      phase = seeds.filter((seed) => seed.lit).length >= stage.target ? "won" : "retry";
      break;
    }
  }
  return { ...state, seeds, rings, phase, elapsed: (state.elapsed + duration) % 86400 };
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
function safePoint(value: unknown): value is BloomPoint & Record<string, unknown> {
  return record(value) && finite(value.x) && finite(value.y) && value.x >= 14 && value.x <= 626 && value.y >= 14 && value.y <= 406;
}
export function parseBloom(raw: string | null, level: number): BloomState | null {
  if (!raw || raw.length > 16000) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!record(data) || data.version !== 1 || !record(data.state)) return null;
    const s = data.state, stage = bloomStage(level);
    if (s.level !== level || !["watching","blooming","won","retry"].includes(String(s.phase)) || !finite(s.elapsed) || s.elapsed < 0 || s.elapsed >= 86400 || (s.aim !== null && !safePoint(s.aim)) || !Array.isArray(s.seeds) || s.seeds.length !== stage.routes.length || !Array.isArray(s.rings) || s.rings.length > stage.routes.length + 1) return null;
    const seeds: BloomSeed[] = [];
    for (let id = 0; id < s.seeds.length; id++) {
      const seed: unknown = s.seeds[id];
      if (!safePoint(seed) || !record(seed) || typeof seed.lit !== "boolean" || !finite(seed.vx) || !finite(seed.vy) || Math.abs(Math.abs(seed.vx) - Math.abs(stage.routes[id][2])) > 0.001 || Math.abs(Math.abs(seed.vy) - Math.abs(stage.routes[id][3])) > 0.001) return null;
      seeds.push({ x: seed.x, y: seed.y, vx: seed.vx, vy: seed.vy, lit: seed.lit });
    }
    const rings: BloomRing[] = [], seen = new Set<number>();
    for (const item of s.rings) {
      if (!safePoint(item) || !record(item) || !finite(item.id) || !Number.isInteger(item.id) || item.id < -1 || item.id >= seeds.length || seen.has(item.id) || !finite(item.age) || item.age < 0 || item.age >= BLOOM_LIFETIME) return null;
      if (item.id >= 0 && (!seeds[item.id].lit || item.x !== seeds[item.id].x || item.y !== seeds[item.id].y)) return null;
      seen.add(item.id);
      rings.push({ x: item.x, y: item.y, id: item.id, age: item.age });
    }
    const count = seeds.filter((seed) => seed.lit).length;
    if (s.phase === "watching" && (count !== 0 || rings.length !== 0)) return null;
    if (s.phase === "blooming" && rings.length === 0) return null;
    if ((s.phase === "won" || s.phase === "retry") && rings.length !== 0) return null;
    if (s.phase === "won" && count < stage.target) return null;
    if (s.phase === "retry" && count >= stage.target) return null;
    return { level, phase: s.phase as BloomState["phase"], elapsed: s.elapsed, aim: s.aim === null ? null : { ...(s.aim as BloomPoint) }, seeds, rings };
  } catch { return null; }
}
export function loadBloom(level: number): BloomState | null {
  try { return parseBloom(localStorage.getItem(`${BLOOM_SAVE}.round.${level}`), level); } catch { return null; }
}
export function saveBloom(state: BloomState): boolean {
  try { localStorage.setItem(`${BLOOM_SAVE}.round.${state.level}`, JSON.stringify({ version: 1, state })); return true; } catch { return false; }
}
