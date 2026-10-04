// SPDX-License-Identifier: MIT
import {
  labAdd,
  labCompare,
  labDiv,
  labFormat,
  labMax,
  labMin,
  labMul,
  labQ,
  labSub,
  labValid,
  type LabFraction,
} from "./ballisticsCircuitExact";
export type ParabolicPart = "vx" | "vy";
export type ParabolicSettings = Record<ParabolicPart, number | null>;
export type ParabolicMove =
  { part: ParabolicPart; value: number } | { part: "launch" };
export type ParabolicSnapshot = {
  settings: ParabolicSettings;
  tested: boolean;
};
export type ParabolicState = ParabolicSnapshot & {
  history: ParabolicSnapshot[];
};
export type ParabolicObstacle = {
  name: string;
  left: LabFraction;
  right: LabFraction;
  bottom: LabFraction;
  top: LabFraction;
};
export type ParabolicLevel = {
  title: string;
  idea: string;
  startHeight: number;
  targetX: number;
  targetLow: LabFraction;
  targetHigh: LabFraction;
  direction: "either" | "rising" | "falling";
  vx: number[];
  vy: number[];
  obstacles: ParabolicObstacle[];
  certificate: Record<ParabolicPart, number>;
};
export const PARABOLIC_SEARCH_LIMIT = 128;
export const parabolicParts: ParabolicPart[] = ["vx", "vy"];
export const parabolicPartNames: Record<ParabolicPart, string> = {
  vx: "水平速度",
  vy: "竖直初速度",
};
const zero = labQ(0);
const within = (q: LabFraction, lo: LabFraction, hi: LabFraction) =>
  labCompare(q, lo) >= 0 && labCompare(q, hi) <= 0;
export function validParabolicGeometry(c: ParabolicLevel): boolean {
  return (
    !!c &&
    Number.isSafeInteger(c.startHeight) &&
    c.startHeight > 0 &&
    c.startHeight <= 50 &&
    Number.isSafeInteger(c.targetX) &&
    c.targetX > 0 &&
    c.targetX <= 100 &&
    ["either", "rising", "falling"].includes(c.direction) &&
    parabolicParts.every(
      (p) =>
        Array.isArray(c[p]) &&
        c[p].length > 0 &&
        c[p].length <= 10 &&
        new Set(c[p]).size === c[p].length &&
        c[p].every((v) => Number.isSafeInteger(v) && v > 0 && v <= 30),
    ) &&
    labValid(c.targetLow) &&
    labValid(c.targetHigh) &&
    labCompare(c.targetLow, zero) > 0 &&
    labCompare(c.targetLow, c.targetHigh) <= 0 &&
    labCompare(c.targetHigh, labQ(100)) <= 0 &&
    Array.isArray(c.obstacles) &&
    c.obstacles.length <= 8 &&
    c.obstacles.every(
      (o) =>
        [o.left, o.right, o.bottom, o.top].every(labValid) &&
        labCompare(o.left, zero) > 0 &&
        labCompare(o.left, o.right) < 0 &&
        labCompare(o.right, labQ(c.targetX)) < 0 &&
        labCompare(o.bottom, zero) >= 0 &&
        labCompare(o.bottom, o.top) < 0 &&
        labCompare(o.top, labQ(100)) <= 0,
    )
  );
}
export function validParabolicSettings(
  c: ParabolicLevel,
  s: ParabolicSettings,
): boolean {
  return (
    validParabolicGeometry(c) &&
    !!s &&
    parabolicParts.every((p) => s[p] === null || c[p].includes(s[p]!))
  );
}
/** x = vx*t, y = h + vy*t - t²; g is exactly 2 m/s². */
export function parabolicHeight(
  c: ParabolicLevel,
  s: Record<ParabolicPart, number>,
  x: LabFraction,
): LabFraction {
  const t = labDiv(x, labQ(s.vx));
  return labSub(
    labAdd(labQ(c.startHeight), labMul(labQ(s.vy), t)),
    labMul(t, t),
  );
}
/** Exact image of a concave quadratic on a CLOSED horizontal interval.
 * The minimum is an endpoint. The maximum is an endpoint or the vertex.
 * Continuity makes overlap with an obstacle's vertical interval sufficient
 * and necessary for collision; there are no sampled physics points. */
export function parabolicHeightRange(
  c: ParabolicLevel,
  s: Record<ParabolicPart, number>,
  left: LabFraction,
  right: LabFraction,
): { min: LabFraction; max: LabFraction } {
  const a = parabolicHeight(c, s, left),
    b = parabolicHeight(c, s, right),
    vertex = labQ(s.vx * s.vy, 2);
  return {
    min: labMin(a, b),
    max: within(vertex, left, right)
      ? labMax(labMax(a, b), parabolicHeight(c, s, vertex))
      : labMax(a, b),
  };
}
export type ParabolicResult = {
  kind:
    | "invalid"
    | "incomplete"
    | "obstacle"
    | "ground"
    | "low"
    | "high"
    | "direction"
    | "target";
  height: LabFraction | null;
  time: LabFraction | null;
  verticalSpeed: LabFraction | null;
  blocked: number[];
};
export function evaluateParabolic(
  c: ParabolicLevel,
  s: ParabolicSettings,
): ParabolicResult {
  const empty = { height: null, time: null, verticalSpeed: null, blocked: [] };
  if (!validParabolicSettings(c, s)) return { ...empty, kind: "invalid" };
  if (s.vx === null || s.vy === null) return { ...empty, kind: "incomplete" };
  const settings = { vx: s.vx, vy: s.vy },
    time = labQ(c.targetX, s.vx),
    height = parabolicHeight(c, settings, labQ(c.targetX)),
    verticalSpeed = labSub(labQ(s.vy), labMul(labQ(2), time));
  const blocked = c.obstacles.flatMap((obstacle, i) => {
    const range = parabolicHeightRange(
      c,
      settings,
      obstacle.left,
      obstacle.right,
    );
    return labCompare(range.max, obstacle.bottom) >= 0 &&
      labCompare(range.min, obstacle.top) <= 0
      ? [i]
      : [];
  });
  // Report intersected geometry, not an invented chronological collision time.
  const kind = blocked.length
    ? "obstacle"
    : labCompare(height, zero) <= 0
      ? "ground"
      : labCompare(height, c.targetLow) < 0
        ? "low"
        : labCompare(height, c.targetHigh) > 0
          ? "high"
          : (c.direction === "rising" &&
                labCompare(verticalSpeed, zero) <= 0) ||
              (c.direction === "falling" &&
                labCompare(verticalSpeed, zero) >= 0)
            ? "direction"
            : "target";
  return { kind, height, time, verticalSpeed, blocked };
}
export function createParabolicState(c: ParabolicLevel): ParabolicState {
  return {
    settings: {
      vx: c.vx.length === 1 ? c.vx[0] : null,
      vy: c.vy.length === 1 ? c.vy[0] : null,
    },
    tested: false,
    history: [],
  };
}
export const isParabolicSolved = (c: ParabolicLevel, s: ParabolicSnapshot) =>
  s.tested && evaluateParabolic(c, s.settings).kind === "target";
export function moveParabolic(
  c: ParabolicLevel,
  state: ParabolicState,
  move: ParabolicMove,
): ParabolicState {
  if (!validParabolicSettings(c, state.settings) || isParabolicSolved(c, state))
    return state;
  if (move.part === "launch") {
    if (
      state.tested ||
      evaluateParabolic(c, state.settings).kind === "incomplete"
    )
      return state;
    return {
      settings: { ...state.settings },
      tested: true,
      history: [
        ...state.history,
        { settings: { ...state.settings }, tested: state.tested },
      ],
    };
  }
  if (
    !parabolicParts.includes(move.part) ||
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
export function undoParabolic(state: ParabolicState): ParabolicState {
  const last = state.history.at(-1);
  return last
    ? {
        settings: { ...last.settings },
        tested: last.tested,
        history: state.history.slice(0, -1),
      }
    : state;
}
export function solveParabolic(
  c: ParabolicLevel,
  state = createParabolicState(c),
  limit = PARABOLIC_SEARCH_LIMIT,
): {
  settings: Record<ParabolicPart, number> | null;
  nodes: number;
  exhausted: boolean;
} {
  if (!validParabolicSettings(c, state.settings))
    return { settings: null, nodes: 0, exhausted: false };
  let nodes = 0,
    best: Record<ParabolicPart, number> | null = null,
    distance = Infinity;
  const cap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  for (const vx of c.vx)
    for (const vy of c.vy) {
      if (nodes >= cap) return { settings: best, nodes, exhausted: true };
      nodes++;
      const settings = { vx, vy };
      if (evaluateParabolic(c, settings).kind !== "target") continue;
      const changes = parabolicParts.filter(
        (p) => state.settings[p] !== settings[p],
      ).length;
      if (changes < distance) {
        best = settings;
        distance = changes;
      }
    }
  return { settings: best, nodes, exhausted: false };
}
export function describeParabolicResult(
  c: ParabolicLevel,
  result: ParabolicResult,
): string {
  if (result.kind === "invalid") return "参数无效，请重置实验。";
  if (result.kind === "incomplete") return "选择两个初速度，再发射验证。";
  if (result.kind === "obstacle")
    return `轨迹与${result.blocked.map((i) => `“${c.obstacles[i].name}”`).join("、")}相交。碰到边界也算碰撞，请调整弧线。`;
  if (result.kind === "ground")
    return "到达靶线前已落地。需要更长的滞空时间或更快的水平运动。";
  if (result.kind === "direction")
    return `靶线高度正确，但必须在${c.direction === "rising" ? "上升" : "下降"}时穿靶；最高点不算上升或下降。`;
  return `靶线处高度 ${labFormat(result.height!)} m；${result.kind === "target" ? "无碰撞，成功穿靶！" : result.kind === "low" ? "低于绿色靶窗。" : "高于绿色靶窗。"}`;
}
export function parabolicHint(
  c: ParabolicLevel,
  state: ParabolicState,
  limit = PARABOLIC_SEARCH_LIMIT,
): string {
  const current = evaluateParabolic(c, state.settings);
  if (isParabolicSolved(c, state))
    return "已验证：整段轨迹避开障碍，靶线高度和方向都合格。";
  if (current.kind === "incomplete")
    return state.settings.vx === null
      ? "先选水平速度。飞到靶线的时间 t = 水平距离 ÷ 水平速度；它同时影响上升和重力下落。"
      : "先选竖直初速度。在相同飞行时间 t 下，每增加 1 m/s，靶线高度增加 t 米。";
  if (current.kind === "target")
    return "当前计算满足所有条件。点击“发射验证”，检验整段弧线。";
  const search = solveParabolic(c, state, limit);
  if (!search.settings)
    return `${describeParabolicResult(c, current)}${search.exhausted ? `提示已检查 ${search.nodes} 种设置，达到上限。` : "当前选项没有可行解。"}`;
  const part = parabolicParts.find(
    (p) => search.settings![p] !== state.settings[p],
  )!;
  const trial = evaluateParabolic(c, {
    ...state.settings,
    [part]: search.settings[part],
  });
  const local =
    current.kind === "obstacle"
      ? `当前弧线碰到${c.obstacles[current.blocked[0]].name}。`
      : describeParabolicResult(c, current);
  return `${local}试把${parabolicPartNames[part]}从 ${state.settings[part]} 改为 ${search.settings[part]} m/s：靶线计算高度由 ${labFormat(current.height!)} 变为 ${labFormat(trial.height!)} m。${part === "vx" ? "水平速度改变飞行时间，不能一概认为更快就更高。" : "竖直初速度改变抛物线的起始斜率。"}${trial.kind === "target" ? "这条弧线也能避开全部障碍。" : "还要继续核对障碍和靶窗。"}`;
}
export const verifyParabolicLevel = (c: ParabolicLevel) =>
  validParabolicGeometry(c) &&
  evaluateParabolic(c, c.certificate).kind === "target";
