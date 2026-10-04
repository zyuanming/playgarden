// SPDX-License-Identifier: MIT
/** Original, deterministic route-recall puzzles. Runtime uses the public walk only. */
export type RouteDirection = "N" | "E" | "S" | "W";
export type MemoryRouteLevel = {
  id: string;
  title: string;
  lesson: string;
  size: 3 | 4;
  start: number;
  walk: readonly RouteDirection[];
};
export type MemoryRouteState = {
  phase: "observe" | "recall" | "complete";
  entered: readonly number[];
};
export const createMemoryRouteState = (): MemoryRouteState => ({
  phase: "observe",
  entered: [],
});
export function memoryRouteTarget(level: MemoryRouteLevel): number[] {
  let cell = level.start;
  const route = [cell];
  for (const direction of level.walk) {
    const x = cell % level.size,
      y = Math.floor(cell / level.size);
    const nx = x + (direction === "E" ? 1 : direction === "W" ? -1 : 0);
    const ny = y + (direction === "S" ? 1 : direction === "N" ? -1 : 0);
    if (nx < 0 || ny < 0 || nx >= level.size || ny >= level.size)
      throw new Error(`Route ${level.id} leaves its board`);
    cell = ny * level.size + nx;
    route.push(cell);
  }
  return route;
}
export function routeAddress(size: number, cell: number): string {
  return `${String.fromCharCode(65 + (cell % size))}${Math.floor(cell / size) + 1}`;
}
export function memoryRouteWon(
  level: MemoryRouteLevel,
  entered: readonly number[],
): boolean {
  const target = memoryRouteTarget(level);
  return (
    entered.length === target.length &&
    entered.every((cell, i) => cell === target[i])
  );
}
export function beginMemoryRoute(
  state: MemoryRouteState,
  paused = false,
): MemoryRouteState {
  return paused || state.phase !== "observe"
    ? state
    : { ...state, phase: "recall" };
}
export function replayMemoryRoute(
  state: MemoryRouteState,
  paused = false,
): MemoryRouteState {
  return paused || state.phase !== "recall"
    ? state
    : { ...state, phase: "observe" };
}
export function enterMemoryRoute(
  level: MemoryRouteLevel,
  state: MemoryRouteState,
  cell: number,
  paused = false,
): MemoryRouteState {
  if (
    paused ||
    state.phase !== "recall" ||
    !Number.isInteger(cell) ||
    cell < 0 ||
    cell >= level.size ** 2 ||
    state.entered.length >= level.walk.length + 1
  )
    return state;
  const entered = [...state.entered, cell];
  return {
    entered,
    phase: memoryRouteWon(level, entered) ? "complete" : "recall",
  };
}
export function undoMemoryRoute(
  state: MemoryRouteState,
  paused = false,
): MemoryRouteState {
  return paused || state.phase === "complete" || !state.entered.length
    ? state
    : { ...state, entered: state.entered.slice(0, -1) };
}
export function memoryRouteHint(
  level: MemoryRouteLevel,
  state: MemoryRouteState,
): { cell: number; step: number; text: string } {
  const target = memoryRouteTarget(level);
  const mismatch = state.entered.findIndex((cell, i) => cell !== target[i]);
  const step =
    mismatch < 0 ? Math.min(state.entered.length, target.length - 1) : mismatch;
  const cell = target[step];
  return {
    cell,
    step,
    text:
      mismatch < 0
        ? `第 ${step + 1} 站是 ${routeAddress(level.size, cell)}。提示标记会留在格子上。`
        : `从第 ${step + 1} 站开始需要调整：这一站是 ${routeAddress(level.size, cell)}。用撤销退回这里，或重置后再试。`,
  };
}
