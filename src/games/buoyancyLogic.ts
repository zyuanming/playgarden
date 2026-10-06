// SPDX-License-Identifier: GPL-3.0-only
import {
  comparePhysicsRatios,
  formatPhysicsRatio,
  physicsRatio,
  validPhysicsRatio,
  type PhysicsRatio,
} from "./motionPhysicsRational";
export type DockHull = { id: string; areaDm2: number; massG: number };
export type DockCargo = { id: string; massG: number; required: boolean };
export type BuoyancyBoard = { hulls: boolean[]; cargo: boolean[] };
export type BuoyancySnapshot = BuoyancyBoard & { tested: boolean };
export type BuoyancyState = BuoyancySnapshot & { history: BuoyancySnapshot[] };
export type BuoyancyMove =
  { kind: "hull" | "cargo"; index: number } | { kind: "launch" };
export type BuoyancyLevel = {
  title: string;
  idea: string;
  densityKgM3: number;
  hullHeightMm: number;
  maxHulls: number;
  hulls: DockHull[];
  cargo: DockCargo[];
  targetDraftMm: PhysicsRatio;
  certificate: BuoyancyBoard;
};
export const BUOYANCY_SEARCH_LIMIT = 4096;
function level(
  title: string,
  densityKgM3: number,
  maxHulls: number,
  hulls: [number, number][],
  cargo: [number, boolean][],
  selectedHulls: number[],
  selectedCargo: number[],
  idea: string,
): BuoyancyLevel {
  const area = selectedHulls.reduce((sum, i) => sum + hulls[i][0], 0);
  const massG =
    selectedHulls.reduce((sum, i) => sum + hulls[i][1] * 1000, 0) +
    selectedCargo.reduce((sum, i) => sum + cargo[i][0] * 1000, 0);
  return {
    title,
    idea,
    densityKgM3,
    hullHeightMm: 300,
    maxHulls,
    hulls: hulls.map(([areaDm2, kg], i) => ({
      id: String.fromCharCode(65 + i),
      areaDm2,
      massG: kg * 1000,
    })),
    cargo: cargo.map(([kg, required], i) => ({
      id: `${required ? "货物" : "压舱"}${i + 1}`,
      massG: kg * 1000,
      required,
    })),
    targetDraftMm: physicsRatio(massG * 100, densityKgM3 * area),
    certificate: {
      hulls: hulls.map((_, i) => selectedHulls.includes(i)),
      cargo: cargo.map((_, i) => selectedCargo.includes(i)),
    },
  };
}
export const buoyancyLevels: BuoyancyLevel[] = [
  level(
    "第一艘浮台",
    1000,
    1,
    [
      [10, 5],
      [20, 8],
    ],
    [[10, true]],
    [0],
    [0],
    "先装上必运货物，再比较不同浮箱的吃水。浮箱本身也有质量。",
  ),
  level(
    "宽一点，浮高一点",
    1000,
    1,
    [
      [10, 4],
      [15, 6],
      [20, 8],
    ],
    [
      [12, true],
      [3, false],
    ],
    [1],
    [0],
    "相同载重下，水线面积越大，通常需要的吃水越浅。",
  ),
  level(
    "压舱微调",
    1000,
    1,
    [
      [10, 3],
      [15, 5],
      [20, 7],
    ],
    [
      [12, true],
      [2, false],
      [5, false],
    ],
    [0],
    [0, 1],
    "压舱块让浮台下沉一些。不要为了减轻重量漏装必运货物。",
  ),
  level(
    "拼接双浮箱",
    1000,
    2,
    [
      [10, 4],
      [15, 6],
      [20, 9],
    ],
    [
      [25, true],
      [10, true],
      [3, false],
    ],
    [0, 1],
    [0, 1],
    "拼接后水线面积相加，空船质量也相加。两者都影响吃水。",
  ),
  level(
    "盐水码头",
    1100,
    2,
    [
      [10, 4],
      [15, 6],
      [20, 8],
      [25, 12],
    ],
    [
      [22, true],
      [11, true],
      [4, false],
    ],
    [1, 2],
    [0, 1, 2],
    "液体密度增大，每升排开液体提供的浮力也增大。",
  ),
  level(
    "低密度实验液",
    900,
    2,
    [
      [12, 4],
      [16, 7],
      [20, 9],
      [24, 11],
    ],
    [
      [18, true],
      [9, true],
      [3, false],
      [6, false],
    ],
    [0, 2],
    [0, 1, 3],
    "在较低密度的实验液里，同一浮台会吃水更深。",
  ),
  level(
    "保留干舷",
    1000,
    2,
    [
      [8, 3],
      [12, 5],
      [18, 8],
      [24, 11],
    ],
    [
      [24, true],
      [18, true],
      [4, false],
      [7, false],
    ],
    [1, 3],
    [0, 1, 2],
    "吃水必须严格小于浮箱高度，才能保留露出水面的干舷。",
  ),
  level(
    "三箱货运平台",
    1000,
    3,
    [
      [8, 3],
      [12, 5],
      [16, 7],
      [20, 9],
      [24, 11],
    ],
    [
      [30, true],
      [20, true],
      [10, true],
      [3, false],
      [6, false],
    ],
    [0, 2, 4],
    [0, 1, 2, 3],
    "先求总质量与总水线面积，再选择小压舱块进行微调。",
  ),
  level(
    "分数吃水线",
    1050,
    3,
    [
      [9, 4],
      [13, 6],
      [17, 8],
      [21, 10],
      [25, 12],
    ],
    [
      [21, true],
      [14, true],
      [7, true],
      [2, false],
      [5, false],
    ],
    [0, 1, 3],
    [0, 1, 2, 4],
    "目标可以是精确分数毫米。显示的小数仅用于观察，不用于判定。",
  ),
  level(
    "浓盐水配载",
    1200,
    3,
    [
      [10, 5],
      [14, 7],
      [18, 9],
      [22, 11],
      [26, 13],
    ],
    [
      [36, true],
      [24, true],
      [12, true],
      [3, false],
      [5, false],
      [8, false],
    ],
    [1, 2, 4],
    [0, 1, 2, 3, 5],
    "用密度 × 水线面积 × 目标吃水，反求需要的总质量。",
  ),
  level(
    "有限船位",
    950,
    3,
    [
      [8, 4],
      [12, 6],
      [16, 8],
      [20, 10],
      [24, 12],
      [28, 14],
    ],
    [
      [27, true],
      [18, true],
      [9, true],
      [2, false],
      [4, false],
      [7, false],
    ],
    [0, 3, 5],
    [0, 1, 2, 4],
    "最多三个浮箱。增加面积并非总能解决问题，浮箱的自重也会变化。",
  ),
  level(
    "浮力总设计师",
    1100,
    4,
    [
      [9, 4],
      [13, 6],
      [17, 8],
      [21, 10],
      [25, 12],
      [29, 14],
    ],
    [
      [33, true],
      [22, true],
      [11, true],
      [3, false],
      [5, false],
      [8, false],
    ],
    [0, 2, 3, 5],
    [0, 1, 2, 3, 4],
    "同时满足必运货物、船位上限、目标吃水和正干舷，完成静水配载。",
  ),
];
function validDockConfig(c: BuoyancyLevel): boolean {
  return (
    Number.isInteger(c.densityKgM3) &&
    c.densityKgM3 >= 100 &&
    c.densityKgM3 <= 2000 &&
    Number.isInteger(c.hullHeightMm) &&
    c.hullHeightMm > 0 &&
    c.hullHeightMm <= 1000 &&
    c.hulls.length > 0 &&
    c.hulls.length <= 6 &&
    c.cargo.length > 0 &&
    c.cargo.length <= 6 &&
    Number.isInteger(c.maxHulls) &&
    c.maxHulls > 0 &&
    c.maxHulls <= c.hulls.length &&
    c.hulls.every(
      (h) =>
        Number.isInteger(h.areaDm2) &&
        h.areaDm2 > 0 &&
        h.areaDm2 <= 100 &&
        Number.isInteger(h.massG) &&
        h.massG > 0 &&
        h.massG <= 1_000_000,
    ) &&
    c.cargo.every(
      (v) =>
        Number.isInteger(v.massG) &&
        v.massG > 0 &&
        v.massG <= 1_000_000 &&
        typeof v.required === "boolean",
    ) &&
    validPhysicsRatio(c.targetDraftMm) &&
    c.targetDraftMm.numerator > 0 &&
    comparePhysicsRatios(c.targetDraftMm, physicsRatio(c.hullHeightMm)) < 0
  );
}
export function validBuoyancyBoard(
  c: BuoyancyLevel,
  board: BuoyancyBoard,
): boolean {
  return (
    validDockConfig(c) &&
    board.hulls.length === c.hulls.length &&
    board.cargo.length === c.cargo.length &&
    [...board.hulls, ...board.cargo].every((v) => typeof v === "boolean") &&
    board.hulls.filter(Boolean).length <= c.maxHulls
  );
}
export function createBuoyancyState(c: BuoyancyLevel): BuoyancyState {
  return {
    hulls: c.hulls.map(() => false),
    cargo: c.cargo.map(() => false),
    tested: false,
    history: [],
  };
}
export type BuoyancyResult = {
  kind:
    | "invalid"
    | "empty"
    | "sunk"
    | "submerged"
    | "missing"
    | "shallow"
    | "deep"
    | "target";
  massG: number;
  areaDm2: number;
  draftMm: PhysicsRatio | null;
  displacedL: PhysicsRatio;
  averageDensityKgM3: PhysicsRatio | null;
  missingCargo: number;
};
/** Rigid joined sealed rectangular pontoons share height and waterline. Static
 * equilibrium only: draft(mm)=100×mass(g)/(density(kg/m³)×area(dm²)).
 * No waves, tilt, leakage or dynamic stability. Every carried gram counts. */
export function evaluateBuoyancy(
  c: BuoyancyLevel,
  board: BuoyancyBoard,
): BuoyancyResult {
  const base = {
    massG: 0,
    areaDm2: 0,
    draftMm: null,
    displacedL: physicsRatio(0),
    averageDensityKgM3: null,
    missingCargo: 0,
  };
  if (!validBuoyancyBoard(c, board)) return { ...base, kind: "invalid" };
  const areaDm2 = c.hulls.reduce(
    (sum, h, i) => sum + (board.hulls[i] ? h.areaDm2 : 0),
    0,
  );
  const massG =
    c.hulls.reduce((sum, h, i) => sum + (board.hulls[i] ? h.massG : 0), 0) +
    c.cargo.reduce(
      (sum, load, i) => sum + (board.cargo[i] ? load.massG : 0),
      0,
    );
  const missingCargo = c.cargo.filter(
    (load, i) => load.required && !board.cargo[i],
  ).length;
  // This is REQUIRED displacement; over-capacity configurations cannot supply it.
  const displacedL = physicsRatio(massG, c.densityKgM3);
  if (!areaDm2)
    return { ...base, kind: "empty", massG, missingCargo, displacedL };
  const draftMm = physicsRatio(massG * 100, c.densityKgM3 * areaDm2);
  const averageDensityKgM3 = physicsRatio(
    massG * 100,
    areaDm2 * c.hullHeightMm,
  );
  const atHeight = comparePhysicsRatios(draftMm, physicsRatio(c.hullHeightMm));
  const atTarget = comparePhysicsRatios(draftMm, c.targetDraftMm);
  const kind =
    atHeight > 0
      ? "sunk"
      : atHeight === 0
        ? "submerged"
        : missingCargo
          ? "missing"
          : atTarget < 0
            ? "shallow"
            : atTarget > 0
              ? "deep"
              : "target";
  return {
    kind,
    massG,
    areaDm2,
    draftMm,
    displacedL,
    averageDensityKgM3,
    missingCargo,
  };
}
export function isBuoyancySolved(
  c: BuoyancyLevel,
  state: BuoyancySnapshot,
): boolean {
  return state.tested && evaluateBuoyancy(c, state).kind === "target";
}
const copySnapshot = (s: BuoyancySnapshot): BuoyancySnapshot => ({
  hulls: [...s.hulls],
  cargo: [...s.cargo],
  tested: s.tested,
});
export function moveBuoyancy(
  c: BuoyancyLevel,
  state: BuoyancyState,
  move: BuoyancyMove,
): BuoyancyState {
  if (!validBuoyancyBoard(c, state)) return state;
  if (move.kind === "launch") {
    if (state.tested || !state.hulls.some(Boolean)) return state;
    return {
      ...copySnapshot(state),
      tested: true,
      history: [...state.history, copySnapshot(state)],
    };
  }
  if (
    (move.kind !== "hull" && move.kind !== "cargo") ||
    !Number.isInteger(move.index)
  )
    return state;
  const key = move.kind === "hull" ? "hulls" : "cargo";
  if (move.index < 0 || move.index >= state[key].length) return state;
  const next = {
    ...copySnapshot(state),
    tested: false,
    [key]: state[key].map((value, i) => (i === move.index ? !value : value)),
  };
  if (!validBuoyancyBoard(c, next)) return state;
  return { ...next, history: [...state.history, copySnapshot(state)] };
}
export function undoBuoyancy(state: BuoyancyState): BuoyancyState {
  return state.history.length
    ? {
        ...copySnapshot(state.history[state.history.length - 1]),
        history: state.history.slice(0, -1),
      }
    : state;
}
/** Complete finite search: ≤2^(6+6)=4096 boards. Never claims an unsolved
 * search is impossible when its caller supplied a smaller evaluation cap. */
export function solveBuoyancy(
  c: BuoyancyLevel,
  state = createBuoyancyState(c),
  limit = BUOYANCY_SEARCH_LIMIT,
): { board: BuoyancyBoard | null; nodes: number; exhausted: boolean } {
  if (!validBuoyancyBoard(c, state))
    return { board: null, nodes: 0, exhausted: false };
  let nodes = 0,
    board: BuoyancyBoard | null = null,
    distance = Infinity;
  const cap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  for (let h = 0; h < 2 ** c.hulls.length; h++)
    for (let l = 0; l < 2 ** c.cargo.length; l++) {
      if (nodes >= cap) return { board, nodes, exhausted: true };
      nodes++;
      const candidate = {
        hulls: c.hulls.map((_, i) => Boolean(h & (1 << i))),
        cargo: c.cargo.map((_, i) => Boolean(l & (1 << i))),
      };
      if (
        !validBuoyancyBoard(c, candidate) ||
        evaluateBuoyancy(c, candidate).kind !== "target"
      )
        continue;
      const changes =
        candidate.hulls.filter((v, i) => v !== state.hulls[i]).length +
        candidate.cargo.filter((v, i) => v !== state.cargo[i]).length;
      if (changes < distance) {
        board = candidate;
        distance = changes;
      }
    }
  return { board, nodes, exhausted: false };
}
function moveTowardBuoyancy(
  state: BuoyancyState,
  target: BuoyancyBoard,
): BuoyancyMove {
  // Remove unwanted hulls first, so a full dock never blocks the next addition.
  let index = state.hulls.findIndex((v, i) => v && !target.hulls[i]);
  if (index >= 0) return { kind: "hull", index };
  index = state.cargo.findIndex((v, i) => v && !target.cargo[i]);
  if (index >= 0) return { kind: "cargo", index };
  index = state.hulls.findIndex((v, i) => v !== target.hulls[i]);
  if (index >= 0) return { kind: "hull", index };
  index = state.cargo.findIndex((v, i) => v !== target.cargo[i]);
  return index >= 0 ? { kind: "cargo", index } : { kind: "launch" };
}
export function buoyancyNextMove(
  c: BuoyancyLevel,
  state: BuoyancyState,
  limit = BUOYANCY_SEARCH_LIMIT,
): BuoyancyMove | null {
  if (isBuoyancySolved(c, state)) return null;
  const target = solveBuoyancy(c, state, limit).board;
  return target ? moveTowardBuoyancy(state, target) : null;
}
export function buoyancyHint(
  c: BuoyancyLevel,
  state: BuoyancyState,
  limit = BUOYANCY_SEARCH_LIMIT,
): string {
  if (isBuoyancySolved(c, state))
    return "货物已齐，吃水精确吻合，并保留正干舷。";
  const answer = solveBuoyancy(c, state, limit);
  if (!answer.board)
    return answer.exhausted
      ? `检查 ${answer.nodes} 种组合后达到搜索上限，尚未找到可行配载。`
      : "当前规则下没有可行配载。";
  const move = moveTowardBuoyancy(state, answer.board);
  if (move.kind === "launch")
    return "当前装配满足目标。点击“下水验证”检查静水吃水。";
  const placed =
    move.kind === "hull" ? state.hulls[move.index] : state.cargo[move.index];
  const name =
    move.kind === "hull"
      ? `浮箱 ${c.hulls[move.index].id}`
      : c.cargo[move.index].id;
  return `从当前配载出发，先${placed ? "卸下" : "装上"}${name}。${answer.exhausted ? "已找到可行方案，尚未检查全部组合。" : "接着根据新的总质量与面积继续调整。"}`;
}
export function describeBuoyancyResult(r: BuoyancyResult): string {
  if (r.kind === "invalid") return "装配无效，请重置码头。";
  if (r.kind === "empty")
    return "先选择至少一个浮箱。货物可以先放在干船坞里规划。";
  if (r.kind === "sunk")
    return "浮力容量不足：所需排水量超过全部浮箱体积，无法漂浮。";
  if (r.kind === "submerged")
    return "刚好完全浸没，干舷为 0；本实验要求保留正干舷。";
  const result =
    r.kind === "missing"
      ? `还缺 ${r.missingCargo} 件必运货物`
      : r.kind === "shallow"
        ? "比目标浅"
        : r.kind === "deep"
          ? "比目标深"
          : "吃水达标，货物齐全";
  return `静水吃水 ${formatPhysicsRatio(r.draftMm!)} mm；${result}。`;
}
export function verifyBuoyancyLevel(c: BuoyancyLevel): boolean {
  return (
    validDockConfig(c) && evaluateBuoyancy(c, c.certificate).kind === "target"
  );
}
export const buoyancySolutions: BuoyancyMove[][] = buoyancyLevels.map((c) => [
  ...c.certificate.hulls.flatMap((v, index) =>
    v ? [{ kind: "hull" as const, index }] : [],
  ),
  ...c.certificate.cargo.flatMap((v, index) =>
    v ? [{ kind: "cargo" as const, index }] : [],
  ),
  { kind: "launch" },
]);
