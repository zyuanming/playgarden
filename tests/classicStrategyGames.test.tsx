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
import SeedSowing from "../src/games/SeedSowing";
import NimGarden from "../src/games/NimGarden";
import {
  SOWING_AI_DELAY,
  SOWING_SEARCH_NODES,
  SOWING_SELECTORS,
  chooseSowingMove,
  createSowingState,
  playSowingTurn,
  replySowingTurn,
  searchSowing,
  sowSeeds,
  sowingCertifiedWin,
  sowingLegalMoves,
  sowingLevels,
  sowingTotal,
  sowingWinner,
  sweepSowingBoard,
  undoSowingTurn,
  validSowingBoard,
} from "../src/games/sowingLogic";
import {
  NIM_AI_DELAY,
  NIM_SELECTORS,
  applyNimMove,
  chooseNimMove,
  createNimState,
  nimCertifiedWin,
  nimHint,
  nimLevels,
  nimRemaining,
  nimXor,
  playNimTurn,
  replyNimTurn,
  undoNimTurn,
  validNimPiles,
} from "../src/games/nimLogic";
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
const sowBoard = () => screen.getByTestId("sowing-board");
const nimBoard = () => screen.getByTestId("nim-board");
const sow = (pit: number) =>
  fireEvent.click(document.querySelector(SOWING_SELECTORS.pit(pit))!);
function take(pile: number, amount: number) {
  fireEvent.click(document.querySelector(NIM_SELECTORS.pile(pile))!);
  fireEvent.click(document.querySelector(NIM_SELECTORS.remove(amount))!);
  fireEvent.click(screen.getByTestId("nim-confirm"));
}
function settleSowing() {
  let guard = 0;
  while (sowBoard().dataset.turn === "2" && guard++ < 192)
    tick(SOWING_AI_DELAY);
  expect(guard).toBeLessThan(192);
}
beforeEach(() =>
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }),
);
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Four-pit Kalah rules and certified authored challenges", () => {
  it("exports 12 distinct studies that extend beyond immediate wins", () => {
    expect(sowingLevels).toHaveLength(12);
    expect(new Set(sowingLevels.map((l) => l.board.join(","))).size).toBe(12);
    expect(sowingLevels.map((l) => l.solution.length)).toEqual([
      1, 2, 3, 3, 4, 4, 5, 6, 7, 8, 8, 9,
    ]);
  });
  for (const [index, level] of sowingLevels.entries())
    it(`certifies Kalah challenge ${index + 1} against its real deterministic opponent`, () => {
      expect(validSowingBoard(level.board)).toBe(true);
      expect(sowingWinner(level.board)).toBeNull();
      expect(sowingCertifiedWin(level)).toBe(true);
      const advice = searchSowing(level.board, 1);
      expect(advice.exact).toBe(true);
      expect(advice.outcome).toBe("win");
      expect(advice.move).toBe(level.solution[0]);
      expect(advice.nodes).toBeLessThanOrEqual(SOWING_SEARCH_NODES);
      let state = createSowingState(level);
      const total = sowingTotal(state.board);
      for (const pit of level.solution) {
        state = playSowingTurn(state, pit);
        expect(sowingTotal(state.board)).toBe(total);
        let guard = 0;
        while (state.turn === 2 && guard++ < 192) {
          state = replySowingTurn(state);
          expect(sowingTotal(state.board)).toBe(total);
        }
        expect(guard).toBeLessThan(192);
      }
      expect(state.turn).toBe(0);
      expect(sowingWinner(state.board)).toBe(1);
      expect(state.board[4] + state.board[9]).toBe(total);
    });
  it("sows around the ring and skips only the opposite store on every lap", () => {
    const board = [10, 1, 1, 1, 0, 1, 1, 1, 1, 0];
    const before = [...board];
    const move = sowSeeds(board, 1, 0)!;
    expect(move.path).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0, 1]);
    expect(move.board[9]).toBe(0);
    expect(move.board[4]).toBe(1);
    expect(sowingTotal(move.board)).toBe(sowingTotal(board));
    expect(board).toEqual(before);
    const opponent = sowSeeds([1, 1, 1, 1, 0, 1, 1, 12, 1, 0], 2, 7)!;
    expect(opponent.path).toEqual([8, 9, 0, 1, 2, 3, 5, 6, 7, 8, 9, 0]);
    expect(opponent.board[4]).toBe(0);
    expect(opponent.board[9]).toBe(2);
  });
  it("captures both the last seed and nonempty opposite pit, symmetrically", () => {
    const move = sowSeeds([0, 1, 0, 1, 2, 1, 2, 3, 1, 2], 1, 1)!;
    expect(move.captured).toBe(3);
    expect(move.board[2]).toBe(0);
    expect(move.board[6]).toBe(0);
    expect(move.board[4]).toBe(5);
    const opposite = sowSeeds([1, 2, 3, 1, 2, 0, 1, 0, 1, 2], 2, 6)!;
    expect(opposite.captured).toBe(3);
    expect(opposite.board[7]).toBe(0);
    expect(opposite.board[1]).toBe(0);
    expect(opposite.board[9]).toBe(5);
  });
  it("does not capture when the opposite pit is empty or landing pit was occupied", () => {
    expect(sowSeeds([0, 1, 0, 1, 2, 1, 0, 3, 1, 2], 1, 1)?.captured).toBe(0);
    expect(sowSeeds([0, 1, 1, 1, 2, 1, 2, 3, 1, 2], 1, 1)?.captured).toBe(0);
  });
  it("grants bonus sows to either side but stops immediately when a side empties", () => {
    expect(sowSeeds([1, 0, 0, 1, 0, 1, 0, 0, 1, 0], 1, 3)).toMatchObject({
      turn: 1,
      extraTurn: true,
    });
    expect(sowSeeds([1, 0, 0, 1, 0, 1, 0, 0, 1, 0], 2, 8)).toMatchObject({
      turn: 2,
      extraTurn: true,
    });
    const end = sowSeeds([0, 0, 0, 1, 3, 0, 0, 0, 1, 3], 1, 3)!;
    expect(end.extraTurn).toBe(false);
    expect(end.turn).toBe(0);
    expect(end.swept).toBe(1);
    expect(end.board).toEqual([0, 0, 0, 0, 4, 0, 0, 0, 0, 4]);
    expect(sowingWinner(end.board)).toBe(0);
  });
  it("sweeps the correct owner's row and normalizes ended starting positions", () => {
    const board = [1, 2, 3, 4, 5, 0, 0, 0, 0, 6];
    expect(sweepSowingBoard(board)).toEqual([0, 0, 0, 0, 15, 0, 0, 0, 0, 6]);
    expect(sowingWinner(board)).toBe(1);
    expect(createSowingState({ board }).turn).toBe(0);
    expect(sowingLegalMoves(board, 1)).toEqual([]);
  });
  it("rejects invalid boards, wrong-side pits, empty pits, and malformed moves", () => {
    const board = sowingLevels[0].board;
    for (const pit of [-1, 4, 5, 9, 10, 1.5, NaN, 1])
      expect(sowSeeds(board, 1, pit)).toBeNull();
    expect(validSowingBoard([1])).toBe(false);
    expect(validSowingBoard([-1, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(false);
    expect(validSowingBoard([193, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(false);
    expect(searchSowing([], 1)).toMatchObject({ move: null, exact: false });
  });
  it("conserves seeds through 120 alternative legal games and always reaches the sweep", () => {
    for (let game = 0; game < 120; game++) {
      let state = createSowingState(sowingLevels[game % 12]);
      const total = sowingTotal(state.board);
      let ply = 0;
      while (state.turn && ply < 300) {
        const legal = sowingLegalMoves(state.board, state.turn);
        expect(legal.length).toBeGreaterThan(0);
        const next = sowSeeds(
          state.board,
          state.turn,
          legal[(game + ply) % legal.length],
        )!;
        expect(sowingTotal(next.board)).toBe(total);
        expect(next.board.every((n) => Number.isInteger(n) && n >= 0)).toBe(
          true,
        );
        state = { ...state, board: next.board, turn: next.turn };
        ply++;
      }
      expect(ply).toBeLessThan(300);
      expect(state.board[4] + state.board[9]).toBe(total);
    }
  });
  it("keeps AI work deterministic and bounded, including arbitrary dense boards", () => {
    const board = [8, 7, 6, 5, 0, 5, 6, 7, 8, 0];
    const started = Date.now();
    const first = searchSowing(board, 2);
    expect(Date.now() - started).toBeLessThan(1500);
    expect(first.nodes).toBeLessThanOrEqual(SOWING_SEARCH_NODES);
    expect(first.exact).toBe(false);
    expect(first.outcome).toBe("unknown");
    expect(searchSowing(board, 2)).toEqual(first);
    expect(sowingLegalMoves(board, 2)).toContain(first.move);
    expect(searchSowing(board, 2, 5, 2).nodes).toBeLessThanOrEqual(5);
    expect(
      searchSowing(board, 2, Infinity, Infinity).nodes,
    ).toBeLessThanOrEqual(SOWING_SEARCH_NODES);
    expect(chooseSowingMove(board, 2)).toBe(first.move);
  });
  it("labels exact ties and losses honestly rather than reusing a starting certificate", () => {
    expect(searchSowing([0, 0, 0, 1, 3, 0, 0, 0, 1, 3], 1)).toMatchObject({
      exact: true,
      outcome: "tie",
    });
    expect(searchSowing([0, 0, 0, 1, 0, 0, 0, 0, 1, 8], 1)).toMatchObject({
      exact: true,
      outcome: "loss",
    });
  });
  it("undo restores the full player bonus chain and every opponent bonus response", () => {
    const initial = createSowingState(sowingLevels[2]);
    let state = playSowingTurn(initial, 3);
    state = playSowingTurn(state, 2);
    expect(state.history).toHaveLength(1);
    let replies = 0;
    while (state.turn === 2) {
      state = replySowingTurn(state);
      replies++;
    }
    expect(replies).toBe(3);
    expect(undoSowingTurn(state)).toEqual(initial);
    expect(undoSowingTurn(playSowingTurn(initial, 3))).toEqual(initial);
    expect(undoSowingTurn(initial)).toBe(initial);
  });
  it("ignores paused, wrong-turn, and terminal input without changing history", () => {
    const state = createSowingState(sowingLevels[3]);
    expect(playSowingTurn(state, 1, true)).toBe(state);
    const pending = playSowingTurn(state, 1);
    expect(pending.turn).toBe(2);
    expect(playSowingTurn(pending, 0)).toBe(pending);
    expect(replySowingTurn(state)).toBe(state);
  });
});

describe("Normal-play Nim exact strategy", () => {
  it("has twelve distinct winning setups and progressively longer certificates", () => {
    expect(nimLevels).toHaveLength(12);
    expect(new Set(nimLevels.map((l) => l.piles.join(","))).size).toBe(12);
    expect(nimLevels[0].solution).toHaveLength(1);
    expect(nimLevels.slice(1).every((l) => l.solution.length >= 2)).toBe(true);
    expect(nimLevels.at(-1)?.solution.length).toBeGreaterThanOrEqual(8);
  });
  for (const [index, level] of nimLevels.entries())
    it(`certifies Nim challenge ${index + 1}, leaving zero XOR at each nonterminal player move`, () => {
      expect(nimXor(level.piles)).not.toBe(0);
      expect(nimCertifiedWin(level)).toBe(true);
      let state = createNimState(level);
      for (const move of level.solution) {
        const before = state;
        state = playNimTurn(state, move);
        expect(nimXor(state.piles)).toBe(0);
        expect(nimRemaining(state.piles)).toBe(
          nimRemaining(before.piles) - move.remove,
        );
        state = replyNimTurn(state);
        expect(undoNimTurn(state)).toEqual(before);
      }
      expect(state.winner).toBe(1);
      expect(state.turn).toBe(0);
      expect(nimRemaining(state.piles)).toBe(0);
    });
  it("permits any positive quantity from exactly one pile without mutating input", () => {
    const piles = [2, 5, 7];
    for (let n = 1; n <= 5; n++)
      expect(applyNimMove(piles, { pile: 1, remove: n })).toEqual([
        2,
        5 - n,
        7,
      ]);
    expect(piles).toEqual([2, 5, 7]);
    for (const remove of [-1, 0, 6, 1.2, NaN, Infinity])
      expect(applyNimMove(piles, { pile: 1, remove })).toBeNull();
    for (const pile of [-1, 3, 1.5, NaN])
      expect(applyNimMove(piles, { pile, remove: 1 })).toBeNull();
    expect(validNimPiles([0, 1, 2])).toBe(true);
    expect(validNimPiles([32, 1])).toBe(false);
    expect(validNimPiles([])).toBe(false);
    expect(validNimPiles([-1, 1])).toBe(false);
  });
  it("matches independent exhaustive game-tree solving on all 2,401 four-pile small boards", () => {
    const memo = new Map<string, boolean>();
    function wins(piles: number[]): boolean {
      const key = piles.join(",");
      if (memo.has(key)) return memo.get(key)!;
      for (let pile = 0; pile < piles.length; pile++)
        for (let count = 1; count <= piles[pile]; count++) {
          const next = [...piles];
          next[pile] -= count;
          if (!wins(next)) {
            memo.set(key, true);
            return true;
          }
        }
      memo.set(key, false);
      return false;
    }
    for (let a = 0; a <= 6; a++)
      for (let b = 0; b <= 6; b++)
        for (let c = 0; c <= 6; c++)
          for (let d = 0; d <= 6; d++) {
            const piles = [a, b, c, d],
              winning = wins(piles),
              move = chooseNimMove(piles);
            expect(winning).toBe(nimXor(piles) !== 0);
            if (move) {
              const next = applyNimMove(piles, move)!;
              expect(nimRemaining(next)).toBeLessThan(nimRemaining(piles));
              if (winning) expect(wins(next)).toBe(false);
            } else expect(nimRemaining(piles)).toBe(0);
          }
  });
  it("admits other valid winning moves instead of enforcing a scripted route", () => {
    const piles = [3, 5, 7];
    const alternatives = [
      { pile: 0, remove: 1 },
      { pile: 1, remove: 1 },
      { pile: 2, remove: 1 },
    ];
    for (const move of alternatives)
      expect(nimXor(applyNimMove(piles, move)!)).toBe(0);
  });
  it("explains losing positions, knows terminal boards, and deterministically halves a large pile", () => {
    expect(nimHint([3, 3]).outcome).toBe("loss");
    expect(nimHint([0, 0])).toEqual({ move: null, outcome: "finished" });
    expect(chooseNimMove([6, 6])).toEqual({ pile: 0, remove: 3 });
    expect(chooseNimMove([1])).toEqual({ pile: 0, remove: 1 });
    expect(chooseNimMove([0, 0])).toBeNull();
  });
  it("awards the last stone to the player who took it, including the opponent", () => {
    const state = createNimState({ piles: [1, 2] });
    const lost = replyNimTurn(playNimTurn(state, { pile: 1, remove: 2 }));
    expect(lost.winner).toBe(2);
    expect(lost.turn).toBe(0);
    expect(playNimTurn(lost, { pile: 0, remove: 1 })).toBe(lost);
    expect(replyNimTurn(lost)).toBe(lost);
    expect(undoNimTurn(lost)).toEqual(state);
    expect(playNimTurn(state, { pile: 1, remove: 1 }, true)).toBe(state);
  });
});

describe("Kalah DOM control contract", () => {
  for (const [level, config] of sowingLevels.entries())
    it(`replays every visible sow in level ${level + 1}`, () => {
      const p = props({ level });
      render(<SeedSowing {...p} />);
      for (const pit of config.solution) {
        sow(pit);
        settleSowing();
      }
      expect(sowBoard().dataset.winner).toBe("1");
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        document.querySelectorAll("[data-sowing-pit]:not(:disabled)"),
      ).toHaveLength(0);
    });
  it("accepts a complete alternative winning route rather than enforcing its certificate", () => {
    const p = props({ level: 1 });
    render(<SeedSowing {...p} />);
    for (const pit of [1, 0]) {
      sow(pit);
      settleSowing();
    }
    expect(sowBoard().dataset.winner).toBe("1");
    expect(p.onComplete).toHaveBeenCalledTimes(1);
  });
  it("a real tied alternative route does not complete and can be undone", () => {
    const p = props({ level: 1 });
    const view = render(<SeedSowing {...p} />);
    for (const pit of [1, 2, 0, 1, 2]) {
      sow(pit);
      settleSowing();
    }
    expect(sowBoard().dataset.winner).toBe("0");
    expect(sowBoard().dataset.turn).toBe("0");
    expect(p.onComplete).not.toHaveBeenCalled();
    expect(vi.mocked(p.onStatus).mock.calls.at(-1)?.[0]).toContain("平局");
    view.rerender(<SeedSowing {...p} undoToken={1} />);
    expect(sowBoard().dataset.turn).toBe("1");
  });
  it("a hint after a losing detour admits that the winning position has been lost", () => {
    const p = props({ level: 1 });
    const view = render(<SeedSowing {...p} />);
    sow(0);
    settleSowing();
    view.rerender(<SeedSowing {...p} hintToken={1} />);
    expect(vi.mocked(p.onStatus).mock.calls.at(-1)?.[0]).toContain(
      "已无法必胜",
    );
    expect(
      document
        .querySelector(SOWING_SELECTORS.pit(2))
        ?.classList.contains("is-hinted"),
    ).toBe(true);
  });
  it("freezes the remaining AI delay rather than restarting or running during pause", () => {
    const p = props({ level: 3 });
    const view = render(<SeedSowing {...p} />);
    sow(1);
    const before = sowBoard().dataset.board;
    tick(240);
    view.rerender(<SeedSowing {...p} paused />);
    tick(9000);
    expect(sowBoard().dataset.board).toBe(before);
    expect(
      document.querySelectorAll("[data-sowing-pit]:not(:disabled)"),
    ).toHaveLength(0);
    view.rerender(<SeedSowing {...p} paused={false} />);
    tick(SOWING_AI_DELAY - 241);
    expect(sowBoard().dataset.board).toBe(before);
    tick(1);
    expect(sowBoard().dataset.board).not.toBe(before);
  });
  it("undo during an opponent bonus chain cancels every old timer and restores the full turn", () => {
    const p = props({ level: 2 });
    const view = render(<SeedSowing {...p} />);
    const initial = sowBoard().dataset.board;
    sow(3);
    sow(2);
    tick(SOWING_AI_DELAY);
    expect(sowBoard().dataset.turn).toBe("2");
    view.rerender(<SeedSowing {...p} undoToken={1} />);
    expect(sowBoard().dataset.board).toBe(initial);
    tick(10000);
    expect(sowBoard().dataset.board).toBe(initial);
    expect(p.onComplete).not.toHaveBeenCalled();
  });
  it("reset and level replacement cancel pending work; old hint/undo tokens do not leak", () => {
    const p = props({ level: 3 });
    const view = render(<SeedSowing {...p} />);
    sow(1);
    tick(200);
    view.rerender(
      <SeedSowing {...p} resetToken={1} hintToken={3} undoToken={3} />,
    );
    expect(sowBoard().dataset.board).toBe(sowingLevels[3].board.join(","));
    tick(10000);
    expect(sowBoard().dataset.board).toBe(sowingLevels[3].board.join(","));
    sow(1);
    view.rerender(<SeedSowing {...p} level={5} hintToken={3} undoToken={3} />);
    tick(10000);
    expect(sowBoard().dataset.board).toBe(sowingLevels[5].board.join(","));
    expect(document.querySelectorAll(".csg-sowing-pit.is-hinted")).toHaveLength(
      0,
    );
  });
  it("unmount clears AI work without a late status or completion callback", () => {
    const p = props({ level: 3 });
    const view = render(<SeedSowing {...p} />);
    sow(1);
    view.unmount();
    const statuses = vi.mocked(p.onStatus).mock.calls.length;
    tick(10000);
    expect(p.onStatus).toHaveBeenCalledTimes(statuses);
    expect(p.onComplete).not.toHaveBeenCalled();
  });
  it("guards repeated clicks and recalculates hints from the current bonus-turn board", () => {
    const p = props({ level: 2 });
    const view = render(<SeedSowing {...p} />);
    view.rerender(<SeedSowing {...p} hintToken={1} />);
    expect(
      document
        .querySelector(SOWING_SELECTORS.pit(3))
        ?.classList.contains("is-hinted"),
    ).toBe(true);
    sow(3);
    const after = sowBoard().dataset.board;
    fireEvent.click(document.querySelector(SOWING_SELECTORS.pit(2))!, {
      detail: 2,
    });
    expect(sowBoard().dataset.board).toBe(after);
    view.rerender(<SeedSowing {...p} hintToken={2} />);
    expect(
      document
        .querySelector(SOWING_SELECTORS.pit(2))
        ?.classList.contains("is-hinted"),
    ).toBe(true);
    expect(vi.mocked(p.onStatus).mock.calls.at(-1)?.[0]).toContain("第 3 孔");
  });
  it("completes only once under StrictMode and undo/replay, and supports native keyboard", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const p = props();
    const view = render(
      <StrictMode>
        <SeedSowing {...p} />
      </StrictMode>,
    );
    await user.tab();
    expect(document.activeElement).toBe(
      document.querySelector(SOWING_SELECTORS.pit(0)),
    );
    await user.keyboard("{Enter}");
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <SeedSowing {...p} undoToken={1} />
      </StrictMode>,
    );
    sow(0);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <SeedSowing {...p} resetToken={1} undoToken={1} />
      </StrictMode>,
    );
    sow(0);
    expect(p.onComplete).toHaveBeenCalledTimes(2);
  });
  it("ignores hint and undo tokens while paused and resumes without deferred mutations", () => {
    const p = props({ level: 2 });
    const view = render(<SeedSowing {...p} />);
    sow(3);
    const board = sowBoard().dataset.board;
    view.rerender(<SeedSowing {...p} paused hintToken={1} undoToken={1} />);
    sow(2);
    expect(sowBoard().dataset.board).toBe(board);
    view.rerender(<SeedSowing {...p} hintToken={1} undoToken={1} />);
    expect(sowBoard().dataset.board).toBe(board);
    expect(document.querySelectorAll(".csg-sowing-pit.is-hinted")).toHaveLength(
      0,
    );
  });
});

describe("Nim DOM control contract", () => {
  for (const [level, config] of nimLevels.entries())
    it(`replays all visible pile/quantity selections in level ${level + 1}`, () => {
      const p = props({ level });
      render(<NimGarden {...p} />);
      for (const move of config.solution) {
        take(move.pile, move.remove);
        tick(NIM_AI_DELAY);
      }
      expect(nimBoard().dataset.winner).toBe("1");
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        (screen.getByTestId("nim-confirm") as HTMLButtonElement).disabled,
      ).toBe(true);
    });
  it("separates selection from commit and permits taking an entire nontrivial pile", () => {
    const p = props({ level: 6 });
    render(<NimGarden {...p} />);
    const before = nimBoard().dataset.piles;
    fireEvent.click(document.querySelector(NIM_SELECTORS.pile(3))!);
    fireEvent.click(document.querySelector(NIM_SELECTORS.remove(5))!);
    expect(nimBoard().dataset.piles).toBe(before);
    fireEvent.click(screen.getByTestId("nim-confirm"));
    expect(nimBoard().dataset.piles).toBe("1,2,3,0");
    expect(nimBoard().dataset.turn).toBe("2");
    fireEvent.click(screen.getByTestId("nim-confirm"));
    expect(nimBoard().dataset.piles).toBe("1,2,3,0");
  });
  it("preserves the remaining AI delay across repeated pause/resume interruptions", () => {
    const p = props({ level: 2 });
    const view = render(<NimGarden {...p} />);
    take(1, 1);
    const board = nimBoard().dataset.piles;
    tick(150);
    view.rerender(<NimGarden {...p} paused />);
    tick(2000);
    expect(nimBoard().dataset.piles).toBe(board);
    view.rerender(<NimGarden {...p} />);
    tick(100);
    view.rerender(<NimGarden {...p} paused />);
    tick(2000);
    view.rerender(<NimGarden {...p} />);
    tick(NIM_AI_DELAY - 251);
    expect(nimBoard().dataset.piles).toBe(board);
    tick(1);
    expect(nimBoard().dataset.piles).not.toBe(board);
  });
  it("undo during AI work restores a complete turn and cancels the scheduled reply", () => {
    const p = props({ level: 2 });
    const view = render(<NimGarden {...p} />);
    take(1, 1);
    tick(200);
    view.rerender(<NimGarden {...p} undoToken={1} />);
    tick(5000);
    expect(nimBoard().dataset.piles).toBe("3,4");
    expect(nimBoard().dataset.turn).toBe("1");
    expect(p.onComplete).not.toHaveBeenCalled();
  });
  it("honestly reports a losing current position after a mistake", () => {
    const p = props({ level: 2 });
    const view = render(<NimGarden {...p} />);
    take(0, 1);
    tick(NIM_AI_DELAY);
    expect(nimBoard().dataset.piles).toBe("2,2");
    view.rerender(<NimGarden {...p} hintToken={1} />);
    expect(vi.mocked(p.onStatus).mock.calls.at(-1)?.[0]).toContain(
      "已没有必胜走法",
    );
    expect(screen.getByTestId("nim-confirm").textContent).toContain("1");
    expect(
      document
        .querySelector(NIM_SELECTORS.pile(0))
        ?.classList.contains("is-hinted"),
    ).toBe(true);
  });
  it("marks a current-state winning hint and accepts a different winning move", () => {
    const p = props({ level: 5 });
    const view = render(<NimGarden {...p} />);
    view.rerender(<NimGarden {...p} hintToken={1} />);
    expect(
      document
        .querySelector(NIM_SELECTORS.pile(0))
        ?.classList.contains("is-hinted"),
    ).toBe(true);
    take(2, 1);
    expect(nimBoard().dataset.piles).toBe("3,5,6");
    tick(NIM_AI_DELAY);
    view.rerender(<NimGarden {...p} hintToken={2} />);
    expect(vi.mocked(p.onStatus).mock.calls.at(-1)?.[0]).toContain(
      "异或和变成 0",
    );
  });
  it("reset, level replacement, and unmount discard stale AI work and selections", () => {
    const p = props({ level: 2 });
    const view = render(<NimGarden {...p} />);
    take(1, 1);
    view.rerender(<NimGarden {...p} resetToken={1} />);
    tick(5000);
    expect(nimBoard().dataset.piles).toBe("3,4");
    expect(document.querySelectorAll("[data-nim-remove]")).toHaveLength(0);
    take(1, 1);
    view.rerender(<NimGarden {...p} level={5} />);
    tick(5000);
    expect(nimBoard().dataset.piles).toBe("3,5,7");
    take(0, 1);
    view.unmount();
    const calls = vi.mocked(p.onStatus).mock.calls.length;
    tick(5000);
    expect(p.onStatus).toHaveBeenCalledTimes(calls);
    expect(p.onComplete).not.toHaveBeenCalled();
  });
  it("supports keyboard completion and never reports an opponent win as completion", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const p = props();
    const view = render(<NimGarden {...p} />);
    await user.tab();
    await user.keyboard("{Enter}");
    await user.tab();
    await user.keyboard("{Enter}");
    await user.tab();
    await user.keyboard("{Enter}");
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    view.rerender(<NimGarden {...p} level={1} />);
    take(1, 2);
    tick(NIM_AI_DELAY);
    expect(nimBoard().dataset.winner).toBe("2");
    expect(p.onComplete).toHaveBeenCalledTimes(1);
  });
  it("completes once under StrictMode and undo/replay, with a fresh completion after reset", () => {
    const p = props();
    const view = render(
      <StrictMode>
        <NimGarden {...p} />
      </StrictMode>,
    );
    take(1, 1);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <NimGarden {...p} undoToken={1} />
      </StrictMode>,
    );
    take(1, 1);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <NimGarden {...p} resetToken={1} undoToken={1} />
      </StrictMode>,
    );
    take(1, 1);
    expect(p.onComplete).toHaveBeenCalledTimes(2);
  });
  it("ignores hint, undo, pile and quantity input while paused without applying it later", () => {
    const p = props({ level: 1 });
    const view = render(<NimGarden {...p} />);
    fireEvent.click(document.querySelector(NIM_SELECTORS.pile(1))!);
    view.rerender(<NimGarden {...p} paused hintToken={1} undoToken={1} />);
    fireEvent.click(document.querySelector(NIM_SELECTORS.remove(2))!);
    fireEvent.click(screen.getByTestId("nim-confirm"));
    expect(nimBoard().dataset.piles).toBe("1,2");
    view.rerender(<NimGarden {...p} hintToken={1} undoToken={1} />);
    expect(screen.getByTestId("nim-confirm").textContent).toContain("1");
    expect(document.querySelectorAll(".csg-nim-pile.is-hinted")).toHaveLength(
      0,
    );
  });
});
