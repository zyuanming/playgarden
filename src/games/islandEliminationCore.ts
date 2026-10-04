/** Original MIT grid-marking infrastructure. Certificates are never imported at runtime. */
export type IslandCell = -1 | 0 | 1;
export type IslandState = { board: IslandCell[]; history: IslandCell[][] };
export type IslandSearch = {
  solutions: IslandCell[][];
  nodes: number;
  status: "complete" | "limit" | "budget" | "invalid";
};
export type IslandHint =
  | {
      kind: "deduction" | "repair";
      index: number;
      value: IslandCell;
      reason: string;
    }
  | { kind: "unavailable"; reason: string };
export const ISLAND_NODE_LIMIT = 50000;
export const ISLAND_HISTORY_LIMIT = 300;
export function islandNeighbors(n: number, i: number): number[] {
  return [i - n, i + n, i - 1, i + 1].filter(
    (j) =>
      j >= 0 &&
      j < n * n &&
      Math.abs(Math.floor(i / n) - Math.floor(j / n)) +
        Math.abs((i % n) - (j % n)) ===
        1,
  );
}
export function islandComponents(
  n: number,
  cells: readonly number[],
): number[][] {
  const remaining = new Set(cells),
    groups: number[][] = [];
  while (remaining.size) {
    const first = remaining.values().next().value!;
    remaining.delete(first);
    const group = [first];
    for (let k = 0; k < group.length; k++)
      for (const j of islandNeighbors(n, group[k]))
        if (remaining.delete(j)) group.push(j);
    groups.push(group);
  }
  return groups;
}
export function createIslandState(
  n: number,
  fixed: readonly number[] = [],
): IslandState {
  return {
    board: Array.from({ length: n * n }, (_, i) =>
      fixed.includes(i) ? 0 : -1,
    ),
    history: [],
  };
}
export function setIslandCell(
  state: IslandState,
  index: number,
  value: IslandCell,
  fixed: readonly number[] = [],
  paused = false,
): IslandState {
  if (
    paused ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= state.board.length ||
    ![-1, 0, 1].includes(value) ||
    fixed.includes(index) ||
    state.board[index] === value
  )
    return state;
  return {
    board: state.board.map((v, i) => (i === index ? value : v)),
    history: [...state.history, state.board.slice()].slice(
      -ISLAND_HISTORY_LIMIT,
    ),
  };
}
export function cycleIslandCell(
  state: IslandState,
  index: number,
  fixed: readonly number[] = [],
  paused = false,
): IslandState {
  return setIslandCell(
    state,
    index,
    state.board[index] === -1 ? 1 : state.board[index] === 1 ? 0 : -1,
    fixed,
    paused,
  );
}
export function undoIsland(state: IslandState, paused = false): IslandState {
  return paused || !state.history.length
    ? state
    : {
        board: state.history.at(-1)!.slice(),
        history: state.history.slice(0, -1),
      };
}
export function validIslandBoard(
  n: number,
  board: readonly number[],
  fixed: readonly number[] = [],
): boolean {
  return (
    Array.isArray(board) &&
    board.length === n * n &&
    board.every(
      (v, i) => [-1, 0, 1].includes(v) && (!fixed.includes(i) || v === 0),
    )
  );
}
/** Search nodes include propagation calls. The cap is fixed, caller budgets can only lower it. */
export function searchIsland(args: {
  board: readonly number[];
  propagate: (board: IslandCell[]) => boolean;
  accept: (board: IslandCell[]) => boolean;
  priority?: number[];
  maxSolutions?: number;
  nodeLimit?: number;
}): IslandSearch {
  const maxSolutions = args.maxSolutions ?? 2,
    budget = args.nodeLimit ?? ISLAND_NODE_LIMIT;
  const result: IslandSearch = { solutions: [], nodes: 0, status: "complete" };
  if (
    !Number.isInteger(maxSolutions) ||
    maxSolutions < 1 ||
    !Number.isInteger(budget) ||
    budget < 0 ||
    !Array.isArray(args.board) ||
    !args.board.every((v) => [-1, 0, 1].includes(v))
  )
    return { ...result, status: "invalid" };
  const cap = Math.min(budget, ISLAND_NODE_LIMIT);
  function visit(board: IslandCell[]) {
    if (result.status !== "complete") return;
    if (result.nodes >= cap) {
      result.status = "budget";
      return;
    }
    result.nodes++;
    if (!args.propagate(board)) return;
    const index = (args.priority ?? board.map((_, i) => i)).find(
      (i) => board[i] === -1,
    );
    if (index === undefined) {
      if (args.accept(board)) {
        result.solutions.push(board);
        if (result.solutions.length >= maxSolutions) result.status = "limit";
      }
      return;
    }
    for (const value of [0, 1] as const) {
      const next = board.slice();
      next[index] = value;
      visit(next);
    }
  }
  visit(args.board.slice() as IslandCell[]);
  return result;
}
export function islandHint(
  board: readonly number[],
  search: (board: readonly number[], nodeLimit: number) => IslandSearch,
  solved: boolean,
  label: [string, string],
  nodeLimit = 12000,
): IslandHint | null {
  if (solved) return null;
  let remaining = Math.min(
    ISLAND_NODE_LIMIT,
    Math.max(0, Number.isFinite(nodeLimit) ? Math.floor(nodeLimit) : 0),
  );
  const current = search(board, remaining);
  remaining -= current.nodes;
  if (current.status === "invalid")
    return { kind: "unavailable", reason: "棋盘数据无效，请重置后再试。" };
  if (current.status !== "complete")
    return {
      kind: "unavailable",
      reason:
        "有限搜索尚未检查完所有可能，暂时不能确定下一格。请继续观察局部规则。",
    };
  if (current.solutions.length) {
    const index = board.findIndex(
      (v, i) =>
        v === -1 &&
        current.solutions.every((s) => s[i] === current.solutions[0][i]),
    );
    if (index >= 0) {
      const value = current.solutions[0][index];
      return {
        kind: "deduction",
        index,
        value,
        reason: `已完整检查当前标记的所有可行延伸，这格都必须是${label[value as 0 | 1]}。`,
      };
    }
    return {
      kind: "unavailable",
      reason: "当前有多种可行延伸，还没有能确定的单格。",
    };
  }
  for (let i = 0; i < board.length && remaining > 0; i++) {
    if (board[i] === -1) continue;
    const trial = board.slice();
    trial[i] = -1;
    const repair = search(trial, remaining);
    remaining -= repair.nodes;
    if (repair.solutions.length)
      return {
        kind: "repair",
        index: i,
        value: -1,
        reason: "当前标记无法完成；清除这格后，已找到至少一种可行延伸。",
      };
  }
  return {
    kind: "unavailable",
    reason: "当前标记存在矛盾；有限搜索未确认单步修复，请撤销或检查最近几笔。",
  };
}
