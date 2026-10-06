// SPDX-License-Identifier: GPL-3.0-only
/** Original balanced binary-grid implementation; literal clues are the complete problem. */
export type BinaryCell = 0 | 1 | 2;
export type BinaryProblem = { size: number; givens: BinaryCell[] };
export type BinaryLevel = BinaryProblem & {
  id: string;
  title: string;
  lesson: string;
  certificate: { cells: BinaryCell[] };
};
export type BinaryState = { cells: BinaryCell[]; history: BinaryCell[][] };
export const BINARY_NODE_LIMIT = 200_000;
export const binaryLabel = (value: BinaryCell) =>
  value === 1 ? "A" : value === 2 ? "B" : "空白";
export function publicBinary(p: BinaryProblem): BinaryProblem {
  return { size: p.size, givens: [...p.givens] };
}
export function validBinaryProblem(p: BinaryProblem): boolean {
  return (
    [4, 6].includes(p.size) &&
    p.givens.length === p.size * p.size &&
    p.givens.every((v) => v === 0 || v === 1 || v === 2)
  );
}
export function binaryConflicts(
  p: BinaryProblem,
  cells: readonly BinaryCell[],
): number[] {
  if (!validBinaryProblem(p) || cells.length !== p.size * p.size)
    return [...cells.keys()];
  const bad = new Set<number>(),
    n = p.size;
  cells.forEach((v, i) => {
    if (![0, 1, 2].includes(v) || (p.givens[i] && p.givens[i] !== v))
      bad.add(i);
  });
  for (const vertical of [false, true]) {
    const lines = Array.from({ length: n }, (_, r) =>
      Array.from({ length: n }, (_, c) => (vertical ? c * n + r : r * n + c)),
    );
    for (const line of lines) {
      for (const v of [1, 2])
        if (line.filter((i) => cells[i] === v).length > n / 2)
          line.filter((i) => cells[i] === v).forEach((i) => bad.add(i));
      for (let j = 0; j < n - 2; j++)
        if (
          cells[line[j]] &&
          cells[line[j]] === cells[line[j + 1]] &&
          cells[line[j]] === cells[line[j + 2]]
        )
          line.slice(j, j + 3).forEach((i) => bad.add(i));
    }
    for (let a = 0; a < n; a++)
      for (let b = a + 1; b < n; b++) {
        if (
          lines[a].every(
            (i, c) => cells[i] !== 0 && cells[i] === cells[lines[b][c]],
          )
        )
          [...lines[a], ...lines[b]].forEach((i) => bad.add(i));
      }
  }
  return [...bad].sort((a, b) => a - b);
}
export function binaryWon(
  p: BinaryProblem,
  cells: readonly BinaryCell[],
): boolean {
  return (
    validBinaryProblem(p) &&
    cells.length === p.size * p.size &&
    cells.every((v) => v === 1 || v === 2) &&
    !binaryConflicts(p, cells).length
  );
}
export function createBinaryState(p: BinaryProblem): BinaryState {
  return { cells: [...p.givens], history: [] };
}
export function editBinary(
  p: BinaryProblem,
  state: BinaryState,
  index: number,
  value: BinaryCell,
): BinaryState {
  if (
    binaryWon(p, state.cells) ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= p.size * p.size ||
    p.givens[index] ||
    ![0, 1, 2].includes(value) ||
    state.cells[index] === value
  )
    return state;
  const cells = [...state.cells];
  cells[index] = value;
  return { cells, history: [...state.history, [...state.cells]] };
}
export function undoBinary(p: BinaryProblem, state: BinaryState): BinaryState {
  if (binaryWon(p, state.cells) || !state.history.length) return state;
  return {
    cells: [...state.history.at(-1)!],
    history: state.history.slice(0, -1),
  };
}
export function binaryRowPatterns(size: number): BinaryCell[][] {
  if (![4, 6].includes(size)) return [];
  const rows: BinaryCell[][] = [];
  for (let bits = 0; bits < 2 ** size; bits++) {
    const row = Array.from(
      { length: size },
      (_, i) => ((bits >> i) & 1 ? 2 : 1) as BinaryCell,
    );
    if (
      row.filter((v) => v === 1).length === size / 2 &&
      row.every((v, i) => i < 2 || v !== row[i - 1] || v !== row[i - 2])
    )
      rows.push(row);
  }
  return rows;
}
export type BinarySearchResult = {
  complete: boolean;
  nodes: number;
  count: number;
  first: BinaryCell[] | null;
  candidates: BinaryCell[][];
};
/** Row-pattern CSP. Every attempted row consumes one bounded partial node. */
export function createBinarySearch(
  problem: BinaryProblem,
  cells: readonly BinaryCell[],
  requestedLimit = BINARY_NODE_LIMIT,
) {
  const p = publicBinary(problem),
    board = [...cells],
    n = p.size;
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(0, Math.min(BINARY_NODE_LIMIT, Math.floor(requestedLimit)))
    : 0;
  const possible = Array.from(
      { length: board.length },
      () => new Set<BinaryCell>(),
    ),
    rows = binaryRowPatterns(n);
  const choices = Array.from({ length: n }, (_, r) =>
    rows.filter((row) =>
      row.every((v, c) => !board[r * n + c] || board[r * n + c] === v),
    ),
  );
  const selected: BinaryCell[][] = [];
  let nodes = 0,
    count = 0,
    capped = false,
    done = false,
    first: BinaryCell[] | null = null;
  function* solve(r: number): Generator<void> {
    if (r === n) {
      const columns = Array.from({ length: n }, (_, c) =>
        selected.map((row) => row[c]).join(""),
      );
      if (new Set(columns).size !== n) return;
      const solution = selected.flat();
      count++;
      if (!first) first = solution;
      solution.forEach((v, i) => possible[i].add(v));
      return;
    }
    for (const row of choices[r]) {
      if (nodes >= limit) {
        capped = true;
        return;
      }
      nodes++;
      yield;
      if (selected.some((other) => other.every((v, c) => v === row[c])))
        continue;
      if (
        row.some(
          (v, c) =>
            (r >= 2 && v === selected[r - 1][c] && v === selected[r - 2][c]) ||
            selected.filter((other) => other[c] === v).length + 1 > n / 2,
        )
      )
        continue;
      selected.push(row);
      yield* solve(r + 1);
      selected.pop();
      if (capped) return;
    }
  }
  function* run(): Generator<void> {
    if (
      validBinaryProblem(p) &&
      board.length === n * n &&
      !binaryConflicts(p, board).length
    )
      yield* solve(0);
  }
  const iterator = run();
  return {
    get done() {
      return done;
    },
    get nodes() {
      return nodes;
    },
    step(budget = 1024): BinarySearchResult | null {
      if (!Number.isInteger(budget) || budget < 1)
        throw new Error("Positive integer chunk required");
      for (let i = 0; i < budget && !done; i++)
        done = Boolean(iterator.next().done);
      return done
        ? {
            complete: !capped,
            nodes,
            count,
            first: first ? [...first] : null,
            candidates: possible.map((s) => [...s].sort()),
          }
        : null;
    },
  };
}
export type BinaryHint = {
  kind: "forced" | "choice" | "contradiction" | "unknown" | "complete";
  index?: number;
  value?: BinaryCell;
  text: string;
  nodes: number;
};
export function binaryHintFromSearch(
  p: BinaryProblem,
  cells: readonly BinaryCell[],
  result: BinarySearchResult,
): BinaryHint {
  const nodes = result.nodes;
  if (!result.complete)
    return {
      kind: "unknown",
      nodes,
      text: "达到搜索预算，尚不能确认这一格。检查行列数量、三个相同相连与重复行列，再填一格后重试。",
    };
  if (!result.count)
    return {
      kind: "contradiction",
      nodes,
      text: "当前填写与公开线索不相容。检查带 ! 的格子，或撤销最近的填写；没有标记也可能存在更远处的矛盾。",
    };
  const index = cells.findIndex(
    (v, i) => !v && result.candidates[i].length === 1,
  );
  if (index >= 0)
    return {
      kind: "forced",
      index,
      value: result.candidates[index][0],
      nodes,
      text: `结合当前填写与全部公开规则，第 ${Math.floor(index / p.size) + 1} 行第 ${(index % p.size) + 1} 列只能填 ${binaryLabel(result.candidates[index][0])}。请自行填入。`,
    };
  if (!cells.includes(0))
    return {
      kind: "complete",
      nodes,
      text: "每行每列已平衡，且没有重复行列。",
    };
  return {
    kind: "choice",
    nodes,
    text: "空格仍有 A、B 两种可能，尚无唯一可确认的一格。先看数量接近一半的行列，再比较相似的行列。",
  };
}
export async function findBinaryHint(
  p: BinaryProblem,
  cells: readonly BinaryCell[],
  options: { signal?: AbortSignal; chunk?: number; limit?: number } = {},
): Promise<BinaryHint | null> {
  const search = createBinarySearch(p, cells, options.limit);
  while (!options.signal?.aborted) {
    const result = search.step(options.chunk ?? 1024);
    if (result)
      return options.signal?.aborted
        ? null
        : binaryHintFromSearch(p, cells, result);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return null;
}
