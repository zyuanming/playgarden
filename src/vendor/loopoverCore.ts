// SPDX-License-Identifier: MIT
// Copyright (c) 2020 Janis Pritzkau
// Adapted from janispritzkau/loopover src/game/board.ts at
// e4da7c57841e71beb5035bd4025c66216eec2b69. Exact notice: public/loopover-LICENSE.txt.
// Port: immutable flat arrays replace the mutable Board class; retain its modular
// row/column indexing and identity-order solved check. Input guards are new.
export type LoopMove = { axis: "row" | "column"; index: number; delta: -1 | 1 };

export function loopMoveValid(move: unknown, rows: number, cols: number): move is LoopMove {
  if (!move || typeof move !== "object") return false;
  const m = move as Partial<LoopMove>;
  return (m.axis === "row" || m.axis === "column") &&
    Number.isInteger(m.index) && Number(m.index) >= 0 &&
    Number(m.index) < (m.axis === "row" ? rows : cols) &&
    (m.delta === 1 || m.delta === -1);
}

/** All tiles in the selected line wrap together. There is never an empty tile. */
export function shiftLoopLine(board: readonly number[], rows: number, cols: number, move: LoopMove): number[] {
  if (!loopMoveValid(move, rows, cols) || board.length !== rows * cols) return [...board];
  const result = [...board];
  if (move.axis === "row") {
    const row = board.slice(move.index * cols, (move.index + 1) * cols);
    for (let i = 0; i < cols; i++) result[move.index * cols + i] = row[((i - move.delta) % cols + cols) % cols];
  } else {
    const column = Array.from({ length: rows }, (_, i) => board[i * cols + move.index]);
    for (let i = 0; i < rows; i++) result[i * cols + move.index] = column[((i - move.delta) % rows + rows) % rows];
  }
  return result;
}

export function loopSolved(board: readonly number[]): boolean {
  return board.length > 0 && board.every((tile, index) => tile === index);
}
