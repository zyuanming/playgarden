// SPDX-License-Identifier: MIT
import {
  comparePhysicsRatios,
  formatPhysicsRatio,
  physicsRatio,
  validPhysicsRatio,
  type PhysicsRatio,
} from "./motionPhysicsRational";
export type InclinePart = "height" | "rampFriction" | "brakeFriction";
export type InclineSettings = Record<InclinePart, number | null>;
export type InclineMove =
  { part: InclinePart; value: number } | { part: "release" };
export type InclineSnapshot = { settings: InclineSettings; tested: boolean };
export type InclineState = InclineSnapshot & { history: InclineSnapshot[] };
export type InclineLevel = {
  title: string;
  idea: string;
  rampRunCm: number;
  height: number[];
  rampFriction: number[];
  brakeFriction: number[];
  targetMinCm: PhysicsRatio;
  targetMaxCm: PhysicsRatio;
  certificate: Record<InclinePart, number>;
};
export const INCLINE_SEARCH_LIMIT = 512;
export const inclineParts: InclinePart[] = [
  "height",
  "rampFriction",
  "brakeFriction",
];
export const inclinePartNames: Record<InclinePart, string> = {
  height: "坡顶高度",
  rampFriction: "坡面摩擦",
  brakeFriction: "刹车地面摩擦",
};
function level(
  title: string,
  rampRunCm: number,
  height: number[],
  rampFriction: number[],
  brakeFriction: number[],
  certificate: number[],
  tolerance: number,
  idea: string,
): InclineLevel {
  const [h, r, b] = certificate;
  return {
    title,
    rampRunCm,
    height,
    rampFriction,
    brakeFriction,
    targetMinCm: physicsRatio(h * 100 - r * rampRunCm - tolerance * b, b),
    targetMaxCm: physicsRatio(h * 100 - r * rampRunCm + tolerance * b, b),
    certificate: { height: h, rampFriction: r, brakeFriction: b },
    idea,
  };
}
export const inclineLevels: InclineLevel[] = [
  level(
    "第一次停车",
    100,
    [20, 30, 40],
    [10],
    [50],
    [30, 10, 50],
    4,
    "只调高度：坡顶越高，转化的势能越多，滑车停得越远。",
  ),
  level(
    "找到合适高度",
    120,
    [24, 36, 48, 60],
    [10],
    [40],
    [36, 10, 40],
    2,
    "坡面摩擦也消耗能量；并非全部高度都用来延长停车距离。",
  ),
  level(
    "换一块刹车地面",
    100,
    [40],
    [10],
    [20, 30, 40, 50],
    [40, 10, 30],
    3,
    "相同的下坡剩余能量，摩擦越强的地面停车越近。",
  ),
  level(
    "坡面也能减速",
    150,
    [60],
    [10, 20, 30, 40],
    [30],
    [60, 20, 30],
    2,
    "坡面摩擦功取决于坡道的水平长度，而不是直接用斜面长度。",
  ),
  level(
    "两种选择",
    120,
    [30, 42, 54, 66],
    [10],
    [20, 30, 40, 50],
    [42, 10, 40],
    1,
    "先求剩余能量，再比较刹车地面的作用。",
  ),
  level(
    "坡面与地面",
    160,
    [64],
    [10, 20, 30, 40],
    [20, 30, 40, 50],
    [64, 20, 40],
    1,
    "坡面消耗一部分能量，水平刹车地面消耗剩余部分。",
  ),
  level(
    "启动门槛",
    200,
    [20, 30, 40, 50],
    [10, 20, 30, 40],
    [25, 40, 50],
    [50, 20, 25],
    1,
    "高度不超过 μ × 水平长度时，滑车不会从静止启动。",
  ),
  level(
    "长坡的代价",
    240,
    [40, 52, 64, 76],
    [5, 10, 15, 20],
    [20, 30, 40, 50],
    [64, 15, 40],
    1,
    "同样的高度，更长的粗糙坡道会消耗更多能量。",
  ),
  level(
    "分数停车点",
    180,
    [36, 45, 54, 63, 72],
    [5, 10, 15, 20],
    [20, 30, 40, 50],
    [45, 10, 40],
    0,
    "停车距离可以是分数。系统用精确分数判定，不靠四舍五入。",
  ),
  level(
    "精细配方",
    220,
    [40, 50, 60, 70, 80],
    [5, 10, 15, 20, 25],
    [15, 20, 25, 30, 40],
    [60, 15, 40],
    0,
    "在多个变量之间分配能量预算，使最后的停车位置刚好吻合。",
  ),
  level(
    "窄窗挑战",
    260,
    [39, 52, 65, 78, 91],
    [5, 10, 15, 20, 25],
    [20, 25, 30, 40, 50],
    [78, 20, 30],
    0,
    "先把目标距离乘以刹车摩擦，再加上坡面损耗，反求所需高度。",
  ),
  level(
    "能量总设计师",
    300,
    [45, 60, 75, 90, 105, 120],
    [5, 10, 15, 20, 25, 30],
    [15, 20, 25, 30, 40, 50],
    [105, 25, 40],
    0,
    "不用试手速：坡顶能量 = 坡面损耗 + 刹车地面损耗。",
  ),
];
function validGeometry(c: InclineLevel): boolean {
  return (
    Number.isInteger(c.rampRunCm) &&
    c.rampRunCm > 0 &&
    c.rampRunCm <= 1000 &&
    inclineParts.every(
      (part) =>
        c[part].length > 0 &&
        c[part].length <= 8 &&
        new Set(c[part]).size === c[part].length &&
        c[part].every(
          (v) =>
            Number.isInteger(v) &&
            v >= (part === "rampFriction" ? 0 : 1) &&
            v <= (part === "height" ? 500 : 100),
        ),
    ) &&
    validPhysicsRatio(c.targetMinCm) &&
    validPhysicsRatio(c.targetMaxCm) &&
    c.targetMinCm.numerator >= 0 &&
    comparePhysicsRatios(c.targetMinCm, c.targetMaxCm) <= 0
  );
}
export function validInclineSettings(
  c: InclineLevel,
  settings: InclineSettings,
): boolean {
  return (
    validGeometry(c) &&
    inclineParts.every(
      (part) => settings[part] === null || c[part].includes(settings[part]!),
    )
  );
}
export function createInclineState(c: InclineLevel): InclineState {
  return {
    settings: {
      height: c.height.length === 1 ? c.height[0] : null,
      rampFriction: c.rampFriction.length === 1 ? c.rampFriction[0] : null,
      brakeFriction: c.brakeFriction.length === 1 ? c.brakeFriction[0] : null,
    },
    tested: false,
    history: [],
  };
}
export type InclineResult = {
  kind: "incomplete" | "stuck" | "short" | "target" | "long" | "invalid";
  stopCm: PhysicsRatio | null;
  energyHeightCm: PhysicsRatio | null;
};
/** Ideal sliding block. Static = kinetic friction, constant μ, no air/rotation.
 * W_ramp/(mg)=μ_r L, K_bottom/(mg)=h−μ_r L, d=(h−μ_r L)/μ_b.
 * μ values are stored in hundredths; lengths are cm. Mass and g cancel. */
export function evaluateIncline(
  c: InclineLevel,
  settings: InclineSettings,
): InclineResult {
  if (!validInclineSettings(c, settings))
    return { kind: "invalid", stopCm: null, energyHeightCm: null };
  const { height: h, rampFriction: r, brakeFriction: b } = settings;
  if (h === null || r === null || b === null)
    return { kind: "incomplete", stopCm: null, energyHeightCm: null };
  const remaining = h * 100 - r * c.rampRunCm;
  const energyHeightCm = physicsRatio(Math.max(0, remaining), 100);
  if (remaining <= 0) return { kind: "stuck", stopCm: null, energyHeightCm };
  const stopCm = physicsRatio(remaining, b);
  const kind =
    comparePhysicsRatios(stopCm, c.targetMinCm) < 0
      ? "short"
      : comparePhysicsRatios(stopCm, c.targetMaxCm) > 0
        ? "long"
        : "target";
  return { kind, stopCm, energyHeightCm };
}
export function isInclineSolved(
  c: InclineLevel,
  state: InclineSnapshot,
): boolean {
  return state.tested && evaluateIncline(c, state.settings).kind === "target";
}
export function moveIncline(
  c: InclineLevel,
  state: InclineState,
  move: InclineMove,
): InclineState {
  if (!validInclineSettings(c, state.settings)) return state;
  if (move.part === "release") {
    if (
      state.tested ||
      evaluateIncline(c, state.settings).kind === "incomplete"
    )
      return state;
    return {
      ...state,
      tested: true,
      history: [
        ...state.history,
        { settings: { ...state.settings }, tested: state.tested },
      ],
    };
  }
  if (
    !inclineParts.includes(move.part) ||
    !c[move.part].includes(move.value) ||
    state.settings[move.part] === move.value
  )
    return state;
  return {
    settings: { ...state.settings, [move.part]: move.value },
    tested: false,
    history: [
      ...state.history,
      { settings: { ...state.settings }, tested: state.tested },
    ],
  };
}
export function undoIncline(state: InclineState): InclineState {
  if (!state.history.length) return state;
  const previous = state.history[state.history.length - 1];
  return {
    settings: { ...previous.settings },
    tested: previous.tested,
    history: state.history.slice(0, -1),
  };
}
/** Enumerates at most limit complete settings, preferring fewest changes from this board. */
export function solveIncline(
  c: InclineLevel,
  state = createInclineState(c),
  limit = INCLINE_SEARCH_LIMIT,
): { settings: InclineSettings | null; nodes: number; exhausted: boolean } {
  if (!validInclineSettings(c, state.settings))
    return { settings: null, nodes: 0, exhausted: false };
  let nodes = 0,
    best: InclineSettings | null = null,
    distance = Infinity;
  const cap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  for (const height of c.height)
    for (const rampFriction of c.rampFriction)
      for (const brakeFriction of c.brakeFriction) {
        if (nodes >= cap) return { settings: best, nodes, exhausted: true };
        nodes++;
        const settings = { height, rampFriction, brakeFriction };
        if (evaluateIncline(c, settings).kind !== "target") continue;
        const changes = inclineParts.filter(
          (part) => settings[part] !== state.settings[part],
        ).length;
        if (changes < distance) {
          best = settings;
          distance = changes;
        }
      }
  return { settings: best, nodes, exhausted: false };
}
export function inclineNextMove(
  c: InclineLevel,
  state: InclineState,
  limit = INCLINE_SEARCH_LIMIT,
): InclineMove | null {
  if (isInclineSolved(c, state)) return null;
  const solution = solveIncline(c, state, limit).settings;
  if (!solution) return null;
  const part = inclineParts.find((p) => state.settings[p] !== solution[p]);
  return part ? { part, value: solution[part]! } : { part: "release" };
}
export function inclineHint(
  c: InclineLevel,
  state: InclineState,
  limit = INCLINE_SEARCH_LIMIT,
): string {
  if (isInclineSolved(c, state)) return "滑车已停在目标区。";
  const result = solveIncline(c, state, limit);
  if (!result.settings)
    return result.exhausted
      ? `已检查 ${result.nodes} 种配方，达到提示搜索上限，尚未找到可行方案。`
      : "当前规则下没有可行配方。";
  const part = inclineParts.find(
    (p) => state.settings[p] !== result.settings![p],
  );
  const move: InclineMove = part
    ? { part, value: result.settings[part]! }
    : { part: "release" };
  return move.part === "release"
    ? "当前配方已经满足目标；点击“释放滑车”验证预测。"
    : `从当前配方出发，先把${inclinePartNames[move.part]}改为 ${move.part === "height" ? `${move.value} cm` : `μ = ${(move.value / 100).toFixed(2)}`}。${result.exhausted ? "找到可行配方，但尚未遍历全部选择。" : "其余选择可以继续逐项调整。"}`;
}
export function describeInclineResult(result: InclineResult): string {
  if (result.kind === "incomplete") return "先补齐三个实验参数，再释放滑车。";
  if (result.kind === "invalid") return "参数无效，请重置实验。";
  if (result.kind === "stuck")
    return "未启动：下坡重力分量不大于摩擦力。提高坡顶或减小坡面摩擦。";
  return `停在坡底后 ${formatPhysicsRatio(result.stopCm!)} cm；${result.kind === "target" ? "正好进入目标区！" : result.kind === "short" ? "距离不足，再调整能量预算。" : "超过目标，再调整能量预算。"}`;
}
export function verifyInclineLevel(c: InclineLevel): boolean {
  return (
    validGeometry(c) && evaluateIncline(c, c.certificate).kind === "target"
  );
}
export const inclineSolutions: InclineMove[][] = inclineLevels.map((c) => [
  ...inclineParts
    .filter((part) => c[part].length > 1)
    .map((part) => ({ part, value: c.certificate[part] })),
  { part: "release" },
]);
