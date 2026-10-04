/** Original masked lessons and explicitly certified full-board tours. */
export type KnightLevel = {
  title: string;
  width: number;
  height: number;
  cells: readonly number[];
  start: number;
  solution: readonly number[];
  idea: string;
};
export type KnightState = { path: readonly number[] };
export type KnightSearch = {
  kind: "solved" | "unsolvable" | "budget" | "invalid";
  continuation: number[] | null;
  visited: number;
};
function authored(
  title: string,
  width: number,
  height: number,
  solution: number[],
  idea: string,
): KnightLevel {
  return {
    title,
    width,
    height,
    cells: [...solution].sort((a, b) => a - b),
    start: solution[0],
    solution,
    idea,
  };
}
export const knightLevels: readonly KnightLevel[] = [
  authored(
    "小马迈开第一步",
    3,
    3,
    [0, 7, 2],
    "骑士每次走一个 L：横着两格再竖着一格，或者竖着两格再横着一格。",
  ),
  authored(
    "转向另一边",
    3,
    3,
    [0, 7, 2, 3],
    "L 可以朝八个方向转。浅色的空地不能落下，但可以跳过。",
  ),
  authored(
    "六片叶子的信",
    3,
    4,
    [0, 7, 2, 3, 10, 5],
    "走过的方格会留下数字。每一格只能访问一次，不能跳回自己的脚印。",
  ),
  authored(
    "八站小旅行",
    3,
    4,
    [2, 7, 0, 5, 10, 3, 8, 1],
    "看一看边缘的方格：它们往往只有很少的出口，值得提早照顾。",
  ),
  authored(
    "留一条回路",
    3,
    4,
    [0, 7, 2, 3, 10, 5, 6, 11, 4, 9],
    "可以有多种正确路线。先观察未走过的格子，别把它们隔在身后。",
  ),
  authored(
    "十二格完整花毯",
    3,
    4,
    [0, 7, 2, 3, 10, 5, 6, 11, 4, 9, 8, 1],
    "第一次走满整张小棋盘。不需要回起点，只要每一格刚好经过一次。",
  ),
  authored(
    "错落的花窗",
    5,
    4,
    [0, 11, 18, 9, 2, 5, 16, 13, 4, 7, 14, 3, 6, 15],
    "花窗缺了几块，但 L 形走法不变。只能落在画着方框的格子里。",
  ),
  authored(
    "十六站长廊",
    5,
    4,
    [0, 11, 18, 9, 2, 5, 16, 13, 4, 7, 14, 3, 6, 15, 12, 19],
    "有选择时，先考虑出口更少的未走格。它是一条经验，并不保证每次都成功。",
  ),
  authored(
    "整片午后草地",
    5,
    4,
    [0, 11, 18, 9, 2, 5, 16, 13, 4, 7, 14, 3, 6, 15, 12, 19, 8, 17, 10, 1],
    "这张完整长方形棋盘有二十格。走错也不用重头来，撤销会一步步退回。",
  ),
  authored(
    "二十五格花园",
    5,
    5,
    [
      0, 11, 20, 17, 24, 13, 4, 7, 16, 5, 2, 9, 18, 21, 10, 1, 8, 19, 22, 15, 6,
      3, 12, 23, 14,
    ],
    "骑士每一步都会换一种棋盘底色。交替的颜色可以帮助检查 L 形落点。",
  ),
  authored(
    "六排春风",
    5,
    6,
    [
      0, 11, 20, 27, 24, 13, 4, 7, 16, 25, 22, 29, 18, 9, 2, 5, 12, 19, 8, 1,
      10, 21, 28, 17, 6, 15, 26, 23, 14, 3,
    ],
    "每次落下前，都看看还没走过的角落。把剩下的格子想成一条能接起来的路线。",
  ),
  authored(
    "骑士的三十六封信",
    6,
    6,
    [
      0, 13, 24, 32, 28, 17, 4, 8, 12, 1, 9, 5, 16, 29, 21, 25, 33, 20, 31, 18,
      7, 3, 11, 22, 35, 27, 14, 6, 2, 10, 23, 34, 26, 15, 19, 30,
    ],
    "这是完整的六乘六棋盘。慢慢规划，把每一个脚印都留在新的方格里。",
  ),
];
export const knightSolutions = knightLevels.map((level) => level.solution);
export const knightCellLabel = (
  level: Pick<KnightLevel, "width">,
  cell: number,
) =>
  `${String.fromCharCode(65 + (cell % level.width))}${Math.floor(cell / level.width) + 1}`;
export function validKnightGeometry(level: KnightLevel): boolean {
  return (
    Number.isInteger(level.width) &&
    Number.isInteger(level.height) &&
    level.width > 0 &&
    level.height > 0 &&
    level.width * level.height <= 36 &&
    level.cells.length >= 2 &&
    new Set(level.cells).size === level.cells.length &&
    level.cells.every(
      (n) => Number.isInteger(n) && n >= 0 && n < level.width * level.height,
    ) &&
    level.cells.includes(level.start)
  );
}
export function isKnightStep(
  level: Pick<KnightLevel, "width" | "cells">,
  from: number,
  to: number,
): boolean {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    !level.cells.includes(from) ||
    !level.cells.includes(to)
  )
    return false;
  const dx = Math.abs((to % level.width) - (from % level.width)),
    dy = Math.abs(
      Math.floor(to / level.width) - Math.floor(from / level.width),
    );
  return (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
}
export function validKnightPath(
  level: KnightLevel,
  path: readonly number[],
): boolean {
  return (
    path.length > 0 &&
    path[0] === level.start &&
    path.length <= level.cells.length &&
    new Set(path).size === path.length &&
    path.every(
      (n, i) =>
        Number.isInteger(n) &&
        level.cells.includes(n) &&
        (!i || isKnightStep(level, path[i - 1], n)),
    )
  );
}
export function createKnightState(level: KnightLevel): KnightState {
  return { path: [level.start] };
}
export function isKnightSolved(
  level: KnightLevel,
  state: KnightState,
): boolean {
  return (
    state.path.length === level.cells.length &&
    validKnightPath(level, state.path)
  );
}
export function knightNextCells(
  level: KnightLevel,
  state: KnightState,
): number[] {
  if (!validKnightPath(level, state.path)) return [];
  return level.cells.filter(
    (n) =>
      !state.path.includes(n) && isKnightStep(level, state.path.at(-1)!, n),
  );
}
export function moveKnight(
  level: KnightLevel,
  state: KnightState,
  to: number,
): KnightState {
  return validKnightPath(level, state.path) &&
    !state.path.includes(to) &&
    isKnightStep(level, state.path.at(-1)!, to)
    ? { path: [...state.path, to] }
    : state;
}
export function undoKnight(state: KnightState): KnightState {
  return state.path.length > 1 ? { path: state.path.slice(0, -1) } : state;
}
export function replayKnightCertificate(
  level: KnightLevel,
  path: readonly number[] = level.solution,
): KnightState | null {
  if (!validKnightGeometry(level) || path[0] !== level.start) return null;
  let state = createKnightState(level);
  for (const next of path.slice(1)) {
    const changed = moveKnight(level, state, next);
    if (changed === state) return null;
    state = changed;
  }
  return state;
}
export function verifyKnightLevel(level: KnightLevel): boolean {
  const replay = replayKnightCertificate(level);
  return !!replay && isKnightSolved(level, replay);
}
/** Warnsdorff-ordered DFS with connectivity pruning and a hard node budget. */
export function solveKnight(
  level: KnightLevel,
  path: readonly number[],
  maxNodes = 10000,
): KnightSearch {
  if (!validKnightGeometry(level) || !validKnightPath(level, path))
    return { kind: "invalid", continuation: null, visited: 0 };
  const limit = Math.max(
    0,
    Math.min(50000, Number.isFinite(maxNodes) ? Math.floor(maxNodes) : 10000),
  );
  const adjacency = new Map(
    level.cells.map((n) => [
      n,
      level.cells.filter((b) => isKnightStep(level, n, b)),
    ]),
  );
  const used = new Set(path),
    remaining = level.cells.length - path.length;
  const dead = new Set<string>();
  let visited = 0,
    exhausted = false;
  function dfs(at: number, left: number): number[] | null {
    if (!left) return [];
    if (visited >= limit) {
      exhausted = true;
      return null;
    }
    visited++;
    const key = `${at}:${[...used].sort((a, b) => a - b).join(",")}`;
    if (dead.has(key)) return null;
    // All remaining cells must still be reachable from the current knight.
    const reached = new Set([at]),
      queue = [at];
    while (queue.length)
      for (const n of adjacency.get(queue.pop()!)!)
        if (!used.has(n) && !reached.has(n)) {
          reached.add(n);
          queue.push(n);
        }
    if (reached.size !== left + 1) {
      dead.add(key);
      return null;
    }
    const choices = adjacency
      .get(at)!
      .filter((n) => !used.has(n))
      .sort(
        (a, b) =>
          adjacency.get(a)!.filter((n) => !used.has(n)).length -
            adjacency.get(b)!.filter((n) => !used.has(n)).length || a - b,
      );
    for (const n of choices) {
      used.add(n);
      const tail = dfs(n, left - 1);
      used.delete(n);
      if (tail) return [n, ...tail];
      if (exhausted) return null;
    }
    dead.add(key);
    return null;
  }
  const continuation = dfs(path.at(-1)!, remaining);
  return {
    kind: continuation ? "solved" : exhausted ? "budget" : "unsolvable",
    continuation,
    visited,
  };
}
export type KnightHint = {
  kind: "move" | "undo" | "complete" | "unavailable";
  cell: number | null;
  undoSteps: number;
  reason: "certificate" | "search" | "budget" | "dead-end" | "invalid";
};
function certifiedKnightNext(
  level: KnightLevel,
  path: readonly number[],
): number | null {
  if (!validKnightPath(level, path) || path.length >= level.solution.length)
    return null;
  const prefix = level.solution.slice(0, path.length);
  return path.at(-1) === prefix.at(-1) && prefix.every((n) => path.includes(n))
    ? level.solution[path.length]
    : null;
}
export function knightHint(
  level: KnightLevel,
  state: KnightState,
  maxNodes = 10000,
): KnightHint {
  if (isKnightSolved(level, state))
    return {
      kind: "complete",
      cell: null,
      undoSteps: 0,
      reason: "certificate",
    };
  const certified = verifyKnightLevel(level);
  const next = certified ? certifiedKnightNext(level, state.path) : null;
  if (next !== null)
    return { kind: "move", cell: next, undoSteps: 0, reason: "certificate" };
  const search = solveKnight(level, state.path, maxNodes);
  if (search.continuation?.length)
    return {
      kind: "move",
      cell: search.continuation[0],
      undoSteps: 0,
      reason: "search",
    };
  const reason =
    search.kind === "budget"
      ? "budget"
      : search.kind === "invalid"
        ? "invalid"
        : "dead-end";
  if (certified)
    for (let undoSteps = 1; undoSteps < state.path.length; undoSteps++) {
      const cell = certifiedKnightNext(level, state.path.slice(0, -undoSteps));
      if (cell !== null) return { kind: "undo", cell, undoSteps, reason };
    }
  return { kind: "unavailable", cell: null, undoSteps: 0, reason };
}
export function knightKeyboardCell(
  level: Pick<KnightLevel, "width" | "height" | "cells">,
  cell: number,
  key: string,
): number {
  if (key === "Home") return level.cells[0];
  if (key === "End") return level.cells.at(-1)!;
  const dx = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0,
    dy = key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : 0;
  if (!dx && !dy) return cell;
  let x = (cell % level.width) + dx,
    y = Math.floor(cell / level.width) + dy;
  while (x >= 0 && x < level.width && y >= 0 && y < level.height) {
    if (level.cells.includes(y * level.width + x)) return y * level.width + x;
    x += dx;
    y += dy;
  }
  return cell;
}
