// SPDX-License-Identifier: GPL-3.0-only
// Original implementation of generic gravity, inertia, thrust and safe landing rules.
export const LUNAR_WORLD = { width: 720, height: 440, foot: 16, halfWidth: 21, thrust: 60, lateralThrust: 24 } as const;
export type LunarPhase = "ready" | "flying" | "won" | "crashed";
export type LunarInput = { engine: boolean; left: boolean; right: boolean; brake: boolean };
export type LunarLevel = {
  id: string; name: string; lesson: string;
  start: { x: number; y: number; vx: number; vy: number };
  pad: { x: number; width: number; y: number };
  gravity: number; wind: number; gust: number; fuel: number;
  maxVertical: number; maxHorizontal: number;
  terrain: readonly (readonly [number, number])[];
};
export type LunarState = {
  level: number; phase: LunarPhase; x: number; y: number; vx: number; vy: number;
  fuel: number; elapsed: number; throttle: number; engine: boolean; lateral: number;
  reason: string;
};
const flat = [[0, 390], [720, 390]] as const;
export const lunarLandingLevels: readonly LunarLevel[] = [
  { id: "gentle-first", name: "01 · 轻轻落下", lesson: "先选 30% 油门，按住主推力。向上的推力抵消重力，保留速度 12 的缓慢下降。", start: { x: 360, y: 228, vx: 0, vy: 12 }, pad: { x: 360, width: 240, y: 390 }, gravity: 18, wind: 0, gust: 0, fuel: 110, maxVertical: 20, maxHorizontal: 15, terrain: flat },
  { id: "brake-first", name: "02 · 先减速，再缓降", lesson: "开局下降较快。用 100% 推力把下降速度降到约 10，再改用 30% 稳稳落下。", start: { x: 350, y: 175, vx: 0, vy: 34 }, pad: { x: 350, width: 220, y: 390 }, gravity: 18, wind: 0, gust: 0, fuel: 115, maxVertical: 20, maxHorizontal: 15, terrain: flat },
  { id: "side-nudge", name: "03 · 向右一点", lesson: "保持 30% 主推力，短按向右推；接近平台时按住横向制动，让滑行慢下来。", start: { x: 225, y: 165, vx: 0, vy: 10 }, pad: { x: 390, width: 190, y: 390 }, gravity: 18, wind: 0, gust: 0, fuel: 135, maxVertical: 20, maxHorizontal: 15, terrain: flat },
  { id: "catch-drift", name: "04 · 接住惯性", lesson: "松开方向推力仍会继续横移。用横向制动消掉开局的右漂，再调整到左侧平台。", start: { x: 465, y: 150, vx: 24, vy: 9 }, pad: { x: 285, width: 190, y: 390 }, gravity: 18, wind: 0, gust: 0, fuel: 150, maxVertical: 20, maxHorizontal: 15, terrain: flat },
  { id: "raised-shelf", name: "05 · 高台上的灯", lesson: "平台比地面更高。看平台高度读数，先向右移动，不要等到贴近山坡才修正。", start: { x: 250, y: 110, vx: 0, vy: 9 }, pad: { x: 465, width: 190, y: 315 }, gravity: 18, wind: 0, gust: 0, fuel: 150, maxVertical: 18, maxHorizontal: 14, terrain: [[0, 400], [290, 400], [370, 315], [560, 315], [650, 400], [720, 400]] },
  { id: "quiet-crater", name: "06 · 环形山里", lesson: "先在高处对齐开阔的谷底，再缓慢下降。灰色岩壁也会碰撞，只有亮色平台能着陆。", start: { x: 420, y: 95, vx: -8, vy: 9 }, pad: { x: 350, width: 170, y: 395 }, gravity: 18, wind: 0, gust: 0, fuel: 160, maxVertical: 18, maxHorizontal: 14, terrain: [[0, 365], [100, 290], [190, 300], [265, 395], [435, 395], [515, 285], [630, 310], [720, 355]] },
  { id: "steady-breeze", name: "07 · 右来的微风", lesson: "这是虚构训练场的侧风，不是月球大气。向右补偿左吹的风；对齐后可按住横向制动。", start: { x: 340, y: 135, vx: 0, vy: 10 }, pad: { x: 410, width: 180, y: 385 }, gravity: 18, wind: -2.5, gust: 0, fuel: 165, maxVertical: 18, maxHorizontal: 14, terrain: [[0, 395], [210, 395], [320, 385], [500, 385], [610, 410], [720, 410]] },
  { id: "eastern-bay", name: "08 · 顺风转向", lesson: "顺风会不断加速。早点向左推，再用制动稳定横速；不要只盯着飞船的位置。", start: { x: 505, y: 130, vx: 12, vy: 8 }, pad: { x: 290, width: 180, y: 365 }, gravity: 18, wind: 2, gust: 0, fuel: 170, maxVertical: 18, maxHorizontal: 14, terrain: [[0, 405], [130, 405], [200, 365], [380, 365], [480, 405], [720, 405]] },
  { id: "variable-breeze", name: "09 · 变动的侧风", lesson: "风每隔几秒改变强弱。保持余量，观察横速箭头，用小段推力修正，平台足够宽。", start: { x: 270, y: 110, vx: 0, vy: 8 }, pad: { x: 425, width: 170, y: 385 }, gravity: 18, wind: 0, gust: 3.5, fuel: 180, maxVertical: 18, maxHorizontal: 14, terrain: [[0, 410], [150, 335], [230, 355], [340, 385], [510, 385], [590, 330], [720, 370]] },
  { id: "heavier-training", name: "10 · 重力训练舱", lesson: "模拟重力增大了：30% 不再能抵消重力。交替用 30% 和 60%，让下降速度留在安全范围。", start: { x: 380, y: 125, vx: -10, vy: 9 }, pad: { x: 330, width: 175, y: 385 }, gravity: 24, wind: 0, gust: 0, fuel: 170, maxVertical: 18, maxHorizontal: 14, terrain: [[0, 405], [150, 405], [242.5, 385], [417.5, 385], [520, 405], [720, 405]] },
  { id: "ridge-crossing", name: "11 · 越过低山脊", lesson: "目标在山脊另一侧。先用大推力保住高度，再向右穿过山脊上空，进入平台后减小推力。", start: { x: 155, y: 105, vx: 0, vy: 7 }, pad: { x: 530, width: 170, y: 355 }, gravity: 18, wind: -1.5, gust: 1, fuel: 200, maxVertical: 18, maxHorizontal: 14, terrain: [[0, 410], [210, 395], [310, 285], [365, 285], [445, 355], [615, 355], [720, 405]] },
  { id: "home-beacon", name: "12 · 返回信标", lesson: "综合练习：向左远航、变动侧风、谷底着陆。燃料充裕；先对齐，再制动，最后轻轻落下。", start: { x: 550, y: 80, vx: -6, vy: 8 }, pad: { x: 235, width: 160, y: 390 }, gravity: 18, wind: 1.2, gust: 2.2, fuel: 210, maxVertical: 17, maxHorizontal: 13, terrain: [[0, 335], [80, 300], [155, 390], [315, 390], [405, 280], [450, 285], [540, 395], [720, 410]] },
];
export const emptyLunarInput = (): LunarInput => ({ engine: false, left: false, right: false, brake: false });
export function createLunarLanding(level: number): LunarState {
  const index = Number.isInteger(level) ? Math.max(0, Math.min(lunarLandingLevels.length - 1, level)) : 0;
  const l = lunarLandingLevels[index];
  return { level: index, phase: "ready", ...l.start, fuel: l.fuel, elapsed: 0, throttle: 0.3, engine: false, lateral: 0, reason: "" };
}
export function lunarTerrainHeight(level: LunarLevel, x: number): number {
  const points = level.terrain;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (x <= b[0]) return a[1] + (b[1] - a[1]) * Math.max(0, (x - a[0]) / (b[0] - a[0]));
  }
  return points[points.length - 1][1];
}
export const lunarWind = (level: LunarLevel, elapsed: number) => level.wind + level.gust * Math.sin(elapsed * 0.65);
export function setLunarThrottle(state: LunarState, throttle: number): LunarState {
  return [0.3, 0.6, 1].includes(throttle) && state.phase !== "won" && state.phase !== "crashed" ? { ...state, throttle } : state;
}
export function startLunarLanding(state: LunarState): LunarState {
  return state.phase === "ready" ? { ...state, phase: "flying" } : state;
}
/** Bounded semi-implicit integration: at most 12 substeps, each <= 1/120 s.
 * A stalled frame never catches up through seconds of unobserved gameplay. */
export function stepLunarLanding(state: LunarState, input: LunarInput, seconds: number): LunarState {
  if (state.phase !== "flying" || !Number.isFinite(seconds) || seconds <= 0) return state;
  const duration = Math.min(seconds, 0.1), steps = Math.ceil(duration * 120), dt = duration / steps;
  const level = lunarLandingLevels[state.level];
  let next = { ...state };
  for (let i = 0; i < steps; i++) {
    const wind = lunarWind(level, next.elapsed);
    let lateral = (Number(input.right) - Number(input.left)) * LUNAR_WORLD.lateralThrust;
    if (input.brake) lateral = Math.max(-LUNAR_WORLD.lateralThrust, Math.min(LUNAR_WORLD.lateralThrust, -next.vx / dt - wind));
    const throttle = input.engine ? next.throttle : 0;
    const fuelRate = throttle * 8 + Math.abs(lateral) / LUNAR_WORLD.lateralThrust * 1.8;
    const power = fuelRate > 0 ? Math.min(1, next.fuel / (fuelRate * dt)) : 0;
    next.fuel = Math.max(0, next.fuel - fuelRate * dt);
    next.engine = throttle * power > 0;
    next.lateral = lateral * power;
    next.vx += (wind + lateral * power) * dt;
    next.vy += (level.gravity - LUNAR_WORLD.thrust * throttle * power) * dt;
    next.x += next.vx * dt;
    next.y += next.vy * dt;
    next.elapsed += dt;
    if (next.x < LUNAR_WORLD.halfWidth || next.x > LUNAR_WORLD.width - LUNAR_WORLD.halfWidth || next.y < 18) {
      return { ...next, phase: "crashed", engine: false, lateral: 0, reason: "飞出了训练区。下次用反向推力早点减速，随时可以重试。" };
    }
    const ground = Math.min(lunarTerrainHeight(level, next.x - LUNAR_WORLD.halfWidth), lunarTerrainHeight(level, next.x), lunarTerrainHeight(level, next.x + LUNAR_WORLD.halfWidth));
    if (next.y + LUNAR_WORLD.foot >= ground) {
      const centered = next.x - LUNAR_WORLD.halfWidth >= level.pad.x - level.pad.width / 2 && next.x + LUNAR_WORLD.halfWidth <= level.pad.x + level.pad.width / 2;
      const onPad = centered && Math.abs(ground - level.pad.y) < 0.01;
      const slow = next.vy >= 0 && next.vy <= level.maxVertical && Math.abs(next.vx) <= level.maxHorizontal;
      if (onPad && slow) return { ...next, y: level.pad.y - LUNAR_WORLD.foot, phase: "won", engine: false, lateral: 0, reason: "安全着陆！两只支脚都在平台内，接触速度也在安全范围。" };
      return { ...next, y: ground - LUNAR_WORLD.foot, phase: "crashed", engine: false, lateral: 0, reason: !onPad ? "碰到岩地了。先让两只支脚都对齐亮色平台，再下降。" : Math.abs(next.vx) > level.maxHorizontal ? "横向滑得太快了。落地前按住横向制动，再试一次。" : "下降速度太快了。提前用 60% 或 100% 主推力减速，再试一次。" };
    }
  }
  return next;
}
export function lunarGuidance(state: LunarState): string {
  if (state.phase === "won" || state.phase === "crashed") return state.reason;
  const l = lunarLandingLevels[state.level], offset = l.pad.x - state.x;
  if (state.phase === "ready") return l.lesson;
  if (state.fuel <= 0) return "燃料已用完，推力不可用。可观察惯性下降，或立即重新尝试。";
  if (state.vy > l.maxVertical) return "下降偏快：提前按住 60% 或 100% 主推力，速度降到约 10 后再减小油门。";
  if (state.vy < -6) return "正在上升：松开主推力，让重力慢慢带你回落。";
  if (Math.abs(offset) > l.pad.width / 2 - 24) return `目标在${offset > 0 ? "右" : "左"}侧：短按方向推力移动，接近后用横向制动。`;
  if (Math.abs(state.vx) > l.maxHorizontal) return "位置已接近平台，横速仍偏快：按住横向制动。";
  return `已对齐平台。保持下降速度不超过 ${l.maxVertical}、横速不超过 ${l.maxHorizontal}；所有读数均为训练单位。`;
}
