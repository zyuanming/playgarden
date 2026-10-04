// SPDX-License-Identifier: MIT
/** Original staged compare-exchange puzzles; every edge travels forward in time. */
export type SortingPair = readonly [number, number];
export type SortingGates = (SortingPair | null)[][];
export type SortingLevel = {
  title: string;
  lanes: number;
  slots: number[];
  fixed: SortingGates;
  solution: SortingGates;
  adjacentOnly: boolean;
  lesson: string;
};
export type SortingState = { gates: SortingGates; history: SortingGates[] };
export type SortingMove = {
  stage: number;
  slot: number;
  pair: SortingPair | null;
};
export type SortingReport = {
  valid: boolean;
  total: number;
  passed: number;
  counterexample: { input: number[]; output: number[] } | null;
};
export const SORTING_MAX_LANES = 6;
export const SORTING_MAX_STAGES = 6;
export const sortingPairKey = (pair: SortingPair | null) =>
  pair ? `${pair[0]}-${pair[1]}` : "";
export const sortingPairLabel = (pair: SortingPair | null) =>
  pair ? `线 ${pair[0] + 1} ↔ 线 ${pair[1] + 1}` : "直通（不装门）";
const same = (a: SortingPair | null, b: SortingPair | null) =>
  sortingPairKey(a) === sortingPairKey(b);
const clone = (gates: SortingGates): SortingGates =>
  gates.map((stage) =>
    stage.map((pair) => (pair ? ([pair[0], pair[1]] as SortingPair) : null)),
  );
const validPair = (level: SortingLevel, pair: SortingPair) =>
  pair.length === 2 &&
  pair.every(Number.isInteger) &&
  pair[0] >= 0 &&
  pair[0] < pair[1] &&
  pair[1] < level.lanes &&
  (!level.adjacentOnly || pair[1] === pair[0] + 1);
function validShape(level: SortingLevel, gates: SortingGates): boolean {
  return (
    gates.length === level.slots.length &&
    gates.every((stage, i) => {
      if (stage.length !== level.slots[i]) return false;
      const used = new Set<number>();
      for (const pair of stage) {
        if (pair === null) continue;
        if (!validPair(level, pair) || pair.some((lane) => used.has(lane)))
          return false;
        pair.forEach((lane) => used.add(lane));
      }
      return true;
    })
  );
}
export function validSortingLevel(level: SortingLevel): boolean {
  return (
    Number.isInteger(level.lanes) &&
    level.lanes >= 2 &&
    level.lanes <= SORTING_MAX_LANES &&
    level.slots.length >= 1 &&
    level.slots.length <= SORTING_MAX_STAGES &&
    level.slots.every(
      (n) => Number.isInteger(n) && n >= 1 && n <= Math.floor(level.lanes / 2),
    ) &&
    validShape(level, level.fixed) &&
    validShape(level, level.solution) &&
    level.fixed.every((stage, s) =>
      stage.every(
        (pair, p) => pair === null || same(pair, level.solution[s][p]),
      ),
    )
  );
}
export function validSortingGates(
  level: SortingLevel,
  gates: SortingGates,
): boolean {
  return (
    validSortingLevel(level) &&
    validShape(level, gates) &&
    gates.every((stage, s) =>
      stage.every(
        (pair, p) =>
          level.fixed[s][p] === null || same(pair, level.fixed[s][p]),
      ),
    )
  );
}
export function sortingPairs(level: SortingLevel): SortingPair[] {
  const pairs: SortingPair[] = [];
  for (let a = 0; a < level.lanes; a++)
    for (let b = a + 1; b < level.lanes; b++)
      if (!level.adjacentOnly || b === a + 1) pairs.push([a, b]);
  return pairs;
}
export const createSortingState = (level: SortingLevel): SortingState => ({
  gates: clone(level.fixed),
  history: [],
});
/** Snapshot after each parallel stage, including the original input. */
export function traceSorting(
  level: SortingLevel,
  gates: SortingGates,
  input: readonly number[],
): number[][] | null {
  if (
    !validSortingGates(level, gates) ||
    input.length !== level.lanes ||
    input.some((n) => !Number.isFinite(n))
  )
    return null;
  const trace = [[...input]];
  for (const stage of gates) {
    const before = trace[trace.length - 1],
      after = [...before];
    for (const pair of stage) {
      if (!pair) continue;
      after[pair[0]] = Math.min(before[pair[0]], before[pair[1]]);
      after[pair[1]] = Math.max(before[pair[0]], before[pair[1]]);
    }
    trace.push(after);
  }
  return trace;
}
export function sortingBinaryInput(lanes: number, row: number): number[] {
  return Array.from(
    { length: lanes },
    (_, lane) => (row >> (lanes - lane - 1)) & 1,
  );
}
const ordered = (output: number[]) =>
  output.every((n, i) => i === 0 || output[i - 1] <= n);
/** Zero-one principle: sorting all 2^n binary inputs proves this fixed comparator
 * network sorts every ordered numeric input, including duplicates. Never sampled. */
export function verifySorting(
  level: SortingLevel,
  gates: SortingGates,
): SortingReport {
  if (!validSortingGates(level, gates))
    return { valid: false, total: 0, passed: 0, counterexample: null };
  let passed = 0;
  let counterexample: SortingReport["counterexample"] = null;
  const total = 2 ** level.lanes;
  for (let row = 0; row < total; row++) {
    const input = sortingBinaryInput(level.lanes, row);
    const output = traceSorting(level, gates, input)!.at(-1)!;
    if (ordered(output)) passed++;
    else if (!counterexample) counterexample = { input, output };
  }
  return { valid: true, total, passed, counterexample };
}
export const sortingWon = (
  level: SortingLevel,
  gates: SortingGates,
): boolean => {
  const report = verifySorting(level, gates);
  return report.valid && report.passed === report.total;
};
export function sortingMoveProblem(
  level: SortingLevel,
  gates: SortingGates,
  move: SortingMove,
): string | null {
  if (!validSortingGates(level, gates)) return "当前网络无效，请重置。";
  if (
    !Number.isInteger(move.stage) ||
    move.stage < 0 ||
    move.stage >= level.slots.length ||
    !Number.isInteger(move.slot) ||
    move.slot < 0 ||
    move.slot >= level.slots[move.stage]
  )
    return "没有这个门位。";
  if (level.fixed[move.stage][move.slot] !== null)
    return "这是固定门，不能修改。";
  if (move.pair !== null && !validPair(level, move.pair))
    return "这两条线不能在此关连接。";
  if (same(move.pair, gates[move.stage][move.slot])) return "门位没有变化。";
  if (
    move.pair &&
    gates[move.stage].some(
      (pair, slot) =>
        slot !== move.slot &&
        pair &&
        pair.some((lane) => move.pair!.includes(lane)),
    )
  )
    return "同一阶段的一条线只能参加一扇门；先移除冲突门。";
  return null;
}
export function applySortingMove(
  level: SortingLevel,
  gates: SortingGates,
  move: SortingMove,
): SortingGates | null {
  if (sortingMoveProblem(level, gates, move)) return null;
  const next = clone(gates);
  next[move.stage][move.slot] = move.pair ? [move.pair[0], move.pair[1]] : null;
  return next;
}
export function moveSorting(
  level: SortingLevel,
  state: SortingState,
  move: SortingMove,
): SortingState {
  if (sortingWon(level, state.gates)) return state;
  const gates = applySortingMove(level, state.gates, move);
  return gates
    ? { gates, history: [...state.history, clone(state.gates)] }
    : state;
}
export function undoSorting(state: SortingState): SortingState {
  const gates = state.history.at(-1);
  return gates
    ? { gates: clone(gates), history: state.history.slice(0, -1) }
    : state;
}
/** Bounded constructive hint against the CURRENT network. At most 18 slots;
 * clear a conflicting editable gate before proposing a certified replacement.
 * This is explicitly one design, not a claim of minimal edits or uniqueness. */
export function sortingNextMove(
  level: SortingLevel,
  gates: SortingGates,
): SortingMove | null {
  if (!validSortingGates(level, gates) || sortingWon(level, gates)) return null;
  for (let stage = 0; stage < gates.length; stage++) {
    for (let slot = 0; slot < gates[stage].length; slot++) {
      const pair = level.solution[stage][slot];
      if (same(pair, gates[stage][slot]) || level.fixed[stage][slot] !== null)
        continue;
      if (pair) {
        const collision = gates[stage].findIndex(
          (other, index) =>
            index !== slot &&
            other &&
            other.some((lane) => pair.includes(lane)),
        );
        if (collision !== -1) return { stage, slot: collision, pair: null };
      }
      return { stage, slot, pair };
    }
  }
  return null;
}
export function sortingHint(
  level: SortingLevel,
  gates: SortingGates,
): { text: string; move: SortingMove | null } {
  if (sortingWon(level, gates))
    return { text: "全部 0/1 输入都通过，网络已正确排序！", move: null };
  const move = sortingNextMove(level, gates);
  return {
    move,
    text: move
      ? `沿一套已验证的设计：第 ${move.stage + 1} 阶段，门位 ${move.slot + 1}${move.pair ? `设为“${sortingPairLabel(move.pair)}”` : "改为直通，先释放被占用的线"}。后续可能还要调整其他门；这不是唯一答案。`
      : "当前网络无法检查，请重置。",
  };
}
const makeLevel = (
  title: string,
  lanes: number,
  solution: SortingGates,
  fixedStages: number[],
  adjacentOnly: boolean,
  lesson: string,
): SortingLevel => ({
  title,
  lanes,
  slots: solution.map((stage) => stage.length),
  solution: clone(solution),
  fixed: solution.map((stage, s) =>
    stage.map((pair) =>
      fixedStages.includes(s) && pair ? [pair[0], pair[1]] : null,
    ),
  ),
  adjacentOnly,
  lesson,
});
const three: SortingGates = [[[0, 1]], [[1, 2]], [[0, 1]]];
const four: SortingGates = [
  [
    [0, 1],
    [2, 3],
  ],
  [
    [0, 2],
    [1, 3],
  ],
  [[1, 2]],
];
const five: SortingGates = [
  [
    [0, 1],
    [2, 3],
  ],
  [
    [0, 2],
    [1, 4],
  ],
  [
    [0, 1],
    [2, 3],
  ],
  [
    [1, 2],
    [3, 4],
  ],
  [[2, 3]],
];
const six: SortingGates = [
  [
    [0, 1],
    [2, 3],
    [4, 5],
  ],
  [
    [0, 2],
    [1, 4],
    [3, 5],
  ],
  [
    [0, 1],
    [2, 3],
    [4, 5],
  ],
  [
    [1, 2],
    [3, 4],
  ],
  [[2, 3]],
];
// Original scaffold puzzles. Tests certify all binary inputs AND all distinct
// permutations using a separate comparator interpreter, including fixed gates.
export const sortingNetworkLevels: SortingLevel[] = [
  makeLevel(
    "两条信号线",
    2,
    [[[0, 1]]],
    [],
    false,
    "装上一扇比较交换门：小值去编号较小的上方线，大值去下方线。相等时保持不变。",
  ),
  makeLevel(
    "补上最后一门",
    3,
    three,
    [0, 1],
    false,
    "前两阶段已经固定。一次比较只保证两条线的顺序，观察哪个输入仍会失败。",
  ),
  makeLevel(
    "三线设计师",
    3,
    three,
    [],
    false,
    "从空白开始搭建三阶段网络。每一组输入都经过同一套门，不能根据输入临时改接线。",
  ),
  makeLevel(
    "中间的缺口",
    4,
    four,
    [0, 1],
    false,
    "两两排序再跨线比较后，最上和最下已就位。还需要一扇门整理中间两条线。",
  ),
  makeLevel(
    "配对之后",
    4,
    four,
    [0],
    false,
    "第一阶段把四条线分成两对。后面要让两个小组的信息交流，不能只重复原来的配对。",
  ),
  makeLevel(
    "四线并行",
    4,
    four,
    [],
    false,
    "同一阶段的门同时工作，不能共用一条线。用三个阶段、至多五扇门完成所有输入。",
  ),
  makeLevel(
    "邻线接力",
    4,
    [
      [
        [0, 1],
        [2, 3],
      ],
      [[1, 2]],
      [
        [0, 1],
        [2, 3],
      ],
      [[1, 2]],
    ],
    [0],
    true,
    "这一关只允许相邻线比较。让奇数配对和偶数配对交替接力，把信号逐步送到正确位置。",
  ),
  makeLevel(
    "五线轮班",
    5,
    [
      [
        [0, 1],
        [2, 3],
      ],
      [
        [1, 2],
        [3, 4],
      ],
      [
        [0, 1],
        [2, 3],
      ],
      [
        [1, 2],
        [3, 4],
      ],
      [
        [0, 1],
        [2, 3],
      ],
    ],
    [0, 2],
    true,
    "五条线每轮都有一条休息。固定阶段已经就位，补齐相邻比较，让边缘信号也能走到另一端。",
  ),
  makeLevel(
    "跨线捷径",
    5,
    five,
    [0],
    false,
    "现在可以跨过中间的线比较。至多九扇门，结合跨线筛选与末尾的相邻整理。",
  ),
  makeLevel(
    "五线总装",
    5,
    five,
    [],
    false,
    "五阶段全部由你安排。预览通过只说明这一组输入正确；真正的目标是全部 32 组。",
  ),
  makeLevel(
    "六线合流",
    6,
    six,
    [0, 1],
    false,
    "前三对已完成分组并交换信息。利用剩余阶段整理边界，使每一种输入都从上到下非递减。",
  ),
  makeLevel(
    "网络总工程师",
    6,
    six,
    [],
    false,
    "六条线、五个阶段、至多十二扇门。从空白搭建固定流程，让全部 64 组二进制输入通过。",
  ),
];
