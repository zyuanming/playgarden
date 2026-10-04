/** Original sliding-vehicle puzzles. All boards and artwork were authored for Playgarden. */
export type TrafficVehicle = {
  id: string;
  axis: "h" | "v";
  fixed: number;
  length: number;
};
export type TrafficMove = { vehicle: string; steps: number };
export type TrafficLevel = {
  title: string;
  vehicles: TrafficVehicle[];
  positions: number[];
  solution: TrafficMove[];
  par: number;
  lesson: string;
};
export type TrafficState = { positions: number[]; history: number[][] };
export const TRAFFIC_SIZE = 6;

export function validTrafficBoard(
  level: TrafficLevel,
  positions: readonly number[] = level.positions,
): boolean {
  if (
    !level.vehicles.length ||
    level.vehicles[0].id !== "T" ||
    level.vehicles[0].axis !== "h" ||
    level.vehicles[0].fixed !== 2 ||
    level.vehicles[0].length !== 2 ||
    positions.length !== level.vehicles.length ||
    new Set(level.vehicles.map((v) => v.id)).size !== level.vehicles.length
  )
    return false;
  const occupied = new Set<number>();
  return level.vehicles.every((vehicle, index) => {
    const start = positions[index];
    if (
      !["h", "v"].includes(vehicle.axis) ||
      !Number.isInteger(vehicle.fixed) ||
      vehicle.fixed < 0 ||
      vehicle.fixed >= 6 ||
      ![2, 3].includes(vehicle.length) ||
      !Number.isInteger(start)
    )
      return false;
    if (index === 0 && start === 6) return true;
    if (start < 0 || start + vehicle.length > 6) return false;
    for (let step = 0; step < vehicle.length; step++) {
      const cell =
        vehicle.axis === "h"
          ? vehicle.fixed * 6 + start + step
          : (start + step) * 6 + vehicle.fixed;
      if (occupied.has(cell)) return false;
      occupied.add(cell);
    }
    return true;
  });
}
export function isTrafficSolved(positions: readonly number[]): boolean {
  return positions[0] === 6;
}
function availableMoves(
  level: TrafficLevel,
  positions: readonly number[],
): TrafficMove[] {
  const occupied = Array<number>(36).fill(-1);
  level.vehicles.forEach((vehicle, index) => {
    if (index === 0 && positions[0] === 6) return;
    for (let step = 0; step < vehicle.length; step++)
      occupied[
        vehicle.axis === "h"
          ? vehicle.fixed * 6 + positions[index] + step
          : (positions[index] + step) * 6 + vehicle.fixed
      ] = index;
  });
  const moves: TrafficMove[] = [];
  level.vehicles.forEach((vehicle, index) => {
    for (const sign of [-1, 1]) {
      let next = positions[index];
      while (true) {
        const edge = sign < 0 ? next - 1 : next + vehicle.length;
        if (
          edge < 0 ||
          edge >= 6 ||
          occupied[
            vehicle.axis === "h"
              ? vehicle.fixed * 6 + edge
              : edge * 6 + vehicle.fixed
          ] !== -1
        )
          break;
        next += sign;
        moves.push({ vehicle: vehicle.id, steps: next - positions[index] });
      }
      // The complete car leaves the board in one move. Intermediate half-out states do not exist.
      if (index === 0 && sign === 1 && next + vehicle.length === 6)
        moves.push({ vehicle: "T", steps: 6 - positions[0] });
    }
  });
  return moves;
}
export function legalTrafficMoves(
  level: TrafficLevel,
  positions: readonly number[],
): TrafficMove[] {
  return !validTrafficBoard(level, positions) || isTrafficSolved(positions)
    ? []
    : availableMoves(level, positions);
}
export function moveTrafficVehicle(
  level: TrafficLevel,
  positions: readonly number[],
  move: TrafficMove,
): number[] | null {
  if (
    !legalTrafficMoves(level, positions).some(
      (candidate) =>
        candidate.vehicle === move.vehicle && candidate.steps === move.steps,
    )
  )
    return null;
  const next = [...positions];
  next[level.vehicles.findIndex((vehicle) => vehicle.id === move.vehicle)] +=
    move.steps;
  return next;
}
export function createTrafficState(level: TrafficLevel): TrafficState {
  return { positions: [...level.positions], history: [] };
}
export function trafficMove(
  state: TrafficState,
  level: TrafficLevel,
  move: TrafficMove,
): TrafficState {
  const positions = moveTrafficVehicle(level, state.positions, move);
  return positions
    ? { positions, history: [...state.history, state.positions] }
    : state;
}
export function undoTraffic(state: TrafficState): TrafficState {
  const positions = state.history.at(-1);
  return positions ? { positions, history: state.history.slice(0, -1) } : state;
}
/** Breadth-first search: one straight slide of any distance, including exit, counts as one move. */
export function solveTraffic(
  level: TrafficLevel,
  positions: readonly number[] = level.positions,
): TrafficMove[] | null {
  if (!validTrafficBoard(level, positions)) return null;
  const start = [...positions];
  const queue: {
    positions: number[];
    parent: number;
    move: TrafficMove | null;
  }[] = [{ positions: start, parent: -1, move: null }];
  const seen = new Set([start.join(",")]);
  const vehicleIndices = new Map(
    level.vehicles.map((vehicle, index) => [vehicle.id, index]),
  );
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (isTrafficSolved(current.positions)) {
      const solution: TrafficMove[] = [];
      for (
        let index = head;
        queue[index].parent >= 0;
        index = queue[index].parent
      )
        solution.push(queue[index].move!);
      return solution.reverse();
    }
    for (const move of availableMoves(level, current.positions)) {
      const next = [...current.positions];
      next[vehicleIndices.get(move.vehicle)!] += move.steps;
      const key = next.join(",");
      if (!seen.has(key)) {
        seen.add(key);
        queue.push({ positions: next, parent: head, move });
      }
    }
  }
  return null;
}
export function trafficHint(
  level: TrafficLevel,
  positions: readonly number[],
): TrafficMove | null {
  return solveTraffic(level, positions)?.[0] ?? null;
}
export function trafficMoveLabel(
  level: TrafficLevel,
  positions: readonly number[],
  move: TrafficMove,
): string {
  const index = level.vehicles.findIndex(
      (vehicle) => vehicle.id === move.vehicle,
    ),
    vehicle = level.vehicles[index];
  if (!vehicle) return "无效移动";
  if (index === 0 && positions[0] + move.steps === 6) return "驶出花园 →";
  const direction =
    vehicle.axis === "h"
      ? move.steps < 0
        ? "向左"
        : "向右"
      : move.steps < 0
        ? "向上"
        : "向下";
  return `${direction} ${Math.abs(move.steps)} 格`;
}

type Layout = [
  string,
  ["h" | "v", number, number][],
  number[],
  [number, number][],
  string,
];
const layouts: Layout[] = [
  [
    "给小绿让个路",
    [
      ["h", 2, 2],
      ["v", 3, 2],
      ["h", 4, 2],
    ],
    [0, 1, 3],
    [
      [1, -1],
      [0, 6],
    ],
    "小绿只能从右侧出口离开。先把挡路的车往上挪。",
  ],
  [
    "两扇小门",
    [
      ["h", 2, 2],
      ["v", 2, 2],
      ["v", 4, 2],
    ],
    [0, 1, 2],
    [
      [1, -1],
      [2, -2],
      [0, 6],
    ],
    "两辆车都要让出第三行。一次可以沿直线移动多格。",
  ],
  [
    "穿过林荫道",
    [
      ["h", 2, 2],
      ["h", 0, 2],
      ["v", 2, 2],
      ["v", 5, 2],
      ["h", 5, 3],
      ["v", 0, 2],
      ["v", 3, 2],
      ["v", 4, 2],
    ],
    [0, 2, 3, 2, 1, 4, 1, 1],
    [
      [3, -2],
      [6, 2],
      [7, -1],
      [0, 6],
    ],
    "找到三辆挡住出口的车，为每一辆找一块空地。",
  ],
  [
    "挪出一片空地",
    [
      ["h", 2, 2],
      ["h", 4, 3],
      ["h", 3, 2],
      ["h", 0, 2],
      ["v", 1, 2],
      ["h", 5, 2],
      ["v", 2, 2],
      ["v", 5, 2],
      ["h", 0, 3],
      ["v", 0, 2],
      ["h", 1, 2],
      ["v", 0, 2],
    ],
    [1, 3, 2, 4, 3, 4, 4, 1, 1, 0, 1, 4],
    [
      [9, 1],
      [8, -1],
      [3, -1],
      [7, -1],
      [0, 5],
    ],
    "要让出口附近的车移动，先整理最上面一排。",
  ],
  [
    "小小接力赛",
    [
      ["h", 2, 2],
      ["v", 0, 2],
      ["h", 3, 2],
      ["v", 4, 2],
      ["v", 5, 2],
      ["h", 3, 2],
      ["v", 3, 2],
      ["v", 1, 2],
      ["v", 4, 2],
      ["h", 0, 2],
    ],
    [1, 1, 0, 2, 4, 2, 0, 0, 4, 4],
    [
      [3, -1],
      [5, 2],
      [6, 3],
      [9, -2],
      [3, -1],
      [0, 5],
    ],
    "同一辆车可能需要分两次移动，中间先帮助伙伴。",
  ],
  [
    "上层花架",
    [
      ["h", 2, 2],
      ["h", 5, 2],
      ["h", 1, 2],
      ["v", 2, 2],
      ["v", 4, 2],
      ["h", 4, 2],
      ["v", 5, 2],
      ["v", 5, 2],
      ["v", 1, 2],
      ["h", 5, 3],
      ["h", 0, 3],
      ["h", 1, 2],
    ],
    [0, 3, 3, 2, 3, 2, 3, 0, 3, 0, 2, 1],
    [
      [10, -1],
      [11, -1],
      [2, -1],
      [4, -3],
      [5, 1],
      [3, 1],
      [0, 6],
    ],
    "先从上面开始调整，为下面的车腾出竖直通道。",
  ],
  [
    "先向前一点",
    [
      ["h", 2, 2],
      ["v", 5, 2],
      ["v", 4, 3],
      ["h", 4, 2],
      ["h", 5, 3],
      ["v", 0, 2],
      ["v", 1, 2],
      ["h", 4, 2],
      ["h", 3, 2],
      ["v", 3, 2],
      ["v", 0, 2],
    ],
    [0, 1, 1, 1, 1, 3, 0, 4, 1, 2, 0],
    [
      [0, 1],
      [1, -1],
      [5, -1],
      [3, -1],
      [7, -2],
      [2, 2],
      [9, -2],
      [0, 5],
    ],
    "小绿也能帮忙。先向前一格，让伙伴经过身后的空间。",
  ],
  [
    "花园的转身",
    [
      ["h", 2, 2],
      ["v", 4, 2],
      ["v", 1, 2],
      ["h", 5, 2],
      ["h", 1, 2],
      ["v", 0, 2],
      ["h", 0, 3],
      ["v", 5, 2],
      ["v", 3, 3],
      ["v", 1, 2],
      ["v", 5, 3],
      ["v", 4, 2],
    ],
    [1, 4, 3, 2, 3, 0, 3, 1, 2, 0, 3, 2],
    [
      [3, -1],
      [4, -1],
      [8, 1],
      [0, 1],
      [9, 1],
      [6, -2],
      [7, -1],
      [11, -2],
      [0, 4],
    ],
    "先松开上下两端，再让中央的大车往下滑。",
  ],
  [
    "长车短路",
    [
      ["h", 2, 2],
      ["v", 4, 2],
      ["v", 3, 3],
      ["h", 1, 2],
      ["h", 4, 2],
      ["h", 1, 2],
      ["h", 5, 3],
      ["h", 4, 2],
      ["h", 0, 2],
      ["h", 0, 2],
      ["v", 5, 2],
    ],
    [0, 3, 0, 4, 2, 1, 0, 0, 4, 0, 3],
    [
      [1, -1],
      [5, -1],
      [10, -1],
      [4, 2],
      [2, 3],
      [3, -2],
      [8, -2],
      [1, -2],
      [10, -2],
      [0, 6],
    ],
    "长车占三格。先清出它需要的整段路。",
  ],
  [
    "退一步的智慧",
    [
      ["h", 2, 2],
      ["h", 0, 2],
      ["v", 4, 2],
      ["v", 4, 2],
      ["v", 1, 2],
      ["v", 0, 2],
      ["v", 3, 2],
      ["v", 3, 2],
      ["h", 3, 2],
    ],
    [0, 2, 1, 3, 0, 4, 1, 4, 1],
    [
      [1, 2],
      [6, -1],
      [0, 2],
      [8, 1],
      [4, 3],
      [0, -1],
      [6, 1],
      [1, -3],
      [2, -1],
      [6, -1],
      [0, 5],
    ],
    "小绿向后退一格，有时是打开前路的关键。",
  ],
  [
    "层层解开",
    [
      ["h", 2, 2],
      ["v", 5, 2],
      ["v", 4, 2],
      ["h", 0, 2],
      ["h", 4, 2],
      ["h", 3, 3],
      ["h", 5, 2],
      ["h", 0, 3],
      ["v", 2, 2],
      ["v", 0, 2],
    ],
    [0, 1, 1, 3, 3, 3, 0, 0, 3, 3],
    [
      [0, 1],
      [3, 1],
      [7, 1],
      [9, -3],
      [0, -1],
      [8, -1],
      [4, -3],
      [8, 2],
      [5, -2],
      [1, 2],
      [2, 2],
      [0, 6],
    ],
    "先打开左边，再清理中间。路线不一定总朝着出口。",
  ],
  [
    "花园疏导员",
    [
      ["h", 2, 2],
      ["v", 2, 2],
      ["h", 5, 2],
      ["v", 0, 2],
      ["v", 2, 2],
      ["v", 3, 2],
      ["v", 3, 2],
      ["v", 4, 2],
      ["h", 3, 2],
      ["h", 4, 2],
      ["v", 4, 2],
      ["v", 5, 2],
    ],
    [0, 3, 3, 4, 0, 0, 2, 0, 0, 4, 2, 2],
    [
      [0, 1],
      [1, 1],
      [8, 1],
      [3, -4],
      [0, -1],
      [8, -1],
      [1, -2],
      [9, -4],
      [1, 1],
      [6, 1],
      [10, 1],
      [11, -2],
      [0, 6],
    ],
    "轮流借用空地，完成最长的一次接力。提示会重新计算当前最短路线。",
  ],
];
export const trafficLevels: TrafficLevel[] = layouts.map(
  ([title, vehicles, positions, solution, lesson]) => ({
    title,
    vehicles: vehicles.map(([axis, fixed, length], index) => ({
      id: index === 0 ? "T" : String.fromCharCode(64 + index),
      axis,
      fixed,
      length,
    })),
    positions,
    solution: solution.map(([vehicle, steps]) => ({
      vehicle: vehicle === 0 ? "T" : String.fromCharCode(64 + vehicle),
      steps,
    })),
    par: solution.length,
    lesson,
  }),
);
