// @vitest-environment jsdom
import { StrictMode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameProps } from "../src/lib/types";
import HexGarden from "../src/games/HexGarden";
import DotsAndBoxes from "../src/games/DotsAndBoxes";
import {
  HEX_AI_DELAY,
  HEX_SEARCH_NODES,
  HEX_SELECTORS,
  chooseHexMove,
  createHexState,
  hexBoardFromMoves,
  hexCertifiedWin,
  hexLegalMoves,
  hexLevels,
  hexNeighbors,
  hexWinner,
  hexWinningPath,
  placeHex,
  playHexTurn,
  replyHexTurn,
  searchHex,
  undoHexTurn,
  validHexBoard,
  type HexPiece,
} from "../src/games/hexLogic";
import {
  DOTS_AI_DELAY,
  DOTS_SEARCH_NODES,
  DOTS_SELECTORS,
  createDotsState,
  dotsBoardFromMoves,
  dotsBoxEdges,
  dotsCertifiedWin,
  dotsEdgeCount,
  dotsLegalMoves,
  dotsLevels,
  dotsScores,
  dotsWinner,
  drawDotsEdge,
  emptyDotsBoard,
  playDotsTurn,
  replyDotsTurn,
  searchDots,
  undoDotsTurn,
  validDotsBoard,
  type DotsBoard,
  type DotsPlayer,
} from "../src/games/dotsAndBoxesLogic";
import {
  hexCertificates,
  dotsCertificates,
} from "./fixtures/connectionStrategyCertificates";
const props = (extra: Partial<GameProps> = {}): GameProps => ({
  level: 0,
  paused: false,
  resetToken: 0,
  hintToken: 0,
  undoToken: 0,
  onComplete: vi.fn(),
  onStatus: vi.fn(),
  ...extra,
});
const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
const hexBoard = () => screen.getByTestId("hex-board");
const dotsBoard = () => screen.getByTestId("dots-board");
const hexClick = (index: number) =>
  fireEvent.click(document.querySelector(HEX_SELECTORS.cell(index))!);
const dotsClick = (index: number) =>
  fireEvent.click(document.querySelector(DOTS_SELECTORS.edge(index))!);
function settleDots() {
  let guard = 0;
  while (dotsBoard().dataset.turn === "2" && guard++ < 25) tick(DOTS_AI_DELAY);
  expect(guard).toBeLessThan(25);
}
beforeEach(() =>
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }),
);
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Independent union-find oracle: joins coordinate pairs instead of using game BFS. */
function refHexWinner(board: readonly number[], n: number): 1 | 2 | null {
  for (const player of [1, 2] as const) {
    const parent = Array.from({ length: n * n + 2 }, (_, i) => i),
      a = n * n,
      b = a + 1;
    const root = (i: number): number =>
      parent[i] === i ? i : (parent[i] = root(parent[i]));
    const join = (x: number, y: number) => {
      parent[root(x)] = root(y);
    };
    for (let i = 0; i < n * n; i++)
      if (board[i] === player) {
        const r = Math.floor(i / n),
          c = i % n;
        if ((player === 1 ? r : c) === 0) join(i, a);
        if ((player === 1 ? r : c) === n - 1) join(i, b);
        for (let j = i + 1; j < n * n; j++)
          if (board[j] === player) {
            const dr = Math.floor(j / n) - r,
              dc = (j % n) - c;
            if (
              (dr === 0 && Math.abs(dc) === 1) ||
              (dr === 1 && (dc === -1 || dc === 0))
            )
              join(i, j);
          }
      }
    if (root(a) === root(b)) return player;
  }
  return null;
}
function refHexSolver(n: number) {
  const memo = new Map<string, boolean>();
  function wins(board: number[], side: 1 | 2): boolean {
    const winner = refHexWinner(board, n);
    if (winner) return winner === 1;
    const key = board.join("") + side;
    if (memo.has(key)) return memo.get(key)!;
    let answer = side === 2;
    for (let i = 0; i < board.length; i++)
      if (!board[i]) {
        const next = [...board];
        next[i] = side;
        const child = wins(next, side === 1 ? 2 : 1);
        if (child === (side === 1)) {
          answer = child;
          break;
        }
      }
    memo.set(key, answer);
    return answer;
  }
  return wins;
}
/** Independent rectangle bookkeeping. Each edge is decoded into grid coordinates. */
function refDotsStep(board: DotsBoard, side: DotsPlayer, index: number) {
  if (board.edges[index] !== 0) throw new Error("Reference edge not empty");
  const edges = [...board.edges],
    boxes = [...board.boxes];
  edges[index] = side;
  let captured = 0;
  for (let r = 0; r < board.rows; r++)
    for (let c = 0; c < board.columns; c++) {
      const box = r * board.columns + c;
      if (boxes[box]) continue;
      let borders = 0;
      for (let e = 0; e < edges.length; e++)
        if (edges[e]) {
          const horizontal = e < (board.rows + 1) * board.columns;
          if (horizontal) {
            const er = Math.floor(e / board.columns),
              ec = e % board.columns;
            if (ec === c && (er === r || er === r + 1)) borders++;
          } else {
            const offset = e - (board.rows + 1) * board.columns,
              er = Math.floor(offset / (board.columns + 1)),
              ec = offset % (board.columns + 1);
            if (er === r && (ec === c || ec === c + 1)) borders++;
          }
        }
      if (borders === 4) {
        boxes[box] = side;
        captured++;
      }
    }
  return {
    board: { ...board, edges, boxes },
    captured,
    turn: edges.every(Boolean) ? 0 : captured ? side : side === 1 ? 2 : 1,
  } as const;
}
function refDotsSolver() {
  const memo = new Map<string, number>();
  function future(board: DotsBoard, side: DotsPlayer): number {
    if (board.edges.every(Boolean)) return 0;
    const key = `${board.rows},${board.columns}:${board.edges.map((e) => +!!e).join("")}:${side}`;
    if (memo.has(key)) return memo.get(key)!;
    let best = side === 1 ? -Infinity : Infinity;
    for (let i = 0; i < board.edges.length; i++)
      if (!board.edges[i]) {
        const next = refDotsStep(board, side, i);
        const value =
          next.captured * (side === 1 ? 1 : -1) +
          (next.turn ? future(next.board, next.turn) : 0);
        best = side === 1 ? Math.max(best, value) : Math.min(best, value);
      }
    memo.set(key, best);
    return best;
  }
  return (board: DotsBoard, side: DotsPlayer) =>
    board.boxes.reduce<number>(
      (v, p) => v + (p === 1 ? 1 : p === 2 ? -1 : 0),
      0,
    ) + future(board, side);
}

describe("Hex independent rules and authored certificates", () => {
  it("has 12 distinct legal studies with larger boards and longer routes", () => {
    expect(hexLevels).toHaveLength(12);
    expect(hexCertificates).toHaveLength(12);
    expect(new Set(hexLevels.map((l) => l.board.join(","))).size).toBe(12);
    expect(hexLevels[0].solution.length).toBe(1);
    expect(hexLevels.at(-1)!.size).toBe(5);
    expect(hexLevels.at(-1)!.solution.length).toBeGreaterThanOrEqual(5);
    expect(new Set(hexLevels.map((l) => l.size))).toEqual(new Set([3, 4, 5]));
  });
  for (const [index, level] of hexLevels.entries())
    it(`independently certifies Hex ${index + 1}, including every real AI reply`, () => {
      const cert = hexCertificates[index];
      expect(cert.size).toBe(level.size);
      expect([...cert.startMoves]).toEqual(level.startMoves);
      let board: number[] = Array(level.size ** 2).fill(0);
      for (const [ply, move] of cert.startMoves.entries()) {
        expect(refHexWinner(board, level.size)).toBeNull();
        expect(board[move]).toBe(0);
        board[move] = ply % 2 ? 2 : 1;
      }
      expect(board).toEqual(level.board);
      expect(refHexWinner(board, level.size)).toBeNull();
      const oracle = refHexSolver(level.size);
      expect(oracle(board, 1)).toBe(true);
      expect(searchHex(level.board, level.size)).toMatchObject({
        exact: true,
        outcome: "win",
        move: level.solution[0],
      });
      let state = createHexState(level);
      for (const [ply, move] of cert.plies.entries()) {
        const side = ply % 2 ? 2 : 1;
        expect(board[move]).toBe(0);
        expect(state.turn).toBe(side);
        if (side === 2)
          expect(chooseHexMove(state.board, state.size)).toBe(move);
        state = side === 1 ? playHexTurn(state, move) : replyHexTurn(state);
        board[move] = side;
        expect(state.board).toEqual(board);
        expect(hexWinner(state.board, state.size)).toBe(
          refHexWinner(board, level.size),
        );
      }
      expect(refHexWinner(board, level.size)).toBe(1);
      expect(state.turn).toBe(0);
      expect(hexCertifiedWin(level)).toBe(true);
    });
  it("matches union-find on all 19,683 ternary 3×3 boards; every full board has a winner", () => {
    for (let code = 0; code < 3 ** 9; code++) {
      let v = code;
      const board: HexPiece[] = Array.from({ length: 9 }, () => {
        const p = (v % 3) as HexPiece;
        v = Math.floor(v / 3);
        return p;
      });
      const reference = refHexWinner(board, 3);
      expect(hexWinner(board, 3)).toBe(reference);
      if (board.every(Boolean)) expect(reference).not.toBeNull();
    }
  });
  it("matches exhaustive independent minimax on every 2×2 position and side", () => {
    const oracle = refHexSolver(2);
    for (let code = 0; code < 81; code++) {
      let v = code;
      const board: HexPiece[] = Array.from({ length: 4 }, () => {
        const p = (v % 3) as HexPiece;
        v = Math.floor(v / 3);
        return p;
      });
      if (refHexWinner(board, 2)) continue;
      for (const side of [1, 2] as const) {
        const advice = searchHex(board, 2, side);
        expect(advice.exact).toBe(true);
        expect(advice.score > 0).toBe(oracle([...board], side));
        const next = placeHex(board, 2, side, advice.move!)!;
        expect(oracle(next, side === 1 ? 2 : 1)).toBe(oracle([...board], side));
      }
    }
  });
  it("uses six neighbors, returns a connected winning path, rejects illegal input, and never mutates boards", () => {
    expect(hexNeighbors(4, 3).sort()).toEqual([1, 2, 3, 5, 6, 7]);
    expect(hexNeighbors(0, 3).sort()).toEqual([1, 3]);
    const level = hexLevels[0],
      before = [...level.board],
      next = placeHex(level.board, 3, 1, 7)!;
    expect(level.board).toEqual(before);
    const path = hexWinningPath(next, 3, 1);
    expect(Math.floor(path[0] / 3)).toBe(0);
    expect(Math.floor(path.at(-1)! / 3)).toBe(2);
    for (let i = 1; i < path.length; i++)
      expect(hexNeighbors(path[i - 1], 3)).toContain(path[i]);
    for (const move of [-1, 9, NaN, 1.5, 0])
      expect(placeHex(level.board, 3, 1, move)).toBeNull();
    expect(placeHex(next, 3, 2, 0)).toBeNull();
    expect(validHexBoard([0], 1)).toBe(false);
    expect(validHexBoard([0, 0, 0, 3] as HexPiece[], 2)).toBe(false);
    expect(searchHex([], 3).exact).toBe(false);
    expect(() => hexBoardFromMoves(3, [0, 0])).toThrow();
    expect(() => createHexState({ size: 3, board: [] })).toThrow();
  });
  it("bounds all search work and labels cutoff suggestions honestly", () => {
    const board: HexPiece[] = Array(25).fill(0),
      first = searchHex(board, 5, 1, 20, 2);
    expect(first.nodes).toBeLessThanOrEqual(20);
    expect(first).toMatchObject({ exact: false, outcome: "unknown" });
    expect(searchHex(board, 5, 1, 20, 2)).toEqual(first);
    expect(hexLegalMoves(board, 5)).toContain(first.move);
    expect(searchHex(board, 5, 1, Infinity, 1).nodes).toBeLessThanOrEqual(
      HEX_SEARCH_NODES,
    );
    const lost: HexPiece[] = [0, 2, 0, 0];
    expect(searchHex(lost, 2, 1)).toMatchObject({
      exact: true,
      outcome: "loss",
    });
  });
  it("accepts every alternate legal move, undoes complete turns, and ignores paused/terminal/wrong-turn moves", () => {
    const initial = createHexState(hexLevels[3]);
    for (const cell of hexLegalMoves(initial.board, initial.size)) {
      const moved = playHexTurn(initial, cell);
      expect(moved.board[cell]).toBe(1);
      expect(undoHexTurn(replyHexTurn(moved))).toEqual(initial);
    }
    expect(playHexTurn(initial, 2, true)).toBe(initial);
    expect(replyHexTurn(initial)).toBe(initial);
    const pending = playHexTurn(initial, 2);
    expect(playHexTurn(pending, 1)).toBe(pending);
    expect(undoHexTurn(initial)).toBe(initial);
  });
});

describe("Dots and Boxes independent rules and certificates", () => {
  it("has 12 distinct progressive scoring studies", () => {
    expect(dotsLevels).toHaveLength(12);
    expect(dotsCertificates).toHaveLength(12);
    expect(new Set(dotsLevels.map((l) => l.board.edges.join(","))).size).toBe(
      12,
    );
    expect(dotsLevels.map((l) => l.solution.length)).toEqual([
      2, 3, 3, 3, 4, 4, 5, 5, 6, 6, 7, 8,
    ]);
  });
  for (const [index, level] of dotsLevels.entries())
    it(`independently certifies Dots ${index + 1} with captures and extra-turn ownership`, () => {
      const cert = dotsCertificates[index];
      let board = emptyDotsBoard(cert.rows, cert.columns),
        turn: 0 | DotsPlayer = 1;
      for (const edge of cert.startMoves) {
        expect(turn).not.toBe(0);
        const next = refDotsStep(board, turn as DotsPlayer, edge);
        board = next.board;
        turn = next.turn;
      }
      expect(turn).toBe(1);
      expect(board).toEqual(level.board);
      expect(validDotsBoard(board)).toBe(true);
      expect(refDotsSolver()(board, 1)).toBeGreaterThan(0);
      const advice = searchDots(board);
      expect(advice).toMatchObject({
        exact: true,
        outcome: "win",
        move: level.solution[0],
      });
      expect(advice.nodes).toBeLessThanOrEqual(DOTS_SEARCH_NODES);
      let state = createDotsState(level);
      for (const { p, e } of cert.plies) {
        expect(turn).toBe(p);
        expect(state.turn).toBe(p);
        const reference = refDotsStep(board, p, e);
        if (p === 2) expect(searchDots(board, 2).move).toBe(e);
        state = p === 1 ? playDotsTurn(state, e) : replyDotsTurn(state);
        board = reference.board;
        turn = reference.turn;
        expect(state.board).toEqual(board);
        expect(state.turn).toBe(turn);
      }
      expect(board.edges.every(Boolean)).toBe(true);
      expect(dotsWinner(board)).toBe(1);
      expect(dotsCertifiedWin(level)).toBe(true);
    });
  it("exhaustively checks every reachable 1×2 small-board state against a separate scoring oracle", () => {
    const visited = new Set<string>(),
      oracle = refDotsSolver();
    function explore(board: DotsBoard, turn: 0 | DotsPlayer) {
      const key = board.edges.join("") + board.boxes.join("") + turn;
      if (visited.has(key)) return;
      visited.add(key);
      expect(validDotsBoard(board)).toBe(true);
      if (!turn) {
        expect(dotsWinner(board)).toBe(
          dotsScores(board)[0] === dotsScores(board)[1]
            ? 0
            : dotsScores(board)[0] > dotsScores(board)[1]
              ? 1
              : 2,
        );
        return;
      }
      const advice = searchDots(board, turn);
      expect(advice.exact).toBe(true);
      expect(advice.score / 100).toBe(oracle(board, turn));
      for (let edge = 0; edge < board.edges.length; edge++)
        if (!board.edges[edge]) {
          const reference = refDotsStep(board, turn, edge),
            actual = drawDotsEdge(board, turn, edge)!;
          expect(actual.board).toEqual(reference.board);
          expect(actual.turn).toBe(reference.turn);
          expect(actual.captured.length).toBe(reference.captured);
          explore(reference.board, reference.turn);
        }
    }
    explore(emptyDotsBoard(1, 2), 1);
    expect(visited.size).toBeGreaterThan(100);
  });
  it("scores two boxes from one shared edge, keeps the capturer's turn, and ends after the final edge", () => {
    const board = {
      ...emptyDotsBoard(1, 2),
      edges: [1, 2, 1, 2, 1, 0, 2] as const,
    };
    const next = drawDotsEdge(board, 1, 5)!;
    expect(next.captured).toEqual([0, 1]);
    expect(dotsScores(next.board)).toEqual([2, 0]);
    expect(next.turn).toBe(0);
    expect(next.extraTurn).toBe(false);
    const first = drawDotsEdge(dotsLevels[0].board, 1, 5)!;
    expect(first.extraTurn).toBe(true);
    expect(first.turn).toBe(1);
  });
  it("counts genuine ties and allows winning alternatives instead of enforcing certificates", () => {
    const tied = dotsBoardFromMoves(1, 2, [0, 1, 2, 4, 5, 3, 6]);
    expect(dotsWinner(tied.board)).toBe(0);
    expect(searchDots(tied.board)).toMatchObject({
      exact: true,
      outcome: "tie",
      move: null,
    });
    let state = createDotsState(dotsLevels[0]);
    for (const edge of [7, 5]) state = playDotsTurn(state, edge);
    expect(dotsWinner(state.board)).toBe(1);
  });
  it("rejects malformed boards and edges without modifying input", () => {
    const board = dotsLevels[0].board,
      before = structuredClone(board);
    for (const edge of [-1, NaN, 0.5, 99, 0])
      expect(drawDotsEdge(board, 1, edge)).toBeNull();
    expect(board).toEqual(before);
    expect(validDotsBoard({ ...board, rows: 4 })).toBe(false);
    expect(validDotsBoard({ ...board, boxes: [1, 0, 0] })).toBe(false);
    expect(validDotsBoard({ ...board, edges: [] })).toBe(false);
    expect(searchDots({ ...board, edges: [] })).toMatchObject({
      exact: false,
      move: null,
    });
    expect(() => dotsBoardFromMoves(1, 1, [0, 0])).toThrow();
    expect(() => createDotsState({ board: { ...board, boxes: [] } })).toThrow();
    expect(dotsEdgeCount(3, 3)).toBe(24);
    expect(dotsBoxEdges(emptyDotsBoard(2, 2), 0)).toEqual([0, 2, 6, 7]);
  });
  it("bounds deterministic estimates on a full 3×3 opening and reports no unproved wins", () => {
    const board = emptyDotsBoard(3, 3),
      result = searchDots(board, 2, 50, 3);
    expect(result.nodes).toBeLessThanOrEqual(50);
    expect(result).toMatchObject({ exact: false, outcome: "unknown" });
    expect(searchDots(board, 2, 50, 3)).toEqual(result);
    expect(dotsLegalMoves(board)).toContain(result.move);
    expect(searchDots(board, 1, Infinity, 1).nodes).toBeLessThanOrEqual(
      DOTS_SEARCH_NODES,
    );
  });
  it("undo includes the entire scoring chain plus every AI response", () => {
    const initial = createDotsState(dotsLevels[6]);
    let state = initial;
    for (const edge of [11, 12, 14]) state = playDotsTurn(state, edge);
    expect(state.history.length).toBe(1);
    expect(state.turn).toBe(2);
    let replies = 0;
    while (state.turn === 2) {
      state = replyDotsTurn(state);
      replies++;
    }
    expect(replies).toBe(2);
    expect(undoDotsTurn(state)).toEqual(initial);
    expect(playDotsTurn(initial, 11, true)).toBe(initial);
    expect(replyDotsTurn(initial)).toBe(initial);
    expect(undoDotsTurn(initial)).toBe(initial);
  });
});

for (const game of ["hex", "dots"] as const)
  describe(`${game} UI lifecycle`, () => {
    const Component = game === "hex" ? HexGarden : DotsAndBoxes,
      levels = game === "hex" ? hexLevels : dotsLevels,
      board = game === "hex" ? hexBoard : dotsBoard,
      click = game === "hex" ? hexClick : dotsClick,
      delay = game === "hex" ? HEX_AI_DELAY : DOTS_AI_DELAY;
    const settle = () => {
      if (game === "hex") tick(delay);
      else settleDots();
    };
    const pendingLevel = game === "hex" ? 3 : 3,
      pendingMove = game === "hex" ? 2 : 0;
    const serial = () =>
      game === "hex" ? board().dataset.board : board().dataset.edges;
    for (const [level, config] of levels.entries())
      it(`completes all visible moves in challenge ${level + 1}`, () => {
        const p = props({ level });
        render(<Component {...p} />);
        for (const move of config.solution) {
          click(move);
          settle();
        }
        expect(board().dataset.winner).toBe("1");
        expect(board().dataset.turn).toBe("0");
        expect(p.onComplete).toHaveBeenCalledTimes(1);
        expect(
          document.querySelectorAll(
            game === "hex"
              ? "[data-hex-cell]:not(:disabled)"
              : "[data-dots-edge]:not(:disabled)",
          ),
        ).toHaveLength(0);
      });
    it("freezes and preserves the remaining AI delay across repeated pauses", () => {
      const p = props({ level: pendingLevel }),
        view = render(<Component {...p} />);
      click(pendingMove);
      expect(board().dataset.turn).toBe("2");
      const before = serial();
      tick(120);
      view.rerender(<Component {...p} paused />);
      tick(9000);
      expect(serial()).toBe(before);
      view.rerender(<Component {...p} />);
      tick(100);
      view.rerender(<Component {...p} paused />);
      tick(9000);
      view.rerender(<Component {...p} />);
      tick(delay - 221);
      expect(serial()).toBe(before);
      tick(1);
      expect(serial()).not.toBe(before);
    });
    it("undo during a pending AI move restores the full turn and cancels stale work", () => {
      const p = props({ level: pendingLevel }),
        view = render(<Component {...p} />),
        initial = serial();
      click(pendingMove);
      tick(100);
      view.rerender(<Component {...p} undoToken={1} />);
      expect(serial()).toBe(initial);
      tick(10000);
      expect(serial()).toBe(initial);
      expect(board().dataset.turn).toBe("1");
      expect(p.onComplete).not.toHaveBeenCalled();
    });
    it("reset, level replacement, and unmount cancel old callbacks and old tokens", () => {
      const p = props({ level: pendingLevel }),
        view = render(<Component {...p} />),
        initial = serial();
      click(pendingMove);
      tick(200);
      view.rerender(
        <Component {...p} resetToken={1} hintToken={3} undoToken={2} />,
      );
      tick(10000);
      expect(serial()).toBe(initial);
      click(pendingMove);
      view.rerender(<Component {...p} level={1} hintToken={3} undoToken={2} />);
      const replacement = serial();
      tick(10000);
      expect(serial()).toBe(replacement);
      expect(document.querySelectorAll(".is-hinted")).toHaveLength(0);
      click(levels[1].solution[0]);
      view.unmount();
      const calls = vi.mocked(p.onStatus).mock.calls.length;
      tick(10000);
      expect(p.onStatus).toHaveBeenCalledTimes(calls);
    });
    it("consumes paused hints and undo without applying them on resume", () => {
      const p = props({ level: pendingLevel }),
        view = render(<Component {...p} />),
        before = serial();
      view.rerender(<Component {...p} paused hintToken={1} undoToken={1} />);
      click(pendingMove);
      expect(serial()).toBe(before);
      view.rerender(<Component {...p} hintToken={1} undoToken={1} />);
      expect(serial()).toBe(before);
      expect(document.querySelectorAll(".is-hinted")).toHaveLength(0);
    });
    it("provides a current-state hint and rejects repeated click events", () => {
      const p = props(),
        view = render(<Component {...p} />);
      view.rerender(<Component {...p} hintToken={1} />);
      expect(document.querySelectorAll(".is-hinted")).toHaveLength(1);
      const before = serial();
      const selector =
        game === "hex"
          ? HEX_SELECTORS.cell(levels[0].solution[0])
          : DOTS_SELECTORS.edge(levels[0].solution[0]);
      fireEvent.click(document.querySelector(selector)!, { detail: 2 });
      expect(serial()).toBe(before);
      click(levels[0].solution[0]);
      expect(document.querySelectorAll(".is-hinted")).toHaveLength(0);
      if (game === "dots") {
        view.rerender(<Component {...p} hintToken={2} />);
        expect(
          document
            .querySelector(DOTS_SELECTORS.edge(7))
            ?.classList.contains("is-hinted"),
        ).toBe(true);
      }
    });
    it("supports keyboard and idempotent completion under StrictMode, undo, and replay", async () => {
      vi.useRealTimers();
      const user = userEvent.setup(),
        p = props(),
        view = render(
          <StrictMode>
            <Component {...p} />
          </StrictMode>,
        );
      await user.tab();
      expect(document.activeElement?.tagName).toBe("BUTTON");
      for (const move of levels[0].solution) {
        const selector =
          game === "hex" ? HEX_SELECTORS.cell(move) : DOTS_SELECTORS.edge(move);
        (document.querySelector(selector) as HTMLButtonElement).focus();
        await user.keyboard("{Enter}");
      }
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      view.rerender(
        <StrictMode>
          <Component {...p} undoToken={1} />
        </StrictMode>,
      );
      for (const move of levels[0].solution) click(move);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      view.rerender(
        <StrictMode>
          <Component {...p} undoToken={1} resetToken={1} />
        </StrictMode>,
      );
      for (const move of levels[0].solution) click(move);
      expect(p.onComplete).toHaveBeenCalledTimes(2);
    });
  });

describe("Connection games alternate outcomes and live hints", () => {
  it("accepts a different winning Hex route in the actual UI", () => {
    const p = props({ level: 2 });
    render(<HexGarden {...p} />);
    for (const move of [6, 2]) {
      hexClick(move);
      tick(HEX_AI_DELAY);
    }
    expect(hexBoard().dataset.winner).toBe("1");
    expect(p.onComplete).toHaveBeenCalledTimes(1);
  });
  it("a Hex mistake really loses; the current hint admits the lost winning position", () => {
    const p = props({ level: 3 }),
      view = render(<HexGarden {...p} />);
    hexClick(0);
    tick(HEX_AI_DELAY);
    view.rerender(<HexGarden {...p} hintToken={1} />);
    expect(vi.mocked(p.onStatus).mock.calls.at(-1)?.[0]).toContain(
      "已无法必胜",
    );
    expect(
      document
        .querySelector(HEX_SELECTORS.cell(1))
        ?.classList.contains("is-hinted"),
    ).toBe(true);
    hexClick(1);
    tick(HEX_AI_DELAY);
    expect(hexBoard().dataset.winner).toBe("2");
    expect(p.onComplete).not.toHaveBeenCalled();
    view.rerender(<HexGarden {...p} undoToken={1} hintToken={1} />);
    expect(hexBoard().dataset.turn).toBe("1");
  });
  it("accepts a different winning Dots bonus-chain order in the actual UI", () => {
    const p = props();
    render(<DotsAndBoxes {...p} />);
    for (const move of [7, 5]) {
      dotsClick(move);
      settleDots();
    }
    expect(dotsBoard().dataset.winner).toBe("1");
    expect(p.onComplete).toHaveBeenCalledTimes(1);
  });
  it("a true Dots tie never completes, and its current hint reports the achievable tie", () => {
    const p = props({ level: 2 }),
      view = render(<DotsAndBoxes {...p} />);
    dotsClick(10);
    settleDots();
    view.rerender(<DotsAndBoxes {...p} hintToken={1} />);
    expect(vi.mocked(p.onStatus).mock.calls.at(-1)?.[0]).toContain(
      "最多能争取平局",
    );
    dotsClick(9);
    settleDots();
    expect(dotsBoard().dataset.winner).toBe("0");
    expect(dotsBoard().dataset.turn).toBe("0");
    expect(p.onComplete).not.toHaveBeenCalled();
    expect(vi.mocked(p.onStatus).mock.calls.at(-1)?.[0]).toContain("平局");
    view.rerender(<DotsAndBoxes {...p} undoToken={1} hintToken={1} />);
    expect(dotsBoard().dataset.turn).toBe("1");
  });
  it("a losing Dots detour is scored honestly and cannot award a completion", () => {
    const p = props({ level: 2 });
    render(<DotsAndBoxes {...p} />);
    for (const move of [4, 11]) {
      dotsClick(move);
      settleDots();
    }
    expect(dotsBoard().dataset.winner).toBe("2");
    expect(p.onComplete).not.toHaveBeenCalled();
  });
  it("undo in the middle of a Dots AI capture chain also restores all player bonus moves", () => {
    const p = props({ level: 6 }),
      view = render(<DotsAndBoxes {...p} />),
      initial = dotsBoard().dataset.edges;
    for (const edge of [11, 12, 14]) dotsClick(edge);
    tick(DOTS_AI_DELAY);
    expect(dotsBoard().dataset.turn).toBe("2");
    view.rerender(<DotsAndBoxes {...p} undoToken={1} />);
    expect(dotsBoard().dataset.edges).toBe(initial);
    tick(10000);
    expect(dotsBoard().dataset.edges).toBe(initial);
    expect(dotsBoard().dataset.turn).toBe("1");
  });
});
