// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) 2026 YuanMing; Playgarden original contributions.
import { Xiangqi, type Core, type CoreMove } from "../vendor/xiangqi/xiangqiCore.js";
import { positionKey, type Position } from "./xiangqiLogic.ts";
const VALUE = { k: 0, r: 900, c: 450, n: 400, b: 180, a: 180, p: 100 };
function score(core: Core) {
  const side = core.turn();
  return core
    .board()
    .flat()
    .reduce((total, piece, index) => {
      if (!piece) return total;
      const row = Math.floor(index / 9),
        col = index % 9;
      const advance = piece.color === "r" ? 9 - row : row;
      const bonus =
        piece.type === "p"
          ? advance * 12 + (advance >= 5 ? 40 : 0)
          : piece.type === "n" || piece.type === "c"
            ? 12 - Math.abs(col - 4) * 3
            : 0;
      return (
        total + (piece.color === side ? 1 : -1) * (VALUE[piece.type] + bonus)
      );
    }, 0);
}
const order = (moves: CoreMove[]) =>
  moves.sort(
    (a, b) =>
      (b.captured ? VALUE[b.captured] : 0) -
        (a.captured ? VALUE[a.captured] : 0) || a.iccs.localeCompare(b.iccs),
  );
/** Original bounded beginner search around the reused BSD rules; no remote AI. */
export function chooseMove(
  position: Position,
  options: { timeMs?: number; nodeBudget?: number; maxDepth?: number } = {},
) {
  if (position.result || !position.legal.length)
    return { move: null, nodes: 0, depth: 0 };
  const core = Xiangqi(position.fen),
    started = performance.now();
  const timeMs = Math.max(1, Math.min(options.timeMs ?? 350, 800));
  const budget = Math.max(1, Math.min(options.nodeBudget ?? 4500, 20000));
  const maxDepth = Math.max(1, Math.min(options.maxDepth ?? 3, 4));
  const counts = new Map<string, number>();
  for (const key of position.keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  let nodes = 0,
    reachedDepth = 0,
    best = order(core.moves({ verbose: true }))[0].iccs;
  const timeout = Symbol("budget");
  function search(
    depth: number,
    alpha: number,
    beta: number,
    ply: number,
  ): number {
    if (++nodes > budget || performance.now() - started >= timeMs)
      throw timeout;
    const moves = order(core.moves({ verbose: true }));
    if (!moves.length) return -100000 + ply; // Stalemate is a loss too.
    const fen = core.fen();
    if (
      (counts.get(positionKey(fen)) ?? 0) >= 3 ||
      Number(fen.split(" ")[4]) >= 120
    )
      return 0;
    if (depth === 0) return score(core);
    let value = -Infinity;
    for (const move of moves) {
      core.move(move.iccs);
      const key = positionKey(core.fen());
      counts.set(key, (counts.get(key) ?? 0) + 1);
      let child: number;
      try {
        child = -search(depth - 1, -beta, -alpha, ply + 1);
      } finally {
        counts.set(key, counts.get(key)! - 1);
        core.undo();
      }
      value = Math.max(value, child);
      alpha = Math.max(alpha, child);
      if (alpha >= beta) break;
    }
    return value;
  }
  const rootMoves = order(core.moves({ verbose: true }));
  for (let depth = 1; depth <= maxDepth; depth++) {
    let candidate = best,
      bestValue = -Infinity;
    try {
      for (const move of rootMoves) {
        core.move(move.iccs);
        const key = positionKey(core.fen());
        counts.set(key, (counts.get(key) ?? 0) + 1);
        let value: number;
        try {
          value = -search(depth - 1, -Infinity, -bestValue, 1);
        } finally {
          counts.set(key, counts.get(key)! - 1);
          core.undo();
        }
        if (value > bestValue) {
          bestValue = value;
          candidate = move.iccs;
        }
      }
      best = candidate;
      reachedDepth = depth;
      if (bestValue >= 99990) break;
    } catch (error) {
      if (error !== timeout) throw error;
      break;
    }
  }
  return { move: best, nodes, depth: reachedDepth };
}
export function simpleMove(position: Position): string | null {
  if (position.result) return null;
  return order(Xiangqi(position.fen).moves({ verbose: true }))[0]?.iccs ?? null;
}
