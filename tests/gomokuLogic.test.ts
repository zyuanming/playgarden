import { describe, expect, it } from "vitest";
import {
  SIZE,
  emptyPosition,
  evaluate,
  immediateWins,
  isValidPosition,
  playMove,
  pointName,
  replayMoves,
  undoMoves,
  winningLinesAt,
} from "../src/games/gomokuLogic";
import type { Cell, Position, Stone } from "../src/games/gomokuLogic";
import {
  chooseMove,
  neighborCandidates,
  quickScore,
} from "../src/games/gomokuAi";

const at = (x: number, y: number) => y * SIZE + x;
function boardWith(indices: number[], stone: Stone = 1): Cell[] {
  const board = emptyPosition().board;
  for (const index of indices) board[index] = stone;
  return board;
}
function position(moves: number[]): Position {
  const result = replayMoves(moves);
  if (!result) throw new Error(`Invalid test fixture: ${moves}`);
  return result;
}
function deepFreeze(p: Position): Position {
  Object.freeze(p.board);
  Object.freeze(p.moves);
  for (const line of p.winningLines) Object.freeze(line);
  Object.freeze(p.winningLines);
  Object.freeze(p);
  return p;
}
function drawBoard(): Cell[] {
  return Array.from({ length: SIZE * SIZE }, (_, i) =>
    ((i % SIZE) + 2 * Math.floor(i / SIZE)) % 4 < 2 ? 1 : 2,
  );
}
function chronological(board: Cell[], final?: number): number[] {
  const black: number[] = [],
    white: number[] = [];
  for (let i = 0; i < board.length; i++)
    if (i !== final) {
      if (board[i] === 1) black.push(i);
      else if (board[i] === 2) white.push(i);
    }
  if (final !== undefined) (board[final] === 1 ? black : white).push(final);
  const moves: number[] = [];
  for (let i = 0; i < Math.max(black.length, white.length); i++) {
    if (black[i] !== undefined) moves.push(black[i]);
    if (white[i] !== undefined) moves.push(white[i]);
  }
  return moves;
}
const stableClock = { now: () => 0, timeMs: 2_000, nodeBudget: 60_000 };

describe("freestyle board lines", () => {
  it.each([
    ["horizontal", [at(10, 0), at(11, 0), at(12, 0), at(13, 0), at(14, 0)]],
    ["vertical", [at(0, 10), at(0, 11), at(0, 12), at(0, 13), at(0, 14)]],
    ["diagonal", [at(0, 0), at(1, 1), at(2, 2), at(3, 3), at(4, 4)]],
    ["anti-diagonal", [at(10, 4), at(11, 3), at(12, 2), at(13, 1), at(14, 0)]],
  ])("finds a %s win at the board boundary", (_name, line) => {
    expect(
      winningLinesAt(boardWith(line as number[]), (line as number[])[2]),
    ).toEqual([line]);
  });
  it("returns all fifteen points of a long overline, including from an end", () => {
    const line = Array.from({ length: 15 }, (_, x) => at(x, 8));
    expect(winningLinesAt(boardWith(line), line[0])).toEqual([line]);
    expect(winningLinesAt(boardWith(line), line[8])).toEqual([line]);
  });
  it("returns every completed axis through one crossing point", () => {
    const lines = [
      [at(5, 7), at(6, 7), at(7, 7), at(8, 7), at(9, 7)],
      [at(7, 5), at(7, 6), at(7, 7), at(7, 8), at(7, 9)],
      [at(5, 5), at(6, 6), at(7, 7), at(8, 8), at(9, 9)],
      [at(5, 9), at(6, 8), at(7, 7), at(8, 6), at(9, 5)],
    ];
    expect(winningLinesAt(boardWith(lines.flat()), at(7, 7))).toEqual(lines);
  });
  it("does not wrap horizontal or diagonal lines across board edges", () => {
    expect(winningLinesAt(boardWith([12, 13, 14, 15, 16]), 14)).toEqual([]);
    expect(winningLinesAt(boardWith([13, 29, 45, 61, 77]), 45)).toEqual([]);
  });
  it("does not count four, separated stones, or the other color", () => {
    expect(winningLinesAt(boardWith([0, 1, 2, 3]), 2)).toEqual([]);
    const b = boardWith([0, 1, 3, 4, 5]);
    b[2] = 2;
    expect(winningLinesAt(b, 3)).toEqual([]);
    expect(winningLinesAt(b, 20)).toEqual([]);
  });
  it("finds all open-end and split-line immediate wins without mutation", () => {
    const b = boardWith([at(4, 7), at(5, 7), at(6, 7), at(7, 7)]);
    const before = b.slice();
    Object.freeze(b);
    expect(immediateWins(b, 1)).toEqual([at(3, 7), at(8, 7)]);
    expect(b).toEqual(before);
    expect(immediateWins(boardWith([0, 1, 3, 4, 5]), 1)).toEqual([2]);
  });
  it("rejects malformed boards and indices without reporting wins", () => {
    expect(winningLinesAt([] as Cell[], 0)).toEqual([]);
    expect(winningLinesAt(Array(225), 0)).toEqual([]);
    expect(winningLinesAt(boardWith([0, 1, 2, 3, 4]), -1)).toEqual([]);
    expect(winningLinesAt(boardWith([0, 1, 2, 3, 4]), 0.5)).toEqual([]);
    expect(immediateWins(Array(225).fill(3) as Cell[], 1)).toEqual([]);
  });
});

describe("immutable chronological game state", () => {
  it("starts empty, alternates, names points, and leaves the old state untouched", () => {
    const initial = deepFreeze(emptyPosition());
    expect(initial.turn).toBe(1);
    const next = playMove(initial, 112);
    expect(next.board[112]).toBe(1);
    expect(next.turn).toBe(2);
    expect(next.moves).toEqual([112]);
    expect(initial.board.every((c) => c === 0)).toBe(true);
    expect(pointName(0)).toBe("A1");
    expect(pointName(112)).toBe("H8");
    expect(pointName(224)).toBe("O15");
    expect(pointName(-1)).toBe("");
    expect(pointName(225)).toBe("");
  });
  it.each([-1, 225, NaN, Infinity, 1.5])(
    "rejects invalid point %s by object identity",
    (index) => {
      const p = emptyPosition();
      expect(playMove(p, index)).toBe(p);
      expect(replayMoves([index])).toBeNull();
    },
  );
  it("rejects duplicates, non-number points, too many points, and sparse histories", () => {
    const p = position([112]);
    expect(playMove(p, 112)).toBe(p);
    expect(replayMoves([112, 112])).toBeNull();
    expect(replayMoves(["2"] as unknown as number[])).toBeNull();
    expect(replayMoves(Array(226).fill(0))).toBeNull();
    expect(replayMoves(Array(2))).toBeNull();
  });
  it("wins on six, stops immediately, and undoes/replays the exact history", () => {
    const moves = [0, 30, 1, 32, 3, 34, 4, 36, 5, 38, 2];
    const win = position(moves);
    expect(win.winner).toBe(1);
    expect(win.draw).toBe(false);
    expect(win.winningLines).toEqual([[0, 1, 2, 3, 4, 5]]);
    expect(playMove(win, 100)).toBe(win);
    expect(replayMoves([...moves, 100])).toBeNull();
    const back = undoMoves(deepFreeze(win), 2);
    expect(back).toEqual(position(moves.slice(0, -2)));
    expect(back.winner).toBeNull();
    expect(undoMoves(back, 500)).toEqual(emptyPosition());
    expect(undoMoves(back, 0)).toBe(back);
    expect(undoMoves(back, -1)).toBe(back);
    expect(undoMoves(back, 1.2)).toBe(back);
  });
  it("detects an actual full-board draw", () => {
    const p = position(chronological(drawBoard()));
    expect(p.moves).toHaveLength(225);
    expect(p.winner).toBeNull();
    expect(p.draw).toBe(true);
    expect(p.winningLines).toEqual([]);
    expect(playMove(p, 0)).toBe(p);
    expect(undoMoves(p, 1).draw).toBe(false);
  });
  it("gives a winning final 225th move priority over a draw", () => {
    const b = drawBoard();
    b[2] = 1;
    b[3] = 1;
    b[17] = 2;
    b[21] = 2;
    const moves = chronological(b, 2);
    expect(moves[224]).toBe(2);
    const before = position(moves.slice(0, -1));
    expect(before.winner).toBeNull();
    expect(before.draw).toBe(false);
    const after = playMove(before, 2);
    expect(after.moves).toHaveLength(225);
    expect(after.winner).toBe(1);
    expect(after.draw).toBe(false);
    expect(after.winningLines).toEqual([[0, 1, 2, 3, 4, 5]]);
  });
  it("rejects inconsistent persisted boards, turn, winner, draw, and lines", () => {
    const p = position([112, 113]);
    for (const broken of [
      { ...p, turn: 2 },
      { ...p, winner: 1 },
      { ...p, draw: true },
      { ...p, board: p.board.map((c, i) => (i === 112 ? 0 : c)) },
      { ...p, winningLines: [[0, 1, 2, 3, 4]] },
      { ...p, moves: [112, 112] },
      { ...p, board: Array(225) },
    ] as Position[]) {
      expect(isValidPosition(broken)).toBe(false);
      expect(playMove(broken, 114)).toBe(broken);
      expect(undoMoves(broken, 1)).toBe(broken);
    }
    expect(isValidPosition(null)).toBe(false);
    expect(isValidPosition({})).toBe(false);
  });
});

describe("ported heuristic and candidate functions", () => {
  it("preserves empty, center, pattern growth, and color symmetry evaluations", () => {
    expect(evaluate(emptyPosition().board, 1)).toBe(0);
    expect(evaluate(boardWith([112]), 1)).toBe(14);
    const two = boardWith([112, 113]),
      three = boardWith([112, 113, 114]);
    expect(evaluate(three, 1)).toBeGreaterThan(evaluate(two, 1));
    expect(evaluate(three, 2)).toBe(-evaluate(three, 1));
  });
  it("produces unique legal neighbors and handles empty and full boards", () => {
    expect(neighborCandidates(emptyPosition().board, 2)).toEqual([112]);
    const b = boardWith([0]);
    expect(neighborCandidates(b, 1).sort((a, c) => a - c)).toEqual([1, 15, 16]);
    const candidates = neighborCandidates(boardWith([112, 113]), 2);
    expect(new Set(candidates).size).toBe(candidates.length);
    expect(candidates).not.toContain(112);
    expect(candidates).not.toContain(113);
    expect(neighborCandidates(drawBoard(), 2)).toEqual([]);
  });
  it("keeps the upstream move-ordering preference for completing a five", () => {
    const b = boardWith([0, 1, 2, 3]);
    expect(quickScore(b, 4, 1)).toBeGreaterThan(quickScore(b, 112, 1));
    expect(quickScore(b, 4, 1)).toBeGreaterThan(quickScore(b, 4, 2));
  });
});

describe("bounded tactical alpha-beta opponent", () => {
  it.each(["gentle", "steady"] as const)(
    "opens at center on %s",
    (difficulty) => {
      const result = chooseMove(
        deepFreeze(emptyPosition()),
        difficulty,
        stableClock,
      );
      expect(result.move).toBe(112);
      expect(result.depth).toBe(difficulty === "gentle" ? 1 : 3);
      expect(result.budgetHit).toBe(false);
    },
  );
  it.each(["gentle", "steady"] as const)(
    "takes its own win before defending on %s with zero budget",
    (difficulty) => {
      const p = deepFreeze(position([0, 30, 1, 31, 2, 32, 3, 33]));
      expect(immediateWins(p.board, 1)).toEqual([4]);
      expect(immediateWins(p.board, 2)).toEqual([34]);
      const answer = chooseMove(p, difficulty, { nodeBudget: 0, timeMs: 0 });
      expect(answer.move).toBe(4);
      expect(playMove(p, answer.move!).winner).toBe(1);
    },
  );
  it.each(["gentle", "steady"] as const)(
    "makes the unique block on %s even on budget exhaustion",
    (difficulty) => {
      const p = deepFreeze(position([0, 112, 1, 114, 2, 146, 3]));
      expect(immediateWins(p.board, 1)).toEqual([4]);
      expect(chooseMove(p, difficulty, stableClock).move).toBe(4);
      const limited = chooseMove(p, difficulty, { nodeBudget: 0, timeMs: 0 });
      expect(limited.move).toBe(4);
      expect(limited.budgetHit).toBe(true);
      expect(limited.nodes).toBe(0);
    },
  );
  it("returns no move on full, winning, or malformed states", () => {
    const drawn = position(chronological(drawBoard()));
    const won = position([0, 30, 1, 32, 2, 34, 3, 36, 4]);
    for (const p of [drawn, won, { ...emptyPosition(), turn: 2 }, null, {}]) {
      expect(chooseMove(p as Position, "steady").move).toBeNull();
    }
  });
  it("is deterministic, bounded, and does not mutate even frozen nested input", () => {
    const p = deepFreeze(position([112, 113, 97, 127, 96, 111]));
    const serialized = JSON.stringify(p);
    for (const nodeBudget of [0, 1, 2, 12, 30, 200]) {
      const options = { ...stableClock, nodeBudget };
      const a = chooseMove(p, "steady", options),
        b = chooseMove(p, "steady", options);
      expect(a).toEqual(b);
      expect(a.nodes).toBeLessThanOrEqual(nodeBudget);
      expect(a.move).not.toBeNull();
      expect(p.board[a.move!]).toBe(0);
      expect(a.depth).toBeLessThanOrEqual(3);
      expect(JSON.stringify(p)).toBe(serialized);
    }
  });
  it("preserves the last fully completed iteration under a mid-next-iteration abort", () => {
    const p = position([112, 113, 97, 127, 96, 111]);
    const atDepthOne = chooseMove(p, "steady", {
      ...stableClock,
      nodeBudget: 16,
    });
    expect(atDepthOne.depth).toBe(1);
    const partialDepthTwo = chooseMove(p, "steady", {
      ...stableClock,
      nodeBudget: 17,
    });
    expect(partialDepthTwo.depth).toBe(1);
    expect(partialDepthTwo.budgetHit).toBe(true);
    expect(partialDepthTwo.move).toBe(atDepthOne.move);
  });
  it("stops on elapsed time and failed clocks while keeping a legal fallback", () => {
    const p = deepFreeze(position([112, 113, 97, 127]));
    let tick = 0;
    const elapsed = chooseMove(p, "steady", {
      now: () => tick++,
      timeMs: 2,
      nodeBudget: 60_000,
    });
    expect(elapsed.budgetHit).toBe(true);
    expect(p.board[elapsed.move!]).toBe(0);
    for (const now of [
      () => NaN,
      () => {
        throw new Error("clock failed");
      },
    ]) {
      const failed = chooseMove(p, "steady", { now });
      expect(failed.budgetHit).toBe(true);
      expect(p.board[failed.move!]).toBe(0);
    }
  });
  it("never invents a center move on a nearly full board", () => {
    const moves = chronological(drawBoard());
    const p = position(moves.slice(0, -1));
    const result = chooseMove(deepFreeze(p), "steady", stableClock);
    expect(result.move).toBe(moves[224]);
    expect(p.board[result.move!]).toBe(0);
  });
});
