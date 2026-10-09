// SPDX-License-Identifier: MIT
// Copyright (c) 2014 Abe Fehr
// Typed adaptation of Parity scripts/modules/Board.js at commit
// 730ecbd24d4cd821bd236f2a441f4e5e2b22654f. Full license: public/parity-LICENSE.txt.
import type { ParityDirection, ParityLevel } from "../games/parityLevels";

export type ParityBoard = { values: number[]; cursor: number };
export function createParityBoard(level: ParityLevel): ParityBoard {
  return { values: [...level.contents], cursor: level.initialSelected.y * 3 + level.initialSelected.x };
}
export function parityAdjacent(from: number, to: number): boolean {
  return Number.isInteger(to) && to >= 0 && to < 9
    && Math.abs(from % 3 - to % 3) + Math.abs(Math.floor(from / 3) - Math.floor(to / 3)) === 1;
}
export function parityDestination(cursor: number, direction: ParityDirection): number | null {
  const next = cursor + ({ u: -3, d: 3, l: -1, r: 1 } as const)[direction];
  return parityAdjacent(cursor, next) ? next : null;
}
/** Board.isWin: every displayed integer must equal cell (0,0). */
export function parityWon(values: readonly number[]): boolean {
  return values.length === 9 && values.every(value => value === values[0]);
}
/** Board.left/up/right/down update selection BEFORE Board.select modifies the arrival. */
export function stepParity(level: ParityLevel, board: ParityBoard, destination: number): ParityBoard {
  if (parityWon(board.values) || !parityAdjacent(board.cursor, destination)) return board;
  const values = [...board.values];
  values[destination] += level.colors[destination] === "b" ? -1 : 1;
  return { values, cursor: destination };
}
