// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { GameProps } from "../src/lib/types";
import SlidingTiles from "../src/games/SlidingTiles";
import SudokuGarden from "../src/games/SudokuGarden";
import {
  createSlideState,
  isSlideSolvable,
  isSlideSolved,
  legalSlideMoves,
  moveSlideTile,
  slideArrowTile,
  slideHint,
  slideLevels,
  slideManhattan,
  slideMove,
  undoSlide,
  validSlideBoard,
} from "../src/games/slideLogic";
import {
  createSudokuState,
  isSudokuSolved,
  solveSudoku,
  sudokuCandidates,
  sudokuConflicts,
  sudokuHint,
  sudokuInput,
  sudokuLevels,
  sudokuPeers,
  undoSudoku,
} from "../src/games/sudokuLogic";

afterEach(cleanup);
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
const tileButton = (tile: number) =>
  screen.getByRole("button", { name: new RegExp(`^数字 ${tile}，`) });
const sudokuCell = (index: number) =>
  screen.getByRole("button", {
    name: new RegExp(
      `^第 ${Math.floor(index / 4) + 1} 行第 ${(index % 4) + 1} 列，`,
    ),
  });

describe("Sliding Tiles deterministic levels", () => {
  it("contains 12 distinct puzzles with strictly growing optimal distances", () => {
    expect(slideLevels).toHaveLength(12);
    expect(new Set(slideLevels.map((l) => l.tiles.join(","))).size).toBe(12);
    expect(slideLevels.map((l) => l.par)).toEqual([
      2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24,
    ]);
  });
  slideLevels.forEach((level, index) => {
    it(`level ${index + 1} is solvable by a legal shortest path`, () => {
      expect(isSlideSolved(level.tiles, level.size)).toBe(false);
      expect(isSlideSolvable(level.tiles, level.size)).toBe(true);
      expect(slideManhattan(level.tiles, level.size)).toBe(
        level.solution.length,
      );
      let state = createSlideState(level);
      const original = JSON.stringify(state);
      for (const tile of level.solution) {
        expect(slideHint(state)).toBe(tile);
        expect(legalSlideMoves(state.tiles, state.size)).toContain(tile);
        const old = state;
        state = slideMove(state, tile);
        expect(state).not.toBe(old);
        expect(slideManhattan(state.tiles, state.size)).toBe(
          slideManhattan(old.tiles, level.size) - 1,
        );
      }
      expect(isSlideSolved(state.tiles, state.size)).toBe(true);
      expect(slideHint(state)).toBeNull();
      expect(state.history).toHaveLength(level.solution.length);
      expect(slideMove(state, 1)).toBe(state);
      for (let i = 0; i < level.solution.length; i++) state = undoSlide(state);
      expect(JSON.stringify(state)).toBe(original);
      expect(undoSlide(state)).toBe(state);
    });
    it(`level ${index + 1} can be completed through its buttons exactly once`, () => {
      const input = props({ level: index });
      const view = render(createElement(SlidingTiles, input));
      for (const tile of level.solution) fireEvent.click(tileButton(tile));
      expect(input.onComplete).toHaveBeenCalledOnce();
      view.rerender(createElement(SlidingTiles, { ...input, paused: true }));
      view.rerender(createElement(SlidingTiles, input));
      expect(input.onComplete).toHaveBeenCalledOnce();
    });
  });
  it("rejects invalid board shapes, parity and non-adjacent or blank moves", () => {
    expect(validSlideBoard([1, 1, 0, 2], 2)).toBe(false);
    expect(validSlideBoard([1, 2, 3, 0], 1.5)).toBe(false);
    expect(isSlideSolved([], 3)).toBe(false);
    expect(isSlideSolvable([2, 1, 3, 4, 5, 6, 7, 8, 0], 3)).toBe(false);
    expect(
      isSlideSolvable(
        [2, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0],
        4,
      ),
    ).toBe(false);
    const state = createSlideState(slideLevels[0]);
    for (const value of [0, -1, 99, 1, NaN])
      expect(slideMove(state, value)).toBe(state);
    expect(moveSlideTile([1, 2, 3], 3, 1)).toBeNull();
  });
  it("keeps a legal hint route after many player detours and supports immutable undo", () => {
    for (const level of slideLevels) {
      let state = createSlideState(level);
      const initial = JSON.stringify(state);
      for (let i = 0; i < 15; i++) {
        const moves = legalSlideMoves(state.tiles, state.size);
        if (isSlideSolved(state.tiles, state.size)) break;
        const before = state;
        state = slideMove(state, moves[i % moves.length]);
        expect(undoSlide(state)).toEqual(before);
      }
      expect(JSON.stringify(createSlideState(level))).toBe(initial);
      for (
        let limit = 0;
        !isSlideSolved(state.tiles, state.size) && limit < 100;
        limit++
      ) {
        const hint = slideHint(state)!;
        expect(legalSlideMoves(state.tiles, state.size)).toContain(hint);
        state = slideMove(state, hint);
      }
      expect(isSlideSolved(state.tiles, state.size)).toBe(true);
    }
  });
  it("interprets arrows as blank movement without row wrapping", () => {
    expect(slideArrowTile(slideLevels[0].tiles, 3, "ArrowDown")).toBe(5);
    expect(
      slideArrowTile([1, 2, 0, 3, 4, 5, 6, 7, 8], 3, "ArrowRight"),
    ).toBeNull();
    expect(slideArrowTile(slideLevels[0].tiles, 3, "Enter")).toBeNull();
  });
  it("handles pause, hints, undo, reset, level changes and keyboard controls", () => {
    const input = props();
    const view = render(createElement(SlidingTiles, input));
    const initial =
      view.container.querySelector("[data-number-game]")!.textContent;
    view.rerender(createElement(SlidingTiles, { ...input, paused: true }));
    expect((tileButton(5) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(tileButton(5));
    fireEvent.keyDown(screen.getByRole("group", { name: /数字滑块棋盘/ }), {
      key: "ArrowDown",
    });
    expect(
      view.container.querySelector("[data-number-game]")!.textContent,
    ).toBe(initial);
    view.rerender(createElement(SlidingTiles, { ...input, hintToken: 1 }));
    expect(tileButton(5).className).toContain("number-hinted");
    fireEvent.keyDown(screen.getByRole("group", { name: /数字滑块棋盘/ }), {
      key: "ArrowDown",
    });
    expect(tileButton(5).getAttribute("data-position")).toBe("4");
    view.rerender(
      createElement(SlidingTiles, { ...input, hintToken: 1, undoToken: 1 }),
    );
    expect(tileButton(5).getAttribute("data-position")).toBe("7");
    fireEvent.click(tileButton(5));
    view.rerender(createElement(SlidingTiles, { ...input, resetToken: 1 }));
    expect(tileButton(5).getAttribute("data-position")).toBe("7");
    expect(input.onComplete).not.toHaveBeenCalled();
    view.rerender(createElement(SlidingTiles, { ...input, level: 11 }));
    expect(screen.getByText("十五格大师")).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(15);
    expect(input.onComplete).not.toHaveBeenCalled();
  });
});

describe("Sudoku Garden deterministic levels", () => {
  it("contains 12 distinct puzzles with non-increasing clues", () => {
    expect(sudokuLevels).toHaveLength(12);
    expect(new Set(sudokuLevels.map((l) => l.givens.join(","))).size).toBe(12);
    expect(sudokuLevels.map((l) => l.givens.filter(Boolean).length)).toEqual([
      12, 11, 10, 9, 8, 8, 7, 7, 6, 6, 5, 4,
    ]);
  });
  sudokuLevels.forEach((level, index) => {
    it(`level ${index + 1} has exactly one solution and accepts all required inputs`, () => {
      expect(sudokuConflicts(level.givens)).toEqual([]);
      expect(isSudokuSolved(level, level.givens)).toBe(false);
      expect(solveSudoku(level.givens)).toEqual([level.solution]);
      let state = createSudokuState(level);
      const initial = JSON.stringify(state);
      level.givens.forEach((v, i) => {
        if (v) return;
        expect(sudokuCandidates(state.values, i)).toContain(level.solution[i]);
        const previous = state;
        state = sudokuInput(state, level, i, level.solution[i]);
        expect(undoSudoku(state)).toEqual(previous);
      });
      expect(isSudokuSolved(level, state.values)).toBe(true);
      expect(sudokuHint(level, state.values)).toBeNull();
      expect(sudokuInput(state, level, level.givens.indexOf(0), 0)).toBe(state);
      for (let n = level.givens.filter((v) => !v).length; n > 0; n--)
        state = undoSudoku(state);
      expect(JSON.stringify(state)).toBe(initial);
    });
    it(`level ${index + 1} completes through touch-friendly cells and digit buttons`, () => {
      const input = props({ level: index });
      render(createElement(SudokuGarden, input));
      level.givens.forEach((v, i) => {
        if (v) return;
        fireEvent.click(sudokuCell(i));
        fireEvent.click(
          screen.getByRole("button", { name: `填入 ${level.solution[i]}` }),
        );
      });
      expect(input.onComplete).toHaveBeenCalledOnce();
    });
  });
  it("validates row, column and 2×2 box conflicts without a premature win", () => {
    for (const pair of [
      [0, 3],
      [0, 12],
      [0, 5],
    ]) {
      const values = Array(16).fill(0);
      values[pair[0]] = 2;
      values[pair[1]] = 2;
      expect(sudokuConflicts(values)).toEqual(pair);
      expect(solveSudoku(values)).toEqual([]);
    }
    expect(sudokuPeers(0)).toEqual([1, 2, 3, 4, 5, 8, 12]);
    expect(sudokuPeers(-1)).toEqual([]);
    expect(isSudokuSolved(sudokuLevels[0], Array(16).fill(1))).toBe(false);
    expect(isSudokuSolved(sudokuLevels[0], [])).toBe(false);
    expect(solveSudoku(Array(16).fill(0))).toHaveLength(2);
    expect(solveSudoku([1, 2, 3])).toEqual([]);
    expect(solveSudoku(Array(16).fill(5))).toEqual([]);
    expect(solveSudoku(sudokuLevels[0].givens, 0)).toEqual([]);
    const other = sudokuLevels[0].solution.map((v) => (v % 4) + 1);
    expect(sudokuConflicts(other)).toEqual([]);
    expect(isSudokuSolved(sudokuLevels[0], other)).toBe(false);
  });
  it("protects givens, rejects invalid inputs, stores conflicts, notes and exact undo", () => {
    const level = sudokuLevels[0],
      start = createSudokuState(level),
      blank = level.givens.indexOf(0);
    expect(undoSudoku(start)).toBe(start);
    for (const [index, value] of [
      [0, 2],
      [-1, 2],
      [16, 2],
      [blank, 5],
      [blank, -1],
      [blank, 1.1],
    ])
      expect(sudokuInput(start, level, index, value)).toBe(start);
    const noted = sudokuInput(start, level, blank, 2, true);
    expect(noted.values[blank]).toBe(0);
    expect(noted.notes[blank]).toEqual([2]);
    expect(sudokuInput(noted, level, blank, 2, true).notes[blank]).toEqual([]);
    const filled = sudokuInput(noted, level, blank, 1);
    expect(sudokuConflicts(filled.values)).toContain(blank);
    expect(filled.notes[blank]).toEqual([]);
    expect(undoSudoku(filled)).toEqual(noted);
    const cleared = sudokuInput(filled, level, blank, 0);
    expect(cleared.values[blank]).toBe(0);
    expect(undoSudoku(cleared)).toEqual(filled);
    expect(start.values).toEqual(level.givens);
    expect(start.notes.every((ns) => ns.length === 0)).toBe(true);
    expect(sudokuHint(level, filled.values)).toEqual({
      index: blank,
      value: 2,
      correction: true,
    });
  });
  it("supports notes, digit/delete keys, conflict feedback and hint/undo without winning", () => {
    const input = props();
    const view = render(createElement(SudokuGarden, input));
    const blank = 3;
    fireEvent.click(sudokuCell(blank));
    fireEvent.keyDown(sudokuCell(blank), { key: "n" });
    fireEvent.keyDown(sudokuCell(blank), { key: "2" });
    expect(sudokuCell(blank).getAttribute("data-value")).toBe("0");
    expect(sudokuCell(blank).getAttribute("aria-label")).toContain("笔记 2");
    fireEvent.keyDown(sudokuCell(blank), { key: "n" });
    fireEvent.keyDown(sudokuCell(blank), { key: "1" });
    expect(sudokuCell(blank).getAttribute("aria-invalid")).toBe("true");
    expect(input.onComplete).not.toHaveBeenCalled();
    view.rerender(createElement(SudokuGarden, { ...input, undoToken: 1 }));
    expect(sudokuCell(blank).getAttribute("data-value")).toBe("0");
    expect(sudokuCell(blank).getAttribute("aria-label")).toContain("笔记 2");
    view.rerender(
      createElement(SudokuGarden, { ...input, undoToken: 1, hintToken: 1 }),
    );
    expect(sudokuCell(blank).className).toContain("number-hinted");
    expect(input.onStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("这里可以填 2"),
    );
    fireEvent.keyDown(sudokuCell(blank), { key: "2" });
    expect(sudokuCell(blank).getAttribute("data-value")).toBe("2");
    fireEvent.keyDown(sudokuCell(blank), { key: "Backspace" });
    expect(sudokuCell(blank).getAttribute("data-value")).toBe("0");
    expect(input.onComplete).not.toHaveBeenCalled();
  });
  it("freezes all input while paused, resets notes and values, and changes level cleanly", () => {
    const input = props();
    const view = render(createElement(SudokuGarden, input));
    fireEvent.click(sudokuCell(3));
    fireEvent.keyDown(sudokuCell(3), { key: "2" });
    view.rerender(createElement(SudokuGarden, { ...input, paused: true }));
    expect((sudokuCell(3) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(sudokuCell(3), { key: "Delete" });
    expect(sudokuCell(3).getAttribute("data-value")).toBe("2");
    view.rerender(createElement(SudokuGarden, { ...input, resetToken: 1 }));
    expect(sudokuCell(3).getAttribute("data-value")).toBe("0");
    fireEvent.keyDown(sudokuCell(3), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(sudokuCell(2));
    fireEvent.keyDown(sudokuCell(2), { key: "1" });
    expect(sudokuCell(2).getAttribute("data-value")).toBe("4");
    view.rerender(createElement(SudokuGarden, { ...input, level: 11 }));
    expect(screen.getByText("四角挑战")).toBeTruthy();
    expect(view.container.querySelectorAll('[data-given="true"]')).toHaveLength(
      4,
    );
    expect(input.onComplete).not.toHaveBeenCalled();
  });
});
