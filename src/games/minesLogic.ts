export type MinesLevel = {
  size: number;
  mines: number[];
  start: number;
  title: string;
  solution: number[];
};
export type MinesState = {
  revealed: number[];
  flags: number[];
  failed: boolean;
};
export function neighbors(index: number, size: number) {
  const x = index % size,
    y = Math.floor(index / size),
    out: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx,
        ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < size && ny < size)
        out.push(ny * size + nx);
    }
  return out;
}
export const adjacentMines = (level: MinesLevel, index: number) =>
  neighbors(index, level.size).filter((n) => level.mines.includes(n)).length;
export function revealCell(
  level: MinesLevel,
  state: MinesState,
  index: number,
): MinesState {
  if (
    state.failed ||
    state.flags.includes(index) ||
    state.revealed.includes(index)
  )
    return state;
  if (level.mines.includes(index)) return { ...state, failed: true };
  const revealed = new Set(state.revealed),
    queue = [index];
  while (queue.length) {
    const at = queue.pop()!;
    if (
      revealed.has(at) ||
      state.flags.includes(at) ||
      level.mines.includes(at)
    )
      continue;
    revealed.add(at);
    if (adjacentMines(level, at) === 0)
      queue.push(...neighbors(at, level.size));
  }
  return { ...state, revealed: [...revealed] };
}
export const minesWon = (level: MinesLevel, state: MinesState) =>
  !state.failed &&
  state.revealed.length === level.size ** 2 - level.mines.length;
export function toggleFlag(state: MinesState, index: number): MinesState {
  return state.failed || state.revealed.includes(index)
    ? state
    : {
        ...state,
        flags: state.flags.includes(index)
          ? state.flags.filter((n) => n !== index)
          : [...state.flags, index],
      };
}
export function logicStep(
  level: MinesLevel,
  state: MinesState,
): { kind: "reveal" | "flag"; index: number; reason: number } | null {
  for (const index of state.revealed) {
    const near = neighbors(index, level.size),
      unknown = near.filter(
        (n) => !state.revealed.includes(n) && !state.flags.includes(n),
      );
    if (!unknown.length) continue;
    const count = adjacentMines(level, index),
      flags = near.filter((n) => state.flags.includes(n)).length;
    if (count === flags)
      return { kind: "reveal", index: unknown[0], reason: index };
    if (count - flags === unknown.length)
      return { kind: "flag", index: unknown[0], reason: index };
  }
  return null;
}
export function solveMines(level: MinesLevel) {
  let state = revealCell(
    level,
    { revealed: [], flags: [], failed: false },
    level.start,
  );
  const solution: number[] = [level.start];
  for (let i = 0; i < level.size ** 2 * 3 && !minesWon(level, state); i++) {
    const step = logicStep(level, state);
    if (!step) break;
    if (step.kind === "flag") state = toggleFlag(state, step.index);
    else {
      state = revealCell(level, state, step.index);
      solution.push(step.index);
    }
  }
  return { solved: minesWon(level, state), solution, state };
}
function makeLevel(
  size: number,
  count: number,
  seed: number,
  index: number,
): MinesLevel {
  let n = seed >>> 0;
  const random = () => {
    n ^= n << 13;
    n ^= n >>> 17;
    n ^= n << 5;
    return (n >>> 0) / 4294967296;
  };
  const start = index % 2 === 0 ? 0 : size - 1;
  const forbidden = new Set([start, ...neighbors(start, size)]);
  for (let attempt = 0; attempt < 3000; attempt++) {
    const candidates = Array.from({ length: size ** 2 }, (_, i) => i).filter(
      (i) => !forbidden.has(i),
    );
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const level: MinesLevel = {
      size,
      mines: candidates.slice(0, count).sort((a, b) => a - b),
      start,
      title: `${size} × ${size} 花园 · ${count} 块石头`,
      solution: [],
    };
    const solved = solveMines(level);
    if (solved.solved && solved.solution.length >= 2)
      return { ...level, solution: solved.solution };
  }
  throw new Error("Unable to construct a deductively solvable garden");
}
export const minesLevels: MinesLevel[] = Array.from({ length: 12 }, (_, i) =>
  makeLevel(
    i < 4 ? 5 : i < 8 ? 6 : 7,
    i < 4
      ? 4 + Math.floor(i / 2)
      : i < 8
        ? 6 + Math.floor((i - 4) / 2)
        : 8 + Math.floor((i - 8) / 2),
    4309 + i * 337,
    i,
  ),
);
