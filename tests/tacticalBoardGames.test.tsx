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
import FourInARow from "../src/games/FourInARow";
import ReversiGarden from "../src/games/ReversiGarden";
import {
  emptyConnectBoard,
  connectLevels,
  connectBoardFromMoves,
  connectDrop,
  connectLegalMoves,
  connectWinner,
  connectWinningCells,
  chooseConnectMove,
  connectCertifiedWin,
  connectChallengeHint,
  searchConnectChallenge,
  CONNECT_HINT_AI_LIMIT,
  createConnectState,
  playConnectTurn,
  replyConnectTurn,
  undoConnectTurn,
  type ConnectPiece,
} from "../src/games/connectLogic";
import {
  initialReversiBoard,
  reversiLevels,
  reversiBoardFromMoves,
  reversiFlips,
  reversiPlace,
  reversiLegalMoves,
  reversiNextTurn,
  reversiWinner,
  reversiScore,
  solveReversiEndgame,
  chooseReversiMove,
  reversiCertifiedWin,
  createReversiState,
  playReversiTurn,
  replyReversiTurn,
  undoReversiTurn,
  type ReversiBoard,
  type ReversiPiece,
} from "../src/games/reversiLogic";

const props = (override: Partial<GameProps> = {}): GameProps => ({
  level: 0,
  paused: false,
  resetToken: 0,
  hintToken: 0,
  undoToken: 0,
  onComplete: vi.fn(),
  onStatus: vi.fn(),
  ...override,
});
const tick = (ms = 550) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
const renderedBoard = (container: HTMLElement) =>
  [...container.querySelectorAll("[data-cell]")].map((el) =>
    Number(el.getAttribute("data-piece")),
  );
const drop = (column: number) =>
  fireEvent.click(
    screen.getByRole("button", {
      name: new RegExp(`^第 ${column + 1} 列落子`),
    }),
  );
const place = (index: number, size: number) =>
  fireEvent.click(
    screen.getByRole("button", {
      name: new RegExp(
        `^第 ${Math.floor(index / size) + 1} 行第 ${(index % size) + 1} 列，`,
      ),
    }),
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Four-in-a-row pure rules and authored challenges", () => {
  it("has 12 unique, legal setups with a progressive one-to-four move budget", () => {
    expect(connectLevels).toHaveLength(12);
    expect(
      new Set(connectLevels.map((level) => level.board.join(""))).size,
    ).toBe(12);
    expect(connectLevels.map((level) => level.maxTurns)).toEqual([
      1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4,
    ]);
  });
  for (const [index, level] of connectLevels.entries())
    it(`replays challenge ${index + 1} to a certified win against the real opponent`, () => {
      expect(connectBoardFromMoves(level.startMoves)).toEqual(level.board);
      expect(connectWinner(level.board)).toBeNull();
      expect(level.startMoves.length % 2).toBe(0);
      expect(connectCertifiedWin(level)).toBe(true);
      expect(
        connectChallengeHint(level, level.board, level.maxTurns)?.[0],
      ).toBe(level.solution[0]);
      let state = createConnectState(level);
      for (const column of level.solution) {
        const before = state;
        state = playConnectTurn(state, level, column);
        if (state.turn === 2) state = replyConnectTurn(state);
        expect(undoConnectTurn(state)).toEqual(before);
      }
      expect(connectWinner(state.board)).toBe(1);
    });
  it("drops with gravity, rejects invalid and full columns, and does not mutate input", () => {
    const empty = emptyConnectBoard();
    let board = empty;
    for (let i = 0; i < 6; i++) board = connectDrop(board, 0, i % 2 ? 2 : 1)!;
    expect(empty.every((piece) => piece === 0)).toBe(true);
    expect(board[0]).toBe(2);
    expect(connectLegalMoves(board)).not.toContain(0);
    for (const column of [-1, 0, 7, 1.5, NaN])
      expect(connectDrop(board, column, 1)).toBeNull();
    expect(connectDrop(empty, 4, 1)?.[39]).toBe(1);
  });
  it("recognizes horizontal, vertical and both diagonal wins", () => {
    const lines = [
      [35, 36, 37, 38],
      [16, 23, 30, 37],
      [17, 23, 29, 35],
      [14, 22, 30, 38],
    ];
    for (const line of lines) {
      const board = emptyConnectBoard();
      for (const index of line) board[index] = 1;
      expect(connectWinner(board)).toBe(1);
      expect(connectWinningCells(board)).toEqual(expect.arrayContaining(line));
      expect(connectDrop(board, 6, 2)).toBeNull();
      expect(chooseConnectMove(board)).toBeNull();
    }
  });
  it("detects a full-board tie without a spurious wraparound line", () => {
    const board = [..."112211222112211122112221122111221122211221"].map(
      Number,
    ) as ConnectPiece[];
    expect(board).toHaveLength(42);
    expect(connectWinner(board)).toBe(0);
    expect(connectWinningCells(board)).toEqual([]);
    expect(connectLegalMoves(board)).toEqual([]);
    const noWrap = emptyConnectBoard();
    for (const index of [5, 6, 7, 8]) noWrap[index] = 1;
    expect(connectWinner(noWrap)).toBeNull();
  });
  it("opponent wins immediately, blocks a threat, and makes deterministic choices", () => {
    const board = emptyConnectBoard();
    board[35] = board[36] = board[37] = 2;
    expect(chooseConnectMove(board)).toBe(3);
    board[35] = board[36] = board[37] = 1;
    expect(chooseConnectMove(board)).toBe(3);
    expect(chooseConnectMove(emptyConnectBoard())).toBe(
      chooseConnectMove(emptyConnectBoard()),
    );
  });
  it("bounds every detour hint even if an external caller supplies an unlimited horizon", () => {
    for (const turns of [4, 1000, Infinity, NaN]) {
      const result = searchConnectChallenge(emptyConnectBoard(), turns);
      expect(result.aiEvaluations).toBeLessThanOrEqual(CONNECT_HINT_AI_LIMIT);
      expect(result.exhausted).toBe(true);
      expect(result.solution).toBeNull();
    }
    expect(chooseConnectMove(emptyConnectBoard(), 2, 1000)).toBe(
      chooseConnectMove(emptyConnectBoard()),
    );
  });
  it("guards repeated input, pause and exhausted budgets; undo removes an entire turn", () => {
    const level = connectLevels[3],
      start = createConnectState(level);
    expect(playConnectTurn(start, level, 3, true)).toBe(start);
    const pending = playConnectTurn(start, level, 3);
    expect(pending.turn).toBe(2);
    expect(playConnectTurn(pending, level, 2)).toBe(pending);
    expect(replyConnectTurn(pending, true)).toBe(pending);
    expect(undoConnectTurn(pending)).toEqual(start);
    expect(undoConnectTurn(replyConnectTurn(pending))).toEqual(start);
    const failed = playConnectTurn(
      createConnectState(connectLevels[0]),
      connectLevels[0],
      6,
    );
    expect(failed.turn).toBe(0);
    expect(connectWinner(failed.board)).toBeNull();
    expect(playConnectTurn(failed, connectLevels[0], 3)).toBe(failed);
  });
});

function bruteReversi(board: ReversiBoard, size: number, side: 1 | 2): number {
  const moves = reversiLegalMoves(board, size, side);
  if (!moves.length) {
    if (reversiLegalMoves(board, size, side === 1 ? 2 : 1).length)
      return bruteReversi(board, size, side === 1 ? 2 : 1);
    const score = reversiScore(board);
    return score.player - score.opponent;
  }
  const scores = moves.map((move) =>
    bruteReversi(
      reversiPlace(board, size, move, side)!,
      size,
      side === 1 ? 2 : 1,
    ),
  );
  return side === 1 ? Math.max(...scores) : Math.min(...scores);
}
describe("Reversi pure rules, exact local opponent and authored challenges", () => {
  it("contains 12 unique legal positions, starting small before adding a 6×6 board", () => {
    expect(reversiLevels).toHaveLength(12);
    expect(
      new Set(reversiLevels.map((level) => level.board.join(""))).size,
    ).toBe(12);
    expect(reversiLevels.map((level) => level.size)).toEqual([
      4, 4, 4, 4, 4, 4, 6, 6, 6, 6, 6, 6,
    ]);
    expect(
      reversiLevels.map((level) => reversiScore(level.board).empty),
    ).toEqual([2, 3, 4, 5, 6, 7, 3, 4, 5, 6, 7, 8]);
  });
  for (const [index, level] of reversiLevels.entries())
    it(`certifies challenge ${index + 1}, including the exact adversarial endgame score`, () => {
      expect(reversiBoardFromMoves(level.size, level.startMoves)).toEqual(
        level.board,
      );
      expect(reversiWinner(level.board, level.size)).toBeNull();
      expect(
        reversiLegalMoves(level.board, level.size, 1).length,
      ).toBeGreaterThanOrEqual(2);
      expect(reversiCertifiedWin(level)).toBe(true);
      const best = solveReversiEndgame(level.board, level.size, 1);
      expect(best.move).toBe(level.solution[0]);
      expect(best.score).toBe(bruteReversi(level.board, level.size, 1));
      expect(best.score).toBeGreaterThan(0);
      let state = createReversiState(level),
        aiTurns = 0;
      for (const move of level.solution) {
        const before = state;
        state = playReversiTurn(state, level, move);
        while (state.turn === 2) {
          state = replyReversiTurn(state, level);
          aiTurns++;
        }
        expect(undoReversiTurn(state)).toEqual(before);
      }
      expect(aiTurns).toBeGreaterThan(0);
      expect(state.turn).toBe(0);
      expect(reversiScore(state.board).player).toBeGreaterThanOrEqual(
        level.target,
      );
    });
  it("explicitly refuses unbounded endgame searches outside its eight-empty-cell contract", () => {
    expect(() => solveReversiEndgame(initialReversiBoard(6), 6, 1)).toThrow(
      /eight empty squares/,
    );
    expect(() => solveReversiEndgame(initialReversiBoard(4), 4, 1)).toThrow(
      /eight empty squares/,
    );
  });
  it("starts with four center discs and four legal opening moves", () => {
    expect(reversiScore(initialReversiBoard(4))).toEqual({
      player: 2,
      opponent: 2,
      empty: 12,
    });
    expect(reversiLegalMoves(initialReversiBoard(4), 4, 1)).toEqual([
      1, 4, 11, 14,
    ]);
  });
  it("flips every bracketed direction and never mutates the old position", () => {
    const board: ReversiPiece[] = Array(36).fill(0),
      expected: number[] = [];
    for (const [dr, dc] of [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ]) {
      const adjacent = (2 + dr) * 6 + 2 + dc;
      board[adjacent] = 2;
      expected.push(adjacent);
      board[(2 + 2 * dr) * 6 + 2 + 2 * dc] = 1;
    }
    expect(reversiFlips(board, 6, 14, 1).sort()).toEqual(expected.sort());
    const next = reversiPlace(board, 6, 14, 1)!;
    expect(next[14]).toBe(1);
    expect(expected.every((index) => next[index] === 1)).toBe(true);
    expect(board[14]).toBe(0);
    expect(expected.every((index) => board[index] === 2)).toBe(true);
  });
  it("rejects empty rays, occupied cells, invalid indexes and wraparound", () => {
    const board: ReversiPiece[] = Array(16).fill(0);
    board[4] = 2;
    board[5] = 1;
    expect(reversiFlips(board, 4, 3, 1)).toEqual([]);
    for (const index of [-1, 16, 2.5, 4, NaN])
      expect(reversiPlace(board, 4, index, 1)).toBeNull();
  });
  it("handles forced passes, early game-over, zero-piece losses, and ties", () => {
    const board: ReversiPiece[] = Array(16).fill(1);
    board[0] = 0;
    board[1] = 2;
    expect(reversiLegalMoves(board, 4, 2)).toEqual([]);
    expect(reversiNextTurn(board, 4, 1)).toBe(1);
    expect(reversiWinner(board, 4)).toBeNull();
    expect(chooseReversiMove(board, 4, 2)).toBeNull();
    expect(solveReversiEndgame(board, 4, 2).score).toBe(16);
    const complete = reversiPlace(board, 4, 0, 1)!;
    expect(reversiNextTurn(complete, 4, 1)).toBe(0);
    expect(reversiWinner(complete, 4)).toBe(1);
    expect(reversiWinner(Array(16).fill(2), 4)).toBe(2);
    expect(reversiWinner([...Array(8).fill(1), ...Array(8).fill(2)], 4)).toBe(
      0,
    );
    const sparse: ReversiPiece[] = Array(16).fill(0);
    sparse[0] = 1;
    expect(reversiWinner(sparse, 4)).toBe(1);
    expect(reversiScore(sparse).empty).toBe(15);
  });
  it("guards repeated clicks and pause, and undoes all consecutive opponent replies", () => {
    const level = reversiLevels[8],
      start = createReversiState(level);
    expect(playReversiTurn(start, level, level.solution[0], true)).toBe(start);
    let state = playReversiTurn(start, level, level.solution[0]);
    expect(playReversiTurn(state, level, level.solution[0])).toBe(state);
    expect(replyReversiTurn(state, level, true)).toBe(state);
    while (state.turn === 2) state = replyReversiTurn(state, level);
    const before = state;
    state = playReversiTurn(state, level, level.solution[1]);
    let responses = 0;
    while (state.turn === 2) {
      state = replyReversiTurn(state, level);
      responses++;
    }
    expect(responses).toBe(2);
    expect(undoReversiTurn(state)).toEqual(before);
    expect(undoReversiTurn(state, true)).toBe(state);
  });
});

describe("Tactical games DOM lifecycle and certified wins", () => {
  for (const [index, level] of connectLevels.entries())
    it(`plays Four-in-a-Row challenge ${index + 1} through the UI`, () => {
      const p = props({ level: index });
      const view = render(
        <StrictMode>
          <FourInARow {...p} />
        </StrictMode>,
      );
      let reference = createConnectState(level);
      for (const column of level.solution) {
        drop(column);
        reference = playConnectTurn(reference, level, column);
        expect(renderedBoard(view.container)).toEqual(reference.board);
        if (reference.turn === 2) {
          tick();
          reference = replyConnectTurn(reference);
        }
        expect(renderedBoard(view.container)).toEqual(reference.board);
      }
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      tick(5000);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("status").textContent).toBe("四子成线！");
    });
  for (const [index, level] of reversiLevels.entries())
    it(`plays Reversi challenge ${index + 1} through the UI, including passes`, () => {
      const p = props({ level: index });
      const view = render(
        <StrictMode>
          <ReversiGarden {...p} />
        </StrictMode>,
      );
      let reference = createReversiState(level);
      for (const move of level.solution) {
        place(move, level.size);
        reference = playReversiTurn(reference, level, move);
        expect(renderedBoard(view.container)).toEqual(reference.board);
        while (reference.turn === 2) {
          tick();
          reference = replyReversiTurn(reference, level);
          expect(renderedBoard(view.container)).toEqual(reference.board);
        }
      }
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      tick(5000);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("status").textContent).toBe("花园守住了！");
    });
  for (const game of ["connect", "reversi"] as const) {
    const Component = game === "connect" ? FourInARow : ReversiGarden;
    const levelIndex = game === "connect" ? 3 : 1;
    const config =
      game === "connect"
        ? connectLevels[levelIndex]
        : reversiLevels[levelIndex];
    const makeMove = () =>
      game === "connect"
        ? drop(config.solution[0])
        : place(config.solution[0], 4);
    it(`${game} freezes the remaining AI delay and blocks repeated/paused input`, () => {
      const p = props({ level: levelIndex });
      const view = render(<Component {...p} />);
      makeMove();
      const pending = renderedBoard(view.container);
      makeMove();
      expect(renderedBoard(view.container)).toEqual(pending);
      tick(200);
      view.rerender(<Component {...p} paused />);
      tick(2000);
      makeMove();
      expect(renderedBoard(view.container)).toEqual(pending);
      view.rerender(<Component {...p} />);
      tick(349);
      expect(renderedBoard(view.container)).toEqual(pending);
      tick(1);
      expect(renderedBoard(view.container)).not.toEqual(pending);
      expect(p.onComplete).not.toHaveBeenCalled();
    });
    it(`${game} cancels pending work on undo, reset, level change and unmount`, () => {
      const p = props({ level: levelIndex, hintToken: 8, undoToken: 4 });
      const view = render(<Component {...p} />);
      expect(view.container.querySelector(".is-hinted")).toBeNull();
      makeMove();
      tick(100);
      view.rerender(<Component {...p} undoToken={5} />);
      expect(renderedBoard(view.container)).toEqual(config.board);
      tick(1000);
      expect(renderedBoard(view.container)).toEqual(config.board);
      makeMove();
      tick(100);
      view.rerender(<Component {...p} undoToken={5} resetToken={1} />);
      tick(1000);
      expect(renderedBoard(view.container)).toEqual(config.board);
      makeMove();
      tick(100);
      view.rerender(<Component {...p} level={0} resetToken={1} />);
      const initial =
        game === "connect" ? connectLevels[0].board : reversiLevels[0].board;
      tick(1000);
      expect(renderedBoard(view.container)).toEqual(initial);
      expect(p.onComplete).not.toHaveBeenCalled();
      view.rerender(<Component {...p} />);
      makeMove();
      const calls = vi.mocked(p.onStatus).mock.calls.length;
      view.unmount();
      tick(2000);
      expect(p.onStatus).toHaveBeenCalledTimes(calls);
      expect(p.onComplete).not.toHaveBeenCalled();
    });
    it(`${game} can undo after an AI reply and hints do not move any piece`, () => {
      const p = props({ level: levelIndex });
      const view = render(<Component {...p} />);
      view.rerender(<Component {...p} hintToken={1} />);
      expect(view.container.querySelectorAll(".is-hinted")).toHaveLength(1);
      expect(renderedBoard(view.container)).toEqual(config.board);
      makeMove();
      tick();
      view.rerender(<Component {...p} hintToken={1} undoToken={1} />);
      expect(renderedBoard(view.container)).toEqual(config.board);
      expect(view.container.querySelector(".is-hinted")).toBeNull();
    });
    it(`${game} uses the latest callback without restarting a pending turn`, () => {
      const p = props({ level: levelIndex });
      const view = render(<Component {...p} />);
      makeMove();
      tick(300);
      const fresh = vi.fn();
      view.rerender(<Component {...p} onStatus={fresh} />);
      tick(250);
      expect(screen.getByRole("status").textContent).toBe("轮到你落子");
      expect(fresh).toHaveBeenCalled();
    });
  }
  it("supports real keyboard activation for column controls", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const p = props();
    render(<FourInARow {...p} />);
    screen.getByRole("button", { name: "第 4 列落子" }).focus();
    await user.keyboard("{Enter}");
    expect(p.onComplete).toHaveBeenCalledTimes(1);
  });
  it("supports keyboard activation of legal Reversi cells", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const p = props();
    render(<ReversiGarden {...p} />);
    screen.getByRole("button", { name: /第 4 行第 1 列，可落子/ }).focus();
    await user.keyboard(" ");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
    expect(p.onComplete).toHaveBeenCalledTimes(1);
  });
  it("a Reversi lead below the target is a recoverable challenge failure", () => {
    const p = props({ level: 3 }),
      level = reversiLevels[3];
    const view = render(<ReversiGarden {...p} />);
    // This legal route wins 9–7 but misses this challenge's ten-disc target.
    for (const move of [12, 3, 0]) {
      place(move, 4);
      let guard = 0;
      while (
        screen.getByRole("status").textContent === "对手在思考…" &&
        guard++ < 8
      )
        tick();
    }
    expect(
      reversiScore(renderedBoard(view.container) as ReversiPiece[]).player,
    ).toBe(9);
    expect(screen.getByRole("status").textContent).toBe("再试一次");
    expect(p.onComplete).not.toHaveBeenCalled();
    view.rerender(<ReversiGarden {...p} resetToken={1} />);
    expect(renderedBoard(view.container)).toEqual(level.board);
    for (const move of level.solution) {
      place(move, 4);
      let guard = 0;
      while (
        screen.getByRole("status").textContent === "对手在思考…" &&
        guard++ < 8
      )
        tick();
    }
    expect(p.onComplete).toHaveBeenCalledTimes(1);
  });
  it("DOM undo restores a Reversi turn after two automatic consecutive opponent moves", () => {
    const p = props({ level: 8 }),
      level = reversiLevels[8];
    const view = render(<ReversiGarden {...p} />);
    place(level.solution[0], 6);
    tick();
    const before = renderedBoard(view.container);
    place(level.solution[1], 6);
    tick();
    expect(screen.getByRole("status").textContent).toBe("对手在思考…");
    tick();
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(<ReversiGarden {...p} undoToken={1} />);
    expect(renderedBoard(view.container)).toEqual(before);
    expect(screen.getByRole("status").textContent).toBe("轮到你落子");
    tick(2000);
    expect(renderedBoard(view.container)).toEqual(before);
  });
  it("shows a recoverable loss when the move budget is spent", () => {
    const p = props();
    const view = render(<FourInARow {...p} />);
    drop(6);
    expect(screen.getByRole("status").textContent).toBe("再试一次");
    expect(p.onComplete).not.toHaveBeenCalled();
    expect(vi.mocked(p.onStatus).mock.calls.at(-1)?.[0]).toContain("步数用完");
    view.rerender(<FourInARow {...p} undoToken={1} />);
    drop(3);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
  });
});
