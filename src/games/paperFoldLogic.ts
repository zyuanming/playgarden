// SPDX-License-Identifier: MIT
/** Cell centres use integer coordinates; crease k lies between centres k-1 and k. */
export type PaperCrease = {
  id: string;
  axis: "x" | "y";
  at: number;
  side: "low" | "high";
};
export type PaperAction =
  | { kind: "fold"; crease: string }
  | { kind: "punch"; cell: number }
  | { kind: "unfold" };
export type PaperLevel = {
  id: string;
  title: string;
  lesson: string;
  width: number;
  height: number;
  maxFolds: number;
  maxPunches: number;
  creases: readonly PaperCrease[];
  target: readonly number[];
  certificate: { actions: readonly PaperAction[] };
};
export type PaperBoard = {
  stacks: readonly (readonly number[])[];
  folds: number;
  punches: number;
  holes: readonly number[];
  phase: "folding" | "punching" | "unfolded";
};
export type PaperState = { board: PaperBoard; history: readonly PaperBoard[] };
export const PAPER_SEARCH_LIMIT = 60000;
const integer = (n: number, lo: number, hi: number) =>
  Number.isInteger(n) && n >= lo && n <= hi;
export function validPaperLevel(l: PaperLevel): boolean {
  const n = l.width * l.height;
  return (
    integer(l.width, 2, 6) &&
    integer(l.height, 2, 6) &&
    integer(l.maxFolds, 1, 3) &&
    integer(l.maxPunches, 1, 2) &&
    l.creases.length > 0 &&
    l.creases.length <= 4 &&
    new Set(l.creases.map((c) => c.id)).size === l.creases.length &&
    l.creases.every(
      (c) =>
        c.id.length > 0 &&
        (c.axis === "x" || c.axis === "y") &&
        (c.side === "low" || c.side === "high") &&
        integer(c.at, 1, (c.axis === "x" ? l.width : l.height) - 1),
    ) &&
    l.target.length > 0 &&
    l.target.length <= n &&
    new Set(l.target).size === l.target.length &&
    l.target.every((c) => integer(c, 0, n - 1))
  );
}
export function initialPaperBoard(l: PaperLevel): PaperBoard {
  return {
    stacks: Array.from({ length: l.width * l.height }, (_, i) => [i]),
    folds: 0,
    punches: 0,
    holes: [],
    phase: "folding",
  };
}
export const createPaperState = (l: PaperLevel): PaperState => ({
  board: initialPaperBoard(l),
  history: [],
});
export function validPaperBoard(l: PaperLevel, b: PaperBoard): boolean {
  if (
    !validPaperLevel(l) ||
    b.stacks.length !== l.width * l.height ||
    !integer(b.folds, 0, l.maxFolds) ||
    !integer(b.punches, 0, l.maxPunches)
  )
    return false;
  const ids = b.stacks.flat();
  return (
    ids.length === l.width * l.height &&
    new Set(ids).size === ids.length &&
    ids.every((i) => integer(i, 0, ids.length - 1)) &&
    new Set(b.holes).size === b.holes.length &&
    b.holes.every((i) => integer(i, 0, ids.length - 1)) &&
    ((b.phase === "folding" && b.punches === 0 && b.holes.length === 0) ||
      ((b.phase === "punching" || b.phase === "unfolded") &&
        b.folds > 0 &&
        b.punches > 0 &&
        b.holes.length > 0))
  );
}
const matches = (l: PaperLevel, b: PaperBoard) =>
  b.holes.length === l.target.length &&
  l.target.every((i) => b.holes.includes(i));
export const paperWon = (l: PaperLevel, b: PaperBoard): boolean =>
  validPaperBoard(l, b) && b.phase === "unfolded" && matches(l, b);
function transition(
  l: PaperLevel,
  b: PaperBoard,
  a: PaperAction,
): PaperBoard | null {
  if (b.phase === "unfolded") return null;
  if (a.kind === "unfold")
    return b.punches ? { ...b, phase: "unfolded" } : null;
  if (a.kind === "punch") {
    if (
      !b.folds ||
      b.punches >= l.maxPunches ||
      !integer(a.cell, 0, b.stacks.length - 1)
    )
      return null;
    const stack = b.stacks[a.cell];
    if (!stack.some((i) => !b.holes.includes(i))) return null;
    return {
      ...b,
      phase: "punching",
      punches: b.punches + 1,
      holes: [...new Set([...b.holes, ...stack])].sort((a, b) => a - b),
    };
  }
  if (a.kind !== "fold" || b.phase !== "folding" || b.folds >= l.maxFolds)
    return null;
  const c = l.creases.find((c) => c.id === a.crease);
  if (!c) return null;
  const move = (i: number) => {
    const v = c.axis === "x" ? i % l.width : Math.floor(i / l.width);
    return c.side === "low" ? v < c.at : v >= c.at;
  };
  if (
    !b.stacks.some((s, i) => s.length && move(i)) ||
    !b.stacks.some((s, i) => s.length && !move(i))
  )
    return null;
  const stacks = b.stacks.map((s, i) => (move(i) ? [] : [...s]));
  for (let i = 0; i < b.stacks.length; i++) {
    if (!move(i) || !b.stacks[i].length) continue;
    const x = i % l.width,
      y = Math.floor(i / l.width),
      nx = c.axis === "x" ? 2 * c.at - 1 - x : x,
      ny = c.axis === "y" ? 2 * c.at - 1 - y : y;
    if (nx < 0 || nx >= l.width || ny < 0 || ny >= l.height) return null;
    stacks[ny * l.width + nx].push(...[...b.stacks[i]].reverse());
  }
  return { ...b, stacks, folds: b.folds + 1 };
}
export function paperStep(
  l: PaperLevel,
  b: PaperBoard,
  a: PaperAction,
): PaperBoard | null {
  return validPaperBoard(l, b) ? transition(l, b, a) : null;
}
export function movePaper(
  l: PaperLevel,
  s: PaperState,
  a: PaperAction,
): PaperState {
  if (paperWon(l, s.board)) return s;
  const next = paperStep(l, s.board, a);
  return next ? { board: next, history: [...s.history, s.board] } : s;
}
export function undoPaper(l: PaperLevel, s: PaperState): PaperState {
  return !s.history.length || paperWon(l, s.board)
    ? s
    : {
        board: s.history[s.history.length - 1],
        history: s.history.slice(0, -1),
      };
}
export type PaperSearch = {
  status: "solved" | "unreachable" | "limited" | "cancelled" | "invalid";
  actions: PaperAction[];
  visited: number;
};
/** BFS over actual layer maps. Wrong holes are irreversible, so pruning them is sound. */
export function searchPaper(
  l: PaperLevel,
  start?: PaperBoard,
  options: { limit?: number; cancelled?: () => boolean } = {},
): PaperSearch {
  if (!validPaperLevel(l))
    return { status: "invalid", actions: [], visited: 0 };
  start ??= initialPaperBoard(l);
  if (!validPaperBoard(l, start))
    return { status: "invalid", actions: [], visited: 0 };
  const requestedLimit = options.limit ?? PAPER_SEARCH_LIMIT;
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(PAPER_SEARCH_LIMIT, Math.max(0, Math.floor(requestedLimit)))
    : PAPER_SEARCH_LIMIT;
  const key = (b: PaperBoard) =>
    JSON.stringify([b.stacks, b.folds, b.punches, b.holes, b.phase]);
  const queue: [PaperBoard, number, PaperAction | null][] = [[start, -1, null]],
    seen = new Set([key(start)]);
  for (let head = 0; head < queue.length; head++) {
    if (options.cancelled?.())
      return { status: "cancelled", actions: [], visited: seen.size };
    const [b] = queue[head];
    if (b.phase === "unfolded" && matches(l, b)) {
      const actions: PaperAction[] = [];
      for (let i = head; queue[i][1] >= 0; i = queue[i][1])
        actions.push(queue[i][2]!);
      return {
        status: "solved",
        actions: actions.reverse(),
        visited: seen.size,
      };
    }
    if (b.holes.some((i) => !l.target.includes(i))) continue;
    const actions: PaperAction[] = [
      ...l.creases.map((c) => ({ kind: "fold" as const, crease: c.id })),
      ...b.stacks.flatMap((s, i) =>
        s.length ? [{ kind: "punch" as const, cell: i }] : [],
      ),
      { kind: "unfold" },
    ];
    for (const a of actions) {
      const next = transition(l, b, a);
      if (!next || next.holes.some((i) => !l.target.includes(i))) continue;
      const k = key(next);
      if (seen.has(k)) continue;
      if (seen.size >= limit)
        return { status: "limited", actions: [], visited: seen.size };
      seen.add(k);
      queue.push([next, head, a]);
    }
  }
  return { status: "unreachable", actions: [], visited: seen.size };
}
export function paperCellLabel(l: PaperLevel, cell: number): string {
  return `${Math.floor(cell / l.width) + 1}行${(cell % l.width) + 1}列`;
}
export function paperCreaseLabel(c: PaperCrease): string {
  return `${c.axis === "x" ? "竖" : "横"}线 ${c.at}（第${c.at}、${c.at + 1}${c.axis === "x" ? "列" : "行"}之间），${c.side === "low" ? (c.axis === "x" ? "左向右" : "上向下") : c.axis === "x" ? "右向左" : "下向上"}折`;
}
export function paperHint(l: PaperLevel, b: PaperBoard): string {
  const r = searchPaper(l, b);
  if (r.status === "invalid") return "局面无效，请重来。";
  if (r.status === "limited" || r.status === "cancelled")
    return "搜索已停止，暂时没有可靠建议；这不代表无解。";
  if (r.status === "unreachable")
    return `已穷尽当前局面的 ${r.visited} 个可达候选，无法得到目标；请撤销或重来。`;
  const a = r.actions[0];
  if (!a) return "展开后的孔位已吻合。";
  const next =
    a.kind === "fold"
      ? paperCreaseLabel(l.creases.find((c) => c.id === a.crease)!)
      : a.kind === "punch"
        ? `在当前叠层 ${paperCellLabel(l, a.cell)} 打孔`
        : "展开纸张检查";
  return `一条最短续解还有 ${r.actions.length} 步：先${next}。这是一个可行选择，不代表唯一解。`;
}
