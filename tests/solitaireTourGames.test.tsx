// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GameProps } from "../src/lib/types";
import PegSolitaireGarden from "../src/games/PegSolitaireGarden";
import KnightTourGarden from "../src/games/KnightTourGarden";
import {
  createPegState,
  isPegSolved,
  legalPegMoves,
  movePeg,
  pegCellLabel,
  pegHint,
  pegJumpGeometry,
  pegKeyboardCell,
  pegLevels,
  pegSolutions,
  replayPegCertificate,
  solvePeg,
  undoPeg,
  validPegBoard,
  validPegGeometry,
  verifyPegLevel,
  type PegLevel,
  type PegMove,
  type PegState,
} from "../src/games/pegLogic";
import {
  createKnightState,
  isKnightSolved,
  isKnightStep,
  knightCellLabel,
  knightHint,
  knightKeyboardCell,
  knightLevels,
  knightNextCells,
  knightSolutions,
  moveKnight,
  replayKnightCertificate,
  solveKnight,
  undoKnight,
  validKnightGeometry,
  validKnightPath,
  verifyKnightLevel,
  type KnightLevel,
  type KnightState,
} from "../src/games/knightLogic";

afterEach(cleanup);
const props = (overrides: Partial<GameProps> = {}): GameProps => ({
  level: 0,
  paused: false,
  resetToken: 0,
  hintToken: 0,
  undoToken: 0,
  onStatus: vi.fn(),
  onComplete: vi.fn(),
  ...overrides,
});
const pegCell = (n: number) =>
  document.querySelector<HTMLButtonElement>(`[data-peg-cell="${n}"]`)!;
const knightCell = (n: number) =>
  document.querySelector<HTMLButtonElement>(`[data-knight-cell="${n}"]`)!;
const pegCount = () =>
  Number(document.querySelector("[data-peg-count]")!.textContent);
const knightCount = () =>
  Number(document.querySelector("[data-knight-visited-count]")!.textContent);
function playPegs(level: PegLevel, state: PegState, moves: readonly PegMove[]) {
  for (const [from, over, to] of moves) {
    expect(state.pegs.includes(over)).toBe(true);
    const next = movePeg(level, state, from, to);
    expect(next).not.toBe(state);
    state = next;
  }
  return state;
}
function playKnights(
  level: KnightLevel,
  state: KnightState,
  continuation: readonly number[],
) {
  for (const to of continuation) {
    const next = moveKnight(level, state, to);
    expect(next).not.toBe(state);
    state = next;
  }
  return state;
}

describe("original peg construction and certificates", () => {
  it("has twelve distinct progressive boards, each independently reverse-constructed and replay-certified", () => {
    expect(pegLevels).toHaveLength(12);
    expect(new Set(pegLevels.map((l) => l.title)).size).toBe(12);
    expect(
      new Set(
        pegLevels.map((l) => JSON.stringify([l.holes, l.initial, l.target])),
      ).size,
    ).toBe(12);
    pegLevels.forEach((level, index) => {
      expect(validPegGeometry(level), level.title).toBe(true);
      expect(verifyPegLevel(level), level.title).toBe(true);
      expect(pegSolutions[index]).toEqual(level.solution);
      if (index)
        expect(level.initial.length).toBeGreaterThan(
          pegLevels[index - 1].initial.length,
        );
      const reverse = new Set([level.target]);
      for (const [from, over, to] of [...level.solution].reverse()) {
        expect(pegJumpGeometry(level, from, to)).toEqual([from, over, to]);
        expect(reverse.has(to)).toBe(true);
        expect(reverse.has(from) || reverse.has(over)).toBe(false);
        reverse.delete(to);
        reverse.add(from);
        reverse.add(over);
      }
      expect([...reverse].sort((a, b) => a - b)).toEqual(level.initial);
      const final = replayPegCertificate(level)!;
      expect(isPegSolved(level, final)).toBe(true);
      expect(final.history).toHaveLength(level.initial.length - 1);
    });
  });
  it("preserves every jump invariant, immutable history and valid hint across every certified jump", () => {
    for (const level of pegLevels) {
      let state = createPegState(level);
      for (const [from, over, to] of level.solution) {
        const snapshot = JSON.stringify(state),
          beforeCount = state.pegs.length;
        const hint = pegHint(level, state, 0);
        expect(hint.kind).toBe("move");
        expect(hint.reason).toBe("certificate");
        expect(hint.undoSteps).toBe(0);
        expect(legalPegMoves(level, state.pegs)).toContainEqual(hint.move);
        const next = movePeg(level, state, from, to);
        expect(JSON.stringify(state)).toBe(snapshot);
        expect(next.pegs).toHaveLength(beforeCount - 1);
        expect(next.pegs.includes(from) || next.pegs.includes(over)).toBe(
          false,
        );
        expect(next.pegs.includes(to)).toBe(true);
        expect(undoPeg(next)).toEqual(state);
        state = next;
      }
      expect(pegHint(level, state).kind).toBe("complete");
      expect(movePeg(level, state, level.target, level.target)).toBe(state);
    }
  });
  it("validates board edges, missing middle holes, diagonal and wrapped jumps, occupied destinations and target exactness", () => {
    const level = pegLevels[6],
      state = createPegState(level),
      snapshot = JSON.stringify(state);
    expect(pegJumpGeometry(level, 3, 5)).toBeNull(); // Linear indexes must not wrap across rows.
    expect(pegJumpGeometry(level, 0, 10)).toBeNull();
    expect(pegJumpGeometry(level, -1, 1)).toBeNull();
    expect(pegJumpGeometry(level, 0.5, 2.5)).toBeNull();
    expect(
      pegJumpGeometry(
        { ...level, holes: level.holes.filter((n) => n !== 1) },
        0,
        2,
      ),
    ).toBeNull();
    expect(movePeg(level, state, 1, 2)).toBe(state);
    expect(movePeg(level, state, 0, 2)).toBe(state);
    expect(movePeg(level, state, 12, 14)).toBe(state);
    expect(JSON.stringify(state)).toBe(snapshot);
    expect(isPegSolved(level, { pegs: [level.target] })).toBe(true);
    expect(isPegSolved(level, { pegs: [0] })).toBe(false);
    expect(isPegSolved(level, { pegs: [level.target, level.target] })).toBe(
      false,
    );
    expect(isPegSolved(level, { pegs: [] })).toBe(false);
    expect(validPegBoard(level, [100])).toBe(false);
    expect(validPegBoard(level, [1, 1])).toBe(false);
    expect(validPegGeometry({ ...level, holes: [0, 0, 1] })).toBe(false);
    expect(validPegGeometry({ ...level, width: 30 })).toBe(false);
    expect(validPegGeometry({ ...level, holes: [0, 1, 99] })).toBe(false);
    expect(replayPegCertificate(pegLevels[0], [[0, 2, 2]])).toBeNull();
    expect(
      replayPegCertificate(pegLevels[0], [
        [0, 1, 2],
        [0, 1, 2],
      ]),
    ).toBeNull();
  });
  it("solves every initial layout within the bounded search and replays the returned continuation", () => {
    for (const level of pegLevels) {
      const result = solvePeg(level, level.initial);
      expect(result.kind, level.title).toBe("solved");
      expect(result.visited).toBeLessThanOrEqual(12000);
      expect(
        isPegSolved(
          level,
          playPegs(level, createPegState(level), result.moves!),
        ),
      ).toBe(true);
    }
  });
  it("checks alternatives instead of blindly returning the authored first jump", () => {
    let searchHints = 0,
      undoHints = 0;
    for (const level of pegLevels)
      for (const [from, , to] of legalPegMoves(level, level.initial)) {
        const state = movePeg(level, createPegState(level), from, to);
        if (isPegSolved(level, state)) continue;
        const hint = pegHint(level, state);
        if (hint.kind === "move") {
          const after = movePeg(level, state, hint.move![0], hint.move![2]);
          expect(after).not.toBe(state);
          const continuation = solvePeg(level, after.pegs, 50000);
          expect(continuation.kind).toBe("solved");
          expect(
            isPegSolved(level, playPegs(level, after, continuation.moves!)),
          ).toBe(true);
          if (hint.reason === "search") searchHints++;
        } else {
          expect(hint.kind).toBe("undo");
          expect(hint.undoSteps).toBe(1);
          expect(pegHint(level, undoPeg(state), 0).kind).toBe("move");
          undoHints++;
        }
      }
    expect(searchHints).toBeGreaterThan(0);
    expect(undoHints).toBeGreaterThan(0);
  });
  it("reports budget exhaustion as unknown and offers honest undo to a certified state", () => {
    const level = pegLevels[3],
      state = createPegState(level);
    expect(solvePeg(level, state.pegs, 0)).toEqual({
      kind: "budget",
      moves: null,
      visited: 0,
    });
    expect(solvePeg(level, state.pegs, 1).visited).toBeLessThanOrEqual(1);
    expect(solvePeg(level, [999]).kind).toBe("invalid");
    expect(solvePeg(level, [level.target], 0)).toEqual({
      kind: "solved",
      moves: [],
      visited: 0,
    });
    expect(solvePeg(level, [1], 30).kind).toBe("unsolvable");
    const alternative = legalPegMoves(level, state.pegs).find(
      (m) => m[0] !== level.solution[0][0] || m[2] !== level.solution[0][2],
    )!;
    const changed = movePeg(level, state, alternative[0], alternative[2]);
    const hint = pegHint(level, changed, 0);
    expect(hint).toMatchObject({
      kind: "undo",
      undoSteps: 1,
      reason: "budget",
    });
    expect(
      pegHint(level, { pegs: changed.pegs, history: [] }, 0),
    ).toMatchObject({ kind: "unavailable", reason: "budget" });
  });
  it("has complete undo without mutating saved snapshots and does nothing before the first jump", () => {
    for (const level of pegLevels) {
      const initial = createPegState(level);
      expect(undoPeg(initial)).toBe(initial);
      let state = replayPegCertificate(level)!;
      while (state.history.length) state = undoPeg(state);
      expect(state).toEqual(initial);
    }
  });
});

describe("knight tours, masks and bounded continuations", () => {
  it("certifies all twelve progressive tours including 5×5, 5×6 and 6×6, never a full 4×4", () => {
    expect(knightLevels).toHaveLength(12);
    expect(new Set(knightLevels.map((l) => l.title)).size).toBe(12);
    expect(knightLevels.map((l) => l.cells.length)).toEqual([
      3, 4, 6, 8, 10, 12, 14, 16, 20, 25, 30, 36,
    ]);
    for (const [index, level] of knightLevels.entries()) {
      expect(validKnightGeometry(level)).toBe(true);
      expect(verifyKnightLevel(level), level.title).toBe(true);
      expect(knightSolutions[index]).toEqual(level.solution);
      expect(isKnightSolved(level, replayKnightCertificate(level)!)).toBe(true);
      expect(
        level.width === 4 && level.height === 4 && level.cells.length === 16,
      ).toBe(false);
      expect(new Set(level.solution).size).toBe(level.cells.length);
    }
  });
  it("every step is L-shaped, stays on the mask, never revisits and has a certified hint", () => {
    for (const level of knightLevels) {
      let state = createKnightState(level);
      for (const to of level.solution.slice(1)) {
        const before = JSON.stringify(state),
          from = state.path.at(-1)!;
        const hint = knightHint(level, state, 0);
        expect(hint).toMatchObject({
          kind: "move",
          cell: to,
          undoSteps: 0,
          reason: "certificate",
        });
        expect(knightNextCells(level, state)).toContain(to);
        expect(isKnightStep(level, from, to)).toBe(true);
        expect(level.cells).toContain(to);
        expect(state.path).not.toContain(to);
        const next = moveKnight(level, state, to);
        expect(JSON.stringify(state)).toBe(before);
        expect(undoKnight(next)).toEqual(state);
        expect(new Set(next.path).size).toBe(next.path.length);
        state = next;
      }
      expect(knightHint(level, state).kind).toBe("complete");
      expect(knightNextCells(level, state)).toEqual([]);
      expect(moveKnight(level, state, level.start)).toBe(state);
    }
  });
  it("refuses invalid/revisited squares and board-edge wrapping but can jump over masked ground", () => {
    const level = knightLevels[0],
      state = createKnightState(level);
    expect(isKnightStep(level, 0, 7)).toBe(true);
    expect(level.cells.includes(1)).toBe(false);
    expect(moveKnight(level, state, 1)).toBe(state);
    expect(moveKnight(level, state, -1)).toBe(state);
    expect(moveKnight(level, state, 7.5)).toBe(state);
    expect(moveKnight(level, state, 2)).toBe(state);
    const next = moveKnight(level, state, 7);
    expect(moveKnight(level, next, 0)).toBe(next);
    const full = knightLevels[11];
    expect(isKnightStep(full, 5, 12)).toBe(false); // +7 can wrap and is not always a knight jump.
    expect(isKnightStep(full, 0, 35)).toBe(false);
    expect(validKnightPath(level, [0, 7, 0])).toBe(false);
    expect(validKnightPath(level, [7, 0, 2])).toBe(false);
    expect(validKnightPath(level, [])).toBe(false);
    expect(validKnightPath(level, [0, 7, 2, 100])).toBe(false);
    expect(isKnightSolved(level, { path: [0, 7, 0] })).toBe(false);
    expect(isKnightSolved(level, { path: [0, 7] })).toBe(false);
    expect(validKnightGeometry({ ...level, cells: [0, 0] })).toBe(false);
    expect(validKnightGeometry({ ...level, width: 7, height: 7 })).toBe(false);
    expect(validKnightGeometry({ ...level, cells: [0, 9] })).toBe(false);
    expect(replayKnightCertificate(level, [7, 0, 2])).toBeNull();
    expect(replayKnightCertificate(level, [0, 7, 0])).toBeNull();
  });
  it("finds and replays a bounded solution for all starting boards", () => {
    for (const level of knightLevels) {
      const result = solveKnight(level, [level.start]);
      expect(result.kind, level.title).toBe("solved");
      expect(result.visited).toBeLessThanOrEqual(10000);
      expect(
        isKnightSolved(
          level,
          playKnights(level, createKnightState(level), result.continuation!),
        ),
      ).toBe(true);
    }
  });
  it("checks every first alternative and supports genuine off-certificate completions", () => {
    let alternativeSolutions = 0,
      recovery = 0;
    for (const level of knightLevels)
      for (const to of knightNextCells(level, createKnightState(level))) {
        const state = moveKnight(level, createKnightState(level), to);
        const hint = knightHint(level, state);
        if (hint.kind === "move") {
          const after = moveKnight(level, state, hint.cell!);
          const result = solveKnight(level, after.path, 50000);
          expect(result.kind, `${level.title} to ${to}`).toBe("solved");
          expect(
            isKnightSolved(
              level,
              playKnights(level, after, result.continuation!),
            ),
          ).toBe(true);
          if (to !== level.solution[1]) alternativeSolutions++;
        } else {
          expect(hint.kind).toBe("undo");
          expect(hint.undoSteps).toBe(1);
          expect(knightHint(level, undoKnight(state), 0).kind).toBe("move");
          recovery++;
        }
      }
    expect(alternativeSolutions).toBeGreaterThan(0);
    expect(recovery).toBeGreaterThan(0);
  });
  it("never calls budget exhaustion an impossibility, and limits work even at zero or one node", () => {
    const level = knightLevels[11],
      initial = createKnightState(level);
    expect(solveKnight(level, initial.path, 0)).toEqual({
      kind: "budget",
      continuation: null,
      visited: 0,
    });
    expect(solveKnight(level, initial.path, 1)).toMatchObject({
      kind: "budget",
      visited: 1,
    });
    expect(solveKnight(level, [999], 0).kind).toBe("invalid");
    expect(solveKnight(level, level.solution, 0)).toEqual({
      kind: "solved",
      continuation: [],
      visited: 0,
    });
    const alternative = knightNextCells(level, initial).find(
      (n) => n !== level.solution[1],
    )!;
    const changed = moveKnight(level, initial, alternative);
    expect(knightHint(level, changed, 0)).toMatchObject({
      kind: "undo",
      undoSteps: 1,
      reason: "budget",
    });
    const impossible: KnightLevel = {
      ...level,
      width: 3,
      height: 3,
      start: 0,
      cells: [0, 1, 7],
      solution: [0, 7, 1],
    };
    expect(verifyKnightLevel(impossible)).toBe(false);
    expect(solveKnight(impossible, [0], 100).kind).toBe("unsolvable");
    expect(knightHint(impossible, { path: [0] }, 0)).toMatchObject({
      kind: "unavailable",
      reason: "budget",
    });
  });
  it("undoes all moves to the fixed start, without undoing or changing the start itself", () => {
    for (const level of knightLevels) {
      let state = replayKnightCertificate(level)!;
      while (state.path.length > 1) state = undoKnight(state);
      expect(state).toEqual(createKnightState(level));
      expect(undoKnight(state)).toBe(state);
    }
  });
});

describe("touch, keyboard and game shell lifecycle", () => {
  it.each(pegLevels.map((_, level) => [level]))(
    "completes peg level %i using source/destination clicks exactly once",
    (level) => {
      const p = props({ level });
      const { rerender } = render(
        <StrictMode>
          <PegSolitaireGarden {...p} />
        </StrictMode>,
      );
      for (const [from, , to] of pegLevels[level].solution) {
        // A landed peg remains selected to allow a natural chain jump.
        if (pegCell(from).getAttribute("data-peg-selected") !== "true")
          fireEvent.click(pegCell(from));
        fireEvent.click(pegCell(to));
      }
      expect(pegCount()).toBe(1);
      expect(
        pegCell(pegLevels[level].target).getAttribute("data-peg-occupied"),
      ).toBe("true");
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      fireEvent.click(pegCell(pegLevels[level].target));
      rerender(
        <StrictMode>
          <PegSolitaireGarden {...p} hintToken={1} />
        </StrictMode>,
      );
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    },
  );
  it.each(knightLevels.map((_, level) => [level]))(
    "completes knight level %i using click/touch targets exactly once",
    (level) => {
      const p = props({ level });
      const { rerender } = render(
        <StrictMode>
          <KnightTourGarden {...p} />
        </StrictMode>,
      );
      for (const to of knightLevels[level].solution.slice(1))
        fireEvent.click(knightCell(to));
      expect(knightCount()).toBe(knightLevels[level].cells.length);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      fireEvent.click(knightCell(knightLevels[level].start));
      rerender(
        <StrictMode>
          <KnightTourGarden {...p} hintToken={1} />
        </StrictMode>,
      );
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    },
  );
  it("peg pause consumes command tokens without changing state; undo, reset and level switch restore real state", () => {
    const p = props({ level: 3 });
    const { rerender } = render(<PegSolitaireGarden {...p} />);
    fireEvent.click(pegCell(6));
    fireEvent.click(pegCell(0));
    expect(pegCount()).toBe(4);
    rerender(<PegSolitaireGarden {...p} paused hintToken={1} undoToken={1} />);
    expect(pegCell(0).disabled).toBe(true);
    fireEvent.click(pegCell(2));
    expect(pegCount()).toBe(4);
    rerender(<PegSolitaireGarden {...p} hintToken={1} undoToken={1} />);
    expect(pegCount()).toBe(4); // Paused commands must not be queued.
    rerender(<PegSolitaireGarden {...p} hintToken={1} undoToken={2} />);
    expect(pegCount()).toBe(5);
    expect(pegCell(6).getAttribute("data-peg-occupied")).toBe("true");
    expect(pegCell(0).getAttribute("data-peg-occupied")).toBe("false");
    fireEvent.click(pegCell(6));
    fireEvent.click(pegCell(0));
    rerender(
      <PegSolitaireGarden {...p} resetToken={1} hintToken={1} undoToken={2} />,
    );
    expect(pegCount()).toBe(5);
    rerender(
      <PegSolitaireGarden
        {...p}
        level={1}
        resetToken={1}
        hintToken={1}
        undoToken={2}
      />,
    );
    expect(pegCount()).toBe(3);
    expect(document.querySelector("[data-peg-hinted=true]")).toBeNull();
    expect(p.onComplete).not.toHaveBeenCalled();
  });
  it("knight pause, repeated clicks, true undo, reset and level switch preserve the fixed starting contract", () => {
    const p = props({ level: 5 });
    const { rerender } = render(<KnightTourGarden {...p} />);
    fireEvent.click(knightCell(7));
    fireEvent.click(knightCell(7));
    expect(knightCount()).toBe(2);
    expect(
      document.querySelector("[data-knight-feedback]")!.textContent,
    ).toContain("已经有脚印");
    rerender(<KnightTourGarden {...p} paused hintToken={1} undoToken={1} />);
    expect(knightCell(2).disabled).toBe(true);
    fireEvent.click(knightCell(2));
    expect(knightCount()).toBe(2);
    rerender(<KnightTourGarden {...p} hintToken={1} undoToken={1} />);
    expect(knightCount()).toBe(2);
    rerender(<KnightTourGarden {...p} hintToken={1} undoToken={2} />);
    expect(knightCount()).toBe(1);
    expect(knightCell(7).getAttribute("data-knight-order")).toBe("0");
    fireEvent.click(knightCell(7));
    rerender(
      <KnightTourGarden {...p} resetToken={1} hintToken={1} undoToken={2} />,
    );
    expect(knightCount()).toBe(1);
    rerender(
      <KnightTourGarden
        {...p}
        level={3}
        resetToken={1}
        hintToken={1}
        undoToken={2}
      />,
    );
    expect(knightCell(2).getAttribute("data-knight-current")).toBe("true");
    expect(p.onComplete).not.toHaveBeenCalled();
  });
  it("hints describe and highlight the actual next move without performing it", () => {
    const p = props({ level: 3 });
    const { rerender, unmount } = render(<PegSolitaireGarden {...p} />);
    rerender(<PegSolitaireGarden {...p} hintToken={1} />);
    expect(pegCount()).toBe(5);
    expect(pegCell(6).getAttribute("data-peg-hinted")).toBe("true");
    expect(pegCell(0).getAttribute("data-peg-hinted")).toBe("true");
    expect(p.onStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("已验证"),
    );
    unmount();
    const q = props({ level: 5 });
    const knight = render(<KnightTourGarden {...q} />);
    knight.rerender(<KnightTourGarden {...q} hintToken={1} />);
    expect(knightCount()).toBe(1);
    expect(knightCell(7).getAttribute("data-knight-hinted")).toBe("true");
    expect(q.onStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("已验证"),
    );
  });
  it("rejects invalid clicks with clear feedback and keeps the board unchanged", () => {
    const p = props({ level: 3 });
    const { unmount } = render(<PegSolitaireGarden {...p} />);
    fireEvent.click(pegCell(0));
    expect(
      document.querySelector("[data-peg-feedback]")!.textContent,
    ).toContain("请先点");
    fireEvent.click(pegCell(1));
    fireEvent.click(pegCell(8));
    expect(pegCount()).toBe(5);
    expect(
      document.querySelector("[data-peg-feedback]")!.textContent,
    ).toContain("不能跳");
    fireEvent.click(pegCell(1));
    expect(pegCell(1).getAttribute("data-peg-selected")).toBe("false");
    unmount();
    render(<KnightTourGarden {...props({ level: 5 })} />);
    fireEvent.click(knightCell(2));
    expect(knightCount()).toBe(1);
    expect(
      document.querySelector("[data-knight-feedback]")!.textContent,
    ).toContain("不是一个 L");
    fireEvent.click(knightCell(0));
    expect(
      document.querySelector("[data-knight-feedback]")!.textContent,
    ).toContain("已经有脚印");
  });
  it("both grids have arrow/home/end focus navigation, including masks and edges", () => {
    const peg = pegLevels[1],
      knight = knightLevels[0];
    expect(pegKeyboardCell(peg, 0, "ArrowDown")).toBe(0);
    expect(pegKeyboardCell(peg, 2, "ArrowDown")).toBe(5);
    expect(pegKeyboardCell(peg, 2, "ArrowRight")).toBe(2);
    expect(pegKeyboardCell(peg, 8, "Home")).toBe(0);
    expect(pegKeyboardCell(peg, 0, "End")).toBe(8);
    expect(pegKeyboardCell(peg, 2, "Enter")).toBe(2);
    expect(knightKeyboardCell(knight, 0, "ArrowRight")).toBe(2); // Skip masked B1.
    expect(knightKeyboardCell(knight, 2, "ArrowDown")).toBe(2);
    expect(knightKeyboardCell(knight, 7, "Home")).toBe(0);
    expect(knightKeyboardCell(knight, 0, "End")).toBe(7);
    expect(knightKeyboardCell(knight, 0, "ArrowLeft")).toBe(0);
    expect(knightCellLabel(knight, 7)).toBe("B3");
    expect(pegCellLabel(peg, 8)).toBe("C3");
  });
  it("is fully playable with keyboard focus plus Enter/Space and keeps masked squares out of tab order", async () => {
    const user = userEvent.setup(),
      p = props();
    const { unmount } = render(<PegSolitaireGarden {...p} />);
    pegCell(0).focus();
    await user.keyboard("{Enter}{ArrowRight}{ArrowRight} ");
    expect(document.activeElement).toBe(pegCell(2));
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    unmount();
    const q = props();
    render(<KnightTourGarden {...q} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    knightCell(0).focus();
    await user.keyboard("{End}{Enter}{Home}{ArrowRight}{Enter}");
    expect(q.onComplete).toHaveBeenCalledTimes(1);
  });
  it("can undo a completed component state without emitting completion twice, and reset allows a new completion", () => {
    const p = props(),
      { rerender, unmount } = render(<PegSolitaireGarden {...p} />);
    fireEvent.click(pegCell(0));
    fireEvent.click(pegCell(2));
    rerender(<PegSolitaireGarden {...p} undoToken={1} />);
    expect(pegCount()).toBe(2);
    fireEvent.click(pegCell(0));
    fireEvent.click(pegCell(2));
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    rerender(<PegSolitaireGarden {...p} undoToken={1} resetToken={1} />);
    fireEvent.click(pegCell(0));
    fireEvent.click(pegCell(2));
    expect(p.onComplete).toHaveBeenCalledTimes(2);
    unmount();
    const q = props(),
      knight = render(<KnightTourGarden {...q} />);
    fireEvent.click(knightCell(7));
    fireEvent.click(knightCell(2));
    knight.rerender(<KnightTourGarden {...q} undoToken={1} />);
    expect(knightCount()).toBe(2);
    fireEvent.click(knightCell(2));
    expect(q.onComplete).toHaveBeenCalledTimes(1);
    knight.rerender(<KnightTourGarden {...q} resetToken={1} undoToken={1} />);
    fireEvent.click(knightCell(7));
    fireEvent.click(knightCell(2));
    expect(q.onComplete).toHaveBeenCalledTimes(2);
  });
});
