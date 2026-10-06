/**
 * Bounded freestyle Gomoku AI, adapted from tombelieber/gomoku board.rs/ai.rs
 * commit 0d8f81e687a04c729b1dfe5b0ce028295528cc17.
 * Copyright (c) 2026 open-gomoku Contributors. MIT; see ../../vendor/open-gomoku/LICENSE.
 * Adapted routines: neighbor candidates, quick_score/count_consecutive, and
 * maximizing/minimizing alpha-beta. Added exhaustive tactical prepasses,
 * iterative deepening, deterministic ordering, and cooperative resource bounds.
 */
import {
  AXES,
  SIZE,
  countConsecutive,
  evaluate,
  immediateWins,
  isValidPosition,
  opponent,
  winningLinesAt,
} from "./gomokuLogic.ts";
import type { Cell, Position, Stone } from "./gomokuLogic.ts";

export type Difficulty = "gentle" | "steady";
export type SearchOptions = {
  nodeBudget?: number;
  timeMs?: number;
  now?: () => number;
};
export type MoveChoice = {
  move: number | null;
  nodes: number;
  depth: number;
  budgetHit: boolean;
};
const AREA = SIZE * SIZE;
const MATE = 1_000_000_000;
const ABORT = Symbol("gomoku-search-budget");

/** Port of board.rs get_candidates. Unlike upstream, a full board returns []. */
export function neighborCandidates(
  board: readonly Cell[],
  radius: number,
): number[] {
  const seen = new Uint8Array(AREA),
    candidates: number[] = [];
  let stones = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (board[y * SIZE + x] === 0) continue;
      stones++;
      for (
        let ny = Math.max(0, y - radius);
        ny < Math.min(SIZE, y + radius + 1);
        ny++
      ) {
        for (
          let nx = Math.max(0, x - radius);
          nx < Math.min(SIZE, x + radius + 1);
          nx++
        ) {
          const index = ny * SIZE + nx;
          if (board[index] === 0 && !seen[index]) {
            seen[index] = 1;
            candidates.push(index);
          }
        }
      }
    }
  }
  if (stones === 0 && board[112] === 0) return [112];
  return candidates;
}

/** Port of ai.rs quick_score, including its asymmetric offense/defense weights. */
export function quickScore(
  board: readonly Cell[],
  index: number,
  stone: Stone,
): number {
  const x = index % SIZE,
    y = Math.floor(index / SIZE),
    other = opponent(stone);
  let score = 0;
  for (const [dx, dy] of AXES) {
    const own =
      countConsecutive(board, x, y, dx, dy, stone) +
      countConsecutive(board, x, y, -dx, -dy, stone);
    const opp =
      countConsecutive(board, x, y, dx, dy, other) +
      countConsecutive(board, x, y, -dx, -dy, other);
    score +=
      own >= 4
        ? 10_000
        : own === 3
          ? 1_000
          : own === 2
            ? 100
            : own === 1
              ? 10
              : 0;
    score +=
      opp >= 4 ? 9_000 : opp === 3 ? 900 : opp === 2 ? 80 : opp === 1 ? 5 : 0;
  }
  return score + Math.trunc((14 - Math.abs(x - 7) - Math.abs(y - 7)) / 2);
}

type Tactics = { wins: number[]; threats: number[] };
function tactics(board: readonly Cell[], current: Stone): Tactics {
  // Both whole-board scans finish before any heuristic candidate truncation.
  return {
    wins: immediateWins(board, current),
    threats: immediateWins(board, opponent(current)),
  };
}
function orderedCandidates(
  board: readonly Cell[],
  current: Stone,
  tactical: Tactics,
  radius: number,
  cap: number,
): number[] {
  const forced = tactical.wins.length > 0 ? tactical.wins : tactical.threats;
  const candidates =
    forced.length > 0 ? forced.slice() : neighborCandidates(board, radius);
  const scored = candidates.map((move) => ({
    move,
    score: quickScore(board, move, current),
  }));
  scored.sort((a, b) => b.score - a.score || a.move - b.move);
  // Every forced win/block survives regardless of cap.
  return (forced.length > 0 ? scored : scored.slice(0, cap)).map(
    (candidate) => candidate.move,
  );
}

type Context = {
  nodes: number;
  nodeBudget: number;
  deadline: number;
  now: () => number;
  lastNow: number;
  cap: number;
  ai: Stone;
};
function checkBudget(context: Context): void {
  let now: number;
  try {
    now = context.now();
  } catch {
    throw ABORT;
  }
  if (!Number.isFinite(now)) throw ABORT;
  context.lastNow = Math.max(context.lastNow, now);
  if (
    context.lastNow >= context.deadline ||
    context.nodes >= context.nodeBudget
  )
    throw ABORT;
}
function mateScore(winner: Stone, ai: Stone, ply: number): number {
  return winner === ai ? MATE - ply : -MATE + ply;
}

/**
 * Port of ai.rs minimax: ordered candidates and explicit max/min alpha-beta.
 * The one private board copy is restored with finally even on a budget abort.
 */
function minimax(
  board: Cell[],
  depth: number,
  alpha: number,
  beta: number,
  current: Stone,
  lastMove: number,
  remaining: number,
  ply: number,
  context: Context,
): number {
  checkBudget(context);
  context.nodes++;
  if (winningLinesAt(board, lastMove).length > 0)
    return mateScore(board[lastMove] as Stone, context.ai, ply);
  if (remaining === 0) return 0;
  const tactical = tactics(board, current);
  // A complete tactical scan also occurs at leaf nodes. It cannot be hidden by
  // the quiet-move cap, and a next-ply forced win dominates heuristic scores.
  if (tactical.wins.length > 0) return mateScore(current, context.ai, ply + 1);
  if (tactical.threats.length > 1)
    return mateScore(opponent(current), context.ai, ply + 2);
  if (depth === 0)
    return Math.max(-MATE / 4, Math.min(MATE / 4, evaluate(board, context.ai)));
  checkBudget(context);
  const candidates = orderedCandidates(
    board,
    current,
    tactical,
    2,
    context.cap,
  );
  if (candidates.length === 0) return 0;
  const maximizing = current === context.ai;
  let best = maximizing ? -Infinity : Infinity;
  for (const move of candidates) {
    checkBudget(context);
    let score: number;
    board[move] = current;
    try {
      score = minimax(
        board,
        depth - 1,
        alpha,
        beta,
        opponent(current),
        move,
        remaining - 1,
        ply + 1,
        context,
      );
    } finally {
      board[move] = 0;
    }
    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, score);
    }
    if (beta <= alpha) break;
  }
  return best;
}
function budget(
  value: number | undefined,
  fallback: number,
  maximum: number,
): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(maximum, Math.floor(value)));
}

/**
 * Depth-limited practice opponent, not a strength rating. Gentle: depth 1;
 * steady: iterative depths 1–3. `depth` is the last completed iteration (0 for
 * the tactical/ordered fallback; 1 for a directly proven immediate win).
 * `nodes` counts visited search positions, excluding fixed-size validation and
 * root tactical scans. Time is cooperative, checked between bounded scans;
 * the caller can terminate its Worker for immediate cancellation.
 */
export function chooseMove(
  position: Position,
  difficulty: Difficulty,
  options: SearchOptions = {},
): MoveChoice {
  const empty: MoveChoice = {
    move: null,
    nodes: 0,
    depth: 0,
    budgetHit: false,
  };
  if (
    !isValidPosition(position) ||
    position.winner !== null ||
    position.draw ||
    position.moves.length === AREA ||
    (difficulty !== "gentle" && difficulty !== "steady")
  )
    return empty;
  const now =
    typeof options.now === "function"
      ? options.now
      : () =>
          typeof performance !== "undefined" ? performance.now() : Date.now();
  let started: number;
  try {
    started = now();
  } catch {
    started = NaN;
  }
  const board = position.board.slice(),
    ai = position.turn;
  const tactical = tactics(board, ai);
  const cap = difficulty === "gentle" ? 12 : 16;
  const candidates = orderedCandidates(
    board,
    ai,
    tactical,
    difficulty === "gentle" ? 1 : 2,
    cap,
  );
  if (candidates.length === 0) return empty;
  if (tactical.wins.length > 0)
    return { move: candidates[0], nodes: 0, depth: 1, budgetHit: false };
  let best = candidates[0],
    completedDepth = 0,
    budgetHit = false;
  const context: Context = {
    nodes: 0,
    nodeBudget: budget(
      options.nodeBudget,
      difficulty === "gentle" ? 1_000 : 12_000,
      60_000,
    ),
    deadline:
      started +
      budget(options.timeMs, difficulty === "gentle" ? 100 : 450, 2_000),
    now,
    lastNow: started,
    cap,
    ai,
  };
  try {
    if (!Number.isFinite(started)) throw ABORT;
    for (let depth = 1; depth <= (difficulty === "gentle" ? 1 : 3); depth++) {
      checkBudget(context);
      let iterationBest = best,
        iterationScore = -Infinity,
        alpha = -Infinity;
      // Keep the last completed best first, with the remaining order unchanged.
      const ordered = [best, ...candidates.filter((move) => move !== best)];
      for (const move of ordered) {
        checkBudget(context);
        board[move] = ai;
        let score: number;
        try {
          score = minimax(
            board,
            depth - 1,
            alpha,
            Infinity,
            opponent(ai),
            move,
            AREA - position.moves.length - 1,
            1,
            context,
          );
        } finally {
          board[move] = 0;
        }
        if (score > iterationScore) {
          iterationScore = score;
          iterationBest = move;
        }
        alpha = Math.max(alpha, score);
      }
      // Only whole root iterations can replace the previous answer.
      best = iterationBest;
      completedDepth = depth;
    }
  } catch (error) {
    // A failed external clock or interrupted search still has a legal, tactical
    // fallback. Programming errors are not converted to illegal board actions.
    budgetHit = true;
    if (error !== ABORT) {
      /* Preserve the safe last completed move. */
    }
  }
  return {
    move:
      position.board[best] === 0
        ? best
        : (candidates.find((move) => position.board[move] === 0) ?? null),
    nodes: context.nodes,
    depth: completedDepth,
    budgetHit,
  };
}
