// SPDX-License-Identifier: MIT
import {
  labAdd,
  labCompare,
  labDiv,
  labFormat,
  labMul,
  labQ,
  labSub,
  labValid,
  type LabFraction,
} from "./ballisticsCircuitExact";
export type CurrentTopology = "single" | "series" | "parallel";
export type CurrentNumberPart = "voltage" | "common" | "ballastA" | "ballastB";
export type CurrentPart = CurrentNumberPart | "topology";
export type CurrentValue = number | CurrentTopology;
export type CurrentSettings = {
  voltage: number | null;
  topology: CurrentTopology | null;
  common: number | null;
  ballastA: number | null;
  ballastB: number | null;
};
export type CurrentCompleteSettings = {
  voltage: number;
  topology: CurrentTopology;
  common: number;
  ballastA: number;
  ballastB: number;
};
export type CurrentMove =
  | { part: CurrentNumberPart; value: number }
  | { part: "topology"; value: CurrentTopology }
  | { part: "measure" };
export type CurrentSnapshot = { settings: CurrentSettings; tested: boolean };
export type CurrentState = CurrentSnapshot & { history: CurrentSnapshot[] };
export type CurrentQuantity = "ia" | "ib" | "va" | "vb" | "sourceI" | "busV";
export type CurrentGoal = { quantity: CurrentQuantity; target: LabFraction };
export type CurrentLevel = {
  title: string;
  idea: string;
  lampA: number;
  lampB: number;
  options: {
    voltage: number[];
    topology: CurrentTopology[];
    common: number[];
    ballastA: number[];
    ballastB: number[];
  };
  goals: CurrentGoal[];
  certificate: CurrentCompleteSettings;
};
export const CURRENT_SEARCH_LIMIT = 2048;
export const currentParts: CurrentPart[] = [
  "topology",
  "voltage",
  "common",
  "ballastA",
  "ballastB",
];
export const currentNumberParts: CurrentNumberPart[] = [
  "voltage",
  "common",
  "ballastA",
  "ballastB",
];
export const currentPartNames: Record<CurrentPart, string> = {
  topology: "接线方式",
  voltage: "电源电压",
  common: "公共电阻 R₀",
  ballastA: "A 路电阻 R₁",
  ballastB: "B 路电阻 R₂",
};
export const currentTopologyNames: Record<CurrentTopology, string> = {
  single: "单灯",
  series: "串联",
  parallel: "并联",
};
export const currentQuantityNames: Record<CurrentQuantity, string> = {
  ia: "灯 A 电流",
  ib: "灯 B 电流",
  va: "灯 A 电压",
  vb: "灯 B 电压",
  sourceI: "电源总电流",
  busV: "灯路端电压",
};
export const currentUnit = (quantity: CurrentQuantity) =>
  ["ia", "ib", "sourceI"].includes(quantity) ? "A" : "V";
export const currentChoices = (
  c: CurrentLevel,
  part: CurrentPart,
): readonly CurrentValue[] => c.options[part];
export function validCurrentLevel(c: CurrentLevel): boolean {
  return (
    !!c &&
    [c.lampA, c.lampB].every(
      (v) => Number.isSafeInteger(v) && v >= 1 && v <= 100,
    ) &&
    !!c.options &&
    currentNumberParts.every(
      (p) =>
        Array.isArray(c.options[p]) &&
        c.options[p].length > 0 &&
        c.options[p].length <= 8 &&
        new Set(c.options[p]).size === c.options[p].length &&
        c.options[p].every(
          (v) =>
            Number.isSafeInteger(v) &&
            v >= (p === "voltage" ? 1 : 0) &&
            v <= (p === "voltage" ? 12 : 100),
        ),
    ) &&
    Array.isArray(c.options.topology) &&
    c.options.topology.length > 0 &&
    new Set(c.options.topology).size === c.options.topology.length &&
    c.options.topology.every((t) =>
      ["single", "series", "parallel"].includes(t),
    ) &&
    (!c.options.topology.includes("single") ||
      (c.options.topology.length === 1 &&
        c.options.ballastB.length === 1 &&
        c.options.ballastB[0] === 0)) &&
    Array.isArray(c.goals) &&
    c.goals.length > 0 &&
    c.goals.length <= 6 &&
    new Set(c.goals.map((g) => g.quantity)).size === c.goals.length &&
    c.goals.every(
      (g) =>
        Object.hasOwn(currentQuantityNames, g.quantity) &&
        labValid(g.target) &&
        labCompare(g.target, labQ(0)) >= 0,
    )
  );
}
export function validCurrentSettings(
  c: CurrentLevel,
  s: CurrentSettings,
): boolean {
  return (
    validCurrentLevel(c) &&
    !!s &&
    currentParts.every(
      (p) => s[p] === null || currentChoices(c, p).includes(s[p]!),
    )
  );
}
export type CurrentReadings = Record<CurrentQuantity, LabFraction> & {
  equivalentR: LabFraction;
  branchA: LabFraction;
  branchB: LabFraction;
  commonV: LabFraction;
  ballastAV: LabFraction;
  ballastBV: LabFraction;
  sourcePower: LabFraction;
};
export type CurrentResult = {
  kind: "invalid" | "incomplete" | "mismatch" | "target";
  readings: CurrentReadings | null;
  matched: boolean[];
};
/** Scope: positive ideal lamp resistors, ideal DC source/wires, nonnegative
 * ballast resistors. R0 is in series with either A, A+B, or A||B, where
 * A = R1 + lampA and B = R2 + lampB. No arbitrary graph/nodal claims. */
export function evaluateCurrent(
  c: CurrentLevel,
  settings: CurrentSettings,
): CurrentResult {
  if (!validCurrentSettings(c, settings))
    return { kind: "invalid", readings: null, matched: [] };
  if (currentParts.some((p) => settings[p] === null))
    return { kind: "incomplete", readings: null, matched: [] };
  const s = settings as CurrentCompleteSettings,
    a = labQ(s.ballastA + c.lampA),
    b = labQ(s.ballastB + c.lampB);
  const branchEquivalent =
    s.topology === "single"
      ? a
      : s.topology === "series"
        ? labAdd(a, b)
        : labDiv(labMul(a, b), labAdd(a, b));
  const equivalentR = labAdd(labQ(s.common), branchEquivalent),
    sourceI = labDiv(labQ(s.voltage), equivalentR),
    commonV = labMul(sourceI, labQ(s.common)),
    busV = labSub(labQ(s.voltage), commonV);
  const ia = s.topology === "parallel" ? labDiv(busV, a) : sourceI,
    ib =
      s.topology === "single"
        ? labQ(0)
        : s.topology === "parallel"
          ? labDiv(busV, b)
          : sourceI;
  const readings: CurrentReadings = {
    equivalentR,
    branchA: a,
    branchB: b,
    ia,
    ib,
    sourceI,
    busV,
    commonV,
    va: labMul(ia, labQ(c.lampA)),
    vb: labMul(ib, labQ(c.lampB)),
    ballastAV: labMul(ia, labQ(s.ballastA)),
    ballastBV: labMul(ib, labQ(s.ballastB)),
    sourcePower: labMul(labQ(s.voltage), sourceI),
  };
  const matched = c.goals.map(
    (goal) => labCompare(readings[goal.quantity], goal.target) === 0,
  );
  return {
    kind: matched.every(Boolean) ? "target" : "mismatch",
    readings,
    matched,
  };
}
export function createCurrentState(c: CurrentLevel): CurrentState {
  return {
    settings: {
      voltage: c.options.voltage.length === 1 ? c.options.voltage[0] : null,
      topology: c.options.topology.length === 1 ? c.options.topology[0] : null,
      common: c.options.common.length === 1 ? c.options.common[0] : null,
      ballastA: c.options.ballastA.length === 1 ? c.options.ballastA[0] : null,
      ballastB: c.options.ballastB.length === 1 ? c.options.ballastB[0] : null,
    },
    tested: false,
    history: [],
  };
}
export const isCurrentSolved = (c: CurrentLevel, state: CurrentSnapshot) =>
  state.tested && evaluateCurrent(c, state.settings).kind === "target";
export function moveCurrent(
  c: CurrentLevel,
  state: CurrentState,
  move: CurrentMove,
): CurrentState {
  if (!validCurrentSettings(c, state.settings) || isCurrentSolved(c, state))
    return state;
  if (move.part === "measure") {
    if (
      state.tested ||
      evaluateCurrent(c, state.settings).kind === "incomplete"
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
    !currentParts.includes(move.part) ||
    !currentChoices(c, move.part).includes(move.value) ||
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
export function undoCurrent(state: CurrentState): CurrentState {
  const last = state.history.at(-1);
  return last
    ? {
        settings: { ...last.settings },
        tested: last.tested,
        history: state.history.slice(0, -1),
      }
    : state;
}
export function solveCurrent(
  c: CurrentLevel,
  state = createCurrentState(c),
  limit = CURRENT_SEARCH_LIMIT,
): {
  settings: CurrentCompleteSettings | null;
  nodes: number;
  exhausted: boolean;
} {
  if (!validCurrentSettings(c, state.settings))
    return { settings: null, nodes: 0, exhausted: false };
  let nodes = 0,
    best: CurrentCompleteSettings | null = null,
    distance = Infinity;
  const cap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  for (const topology of c.options.topology)
    for (const voltage of c.options.voltage)
      for (const common of c.options.common)
        for (const ballastA of c.options.ballastA)
          for (const ballastB of c.options.ballastB) {
            if (nodes >= cap) return { settings: best, nodes, exhausted: true };
            nodes++;
            const settings = { topology, voltage, common, ballastA, ballastB };
            if (evaluateCurrent(c, settings).kind !== "target") continue;
            const changes = currentParts.filter(
              (p) => settings[p] !== state.settings[p],
            ).length;
            if (changes < distance) {
              best = settings;
              distance = changes;
            }
          }
  return { settings: best, nodes, exhausted: false };
}
export const currentValueLabel = (part: CurrentPart, value: CurrentValue) =>
  part === "topology"
    ? currentTopologyNames[value as CurrentTopology]
    : `${value} ${part === "voltage" ? "V" : "Ω"}`;
export function currentMoveFor(
  part: CurrentPart,
  value: CurrentValue,
): CurrentMove {
  return part === "topology"
    ? { part, value: value as CurrentTopology }
    : { part, value: value as number };
}
export function describeCurrentResult(
  c: CurrentLevel,
  result: CurrentResult,
): string {
  if (result.kind === "invalid") return "设置无效，请重置实验。";
  if (result.kind === "incomplete")
    return "选好接线方式、电源和电阻，再通电测量。";
  if (result.kind === "target")
    return "所有电流与电压目标均精确匹配，电路验证成功！";
  const index = result.matched.findIndex((v) => !v),
    goal = c.goals[index],
    actual = result.readings![goal.quantity];
  return `${result.matched.filter(Boolean).length} / ${c.goals.length} 项达标。${currentQuantityNames[goal.quantity]}为 ${labFormat(actual)} ${currentUnit(goal.quantity)}，${labCompare(actual, goal.target) < 0 ? "低于" : "高于"}目标 ${labFormat(goal.target)} ${currentUnit(goal.quantity)}。`;
}
export function currentHint(
  c: CurrentLevel,
  state: CurrentState,
  limit = CURRENT_SEARCH_LIMIT,
): string {
  const result = evaluateCurrent(c, state.settings);
  if (isCurrentSolved(c, state))
    return "测量已通过。串联元件电流相等，并联分流之和等于电源总电流。";
  if (result.kind === "incomplete") {
    const part = currentParts.find((p) => state.settings[p] === null)!;
    return part === "topology"
      ? "先决定接线方式：串联只有一条回路、两灯电流相等；并联有两条支路，支路电流由各自总电阻决定。"
      : part === "voltage"
        ? "先选电源电压。电阻网络不变时，电压提高几倍，每条电流也提高几倍。"
        : `先给${currentPartNames[part]}选一个阻值。0 Ω 表示一段理想导线；正电阻会产生 I × R 的电压降。`;
  }
  if (result.kind === "target")
    return "计算值已经满足目标，点击“通电测量”验证；匹配采用精确分数。";
  const search = solveCurrent(c, state, limit);
  if (!search.settings)
    return `${describeCurrentResult(c, result)}${search.exhausted ? `提示已检查 ${search.nodes} 种设置，达到上限。` : "当前选项没有可行解。"}`;
  const part = currentParts.find(
      (p) => state.settings[p] !== search.settings![p],
    )!,
    trial = evaluateCurrent(c, {
      ...state.settings,
      [part]: search.settings[part],
    }),
    before = result.readings!,
    after = trial.readings!;
  const mechanism =
    part === "topology"
      ? "换接线会改变两灯是否共用同一条电流路径。"
      : part === "voltage"
        ? "固定网络的电流随电源电压成比例变化。"
        : part === "common"
          ? "公共电阻承载总电流，其压降会影响整个灯路。"
          : state.settings.topology === "parallel" &&
              state.settings.common !== 0
            ? "支路电阻改变分流，也改变公共电阻压降，因此另一支路也会受影响。"
            : state.settings.topology === "series"
              ? "串联的总电阻改变，两盏灯的电流一起变化。"
              : state.settings.topology === "single"
                ? "这是一条单灯回路：灯与串联电阻共同决定总电流；增加串联电阻会降低电流，并分走更多电源电压。灯 B 未接入。"
                : "每条并联支路承受相同的灯路端电压；电阻越大，电流越小。";
  return `${describeCurrentResult(c, result)}试把${currentPartNames[part]}改为 ${currentValueLabel(part, search.settings[part])}：灯 A 电流 ${labFormat(before.ia)} → ${labFormat(after.ia)} A，灯 B 电流 ${labFormat(before.ib)} → ${labFormat(after.ib)} A。${mechanism}${trial.kind === "target" ? "此时全部目标匹配。" : "其他目标还需继续核对。"}`;
}
export const verifyCurrentLevel = (c: CurrentLevel) =>
  validCurrentLevel(c) && evaluateCurrent(c, c.certificate).kind === "target";
