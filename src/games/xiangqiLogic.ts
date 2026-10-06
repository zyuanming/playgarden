// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) 2026 YuanMing; Playgarden original contributions.
import { Xiangqi, type Color, type Piece, type Core } from "../vendor/xiangqi/xiangqiCore.js";
export type { Color, Piece } from "../vendor/xiangqi/xiangqiCore.js";
export const START_FEN =
  "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1";
export const RULE_ID = "xiangqi-casual-threefold-120-v1";
export type Result = "checkmate" | "stalemate" | "repetition" | "quiet" | null;
export type Position = {
  initial: string;
  fen: string;
  moves: string[];
  keys: string[];
  board: (Piece | null)[];
  turn: Color;
  check: boolean;
  legal: string[];
  winner: Color | null;
  result: Result;
};
export const opponent = (color: Color): Color => (color === "r" ? "b" : "r");
export const colorName = (color: Color) => (color === "r" ? "红方" : "黑方");
export const pieceName = (piece: Piece) =>
  ({
    r: { k: "帅", a: "仕", b: "相", n: "马", r: "车", c: "炮", p: "兵" },
    b: { k: "将", a: "士", b: "象", n: "马", r: "车", c: "炮", p: "卒" },
  })[piece.color][piece.type];
export const squareName = (index: number) =>
  `${"abcdefghi"[index % 9]}${9 - Math.floor(index / 9)}`;
export const squareIndex = (square: string) =>
  /^[a-i][0-9]$/.test(square)
    ? (9 - Number(square[1])) * 9 + square.charCodeAt(0) - 97
    : -1;
export const positionKey = (fen: string) =>
  fen.split(" ").slice(0, 2).join(" ");
export function coreFor(fen: string): Core | null {
  if (typeof fen !== "string" || fen.length > 180) return null;
  const core = Xiangqi();
  if (!core.load(fen) || core.attacked(opponent(core.turn()))) return null;
  return core;
}
function snapshot(
  core: Core,
  initial: string,
  moves: string[],
  priorKeys: string[],
): Position {
  const fen = core.fen(),
    turn = core.turn(),
    check = core.in_check(),
    legal = core.moves();
  const key = positionKey(fen),
    keys = [...priorKeys, key];
  const result: Result = !legal.length
    ? check
      ? "checkmate"
      : "stalemate"
    : keys.filter((k) => k === key).length >= 3
      ? "repetition"
      : Number(fen.split(" ")[4]) >= 120
        ? "quiet"
        : null;
  return {
    initial,
    fen,
    moves,
    keys,
    board: core.board().flat(),
    turn,
    check,
    legal,
    winner:
      result === "checkmate" || result === "stalemate" ? opponent(turn) : null,
    result,
  };
}
export function initialPosition(fen = START_FEN): Position | null {
  const core = coreFor(fen);
  return core ? snapshot(core, core.fen(), [], []) : null;
}
export function playMove(position: Position, move: string): Position {
  if (
    position.result ||
    typeof move !== "string" ||
    !position.legal.includes(move)
  )
    return position;
  const core = Xiangqi(position.fen);
  if (!core.move(move)) return position;
  return snapshot(
    core,
    position.initial,
    [...position.moves, move],
    position.keys,
  );
}
export function replayMoves(
  initial: string,
  moves: readonly string[],
): Position | null {
  if (!Array.isArray(moves) || moves.length > 4096) return null;
  let position = initialPosition(initial);
  if (!position) return null;
  for (const move of moves) {
    const next = playMove(position, move);
    if (next === position) return null;
    position = next;
  }
  return position;
}
export function undoMoves(position: Position, count = 1): Position {
  if (!Number.isInteger(count) || count < 1 || !position.moves.length)
    return position;
  return (
    replayMoves(
      position.initial,
      position.moves.slice(0, Math.max(0, position.moves.length - count)),
    ) ?? position
  );
}
export function resultText(position: Position): string {
  if (position.winner)
    return `${colorName(position.winner)}获胜 · ${position.result === "checkmate" ? "将死" : "困毙"}`;
  if (position.result === "repetition") return "和棋 · 同一局面第三次出现";
  if (position.result === "quiet") return "和棋 · 连续 120 手没有吃子";
  return `轮到${colorName(position.turn)}${position.check ? " · 正被将军" : ""}`;
}
