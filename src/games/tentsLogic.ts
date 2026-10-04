/** Original MIT Tents rules. A bijection is required; extra tree adjacency is allowed. */
import { tentsLevels, type TentsLevel } from "./tentsLevels";
export { tentsLevels };
export type { TentsLevel } from "./tentsLevels";
export type TentsCell = -1 | 0 | 1;
export type TentsState = { board: TentsCell[]; history: TentsCell[][] };
export type TentsSearch = {
  solutions: TentsCell[][];
  nodes: number;
  status: "complete" | "limit" | "budget" | "invalid";
};
export type TentsHint =
  | {
      kind: "deduction" | "repair";
      index: number;
      value: TentsCell;
      reason: string;
    }
  | { kind: "unavailable"; reason: string };
export const TENTS_NODE_LIMIT = 50000;
export const TENTS_HISTORY_LIMIT = 300;
export function validTentsLevel(level: TentsLevel): boolean {
  if (
    !level ||
    !Number.isInteger(level.size) ||
    level.size < 4 ||
    level.size > 7 ||
    !Array.isArray(level.trees) ||
    level.trees.length < 1 ||
    level.trees.length > Math.ceil(level.size / 2) ** 2 ||
    new Set(level.trees).size !== level.trees.length ||
    !level.trees.every(
      (i) => Number.isInteger(i) && i >= 0 && i < level.size ** 2,
    )
  )
    return false;
  return [level.rowCounts, level.columnCounts].every(
    (line) =>
      Array.isArray(line) &&
      line.length === level.size &&
      line.every(
        (v) => Number.isInteger(v) && v >= 0 && v <= Math.ceil(level.size / 2),
      ) &&
      line.reduce((a, b) => a + b, 0) === level.trees.length,
  );
}
export function validTentsBoard(
  level: TentsLevel,
  board: readonly number[],
): boolean {
  return (
    validTentsLevel(level) &&
    Array.isArray(board) &&
    board.length === level.size ** 2 &&
    board.every(
      (v, i) => [-1, 0, 1].includes(v) && (!level.trees.includes(i) || v === 0),
    )
  );
}
export function tentsNeighbors(size: number, index: number): number[] {
  if (
    !Number.isInteger(size) ||
    size < 4 ||
    size > 7 ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= size ** 2
  )
    return [];
  return [index - size, index + size, index - 1, index + 1].filter(
    (i) =>
      i >= 0 &&
      i < size ** 2 &&
      Math.abs(Math.floor(i / size) - Math.floor(index / size)) +
        Math.abs((i % size) - (index % size)) ===
        1,
  );
}
export function tentsTouch(size: number, a: number, b: number): boolean {
  return (
    Number.isInteger(size) &&
    size >= 4 &&
    size <= 7 &&
    [a, b].every((i) => Number.isInteger(i) && i >= 0 && i < size ** 2) &&
    Math.max(
      Math.abs(Math.floor(a / size) - Math.floor(b / size)),
      Math.abs((a % size) - (b % size)),
    ) <= 1
  );
}
/** Augmenting paths certify a one-to-one tree/tent assignment, even with several neighboring trees. */
export function tentsMatching(
  level: TentsLevel,
  tents: readonly number[],
): [number, number][] | null {
  if (
    !validTentsLevel(level) ||
    !Array.isArray(tents) ||
    tents.length !== level.trees.length ||
    new Set(tents).size !== tents.length ||
    !tents.every(
      (i) =>
        Number.isInteger(i) &&
        i >= 0 &&
        i < level.size ** 2 &&
        !level.trees.includes(i),
    )
  )
    return null;
  const assignment = new Map<number, number>();
  function augment(tree: number, seen: Set<number>): boolean {
    for (const tent of tentsNeighbors(level.size, tree))
      if (tents.includes(tent) && !seen.has(tent)) {
        seen.add(tent);
        const old = assignment.get(tent);
        if (old === undefined || augment(old, seen)) {
          assignment.set(tent, tree);
          return true;
        }
      }
    return false;
  }
  return level.trees.every((t) => augment(t, new Set()))
    ? [...assignment].map(([tent, tree]) => [tree, tent])
    : null;
}
export function tentsConflicts(
  level: TentsLevel,
  board: readonly number[],
): number[] {
  if (!validTentsBoard(level, board)) return [];
  const n = level.size,
    tents = board.flatMap((v, i) => (v === 1 ? [i] : [])),
    conflicts = new Set<number>();
  for (const tent of tents) {
    if (!tentsNeighbors(n, tent).some((i) => level.trees.includes(i)))
      conflicts.add(tent);
    if (tents.some((other) => tent !== other && tentsTouch(n, tent, other)))
      conflicts.add(tent);
  }
  for (let line = 0; line < n; line++)
    for (const axis of ["row", "column"] as const) {
      const cells = Array.from({ length: n }, (_, i) =>
          axis === "row" ? line * n + i : i * n + line,
        ),
        target =
          axis === "row" ? level.rowCounts[line] : level.columnCounts[line];
      if (cells.filter((i) => board[i] === 1).length > target)
        cells.filter((i) => board[i] === 1).forEach((i) => conflicts.add(i));
    }
  if (tents.length === level.trees.length && !tentsMatching(level, tents))
    tents.forEach((i) => conflicts.add(i));
  return [...conflicts].sort((a, b) => a - b);
}
export function isTentsSolved(
  level: TentsLevel,
  board: readonly number[],
): boolean {
  if (!validTentsBoard(level, board) || tentsConflicts(level, board).length)
    return false;
  const tents = board.flatMap((v, i) => (v === 1 ? [i] : []));
  return (
    tents.length === level.trees.length &&
    level.rowCounts.every(
      (v, r) =>
        tents.filter((i) => Math.floor(i / level.size) === r).length === v,
    ) &&
    level.columnCounts.every(
      (v, c) => tents.filter((i) => i % level.size === c).length === v,
    ) &&
    tentsMatching(level, tents) !== null
  );
}
export function createTentsState(level: TentsLevel): TentsState {
  return {
    board: validTentsLevel(level)
      ? Array.from({ length: level.size ** 2 }, (_, i) =>
          level.trees.includes(i) ? 0 : -1,
        )
      : [],
    history: [],
  };
}
export function setTentsCell(
  state: TentsState,
  level: TentsLevel,
  index: number,
  value: TentsCell,
  paused = false,
): TentsState {
  if (
    paused ||
    !validTentsBoard(level, state.board) ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= state.board.length ||
    level.trees.includes(index) ||
    ![-1, 0, 1].includes(value) ||
    state.board[index] === value
  )
    return state;
  return {
    board: state.board.map((v, i) => (i === index ? value : v)),
    history: [...state.history, state.board.slice()].slice(
      -TENTS_HISTORY_LIMIT,
    ),
  };
}
export function cycleTentsCell(
  state: TentsState,
  level: TentsLevel,
  index: number,
  paused = false,
): TentsState {
  return setTentsCell(
    state,
    level,
    index,
    state.board[index] === -1 ? 1 : state.board[index] === 1 ? 0 : -1,
    paused,
  );
}
export function undoTents(state: TentsState, paused = false): TentsState {
  return paused || !state.history.length
    ? state
    : {
        board: state.history.at(-1)!.slice(),
        history: state.history.slice(0, -1),
      };
}
/** Row bitmask enumeration with count pruning, non-touching rows, and final matching. */
export function solveTents(
  level: TentsLevel,
  board: readonly TentsCell[] = createTentsState(level).board,
  limit = 2,
  nodeLimit = TENTS_NODE_LIMIT,
): TentsSearch {
  const result: TentsSearch = { solutions: [], nodes: 0, status: "complete" };
  if (
    !validTentsBoard(level, board) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 128 ||
    !Number.isInteger(nodeLimit) ||
    nodeLimit < 1 ||
    nodeLimit > TENTS_NODE_LIMIT
  )
    return { ...result, status: "invalid" };
  const n = level.size,
    possible = new Set(
      level.trees
        .flatMap((t) => tentsNeighbors(n, t))
        .filter((i) => !level.trees.includes(i)),
    ),
    options: number[][] = [];
  for (let r = 0; r < n; r++) {
    options[r] = [];
    for (let m = 0; m < 1 << n; m++) {
      if (m & (m << 1)) continue;
      const bits = Array.from({ length: n }, (_, c) => (m >> c) & 1);
      if (bits.reduce((a, b) => a + b, 0) !== level.rowCounts[r]) continue;
      if (
        bits.some(
          (v, c) =>
            (v && !possible.has(r * n + c)) ||
            (board[r * n + c] !== -1 && board[r * n + c] !== v),
        )
      )
        continue;
      options[r].push(m);
    }
  }
  const totals = Array(n).fill(0),
    masks: number[] = [];
  function visit(r: number, previous: number) {
    if (result.status !== "complete") return;
    if (result.nodes >= nodeLimit) {
      result.status = "budget";
      return;
    }
    result.nodes++;
    if (r === n) {
      if (totals.some((v, c) => v !== level.columnCounts[c])) return;
      const answer = Array.from(
        { length: n * n },
        (_, i) => ((masks[Math.floor(i / n)] >> (i % n)) & 1) as TentsCell,
      );
      if (
        !tentsMatching(
          level,
          answer.flatMap((v, i) => (v === 1 ? [i] : [])),
        )
      )
        return;
      result.solutions.push(answer);
      if (result.solutions.length >= limit) result.status = "limit";
      return;
    }
    for (const m of options[r]) {
      if (m & (previous | (previous << 1) | (previous >> 1))) continue;
      for (let c = 0; c < n; c++) totals[c] += (m >> c) & 1;
      const feasible = totals.every(
        (v, c) =>
          v <= level.columnCounts[c] &&
          v +
            options
              .slice(r + 1)
              .filter((list) => list.some((mask) => (mask >> c) & 1)).length >=
            level.columnCounts[c],
      );
      if (feasible) {
        masks.push(m);
        visit(r + 1, m);
        masks.pop();
      }
      for (let c = 0; c < n; c++) totals[c] -= (m >> c) & 1;
      if (result.status !== "complete") return;
    }
  }
  visit(0, 0);
  return result;
}
export function getTentsHint(
  level: TentsLevel,
  board: readonly TentsCell[],
  nodeLimit = TENTS_NODE_LIMIT,
): TentsHint | null {
  if (isTentsSolved(level, board)) return null;
  const search = solveTents(level, board, 128, nodeLimit);
  if (search.status !== "complete")
    return {
      kind: "unavailable",
      reason:
        search.status === "invalid"
          ? "棋盘数据需要检查。"
          : "本次搜索已到安全上限，尚不能确认这一步。请继续观察行列数量。",
    };
  if (!search.solutions.length) {
    let remaining = nodeLimit - search.nodes;
    for (let index = board.length - 1; index >= 0 && remaining > 0; index--) {
      if (board[index] === -1 || level.trees.includes(index)) continue;
      const cleared = board.map((v, i) => (i === index ? -1 : v));
      const repaired = solveTents(level, cleared, 1, remaining);
      remaining -= repaired.nodes;
      if (repaired.solutions.length)
        return {
          kind: "repair",
          index,
          value: -1,
          reason:
            "当前标记有矛盾；清除此格后，其余标记存在完整布局。先撤回这笔，再继续推理。",
        };
    }
    const index = board.findIndex(
      (v, i) => v !== -1 && !level.trees.includes(i),
    );
    return index >= 0
      ? {
          kind: "repair",
          index,
          value: -1,
          reason:
            "当前标记无法组成完整营地。先清除此格逐步排查；不表示它一定是唯一的错误。",
        }
      : { kind: "unavailable", reason: "这些树和行列数量没有可行布局。" };
  }
  // Prefer a tent to an empty-cell hint, but either is proven across all remaining solutions.
  const index = board
    .map((_, i) => i)
    .sort((a, b) => search.solutions[0][b] - search.solutions[0][a])
    .find(
      (i) =>
        board[i] === -1 &&
        search.solutions.every((s) => s[i] === search.solutions[0][i]),
    );
  return index === undefined
    ? {
        kind: "unavailable",
        reason: "还有不同的可行布局，暂时没有各解一致的新格子。",
      }
    : {
        kind: "deduction",
        index,
        value: search.solutions[0][index],
        reason: `在当前标记下，所有可行布局都要求此格${search.solutions[0][index] === 1 ? "放帐篷" : "留作草地"}。`,
      };
}
export const tentsSolutions = tentsLevels.map((l) =>
  Array.from(
    { length: l.size ** 2 },
    (_, i) => (l.solution.includes(i) ? 1 : 0) as TentsCell,
  ),
);
