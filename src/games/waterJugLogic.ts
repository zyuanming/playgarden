/** Original integer-volume puzzles and bounded, deterministic breadth-first search. */
export type WaterJugMove =
  | { kind: "fill" | "empty"; jug: number }
  | { kind: "pour"; from: number; to: number };
export type WaterJugLevel = {
  title: string;
  capacities: number[];
  start: number[];
  target: number[];
  lesson: string;
  solution: WaterJugMove[];
  par: number;
};
export type WaterJugState = { volumes: number[]; history: number[][] };
export type WaterJugSearch = {
  solution: WaterJugMove[] | null;
  visited: number;
  status: "solved" | "unreachable" | "invalid" | "limit";
};
// At most 16³ integer-volume states. No input can request an unbounded search.
export const WATER_JUG_STATE_LIMIT = 4096;
export function validWaterJugVolumes(
  capacities: readonly number[],
  volumes: readonly number[],
): boolean {
  return (
    capacities.length >= 2 &&
    capacities.length <= 3 &&
    capacities.every((n) => Number.isInteger(n) && n >= 1 && n <= 15) &&
    volumes.length === capacities.length &&
    volumes.every((n, i) => Number.isInteger(n) && n >= 0 && n <= capacities[i])
  );
}
export function waterJugWon(
  level: WaterJugLevel,
  volumes: readonly number[],
): boolean {
  return (
    validWaterJugVolumes(level.capacities, volumes) &&
    volumes.length === level.target.length &&
    volumes.every((n, i) => n === level.target[i])
  );
}
export function applyWaterJugMove(
  level: WaterJugLevel,
  volumes: readonly number[],
  move: WaterJugMove,
): number[] | null {
  if (!validWaterJugVolumes(level.capacities, volumes)) return null;
  const index = (n: number) =>
    Number.isInteger(n) && n >= 0 && n < volumes.length;
  const next = [...volumes];
  if (move.kind === "fill" || move.kind === "empty") {
    if (!index(move.jug)) return null;
    next[move.jug] = move.kind === "fill" ? level.capacities[move.jug] : 0;
  } else if (move.kind === "pour") {
    if (!index(move.from) || !index(move.to) || move.from === move.to)
      return null;
    const amount = Math.min(
      volumes[move.from],
      level.capacities[move.to] - volumes[move.to],
    );
    next[move.from] -= amount;
    next[move.to] += amount;
  } else return null;
  return next.every((n, i) => n === volumes[i]) ? null : next;
}
export function legalWaterJugMoves(
  level: WaterJugLevel,
  volumes: readonly number[],
): WaterJugMove[] {
  const moves: WaterJugMove[] = [];
  for (let jug = 0; jug < level.capacities.length; jug++) {
    moves.push({ kind: "fill", jug }, { kind: "empty", jug });
    for (let to = 0; to < level.capacities.length; to++)
      if (jug !== to) moves.push({ kind: "pour", from: jug, to });
  }
  return moves.filter(
    (move) => applyWaterJugMove(level, volumes, move) !== null,
  );
}
export function searchWaterJug(
  level: WaterJugLevel,
  start: readonly number[] = level.start,
  maxStates = WATER_JUG_STATE_LIMIT,
): WaterJugSearch {
  if (
    !validWaterJugVolumes(level.capacities, start) ||
    !validWaterJugVolumes(level.capacities, level.target)
  )
    return { solution: null, visited: 0, status: "invalid" };
  if (waterJugWon(level, start))
    return { solution: [], visited: 1, status: "solved" };
  const limit = Number.isFinite(maxStates)
    ? Math.max(1, Math.min(WATER_JUG_STATE_LIMIT, Math.floor(maxStates)))
    : WATER_JUG_STATE_LIMIT;
  const queue = [
    { volumes: [...start], parent: -1, move: null as WaterJugMove | null },
  ];
  const seen = new Set([start.join(",")]);
  for (let head = 0; head < queue.length; head++) {
    for (const move of legalWaterJugMoves(level, queue[head].volumes)) {
      const next = applyWaterJugMove(level, queue[head].volumes, move)!;
      const key = next.join(",");
      if (seen.has(key)) continue;
      if (seen.size >= limit)
        return { solution: null, visited: seen.size, status: "limit" };
      seen.add(key);
      queue.push({ volumes: next, parent: head, move });
      if (waterJugWon(level, next)) {
        const route: WaterJugMove[] = [];
        for (
          let i = queue.length - 1;
          queue[i].parent !== -1;
          i = queue[i].parent
        )
          route.push(queue[i].move!);
        return {
          solution: route.reverse(),
          visited: seen.size,
          status: "solved",
        };
      }
    }
  }
  return { solution: null, visited: seen.size, status: "unreachable" };
}
export const solveWaterJug = (
  level: WaterJugLevel,
  volumes: readonly number[] = level.start,
) => searchWaterJug(level, volumes).solution;
export const createWaterJugState = (level: WaterJugLevel): WaterJugState => ({
  volumes: [...level.start],
  history: [],
});
export function waterJugMove(
  state: WaterJugState,
  level: WaterJugLevel,
  move: WaterJugMove,
): WaterJugState {
  if (waterJugWon(level, state.volumes)) return state;
  const volumes = applyWaterJugMove(level, state.volumes, move);
  return volumes
    ? { volumes, history: [...state.history, [...state.volumes]] }
    : state;
}
export function undoWaterJug(state: WaterJugState): WaterJugState {
  const previous = state.history.at(-1);
  return previous
    ? { volumes: [...previous], history: state.history.slice(0, -1) }
    : state;
}
export function waterJugMoveLabel(move: WaterJugMove): string {
  return move.kind === "pour"
    ? `${move.from + 1} 号壶倒入 ${move.to + 1} 号壶`
    : `${move.kind === "fill" ? "装满" : "倒空"} ${move.jug + 1} 号壶`;
}

// Shortest certificates are authored offline and independently checked in tests.
export const waterJugLevels: WaterJugLevel[] = [
  {
    title: "留下一小杯",
    capacities: [2, 3],
    start: [0, 0],
    target: [2, 1],
    lesson: "先装满大壶，再把小壶装满。剩下多少？",
    solution: [
      { kind: "fill", jug: 1 },
      { kind: "pour", from: 1, to: 0 },
    ],
    par: 2,
  },
  {
    title: "装满再分享",
    capacities: [3, 5],
    start: [0, 0],
    target: [0, 2],
    lesson: "倒满小壶后，把它倒空，保留大壶里的余量。",
    solution: [
      { kind: "fill", jug: 1 },
      { kind: "pour", from: 1, to: 0 },
      { kind: "empty", jug: 0 },
    ],
    par: 3,
  },
  {
    title: "反复差一点",
    capacities: [3, 4],
    start: [0, 0],
    target: [0, 2],
    lesson: "两个壶只差一升，试着累积这份差。",
    solution: [
      { kind: "fill", jug: 0 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "fill", jug: 0 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "empty", jug: 1 },
      { kind: "pour", from: 0, to: 1 },
    ],
    par: 6,
  },
  {
    title: "五升花茶",
    capacities: [4, 7],
    start: [0, 0],
    target: [0, 5],
    lesson: "装满和倒空可以搭配，把余量一步步带回大壶。",
    solution: [
      { kind: "fill", jug: 0 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "fill", jug: 0 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "empty", jug: 1 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "fill", jug: 0 },
      { kind: "pour", from: 0, to: 1 },
    ],
    par: 8,
  },
  {
    title: "中间刻度",
    capacities: [5, 8],
    start: [0, 0],
    target: [0, 4],
    lesson: "记住差值，重复有效的倒水顺序。",
    solution: [
      { kind: "fill", jug: 0 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "fill", jug: 0 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "empty", jug: 1 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "fill", jug: 0 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "fill", jug: 0 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "empty", jug: 1 },
      { kind: "pour", from: 0, to: 1 },
    ],
    par: 12,
  },
  {
    title: "八升晨露",
    capacities: [7, 10],
    start: [0, 0],
    target: [0, 8],
    lesson: "别急着把少量余水倒掉，它可能正是关键。",
    solution: [
      { kind: "fill", jug: 0 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "fill", jug: 0 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "empty", jug: 1 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "fill", jug: 0 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "empty", jug: 1 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "fill", jug: 0 },
      { kind: "pour", from: 0, to: 1 },
    ],
    par: 12,
  },
  {
    title: "第三个帮手",
    capacities: [3, 5, 8],
    start: [0, 0, 0],
    target: [1, 2, 8],
    lesson: "三个壶都要保留指定水量，先用空位作中转。",
    solution: [
      { kind: "fill", jug: 0 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "fill", jug: 2 },
      { kind: "pour", from: 2, to: 0 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "pour", from: 1, to: 2 },
    ],
    par: 6,
  },
  {
    title: "分出三份",
    capacities: [2, 5, 7],
    start: [0, 0, 0],
    target: [1, 3, 7],
    lesson: "最小的壶也能帮你留下精确余量。",
    solution: [
      { kind: "fill", jug: 0 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "fill", jug: 0 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "fill", jug: 2 },
      { kind: "pour", from: 2, to: 0 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "pour", from: 1, to: 2 },
    ],
    par: 8,
  },
  {
    title: "九升花圃",
    capacities: [4, 7, 9],
    start: [0, 0, 0],
    target: [2, 1, 9],
    lesson: "三个目标需要同时满足，先规划哪个壶最后装满。",
    solution: [
      { kind: "fill", jug: 0 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "fill", jug: 0 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "pour", from: 1, to: 2 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "fill", jug: 0 },
      { kind: "pour", from: 0, to: 2 },
    ],
    par: 8,
  },
  {
    title: "晨间配水",
    capacities: [5, 7, 11],
    start: [0, 0, 0],
    target: [3, 1, 11],
    lesson: "把已经量好的水暂存起来，再处理下一份。",
    solution: [
      { kind: "fill", jug: 0 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "fill", jug: 0 },
      { kind: "pour", from: 0, to: 2 },
      { kind: "fill", jug: 0 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "pour", from: 1, to: 2 },
    ],
    par: 7,
  },
  {
    title: "两份小余量",
    capacities: [5, 8, 13],
    start: [0, 0, 0],
    target: [2, 4, 13],
    lesson: "总量很大，但两份小余量才是关键。",
    solution: [
      { kind: "fill", jug: 1 },
      { kind: "pour", from: 1, to: 0 },
      { kind: "empty", jug: 0 },
      { kind: "pour", from: 1, to: 0 },
      { kind: "fill", jug: 1 },
      { kind: "pour", from: 1, to: 0 },
      { kind: "pour", from: 0, to: 2 },
      { kind: "pour", from: 1, to: 0 },
      { kind: "pour", from: 0, to: 2 },
      { kind: "pour", from: 1, to: 0 },
      { kind: "fill", jug: 1 },
      { kind: "pour", from: 1, to: 0 },
      { kind: "pour", from: 0, to: 2 },
    ],
    par: 13,
  },
  {
    title: "花园量水师",
    capacities: [7, 10, 13],
    start: [0, 0, 0],
    target: [5, 1, 13],
    lesson: "把大壶当临时仓库，留出足够的转移空间。",
    solution: [
      { kind: "fill", jug: 1 },
      { kind: "pour", from: 1, to: 0 },
      { kind: "empty", jug: 0 },
      { kind: "fill", jug: 2 },
      { kind: "pour", from: 2, to: 0 },
      { kind: "pour", from: 2, to: 1 },
      { kind: "pour", from: 0, to: 2 },
      { kind: "pour", from: 1, to: 0 },
      { kind: "pour", from: 0, to: 2 },
      { kind: "pour", from: 2, to: 1 },
      { kind: "empty", jug: 1 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "pour", from: 2, to: 0 },
      { kind: "fill", jug: 2 },
    ],
    par: 14,
  },
];
