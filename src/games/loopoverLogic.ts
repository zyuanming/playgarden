// SPDX-License-Identifier: GPL-3.0-only
import { loopMoveValid, loopSolved, shiftLoopLine, type LoopMove } from "../vendor/loopoverCore";
import type { LoopLevel } from "./loopoverLevels";
export { loopSolved, shiftLoopLine };
export type { LoopMove };
export const LOOP_HISTORY_LIMIT = 2000;
export type LoopState = { board: number[]; history: LoopMove[] };
export const inverseLoopMove = (move: LoopMove): LoopMove => ({ ...move, delta: move.delta === 1 ? -1 : 1 });
export const loopMoveKey = (move: LoopMove) => `${move.axis}-${move.index}-${move.delta}`;
export function loopMoveLabel(move: LoopMove): string {
  return `第 ${move.index + 1} ${move.axis === "row" ? "行" : "列"}向${move.axis === "row" ? move.delta === 1 ? "右" : "左" : move.delta === 1 ? "下" : "上"}环移`;
}
export function createLoopState(level: LoopLevel): LoopState { return { board: [...level.initial], history: [] }; }
export function playLoopMove(level: LoopLevel, state: LoopState, move: LoopMove): LoopState {
  if (loopSolved(state.board) || state.history.length >= LOOP_HISTORY_LIMIT || !loopMoveValid(move, level.rows, level.cols)) return state;
  return { board: shiftLoopLine(state.board, level.rows, level.cols, move), history: [...state.history, { ...move }] };
}
export function undoLoopMove(level: LoopLevel, state: LoopState): LoopState {
  const last = state.history.at(-1);
  if (!last || loopSolved(state.board)) return state;
  return { board: shiftLoopLine(state.board, level.rows, level.cols, inverseLoopMove(last)), history: state.history.slice(0, -1) };
}

/** A real, legal route from this board. Erase witnessed loops, then reverse the
 * remaining construction + player path. No guessed move and no optimality claim.
 * Applying a hint shortens this loop-erased path, including after an off-route move. */
export function getLoopHint(level: LoopLevel, state: LoopState): { move: LoopMove; remaining: number } | null {
  if (loopSolved(state.board)) return null;
  let board = Array.from({ length: level.rows * level.cols }, (_, i) => i);
  const path: LoopMove[] = [], keys: string[] = [board.join(",")];
  const positions = new Map<string, number>([[keys[0], 0]]);
  for (const move of [...level.scramble, ...state.history]) {
    board = shiftLoopLine(board, level.rows, level.cols, move);
    const key = board.join(","), previous = positions.get(key);
    if (previous !== undefined) {
      for (let i = previous + 1; i < keys.length; i++) positions.delete(keys[i]);
      keys.length = previous + 1; path.length = previous;
    } else { path.push(move); keys.push(key); positions.set(key, path.length); }
  }
  const last = path.at(-1);
  return last ? { move: inverseLoopMove(last), remaining: path.length } : null;
}
