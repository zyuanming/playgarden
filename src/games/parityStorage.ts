// SPDX-License-Identifier: GPL-3.0-only
import type { ParityLevel } from "./parityLevels";
import { createParityBoard, parityWon, stepParity, type ParityBoard } from "../vendor/parityCore";

export type ParityRound = ParityBoard & { history: number[] };
export const PARITY_RESUME_KEY = "playgarden.parity.v1";
const MAX_SAVED_MOVES = 20000;
export function freshParityRound(level: ParityLevel): ParityRound {
  return { ...createParityBoard(level), history: [] };
}
/** Only replay witnessed adjacent arrivals; saved values, cursor and wins are never trusted. */
export function parseParityRound(raw: string | null, level: ParityLevel): ParityRound {
  const initial = freshParityRound(level);
  try {
    if (!raw || raw.length > 100000) return initial;
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || saved.id !== level.id || !Array.isArray(saved.history)
      || saved.history.length > MAX_SAVED_MOVES) return initial;
    let board: ParityBoard = initial;
    const history: number[] = [];
    for (const destination of saved.history) {
      if (typeof destination !== "number" || parityWon(board.values)) return initial;
      const next = stepParity(level, board, destination);
      if (next === board) return initial;
      history.push(destination); board = next;
    }
    return { ...board, history };
  } catch { return initial; }
}
export function loadParityRound(index: number, level: ParityLevel): ParityRound {
  try { return parseParityRound(localStorage.getItem(`${PARITY_RESUME_KEY}.round.${index}`), level); }
  catch { return freshParityRound(level); }
}
export function saveParityRound(index: number, level: ParityLevel, round: ParityRound): boolean {
  try {
    if (round.history.length > MAX_SAVED_MOVES) return false;
    localStorage.setItem(`${PARITY_RESUME_KEY}.round.${index}`, JSON.stringify({ version: 1, id: level.id, history: round.history }));
    return true;
  } catch { return false; }
}
/** Undo is a Playgarden convenience: exactly reverse the last arrival, without a new move. */
export function undoParityRound(level: ParityLevel, round: ParityRound): ParityRound {
  if (!round.history.length || parityWon(round.values)) return round;
  const history = round.history.slice(0, -1), values = [...round.values];
  values[round.cursor] -= level.colors[round.cursor] === "b" ? -1 : 1;
  return { values, history, cursor: history.at(-1) ?? level.initialSelected.y * 3 + level.initialSelected.x };
}
