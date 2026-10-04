import { describe, it, expect } from "vitest";
import {
  hanoiLevels,
  solveHanoi,
  moveDisk,
  hanoiWon,
} from "../src/games/hanoiLogic";
import {
  minesLevels,
  solveMines,
  revealCell,
  adjacentMines,
  neighbors,
  toggleFlag,
  minesWon,
} from "../src/games/minesLogic";
describe("Hanoi", () => {
  hanoiLevels.forEach((level, i) =>
    it(`level ${i + 1} has a valid shortest-path solution`, () => {
      let state = level.start;
      expect(hanoiWon(state, level.disks, level.goal)).toBe(false);
      for (const step of level.solution) {
        const next = moveDisk(state, step.from, step.to);
        expect(next).not.toBeNull();
        state = next!;
      }
      expect(hanoiWon(state, level.disks, level.goal)).toBe(true);
    }),
  );
  it("rejects larger disk on smaller", () =>
    expect(moveDisk([[2], [1], []], 0, 1)).toBeNull());
  it("classic three disks require seven moves", () =>
    expect(solveHanoi([[3, 2, 1], [], []], 2)).toHaveLength(7));
  it("never mutates the input state", () => {
    const pegs: [[number], [], []] = [[1], [], []];
    moveDisk(pegs, 0, 1);
    expect(pegs).toEqual([[1], [], []]);
  });
});
describe("Deductive garden", () => {
  minesLevels.forEach((level, i) =>
    it(`level ${i + 1} can be solved without guessing`, () => {
      expect(solveMines(level).solved).toBe(true);
      expect(new Set(level.mines).size).toBe(level.mines.length);
      expect(adjacentMines(level, level.start)).toBe(0);
      let state = {
        revealed: [] as number[],
        flags: [] as number[],
        failed: false,
      };
      for (const cell of level.solution) state = revealCell(level, state, cell);
      expect(minesWon(level, state)).toBe(true);
    }),
  );
  it("corner has three neighbors", () =>
    expect(neighbors(0, 5)).toHaveLength(3));
  it("flags protect a hidden cell", () => {
    const level = minesLevels[0],
      state = toggleFlag(
        { revealed: [], flags: [], failed: false },
        level.mines[0],
      );
    expect(revealCell(level, state, level.mines[0])).toBe(state);
  });
  it("stone ends current attempt but immutable state permits undo", () => {
    const level = minesLevels[0],
      state = { revealed: [], flags: [], failed: false };
    expect(revealCell(level, state, level.mines[0]).failed).toBe(true);
    expect(state.failed).toBe(false);
  });
});
it("invalid engine coordinates cannot corrupt a game", () => {
  expect(moveDisk([[1], [], []], 1.5, 2)).toBeNull();
  const level = minesLevels[0],
    state = { revealed: [], flags: [], failed: false };
  expect(revealCell(level, state, -1)).toBe(state);
  expect(revealCell(level, state, 999)).toBe(state);
});
