// SPDX-License-Identifier: GPL-3.0-only
// fillFlood / isFloodComplete / move guards are adapted from Simon Tatham's
// MIT-licensed flood.c (2004–2024); see vendor/sgtatham-flood/LICENCE.
export type FloodLevel = {
  id: string;
  title: string;
  chapter: number;
  size: number;
  colors: number;
  board: number[];
  limit: number;
  optimum: number;
};
export type FloodState = { board: number[]; moves: number[] };
export const FLOOD_NAMES = ["青叶", "杏果", "紫花", "蓝雨", "莓红"];
export const FLOOD_SYMBOLS = ["●", "◆", "✿", "▲", "★"];
export const FLOOD_RESUME_KEY = "playgarden.flood.v1";
export function floodRegion(board: readonly number[], size: number): number[] {
  const seen = new Set([0]),
    queue = [0];
  for (let head = 0; head < queue.length; head++) {
    const p = queue[head],
      x = p % size,
      y = Math.floor(p / size);
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        next = ny * size + nx;
      if (
        nx >= 0 &&
        nx < size &&
        ny >= 0 &&
        ny < size &&
        !seen.has(next) &&
        board[next] === board[0]
      ) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return queue;
}
/** Direct queue-fill port: recolour only the old colour's orthogonal region. */
export function fillFlood(
  board: readonly number[],
  size: number,
  color: number,
): number[] {
  const grid = [...board],
    old = grid[0];
  if (old === color) return grid;
  const queue = [0];
  grid[0] = color;
  for (let tail = 0; tail < queue.length; tail++) {
    const pos = queue[tail],
      y = Math.floor(pos / size),
      x = pos % size;
    for (let dir = 0; dir < 4; dir++) {
      const ny = y + (dir === 1 ? 1 : dir === 3 ? -1 : 0),
        nx = x + (dir === 0 ? 1 : dir === 2 ? -1 : 0);
      if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
        const next = ny * size + nx;
        if (grid[next] === old) {
          grid[next] = color;
          queue.push(next);
        }
      }
    }
  }
  return grid;
}
export const isFloodComplete = (board: readonly number[]) =>
  board.length > 0 && board.every((c) => c === board[0]);
export const createFloodState = (p: FloodLevel): FloodState => ({
  board: [...p.board],
  moves: [],
});
export function playFlood(
  state: FloodState,
  p: FloodLevel,
  color: number,
): FloodState {
  if (
    !Number.isInteger(color) ||
    color < 0 ||
    color >= p.colors ||
    color === state.board[0] ||
    isFloodComplete(state.board) ||
    state.moves.length >= p.limit
  )
    return state;
  return {
    board: fillFlood(state.board, p.size, color),
    moves: [...state.moves, color],
  };
}
export function replayFlood(
  p: FloodLevel,
  moves: readonly number[],
): FloodState | null {
  let state = createFloodState(p);
  for (const color of moves) {
    const next = playFlood(state, p, color);
    if (next === state) return null;
    state = next;
  }
  return state;
}
export function parseFloodSave(raw: string | null, p: FloodLevel): FloodState {
  try {
    if (!raw || raw.length > 3000) return createFloodState(p);
    const v = JSON.parse(raw);
    if (
      v?.version !== 1 ||
      v.id !== p.id ||
      !Array.isArray(v.moves) ||
      v.moves.length > p.limit
    )
      return createFloodState(p);
    return replayFlood(p, v.moves) ?? createFloodState(p);
  } catch {
    return createFloodState(p);
  }
}
/** Exact BFS over growing connected regions. Non-growing recolours cannot help
 * a shortest solution, so omit them. Budget exhaustion is not an impossibility. */
export function solveFlood(
  board: readonly number[],
  size: number,
  colors: number,
  budget = 12000,
):
  | { kind: "solved"; path: number[]; visited: number }
  | { kind: "budget"; visited: number } {
  const queue: { board: number[]; parent: number; color: number }[] = [
      { board: [...board], parent: -1, color: -1 },
    ],
    seen = new Set([
      floodRegion(board, size)
        .sort((a, b) => a - b)
        .join(","),
    ]);
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (isFloodComplete(current.board)) {
      const path: number[] = [];
      for (let i = head; queue[i].parent >= 0; i = queue[i].parent)
        path.push(queue[i].color);
      return { kind: "solved", path: path.reverse(), visited: seen.size };
    }
    const region = floodRegion(current.board, size).length;
    for (let color = 0; color < colors; color++) {
      if (color === current.board[0]) continue;
      const next = fillFlood(current.board, size, color);
      if (floodRegion(next, size).length === region) continue;
      const key = floodRegion(next, size)
        .sort((a, b) => a - b)
        .join(",");
      if (seen.has(key)) continue;
      if (seen.size >= budget) return { kind: "budget", visited: seen.size };
      seen.add(key);
      queue.push({ board: next, parent: head, color });
    }
  }
  return { kind: "budget", visited: seen.size };
}
