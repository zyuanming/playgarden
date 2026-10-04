/** Signed lever arms: negative = left, positive = right. Gravity is shared,
 * so the exact balance equation is Σ mass × signed distance = 0. */
export type BalanceWeight = { id: string; mass: number; allowed: number[] };
export type BalanceLevel = {
  title: string;
  arm: number;
  fixed: { mass: number; position: number }[];
  weights: BalanceWeight[];
  solution: number[];
  idea: string;
};
export type BalancePositions = (number | null)[];
export type BalanceState = {
  positions: BalancePositions;
  history: BalancePositions[];
};
export type BalanceMove = { weight: number; position: number | null };
export const BALANCE_SEARCH_LIMIT = 200_000;
const range = (a: number, b: number) =>
  Array.from({ length: b - a + 1 }, (_, i) => a + i);
const both = (arm: number) => [...range(-arm, -1), ...range(1, arm)];
function level(
  title: string,
  arm: number,
  fixed: [number, number][],
  weights: [number, number[]][],
  solution: number[],
  idea: string,
): BalanceLevel {
  return {
    title,
    arm,
    fixed: fixed.map(([mass, position]) => ({ mass, position })),
    weights: weights.map(([mass, allowed], i) => ({
      id: String.fromCharCode(65 + i),
      mass,
      allowed,
    })),
    solution,
    idea,
  };
}
export const balanceLevels: BalanceLevel[] = [
  level(
    "一样重，一样远",
    3,
    [[2, -2]],
    [[2, [1, 2, 3]]],
    [2],
    "相同重量放在支点两侧相同距离，力矩就能抵消。",
  ),
  level(
    "重一点，近一点",
    3,
    [[2, -3]],
    [[3, [1, 2, 3]]],
    [2],
    "2 × 3 与 3 × 2 一样大。重量和距离可以互相补偿。",
  ),
  level(
    "轻砝码的长手臂",
    4,
    [[4, -2]],
    [[2, [1, 2, 3, 4]]],
    [4],
    "轻砝码离支点远一些，也能平衡较重的砝码。",
  ),
  level(
    "两个砝码一起帮忙",
    4,
    [[3, -3]],
    [
      [2, [1, 2, 3, 4]],
      [1, [1, 2, 3, 4]],
    ],
    [4, 1],
    "同侧多个砝码的力矩要相加；每个挂点只能放一个。",
  ),
  level(
    "留出一个远端挂点",
    5,
    [[2, -4]],
    [
      [3, [1, 2, 3]],
      [1, [2, 3, 4, 5]],
    ],
    [1, 5],
    "可用挂点有限，先估算大砝码，再用小砝码补齐力矩。",
  ),
  level(
    "三位小助手",
    5,
    [[3, -5]],
    [
      [2, [2, 3, 4, 5]],
      [1, [1, 2, 3, 4]],
      [1, [1, 2, 3, 4, 5]],
    ],
    [5, 2, 3],
    "即使两块砝码一样重，它们也各占一个不同挂点。",
  ),
  level(
    "自由选择两侧",
    4,
    [],
    [
      [2, both(4)],
      [3, both(3)],
    ],
    [-3, 2],
    "左侧距离记为负，右侧为正；总力矩为零才能平衡。",
  ),
  level(
    "两边都能移动",
    4,
    [],
    [
      [3, [-4, -3, -2, -1, 1, 2]],
      [2, [-2, -1, 1, 2, 3]],
      [1, both(4)],
    ],
    [-2, 1, 4],
    "先选择哪边承载较重的砝码，再用另一边的力矩配平。",
  ),
  level(
    "固定砝码的影响",
    5,
    [[1, -5]],
    [
      [3, [-4, -3, -2, -1, 1, 2]],
      [2, [-3, -1, 1, 2, 3, 4]],
      [1, [-4, -2, -1, 1, 2, 3, 4, 5]],
    ],
    [-2, 4, 3],
    "固定砝码也贡献力矩。不要只计算能移动的部分。",
  ),
  level(
    "四块砝码的合奏",
    5,
    [],
    [
      [4, [-5, -4, -3, -2, -1, 1]],
      [3, [-3, -2, -1, 1, 2, 3]],
      [2, [-2, -1, 1, 2, 3, 4]],
      [1, both(5)],
    ],
    [-3, 2, 1, 4],
    "平衡不要求左右总质量相等，只要求左右力矩的大小相等。",
  ),
  level(
    "更长的实验台",
    6,
    [[2, -6]],
    [
      [4, [-5, -4, -3, -2, -1, 1]],
      [3, [-3, -2, 1, 2, 3, 4, 5]],
      [2, [-2, -1, 1, 2, 3, 4]],
      [1, [-4, -3, -1, 1, 2, 3, 5, 6]],
    ],
    [-2, 5, 1, 3],
    "距离加倍会使同一砝码的力矩加倍；移远一格的变化量就是质量。",
  ),
  level(
    "力矩总设计师",
    6,
    [[3, -6]],
    [
      [5, [-5, -4, -3, -2, -1, 1]],
      [4, [-4, -2, -1, 1, 2, 3, 4, 5]],
      [3, [-3, -2, -1, 1, 2, 3, 4]],
      [2, [-4, -1, 1, 2, 3, 4, 5, 6]],
      [1, [-5, -3, -1, 1, 2, 3, 4, 5, 6]],
    ],
    [-3, 4, 2, 5, 1],
    "把每个砝码的质量乘以带正负号的距离，再把所有结果相加。",
  ),
];
export function createBalanceState(config: BalanceLevel): BalanceState {
  return { positions: config.weights.map(() => null), history: [] };
}
export function validBalancePositions(
  config: BalanceLevel,
  positions: BalancePositions,
): boolean {
  if (positions.length !== config.weights.length) return false;
  const occupied = new Set(config.fixed.map((w) => w.position));
  return positions.every((position, index) => {
    if (position === null) return true;
    if (
      !Number.isInteger(position) ||
      !config.weights[index].allowed.includes(position) ||
      occupied.has(position)
    )
      return false;
    occupied.add(position);
    return true;
  });
}
export function balanceTorque(
  config: BalanceLevel,
  positions: BalancePositions,
): number {
  return (
    config.fixed.reduce((sum, w) => sum + w.mass * w.position, 0) +
    config.weights.reduce((sum, w, i) => sum + w.mass * (positions[i] ?? 0), 0)
  );
}
export function isBalanceSolved(
  config: BalanceLevel,
  state: Pick<BalanceState, "positions">,
): boolean {
  return (
    validBalancePositions(config, state.positions) &&
    state.positions.every((p) => p !== null) &&
    balanceTorque(config, state.positions) === 0
  );
}
export function moveBalance(
  config: BalanceLevel,
  state: BalanceState,
  move: BalanceMove,
): BalanceState {
  if (
    !Number.isInteger(move.weight) ||
    move.weight < 0 ||
    move.weight >= config.weights.length ||
    !validBalancePositions(config, state.positions) ||
    state.positions[move.weight] === move.position
  )
    return state;
  const positions = state.positions.map((p, i) =>
    i === move.weight ? move.position : p,
  );
  if (!validBalancePositions(config, positions)) return state;
  return { positions, history: [...state.history, [...state.positions]] };
}
export function undoBalance(state: BalanceState): BalanceState {
  return state.history.length
    ? {
        positions: [...state.history[state.history.length - 1]],
        history: state.history.slice(0, -1),
      }
    : state;
}
/** Exact assignment search with torque interval pruning. At most limit nodes. */
export function solveBalance(
  config: BalanceLevel,
  state = createBalanceState(config),
  limit = BALANCE_SEARCH_LIMIT,
): { positions: number[] | null; nodes: number; exhausted: boolean } {
  const positions: BalancePositions = config.weights.map(() => null);
  const used = new Set(config.fixed.map((w) => w.position));
  const order = config.weights
    .map((_, i) => i)
    .sort(
      (a, b) =>
        config.weights[a].allowed.length - config.weights[b].allowed.length ||
        a - b,
    );
  let nodes = 0;
  let exhausted = false;
  const visit = (depth: number, torque: number): number[] | null => {
    if (nodes >= limit) {
      exhausted = true;
      return null;
    }
    nodes++;
    if (depth === order.length)
      return torque === 0 ? (positions as number[]) : null;
    let min = torque,
      max = torque;
    for (let d = depth; d < order.length; d++) {
      const weight = config.weights[order[d]];
      const available = weight.allowed.filter((p) => !used.has(p));
      if (!available.length) return null;
      min += weight.mass * Math.min(...available);
      max += weight.mass * Math.max(...available);
    }
    if (min > 0 || max < 0) return null;
    const index = order[depth];
    const weight = config.weights[index];
    const candidates = [...weight.allowed].sort(
      (a, b) =>
        Number(b === state.positions[index]) -
          Number(a === state.positions[index]) || a - b,
    );
    for (const position of candidates) {
      if (used.has(position)) continue;
      used.add(position);
      positions[index] = position;
      const solution = visit(depth + 1, torque + weight.mass * position);
      if (solution) return [...solution];
      used.delete(position);
      positions[index] = null;
      if (exhausted) return null;
    }
    return null;
  };
  const answer = visit(
    0,
    config.fixed.reduce((sum, w) => sum + w.mass * w.position, 0),
  );
  return { positions: answer, nodes, exhausted };
}
export function balanceNextMove(
  config: BalanceLevel,
  state: BalanceState,
): BalanceMove | null {
  const solution = solveBalance(config, state).positions;
  if (!solution || isBalanceSolved(config, state)) return null;
  const different = solution
    .map((_, i) => i)
    .filter((i) => solution[i] !== state.positions[i]);
  const ready = different.find((i) => !state.positions.includes(solution[i]));
  if (ready !== undefined) return { weight: ready, position: solution[ready] };
  // Every desired slot is occupied: lift one misplaced weight to break a cycle.
  const lift = different.find((i) => state.positions[i] !== null);
  return lift === undefined ? null : { weight: lift, position: null };
}
export function balanceHint(config: BalanceLevel, state: BalanceState): string {
  if (isBalanceSolved(config, state)) return "已平衡！左右力矩正好抵消。";
  const move = balanceNextMove(config, state);
  if (!move) return "暂时没有找到解；可重置后重新安排挂点。";
  const w = config.weights[move.weight];
  return move.position === null
    ? `先把 ${w.id}（${w.mass} 单位）放回托盘，腾出被占用的挂点。`
    : `试把 ${w.id}（${w.mass} 单位）移到${move.position < 0 ? "左" : "右"} ${Math.abs(move.position)} 格。它贡献 ${w.mass * move.position} 单位力矩。`;
}
export function verifyBalanceLevel(config: BalanceLevel): boolean {
  const allSlots = [
    ...config.fixed.map((w) => w.position),
    ...config.weights.flatMap((w) => w.allowed),
  ];
  return (
    Number.isInteger(config.arm) &&
    config.arm > 0 &&
    config.weights.length > 0 &&
    config.weights.every(
      (w) =>
        Number.isInteger(w.mass) &&
        w.mass > 0 &&
        w.allowed.length > 0 &&
        new Set(w.allowed).size === w.allowed.length,
    ) &&
    config.fixed.every((w) => Number.isInteger(w.mass) && w.mass > 0) &&
    new Set(config.fixed.map((w) => w.position)).size === config.fixed.length &&
    allSlots.every(
      (p) => Number.isInteger(p) && p !== 0 && Math.abs(p) <= config.arm,
    ) &&
    isBalanceSolved(config, { positions: config.solution })
  );
}
export const balanceSolutions: BalanceMove[][] = balanceLevels.map((config) =>
  config.solution.map((position, weight) => ({ weight, position })),
);
