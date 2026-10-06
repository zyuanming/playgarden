import { describe, it, expect } from "vitest";
import { Xiangqi } from "../src/vendor/xiangqi/xiangqiCore.js";
import {
  initialPosition,
  playMove,
  replayMoves,
  undoMoves,
  START_FEN,
  squareName,
  squareIndex,
  RULE_ID,
  resultText,
} from "../src/games/xiangqiLogic";
import { chooseMove, simpleMove } from "../src/games/xiangqiAi";
import { xiangqiLevels } from "../src/games/xiangqiLevels";
import { solvePuzzle, practiceResult } from "../src/games/xiangqiPractice";
import { parseRound, defaultSettings } from "../src/games/xiangqiStorage";
import { readFileSync } from "node:fs";
const initial = () => initialPosition()!;
describe("Chinese chess: actual BSD core and casual adjudication", () => {
  it("has 90 canonical cells, 32 men, 44 legal opening moves and independent perft constants", () => {
    const p = initial();
    expect(p.board).toHaveLength(90);
    expect(p.board.filter(Boolean)).toHaveLength(32);
    expect(p.turn).toBe("r");
    expect(p.legal).toHaveLength(44);
    const core = Xiangqi();
    expect([0, 1, 2, 3].map((d) => core.perft(d))).toEqual([
      1, 44, 1920, 79666,
    ]);
    expect(core.fen()).toBe(START_FEN);
  });
  it("round-trips each coordinate", () => {
    for (let i = 0; i < 90; i++) expect(squareIndex(squareName(i))).toBe(i);
    expect(squareIndex("j0")).toBe(-1);
  });
  it("rejects malformed FEN, decimals, zero-run, missing kings and a side that already left itself checked", () => {
    for (const f of [
      "",
      START_FEN.replace("0 1", "0.5 1"),
      START_FEN.replace("0 1", "0 1.2"),
      START_FEN.replace("/9/", "/09/"),
      START_FEN.replace("k", "r"),
      "4k4/9/9/9/9/9/9/9/9/4K4 r - - 0 1",
    ])
      expect(initialPosition(f)).toBeNull();
  });
  it("opponent pseudo-move inspection cannot change the turn or FEN", () => {
    const core = Xiangqi();
    core.moves({ opponent: true, legal: false });
    expect(core.fen()).toBe(START_FEN);
  });
  it("disallows side switches, repeated clicks, illegal lines and history after terminal", () => {
    let p = initial();
    for (const m of ["a6a5", "a0a9", "a3a3", "", "bad"])
      expect(playMove(p, m)).toBe(p);
    p = playMove(p, "a3a4");
    expect(p.moves).toEqual(["a3a4"]);
    expect(playMove(p, "a3a4")).toBe(p);
    expect(p.turn).toBe("b");
    expect(undoMoves(p)).toEqual(initial());
  });
  it("ends the actual third occurrence, including side-to-move, and undo restores it", () => {
    const moves = [
      "b0c2",
      "b9c7",
      "c2b0",
      "c7b9",
      "b0c2",
      "b9c7",
      "c2b0",
      "c7b9",
    ];
    const p = replayMoves(START_FEN, moves)!;
    expect(p.result).toBe("repetition");
    expect(p.winner).toBeNull();
    expect(playMove(p, p.legal[0])).toBe(p);
    expect(replayMoves(START_FEN, [...moves, "a3a4"])).toBeNull();
    expect(undoMoves(p).result).toBeNull();
  });
  it("uses 120 non-capture plies; a soldier push does not reset this casual counter", () => {
    const p = initialPosition(START_FEN.replace("0 1", "119 1"))!;
    expect(playMove(p, "a3a4").result).toBe("quiet");
    const q = initialPosition(xiangqiLevels[0].fen.replace("0 1", "119 1"))!;
    expect(playMove(q, "a0a6").result).toBeNull();
    expect(playMove(q, "a0a6").fen.split(" ")[4]).toBe("0");
  });
  it("prioritizes checkmate and stalemate losses over the quiet-move draw", () => {
    for (const puzzle of xiangqiLevels.filter(
      (p) => p.objective === "mate" || p.objective === "stalemate",
    )) {
      const p = initialPosition(puzzle.fen.replace("0 1", "119 1"))!,
        n = playMove(p, puzzle.solutions[0]);
      expect(n.winner).toBe("r");
      expect(n.result).toBe(
        puzzle.objective === "mate" ? "checkmate" : "stalemate",
      );
      expect(resultText(n)).toContain("红方获胜");
    }
  });
  it("preserves exact BSD license and upstream provenance, without MIT relabeling", () => {
    expect(readFileSync("public/xiangqi-LICENSE.txt", "utf8")).toBe(
      readFileSync("docs/upstream/xiangqi.js/LICENSE", "utf8"),
    );
    expect(readFileSync("src/vendor/xiangqi/xiangqiCore.js", "utf8")).toContain(
      "BSD-2-Clause",
    );
    expect(readFileSync("src/vendor/xiangqi/xiangqiCore.js", "utf8")).not.toMatch(
      /fetch\(|XMLHttpRequest|https?:.*\.js["']/,
    );
  });
});
describe("13 original exercises enumerate every goal move", () => {
  it("matches the published corpus exactly", () => {
    expect(xiangqiLevels).toEqual(
      JSON.parse(readFileSync("docs/xiangqi/corpus.json", "utf8")),
    );
    expect(xiangqiLevels).toHaveLength(13);
    expect(new Set(xiangqiLevels.map((p) => p.fen)).size).toBe(13);
  });
  for (const puzzle of xiangqiLevels)
    it(puzzle.id, () => {
      const p = initialPosition(puzzle.fen)!;
      expect(p).not.toBeNull();
      expect(p.result).toBeNull();
      expect(solvePuzzle(puzzle)).toEqual(puzzle.solutions);
      for (const move of p.legal)
        expect(practiceResult(puzzle, playMove(p, move))).toBe(
          puzzle.solutions.includes(move) ? "success" : "retry",
        );
      expect(practiceResult(puzzle, p)).toBe("ready");
    });
});
describe("bounded beginner search", () => {
  for (const puzzle of xiangqiLevels.filter(
    (p) => p.objective === "mate" || p.objective === "stalemate",
  ))
    it(`finds a terminal win: ${puzzle.id}`, () => {
      const p = initialPosition(puzzle.fen)!,
        snapshot = JSON.stringify(p);
      const search = chooseMove(p, {
        nodeBudget: 1000,
        timeMs: 800,
        maxDepth: 1,
      });
      expect(search.move).not.toBeNull();
      expect(playMove(p, search.move!).winner).toBe("r");
      expect(JSON.stringify(p)).toBe(snapshot);
    });
  it("returns a legal fallback under a one-node budget and never edits input", () => {
    const p = initial(),
      copy = JSON.stringify(p),
      s = chooseMove(p, { nodeBudget: 1, timeMs: 1 });
    expect(p.legal).toContain(s.move);
    expect(JSON.stringify(p)).toBe(copy);
    expect(s.nodes).toBeLessThanOrEqual(2);
  });
  it("returns no move in terminal states", () => {
    const p = playMove(initialPosition(xiangqiLevels[12].fen)!, "d7d8");
    expect(chooseMove(p).move).toBeNull();
    expect(simpleMove(p)).toBeNull();
  });
});
describe("versioned complete-history saves", () => {
  const raw = (extra: Record<string, unknown> = {}) =>
    JSON.stringify({
      version: 1,
      ruleId: RULE_ID,
      puzzleId: "free",
      initial: START_FEN,
      settings: defaultSettings,
      moves: ["a3a4", "a6a5"],
      ...extra,
    });
  it("replays legal history rather than trusting a supplied board or turn", () => {
    const parsed = parseRound(raw({ turn: "r", board: [] }), START_FEN, "free");
    expect(parsed.position).toEqual(replayMoves(START_FEN, ["a3a4", "a6a5"]));
    expect(parsed.restored).toBe(true);
  });
  for (const extra of [
    { version: 2 },
    { ruleId: "tournament" },
    { puzzleId: "different" },
    { initial: "bad" },
    { moves: ["a6a5"] },
    { moves: null },
    { moves: [0] },
    { settings: { mode: "remote", human: "r" } },
  ])
    it(`rejects ${JSON.stringify(extra)}`, () => {
      const p = parseRound(raw(extra), START_FEN, "free");
      expect(p.invalid).toBe(true);
      expect(p.position.moves).toEqual([]);
    });
  it("rejects corrupt and over-budget input", () => {
    for (const raw of ["{", "x".repeat(60001)])
      expect(parseRound(raw, START_FEN, "free").invalid).toBe(true);
  });
});
