// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) 2026 YuanMing; Playgarden original contributions.
import {
  initialPosition,
  playMove,
  squareIndex,
  type Position,
} from "./xiangqiLogic.ts";
export type XiangqiPuzzle = {
  id: string;
  title: string;
  chapter: number;
  fen: string;
  goal: string;
  hint: string;
  objective: "capture" | "evade" | "mate" | "stalemate";
  target?: string;
  piece?: string;
  solutions: string[];
};
export function meetsGoal(
  puzzle: XiangqiPuzzle,
  before: Position,
  move: string,
  after: Position,
) {
  if (after === before) return false;
  if (puzzle.objective === "capture")
    return (
      move.slice(2) === puzzle.target &&
      before.board[squareIndex(move.slice(0, 2))]?.type === puzzle.piece &&
      !!before.board[squareIndex(move.slice(2))]
    );
  if (puzzle.objective === "evade")
    return before.check && before.legal.includes(move);
  return (
    after.result ===
      (puzzle.objective === "mate" ? "checkmate" : "stalemate") &&
    after.winner === before.turn
  );
}
export function practiceResult(
  puzzle: XiangqiPuzzle,
  position: Position,
): "ready" | "success" | "retry" {
  if (!position.moves.length) return "ready";
  if (position.moves.length !== 1) return "retry";
  const before = initialPosition(puzzle.fen)!;
  return meetsGoal(puzzle, before, position.moves[0], position)
    ? "success"
    : "retry";
}
export function solvePuzzle(puzzle: XiangqiPuzzle) {
  const p = initialPosition(puzzle.fen);
  if (!p) return [];
  return p.legal.filter((m) => meetsGoal(puzzle, p, m, playMove(p, m))).sort();
}
