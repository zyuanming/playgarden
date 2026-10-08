// SPDX-License-Identifier: GPL-3.0-only
import { loopMoveValid, loopSolved, shiftLoopLine, type LoopMove } from "../vendor/loopoverCore";
import { createLoopState, LOOP_HISTORY_LIMIT, type LoopState } from "./loopoverLogic";
import type { LoopLevel } from "./loopoverLevels";
export const LOOP_RESUME_KEY = "playgarden.loopover.v1";
/** Replay the entire witnessed move list. Never trust a saved board or win flag. */
export function parseLoopRound(raw: string | null, level: LoopLevel): LoopState {
  const initial = createLoopState(level);
  try {
    if (!raw || raw.length > 200000) return initial;
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || saved.id !== level.id || !Array.isArray(saved.history) || saved.history.length > LOOP_HISTORY_LIMIT) return initial;
    let board = initial.board;
    const history: LoopMove[] = [];
    for (const move of saved.history) {
      if (loopSolved(board) || !loopMoveValid(move, level.rows, level.cols)) return initial;
      const clean: LoopMove = { axis: move.axis, index: move.index, delta: move.delta };
      board = shiftLoopLine(board, level.rows, level.cols, clean); history.push(clean);
    }
    return { board, history };
  } catch { return initial; }
}
export function loadLoopRound(index: number, level: LoopLevel): LoopState {
  try { return parseLoopRound(localStorage.getItem(`${LOOP_RESUME_KEY}.round.${index}`), level); }
  catch { return createLoopState(level); }
}
export function saveLoopRound(index: number, level: LoopLevel, state: LoopState): boolean {
  try { localStorage.setItem(`${LOOP_RESUME_KEY}.round.${index}`, JSON.stringify({ version: 1, id: level.id, history: state.history })); return true; }
  catch { return false; }
}
