// SPDX-License-Identifier: MIT
// Adapted from Jake Gordon's javascript-tetris e5c0c42f; full license beside this file.
export const WIDTH = 10,
  HEIGHT = 20;
export const SHAPES = [
  [0x0f00, 0x2222, 0x00f0, 0x4444],
  [0x44c0, 0x8e00, 0x6440, 0x0e20],
  [0x4460, 0x0e80, 0xc440, 0x2e00],
  [0xcc00, 0xcc00, 0xcc00, 0xcc00],
  [0x06c0, 0x8c40, 0x6c00, 0x4620],
  [0x0e40, 0x4c40, 0x4e00, 0x4640],
  [0x0c60, 0x4c80, 0xc600, 0x2640],
] as const;
export interface Piece {
  kind: number;
  rotation: number;
  x: number;
  y: number;
}
export interface FallingState {
  board: number[];
  piece: Piece;
  next: number;
  bag: number[];
  seed: number;
  score: number;
  lines: number;
  placed: number;
  phase: "ready" | "playing" | "lost";
}
export type Action = "left" | "right" | "rotate" | "down" | "drop";
// Upstream eachblock's 16-bit occupied-cell iteration, made pure.
export function cells(p: Piece): number[][] {
  let row = 0,
    col = 0;
  const out: number[][] = [];
  for (let bit = 0x8000; bit > 0; bit >>= 1) {
    if (SHAPES[p.kind][p.rotation] & bit) out.push([p.x + col, p.y + row]);
    if (++col === 4) {
      col = 0;
      row++;
    }
  }
  return out;
}
export function occupied(board: number[], p: Piece) {
  return cells(p).some(
    ([x, y]) =>
      x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || board[y * WIDTH + x] !== 0,
  );
}
function draw(s: Pick<FallingState, "bag" | "seed">) {
  let seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  const bag = s.bag.length ? [...s.bag] : [0, 1, 2, 3, 4, 5, 6];
  const index = seed % bag.length;
  const kind = bag.splice(index, 1)[0];
  return { kind, bag, seed };
}
export function createFalling(seed = 123456): FallingState {
  const a = draw({ bag: [], seed: seed >>> 0 }),
    b = draw(a);
  return {
    board: Array(200).fill(0),
    piece: { kind: a.kind, rotation: 0, x: 3, y: 0 },
    next: b.kind,
    bag: b.bag,
    seed: b.seed,
    score: 0,
    lines: 0,
    placed: 0,
    phase: "ready",
  };
}
export function startFalling(s: FallingState): FallingState {
  return s.phase === "ready" ? { ...s, phase: "playing" } : s;
}
export function clearLines(board: number[]) {
  const remaining: number[][] = [];
  let cleared = 0;
  for (let y = 0; y < HEIGHT; y++) {
    const row = board.slice(y * WIDTH, (y + 1) * WIDTH);
    if (row.every(Boolean)) cleared++;
    else remaining.push(row);
  }
  return {
    board: [...Array(cleared * WIDTH).fill(0), ...remaining.flat()],
    cleared,
  };
}
function lock(s: FallingState): FallingState {
  const board = [...s.board];
  for (const [x, y] of cells(s.piece)) board[y * WIDTH + x] = s.piece.kind + 1;
  const result = clearLines(board),
    next = draw(s);
  const piece = { kind: s.next, rotation: 0, x: 3, y: 0 };
  return {
    ...s,
    board: result.board,
    piece,
    next: next.kind,
    bag: next.bag,
    seed: next.seed,
    score:
      s.score + 10 + (result.cleared ? 100 * 2 ** (result.cleared - 1) : 0),
    lines: s.lines + result.cleared,
    placed: s.placed + 1,
    phase: occupied(result.board, piece) ? "lost" : "playing",
  };
}
export function ghost(s: FallingState) {
  let p = { ...s.piece };
  if (occupied(s.board, p)) return p;
  while (!occupied(s.board, { ...p, y: p.y + 1 })) p = { ...p, y: p.y + 1 };
  return p;
}
export function actFalling(s: FallingState, action: Action): FallingState {
  if (s.phase !== "playing") return s;
  if (action === "drop") return lock({ ...s, piece: ghost(s) });
  const p = { ...s.piece };
  if (action === "left") p.x--;
  if (action === "right") p.x++;
  if (action === "down") p.y++;
  if (action === "rotate") p.rotation = (p.rotation + 1) % 4;
  if (!occupied(s.board, p)) return { ...s, piece: p };
  return action === "down" ? lock(s) : s;
}
export const fallInterval = (lines: number) => Math.max(120, 650 - lines * 8);
export function parseFalling(raw: string | null): FallingState | null {
  try {
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.version !== 1) return null;
    const v = s.state as FallingState;
    const int = (n: unknown, min: number, max: number) =>
      Number.isInteger(n) && Number(n) >= min && Number(n) <= max;
    if (
      !v ||
      !Array.isArray(v.board) ||
      v.board.length !== 200 ||
      !v.board.every((n) => int(n, 0, 7)) ||
      !Array.isArray(v.bag) ||
      v.bag.length > 7 ||
      new Set(v.bag).size !== v.bag.length ||
      !v.bag.every((n) => int(n, 0, 6)) ||
      !int(v.next, 0, 6) ||
      !int(v.seed, 0, 0xffffffff) ||
      !int(v.score, 0, 1e9) ||
      !int(v.lines, 0, 1e6) ||
      !int(v.placed, 0, 1e7) ||
      !["ready", "playing", "lost"].includes(v.phase)
    )
      return null;
    const p = v.piece;
    if (
      !p ||
      !int(p.kind, 0, 6) ||
      !int(p.rotation, 0, 3) ||
      !int(p.x, -3, 9) ||
      !int(p.y, 0, 19) ||
      cells(p).some(([x, y]) => x < 0 || x >= 10 || y < 0 || y >= 20) ||
      (v.phase !== "lost" && occupied(v.board, p))
    )
      return null;
    return v;
  } catch {
    return null;
  }
}
export const serializeFalling = (state: FallingState) =>
  JSON.stringify({ version: 1, state });
