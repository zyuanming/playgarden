// SPDX-License-Identifier: MIT
export type IceDirection = "N" | "E" | "S" | "W";
export type IcePositions = readonly [number, number, number];
export type IceMove = { puck: number; direction: IceDirection };
export type IceProblem = {
  id: string;
  title: string;
  lesson: string;
  rows: readonly string[];
  start: IcePositions;
  goals: IcePositions;
};
export type IceLevel = IceProblem & {
  certificate: { moves: readonly IceMove[]; shortest: number; visited: number };
};
export type IceState = {
  positions: IcePositions;
  history: readonly IcePositions[];
};
export const ICE_DIRECTIONS: readonly IceDirection[] = ["N", "E", "S", "W"];
export const ICE_LABELS = { N: "上 ↑", E: "右 →", S: "下 ↓", W: "左 ←" };
export const ICE_STATE_LIMIT = 30 * 29 * 28;
export function iceWalkable(l: IceProblem, cell: number): boolean {
  const w = l.rows[0]?.length ?? 0;
  return (
    Number.isInteger(cell) &&
    cell >= 0 &&
    cell < w * l.rows.length &&
    l.rows[Math.floor(cell / w)]?.[cell % w] === "."
  );
}
export function validIceProblem(l: IceProblem): boolean {
  const width = l.rows[0]?.length ?? 0,
    count = l.rows
      .join("")
      .split("")
      .filter((c) => c === ".").length;
  return (
    width > 0 &&
    width <= 6 &&
    l.rows.length > 0 &&
    l.rows.length <= 6 &&
    count >= 3 &&
    count <= 30 &&
    l.rows.every((r) => r.length === width && /^[.#]+$/.test(r)) &&
    [l.start, l.goals].every(
      (p) =>
        p.length === 3 &&
        new Set(p).size === 3 &&
        p.every((c) => iceWalkable(l, c)),
    )
  );
}
export function validIcePositions(
  l: IceProblem,
  positions: IcePositions,
): boolean {
  return (
    validIceProblem(l) &&
    positions.length === 3 &&
    new Set(positions).size === 3 &&
    positions.every((c) => iceWalkable(l, c))
  );
}
function slide(
  l: IceProblem,
  p: IcePositions,
  move: IceMove,
): IcePositions | null {
  const w = l.rows[0].length;
  const dx = move.direction === "E" ? 1 : move.direction === "W" ? -1 : 0;
  const dy = move.direction === "S" ? 1 : move.direction === "N" ? -1 : 0;
  let x = p[move.puck] % w,
    y = Math.floor(p[move.puck] / w);
  while (true) {
    const nx = x + dx,
      ny = y + dy,
      next = ny * w + nx;
    if (
      nx < 0 ||
      nx >= w ||
      ny < 0 ||
      ny >= l.rows.length ||
      !iceWalkable(l, next) ||
      p.includes(next)
    )
      break;
    x = nx;
    y = ny;
  }
  const end = y * w + x;
  if (end === p[move.puck]) return null;
  const next = [...p] as [number, number, number];
  next[move.puck] = end;
  return next;
}
export function iceStep(
  l: IceProblem,
  p: IcePositions,
  move: IceMove,
): IcePositions | null {
  if (
    !validIcePositions(l, p) ||
    !Number.isInteger(move.puck) ||
    move.puck < 0 ||
    move.puck > 2 ||
    !ICE_DIRECTIONS.includes(move.direction)
  )
    return null;
  return slide(l, p, move);
}
export const iceWon = (l: IceProblem, p: IcePositions): boolean =>
  validIcePositions(l, p) && p.every((cell, i) => cell === l.goals[i]);
export const createIceState = (l: IceProblem): IceState => ({
  positions: [...l.start],
  history: [],
});
export function moveIce(l: IceProblem, s: IceState, move: IceMove): IceState {
  if (iceWon(l, s.positions)) return s;
  const positions = iceStep(l, s.positions, move);
  return positions ? { positions, history: [...s.history, s.positions] } : s;
}
export function undoIce(l: IceProblem, s: IceState): IceState {
  return !s.history.length || iceWon(l, s.positions)
    ? s
    : {
        positions: s.history[s.history.length - 1],
        history: s.history.slice(0, -1),
      };
}
export type IceSearch = {
  status: "solved" | "unreachable" | "invalid";
  moves: IceMove[];
  visited: number;
};
/** Exact BFS over <= 30P3 = 24,360 labeled positions; 12 actions, no budget cutoff. */
export function searchIce(
  l: IceProblem,
  start: IcePositions = l.start,
): IceSearch {
  if (!validIcePositions(l, start))
    return { status: "invalid", moves: [], visited: 0 };
  const width = l.rows[0].length,
    area = width * l.rows.length;
  const key = (p: IcePositions) => (p[0] * area + p[1]) * area + p[2];
  const queue = [
      {
        positions: start,
        parent: -1,
        move: { puck: 0, direction: "N" } as IceMove,
      },
    ],
    seen = new Set([key(start)]);
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    if (node.positions.every((c, i) => c === l.goals[i])) {
      const moves: IceMove[] = [];
      for (let at = head; queue[at].parent >= 0; at = queue[at].parent)
        moves.push(queue[at].move);
      return { status: "solved", moves: moves.reverse(), visited: seen.size };
    }
    for (let puck = 0; puck < 3; puck++)
      for (const direction of ICE_DIRECTIONS) {
        const move = { puck, direction },
          positions = slide(l, node.positions, move);
        if (!positions || seen.has(key(positions))) continue;
        seen.add(key(positions));
        queue.push({ positions, parent: head, move });
      }
  }
  return { status: "unreachable", moves: [], visited: seen.size };
}
export function iceHint(
  l: IceProblem,
  p: IcePositions,
): { text: string; move: IceMove | null } {
  const result = searchIce(l, p),
    move = result.moves[0] ?? null;
  if (result.status === "invalid")
    return { text: "局面无效，请重置。", move: null };
  if (result.status === "unreachable")
    return {
      text: `已穷尽 ${result.visited} 个可达局面，当前无法归位。请撤销或重置。`,
      move: null,
    };
  return {
    move,
    text: move
      ? `从当前局面最少还需 ${result.moves.length} 次滑动。可先让 ${"ABC"[move.puck]} 向${ICE_LABELS[move.direction]}滑到底；这是一条路线，并非唯一走法。`
      : "三枚冰盘都已到达各自的目标。",
  };
}
