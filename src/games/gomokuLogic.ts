/**
 * Freestyle Gomoku board and evaluation, adapted from tombelieber/gomoku
 * board.rs and eval.rs, commit 0d8f81e687a04c729b1dfe5b0ce028295528cc17.
 * Copyright (c) 2026 open-gomoku Contributors. MIT; see ../../vendor/open-gomoku/LICENSE.
 * Changes: immutable chronological state, runtime validation, complete winning
 * segments, unrestricted five-or-more rules, and safe replay/undo helpers.
 */
export const SIZE = 15;
export type Stone = 1 | 2;
export type Cell = 0 | Stone;
export type Position = {
  board: Cell[];
  moves: number[];
  turn: Stone;
  winner: Stone | null;
  draw: boolean;
  winningLines: number[][];
};

export const AXES: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];
const AREA = SIZE * SIZE;

export function opponent(stone: Stone): Stone {
  return stone === 1 ? 2 : 1;
}
export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}
export function isBoard(board: unknown): board is Cell[] {
  if (!Array.isArray(board) || board.length !== AREA) return false;
  // A loop, rather than every(), also rejects sparse arrays.
  for (let i = 0; i < AREA; i++) {
    if (board[i] !== 0 && board[i] !== 1 && board[i] !== 2) return false;
  }
  return true;
}
function isIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < AREA;
}

/** Port of board.rs count_line_through, extended to whole contiguous segments. */
export function winningLinesAt(
  board: readonly Cell[],
  index: number,
): number[][] {
  if (!isBoard(board) || !isIndex(index) || board[index] === 0) return [];
  const stone = board[index];
  const x = index % SIZE,
    y = Math.floor(index / SIZE);
  const lines: number[][] = [];
  for (const [dx, dy] of AXES) {
    const before: number[] = [],
      after: number[] = [];
    let nx = x - dx,
      ny = y - dy;
    while (inBounds(nx, ny) && board[ny * SIZE + nx] === stone) {
      before.push(ny * SIZE + nx);
      nx -= dx;
      ny -= dy;
    }
    nx = x + dx;
    ny = y + dy;
    while (inBounds(nx, ny) && board[ny * SIZE + nx] === stone) {
      after.push(ny * SIZE + nx);
      nx += dx;
      ny += dy;
    }
    if (before.length + 1 + after.length >= 5) {
      lines.push([...before.reverse(), index, ...after]);
    }
  }
  return lines;
}

/** Port of ai.rs count_consecutive; never crosses a row boundary. */
export function countConsecutive(
  board: readonly Cell[],
  x: number,
  y: number,
  dx: number,
  dy: number,
  stone: Stone,
): number {
  if (dx === 0 && dy === 0) return 0;
  let count = 0,
    nx = x + dx,
    ny = y + dy;
  while (inBounds(nx, ny) && board[ny * SIZE + nx] === stone) {
    count++;
    nx += dx;
    ny += dy;
  }
  return count;
}

/** Finds every legal one-move win without ever writing into the input board. */
export function immediateWins(board: readonly Cell[], stone: Stone): number[] {
  if (!isBoard(board) || (stone !== 1 && stone !== 2)) return [];
  const wins: number[] = [];
  for (let index = 0; index < AREA; index++) {
    if (board[index] !== 0) continue;
    const x = index % SIZE,
      y = Math.floor(index / SIZE);
    if (
      AXES.some(
        ([dx, dy]) =>
          1 +
            countConsecutive(board, x, y, dx, dy, stone) +
            countConsecutive(board, x, y, -dx, -dy, stone) >=
          5,
      )
    )
      wins.push(index);
  }
  return wins;
}

export function emptyPosition(): Position {
  return {
    board: Array<Cell>(AREA).fill(0),
    moves: [],
    turn: 1,
    winner: null,
    draw: false,
    winningLines: [],
  };
}

/** Only used after validation. Winner is deliberately resolved before draw. */
function applyLegalMove(position: Position, index: number): Position {
  const board = position.board.slice();
  board[index] = position.turn;
  const moves = [...position.moves, index];
  const winningLines = winningLinesAt(board, index);
  const winner = winningLines.length > 0 ? position.turn : null;
  return {
    board,
    moves,
    turn: opponent(position.turn),
    winner,
    draw: winner === null && moves.length === AREA,
    winningLines,
  };
}

/** The move list is the sole source of game state; nothing after a win is valid. */
export function replayMoves(moves: readonly number[]): Position | null {
  if (!Array.isArray(moves) || moves.length > AREA) return null;
  let position = emptyPosition();
  for (const index of moves) {
    if (
      !isIndex(index) ||
      position.board[index] !== 0 ||
      position.winner !== null ||
      position.draw
    )
      return null;
    position = applyLegalMove(position, index);
  }
  return position;
}

/** Runtime guard for loaded data and Worker messages, including stale flags. */
export function isValidPosition(value: unknown): value is Position {
  if (value === null || typeof value !== "object") return false;
  const position = value as Position;
  if (!isBoard(position.board) || !Array.isArray(position.moves)) return false;
  const replayed = replayMoves(position.moves);
  if (
    !replayed ||
    position.turn !== replayed.turn ||
    position.winner !== replayed.winner ||
    position.draw !== replayed.draw ||
    !Array.isArray(position.winningLines)
  )
    return false;
  if (position.board.some((cell, i) => cell !== replayed.board[i]))
    return false;
  if (position.winningLines.length !== replayed.winningLines.length)
    return false;
  for (let i = 0; i < replayed.winningLines.length; i++) {
    const line = position.winningLines[i],
      expected = replayed.winningLines[i];
    if (!Array.isArray(line) || line.length !== expected.length) return false;
    for (let j = 0; j < expected.length; j++)
      if (line[j] !== expected[j]) return false;
  }
  return true;
}

/** Illegal actions return the exact original object, including malformed input. */
export function playMove(position: Position, index: number): Position {
  if (
    !isValidPosition(position) ||
    !isIndex(index) ||
    position.board[index] !== 0 ||
    position.winner !== null ||
    position.draw
  )
    return position;
  return applyLegalMove(position, index);
}

export function undoMoves(position: Position, count: number): Position {
  if (
    !isValidPosition(position) ||
    !Number.isInteger(count) ||
    count <= 0 ||
    position.moves.length === 0
  )
    return position;
  return replayMoves(
    position.moves.slice(0, Math.max(0, position.moves.length - count)),
  )!;
}

/** Coordinates use A1 at the top-left intersection and O15 at bottom-right. */
export function pointName(index: number): string {
  return isIndex(index)
    ? `${String.fromCharCode(65 + (index % SIZE))}${Math.floor(index / SIZE) + 1}`
    : "";
}

/** Port of eval.rs pattern_score, retaining the upstream pattern weights. */
function patternScore(count: number, openEnds: number): number {
  if (count >= 5) return 1_000_000;
  if (count === 4) return openEnds === 2 ? 50_000 : openEnds === 1 ? 5_000 : 0;
  if (count === 3) return openEnds === 2 ? 5_000 : openEnds === 1 ? 500 : 0;
  if (count === 2) return openEnds === 2 ? 200 : openEnds === 1 ? 50 : 0;
  return 0;
}

/** Port of eval.rs evaluate/count_line: each maximal run is scored once/axis. */
export function evaluate(board: readonly Cell[], stone: Stone): number {
  if (!isBoard(board) || (stone !== 1 && stone !== 2)) return 0;
  let score = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const cell = board[y * SIZE + x];
      if (cell === 0) continue;
      const sign = cell === stone ? 1 : -1;
      for (const [dx, dy] of AXES) {
        const px = x - dx,
          py = y - dy;
        if (inBounds(px, py) && board[py * SIZE + px] === cell) continue;
        let count = 0,
          nx = x,
          ny = y;
        while (inBounds(nx, ny) && board[ny * SIZE + nx] === cell) {
          count++;
          nx += dx;
          ny += dy;
        }
        let openEnds = inBounds(nx, ny) && board[ny * SIZE + nx] === 0 ? 1 : 0;
        if (inBounds(px, py) && board[py * SIZE + px] === 0) openEnds++;
        score += sign * patternScore(count, openEnds);
      }
      score += sign * Math.max(0, 14 - Math.abs(x - 7) - Math.abs(y - 7));
    }
  }
  return score;
}
