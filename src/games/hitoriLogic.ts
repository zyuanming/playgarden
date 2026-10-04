/** Original MIT Hitori: duplicate elimination, separated shade, connected white cells. */
import { hitoriLevels, type HitoriLevel } from "./hitoriLevels";
import {
  createIslandState,
  cycleIslandCell,
  islandComponents,
  islandHint,
  islandNeighbors,
  searchIsland,
  setIslandCell,
  undoIsland,
  validIslandBoard,
  type IslandCell,
  type IslandHint,
  type IslandSearch,
  type IslandState,
} from "./islandEliminationCore";
export { hitoriLevels, undoIsland as undoHitori };
export type { HitoriLevel } from "./hitoriLevels";
export type {
  IslandCell as HitoriCell,
  IslandState as HitoriState,
  IslandHint as HitoriHint,
} from "./islandEliminationCore";
export function validHitoriLevel(level: HitoriLevel): boolean {
  return (
    !!level &&
    Number.isInteger(level.size) &&
    level.size >= 2 &&
    level.size <= 6 &&
    Array.isArray(level.numbers) &&
    level.numbers.length === level.size ** 2 &&
    level.numbers.every((v) => Number.isInteger(v) && v >= 1 && v <= level.size)
  );
}
export function validHitoriBoard(
  level: HitoriLevel,
  board: readonly number[],
): boolean {
  return validHitoriLevel(level) && validIslandBoard(level.size, board);
}
export function createHitoriState(level: HitoriLevel): IslandState {
  return createIslandState(validHitoriLevel(level) ? level.size : 0);
}
export function setHitoriCell(
  state: IslandState,
  index: number,
  value: IslandCell,
  paused = false,
): IslandState {
  return setIslandCell(state, index, value, [], paused);
}
export function cycleHitoriCell(
  state: IslandState,
  index: number,
  paused = false,
): IslandState {
  return cycleIslandCell(state, index, [], paused);
}
function duplicatePairs(level: HitoriLevel): [number, number][] {
  const pairs: [number, number][] = [],
    n = level.size;
  for (let a = 0; a < n * n; a++)
    for (let b = a + 1; b < n * n; b++)
      if (
        level.numbers[a] === level.numbers[b] &&
        (Math.floor(a / n) === Math.floor(b / n) || a % n === b % n)
      )
        pairs.push([a, b]);
  return pairs;
}
export function hitoriConflicts(
  level: HitoriLevel,
  board: readonly number[],
): number[] {
  if (!validHitoriBoard(level, board)) return [];
  const bad = new Set<number>();
  for (const [a, b] of duplicatePairs(level))
    if (board[a] === 0 && board[b] === 0) {
      bad.add(a);
      bad.add(b);
    }
  board.forEach((v, i) => {
    if (v === 1)
      for (const j of islandNeighbors(level.size, i))
        if (board[j] === 1) {
          bad.add(i);
          bad.add(j);
        }
  });
  const reachable = islandComponents(
    level.size,
    board.flatMap((v, i) => (v !== 1 ? [i] : [])),
  );
  if (reachable.filter((group) => group.some((i) => board[i] === 0)).length > 1)
    board.forEach((v, i) => {
      if (v === 0) bad.add(i);
    });
  return [...bad].sort((a, b) => a - b);
}
export function isHitoriSolved(
  level: HitoriLevel,
  board: readonly number[],
): boolean {
  return (
    validHitoriBoard(level, board) &&
    !board.includes(-1) &&
    hitoriConflicts(level, board).length === 0 &&
    islandComponents(
      level.size,
      board.flatMap((v, i) => (v === 0 ? [i] : [])),
    ).length === 1
  );
}
export function solveHitori(
  level: HitoriLevel,
  board: readonly number[] = createHitoriState(level).board,
  maxSolutions = 2,
  nodeLimit = 50000,
): IslandSearch {
  if (!validHitoriBoard(level, board))
    return { solutions: [], nodes: 0, status: "invalid" };
  const pairs = duplicatePairs(level),
    n = level.size;
  const priority = board
    .map((_, i) => i)
    .sort(
      (a, b) =>
        pairs.filter((p) => p.includes(b)).length -
          pairs.filter((p) => p.includes(a)).length || a - b,
    );
  return searchIsland({
    board,
    maxSolutions,
    nodeLimit,
    priority,
    accept: (b) => isHitoriSolved(level, b),
    propagate: (b) => {
      let changed = true;
      const put = (i: number, value: IslandCell) => {
        if (b[i] === value) return true;
        if (b[i] !== -1) return false;
        b[i] = value;
        changed = true;
        return true;
      };
      while (changed) {
        changed = false;
        for (const [a, c] of pairs) {
          if (b[a] === 0 && !put(c, 1)) return false;
          if (b[c] === 0 && !put(a, 1)) return false;
        }
        for (let i = 0; i < b.length; i++)
          if (b[i] === 1)
            for (const j of islandNeighbors(n, i)) if (!put(j, 0)) return false;
        const components = islandComponents(
          n,
          b.flatMap((v, i) => (v !== 1 ? [i] : [])),
        );
        if (
          !components.length ||
          components.filter((g) => g.some((i) => b[i] === 0)).length > 1
        )
          return false;
      }
      return true;
    },
  });
}
export function getHitoriHint(
  level: HitoriLevel,
  board: readonly number[],
  nodeLimit = 12000,
): IslandHint | null {
  const fallback = islandHint(
    board,
    (b, budget) => solveHitori(level, b, 2, budget),
    isHitoriSolved(level, board),
    ["保留的白格", "涂黑格"],
    nodeLimit,
  );
  // Keep the bounded feasibility/repair check before teaching a local rule.
  // Otherwise an already contradictory board could receive a misleading hint.
  if (fallback?.kind !== "deduction") return fallback;
  const n = level.size,
    position = (i: number) =>
      `第 ${Math.floor(i / n) + 1} 行第 ${(i % n) + 1} 列`;
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== -1) continue;
    const dark = islandNeighbors(n, i).find((j) => board[j] === 1);
    if (dark !== undefined)
      return {
        kind: "deduction",
        index: i,
        value: 0,
        reason: `黑格分隔：${position(dark)}已经涂黑。黑格不能上下左右相邻，所以这格必须留白。`,
      };
  }
  for (const [a, b] of duplicatePairs(level)) {
    const white =
      board[a] === 0 && board[b] === -1
        ? a
        : board[b] === 0 && board[a] === -1
          ? b
          : undefined;
    if (white !== undefined)
      return {
        kind: "deduction",
        index: white === a ? b : a,
        value: 1,
        reason: `避免重复：${position(white)}的数字 ${level.numbers[white]} 已确认留白。同一行或列不能留下重复数字，所以这格必须涂黑。`,
      };
  }
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== -1) continue;
    const row = Math.floor(i / n),
      col = i % n;
    for (const [a, b] of [
      ...(col > 0 && col < n - 1 ? [[i - 1, i + 1]] : []),
      ...(row > 0 && row < n - 1 ? [[i - n, i + n]] : []),
    ]) {
      if (level.numbers[a] !== level.numbers[b]) continue;
      return {
        kind: "deduction",
        index: i,
        value: 0,
        reason: `夹心法：${position(a)}与${position(b)}都是 ${level.numbers[a]}。若把中间这格涂黑，两端就都必须留白，造成重复。因此中间必须留白。`,
      };
    }
  }
  return fallback;
}
