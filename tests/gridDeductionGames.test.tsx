// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import NonogramGarden from "../src/games/NonogramGarden";
import BoxGarden from "../src/games/BoxGarden";
import type { GameProps } from "../src/lib/types";
import {
  createNonogramState,
  cycleNonogramCell,
  getNonogramHint,
  makeNonogramLevel,
  nonogramLevels,
  nonogramLineOptions,
  nonogramRuns,
  nonogramSolved,
  setNonogramCell,
  solveNonogram,
  solveNonogramLogically,
  undoNonogram,
} from "../src/games/nonogramLogic";
import type { NonogramCell } from "../src/games/nonogramLogic";
import {
  boxDirectionFromKey,
  boxHasCornerDeadlock,
  boxLevels,
  boxNeighbor,
  boxSolved,
  createBoxState,
  makeBoxLevel,
  moveBox,
  searchBoxSolution,
  solveBox,
  undoBox,
} from "../src/games/boxLogic";
import type { BoxDirection } from "../src/games/boxLogic";

afterEach(cleanup);
function props(overrides: Partial<GameProps> = {}): GameProps {
  return {
    level: 0,
    paused: false,
    resetToken: 0,
    hintToken: 0,
    undoToken: 0,
    onComplete: vi.fn(),
    onStatus: vi.fn(),
    ...overrides,
  };
}
function pixel(index: number): HTMLButtonElement {
  return document.querySelector(`[data-nonogram-cell="${index}"]`)!;
}
function playerCell(): number {
  return Number(
    document
      .querySelector('[data-player="true"]')!
      .getAttribute("data-box-cell"),
  );
}
function boxesOnBoard(): number[] {
  return [...document.querySelectorAll('[data-box="true"]')].map((cell) =>
    Number(cell.getAttribute("data-box-cell")),
  );
}

describe("original nonogram level certificates", () => {
  it("has twelve distinct original 5×5, 6×6 and 7×7 pictures", () => {
    expect(nonogramLevels).toHaveLength(12);
    expect(nonogramLevels.map((level) => level.size)).toEqual([
      5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7,
    ]);
    expect(
      new Set(nonogramLevels.map((level) => level.picture.join("/"))).size,
    ).toBe(12);
  });
  for (const [index, level] of nonogramLevels.entries()) {
    it(`level ${index + 1} has exactly one clue solution and a complete no-guess proof`, () => {
      // Deliberately hide the stored solution so solver assertions cannot certify themselves.
      const clueOnly = { ...level, solution: [] };
      const solutions = solveNonogram(clueOnly);
      expect(solutions).toHaveLength(1);
      expect(solutions[0]).toEqual(level.solution);
      const proof = solveNonogramLogically(clueOnly);
      expect(proof.solved).toBe(true);
      expect(proof.board).toEqual(level.solution);
      expect(proof.steps).toHaveLength(level.size ** 2);
      expect(new Set(proof.steps.map((step) => step.index)).size).toBe(
        level.size ** 2,
      );
    });
    it(`level ${index + 1} current-board hints remain valid all the way to completion`, () => {
      let state = createNonogramState(level);
      for (
        let count = 0;
        count < level.size ** 2 && !nonogramSolved(level, state.board);
        count++
      ) {
        const hint = getNonogramHint(level, state.board);
        expect(hint).not.toBeNull();
        expect(hint!.kind).toBe("deduction");
        expect(state.board[hint!.index]).toBe(-1);
        expect(hint!.value).toBe(level.solution[hint!.index]);
        state = setNonogramCell(state, hint!.index, hint!.value);
      }
      expect(nonogramSolved(level, state.board)).toBe(true);
      expect(getNonogramHint(level, state.board)).toBeNull();
    });
  }
  it("detects ambiguous and impossible clue configurations instead of inventing uniqueness", () => {
    const ambiguous = makeNonogramLevel("two diagonals", ["#.", ".#"]);
    expect(solveNonogram(ambiguous)).toHaveLength(2);
    expect(solveNonogramLogically(ambiguous).solved).toBe(false);
    expect(solveNonogram(ambiguous, [1, 1, -1, -1])).toEqual([]);
    expect(solveNonogram(ambiguous, [-1])).toEqual([]);
    expect(nonogramLineOptions(5, [3, 3])).toEqual([]);
    expect(nonogramLineOptions(5, [])).toEqual([[0, 0, 0, 0, 0]]);
    expect(nonogramRuns([1, 1, 0, 1, 0])).toEqual([2, 1]);
  });
});

describe("nonogram editing", () => {
  const level = nonogramLevels[0];
  it("cycles blank, painted, crossed and blank with exact reversible history", () => {
    const initial = createNonogramState(level);
    const painted = cycleNonogramCell(initial, 2);
    const crossed = cycleNonogramCell(painted, 2);
    const blank = cycleNonogramCell(crossed, 2);
    expect([
      initial.board[2],
      painted.board[2],
      crossed.board[2],
      blank.board[2],
    ]).toEqual([-1, 1, 0, -1]);
    expect(undoNonogram(blank)).toEqual(crossed);
    expect(undoNonogram(crossed)).toEqual(painted);
    expect(undoNonogram(painted)).toEqual(initial);
    expect(undoNonogram(initial)).toBe(initial);
    expect(initial.board.every((value) => value === -1)).toBe(true);
  });
  it("ignores invalid coordinates, unchanged values and paused editing", () => {
    const initial = createNonogramState(level);
    for (const index of [-1, 25, 1.5, NaN])
      expect(cycleNonogramCell(initial, index)).toBe(initial);
    expect(setNonogramCell(initial, 0, -1)).toBe(initial);
    expect(cycleNonogramCell(initial, 2, true)).toBe(initial);
    expect(setNonogramCell(initial, 2, 1, true)).toBe(initial);
  });
  it("repairs incorrect paint and incorrect crosses without resetting unrelated work", () => {
    for (const [index, wrong] of [
      [0, 1],
      [2, 0],
    ] as [number, NonogramCell][]) {
      let state = setNonogramCell(createNonogramState(level), 12, 1);
      state = setNonogramCell(state, index, wrong);
      const hint = getNonogramHint(level, state.board)!;
      expect(hint).toMatchObject({ index, value: -1, kind: "repair" });
      const repaired = setNonogramCell(state, index, hint.value);
      expect(repaired.board[12]).toBe(1);
      expect(repaired.board[index]).toBe(-1);
      expect(getNonogramHint(level, repaired.board)!.kind).toBe("deduction");
    }
  });
  it("accepts unmarked empty cells but rejects missing or extra paint", () => {
    const paintedOnly = level.solution.map((value) =>
      value === 1 ? 1 : -1,
    ) as NonogramCell[];
    expect(nonogramSolved(level, paintedOnly)).toBe(true);
    expect(
      nonogramSolved(level, [
        ...paintedOnly.slice(0, 2),
        -1,
        ...paintedOnly.slice(3),
      ]),
    ).toBe(false);
    expect(nonogramSolved(level, [1, ...paintedOnly.slice(1)])).toBe(false);
  });
});

describe("original box level certificates", () => {
  it("has twelve distinct maps with one to three boxes", () => {
    expect(boxLevels).toHaveLength(12);
    expect(new Set(boxLevels.map((level) => level.map.join("/"))).size).toBe(
      12,
    );
    expect(boxLevels.map((level) => level.boxes.length)).toEqual([
      1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3,
    ]);
  });
  for (const [index, level] of boxLevels.entries()) {
    it(`level ${index + 1} certificate is legal, solved and BFS-shortest`, () => {
      let state = createBoxState(level);
      expect(boxSolved(level, state)).toBe(false);
      for (const direction of level.solution) {
        const next = moveBox(level, state, direction);
        expect(next).not.toBe(state);
        state = next;
      }
      expect(boxSolved(level, state)).toBe(true);
      expect(state.moves).toBe(level.solution.length);
      expect(state.pushes).toBeGreaterThan(0);
      const result = searchBoxSolution(level);
      expect(result.status).toBe("solved");
      expect(result.solution!.length).toBe(level.solution.length);
      expect(result.visited).toBeLessThan(120_000);
      // Every undo, including the final delivery, restores the original board exactly.
      while (state.history.length) state = undoBox(state);
      expect(state).toEqual(createBoxState(level));
    });
  }
  it("finds a fresh route after a valid off-certificate detour", () => {
    const level = boxLevels[0];
    const state = moveBox(level, createBoxState(level), "D");
    const solution = solveBox(level, state)!;
    expect(solution[0]).toBe("U");
    expect(
      solution.reduce((s, direction) => moveBox(level, s, direction), state)
        .boxes,
    ).toEqual(level.goals);
  });
  it("distinguishes a real deadlock from its bounded search limit", () => {
    const level = boxLevels[0];
    expect(
      searchBoxSolution(level, { player: 9, boxes: [8], moves: 0, pushes: 0 })
        .status,
    ).toBe("deadlock");
    // Along the bottom wall (not a corner), the box also cannot be pulled back onto the goal row.
    expect(
      searchBoxSolution(level, { player: 10, boxes: [17], moves: 0, pushes: 0 })
        .status,
    ).toBe("deadlock");
    expect(
      searchBoxSolution(boxLevels[11], createBoxState(boxLevels[11]), 2).status,
    ).toBe("limit");
    expect(
      searchBoxSolution(level, {
        player: 11,
        boxes: [...level.goals],
        moves: 3,
        pushes: 2,
      }).solution,
    ).toEqual([]);
  });
});

describe("box transitions", () => {
  it("push and undo restore box, player, counters and history", () => {
    const level = boxLevels[0],
      initial = createBoxState(level);
    const walked = moveBox(level, initial, "R"),
      pushed = moveBox(level, walked, "R");
    expect(walked.pushes).toBe(0);
    expect(pushed.boxes).toEqual([11]);
    expect(pushed.player).toBe(10);
    expect(pushed.pushes).toBe(1);
    expect(undoBox(pushed)).toEqual(walked);
    expect(undoBox(walked)).toEqual(initial);
    expect(undoBox(initial)).toBe(initial);
  });
  it("walls, two-box pushes and paused input do not corrupt state", () => {
    const level = boxLevels[0],
      initial = createBoxState(level);
    expect(moveBox(level, initial, "L")).toBe(initial);
    expect(moveBox(level, initial, "R", true)).toBe(initial);
    const blockedLevel = makeBoxLevel("blocked", [
      "#######",
      "#@$$..#",
      "#######",
    ]);
    const blocked = createBoxState(blockedLevel);
    expect(moveBox(blockedLevel, blocked, "R")).toBe(blocked);
    expect(moveBox(level, initial, "?" as BoxDirection)).toBe(initial);
    expect(initial).toEqual(createBoxState(level));
  });
  it("never wraps across board edges and recognizes keyboard mappings", () => {
    const level = boxLevels[0];
    expect(boxNeighbor(level, 7, "L")).toBeNull();
    expect(boxNeighbor(level, 6, "R")).toBeNull();
    expect(boxNeighbor(level, 0, "U")).toBeNull();
    expect(boxNeighbor(level, 27, "D")).toBeNull();
    expect(boxDirectionFromKey("W")).toBe("U");
    expect(boxDirectionFromKey("ArrowRight")).toBe("R");
    expect(boxDirectionFromKey("Escape")).toBeNull();
    expect(boxHasCornerDeadlock(level, [8])).toBe(true);
    expect(boxHasCornerDeadlock(level, level.goals)).toBe(false);
  });
});

describe("NonogramGarden interaction", () => {
  it("supports touch cycling, arrow focus, direct keyboard marks and undo", () => {
    const initial = props();
    const view = render(<NonogramGarden {...initial} />);
    fireEvent.click(pixel(0));
    expect(pixel(0).dataset.state).toBe("filled");
    fireEvent.click(pixel(0));
    expect(pixel(0).dataset.state).toBe("marked");
    fireEvent.click(pixel(0));
    expect(pixel(0).dataset.state).toBe("blank");
    pixel(0).focus();
    fireEvent.keyDown(pixel(0), { key: "ArrowRight" });
    expect(document.activeElement).toBe(pixel(1));
    fireEvent.keyDown(pixel(1), { key: "F" });
    expect(pixel(1).dataset.state).toBe("filled");
    fireEvent.keyDown(pixel(1), { key: "x" });
    expect(pixel(1).dataset.state).toBe("marked");
    fireEvent.keyDown(pixel(1), { key: "Delete" });
    expect(pixel(1).dataset.state).toBe("blank");
    view.rerender(<NonogramGarden {...initial} undoToken={1} />);
    expect(pixel(1).dataset.state).toBe("marked");
  });
  it("uses hint tokens once, applies a deduction and consumes controls while paused", () => {
    const initial = props({ hintToken: 5, undoToken: 9 });
    const view = render(<NonogramGarden {...initial} />);
    expect(screen.queryByRole("button", { name: "应用这一步" })).toBeNull();
    view.rerender(<NonogramGarden {...initial} hintToken={6} />);
    expect(screen.getByRole("button", { name: "应用这一步" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "应用这一步" }));
    const painted = document.querySelectorAll('[data-state="filled"]').length;
    expect(painted).toBe(1);
    view.rerender(
      <NonogramGarden {...initial} hintToken={7} undoToken={10} paused />,
    );
    fireEvent.click(pixel(0));
    fireEvent.keyDown(pixel(0), { key: "f" });
    expect(document.querySelectorAll('[data-state="filled"]').length).toBe(1);
    expect(pixel(0).disabled).toBe(true);
    view.rerender(<NonogramGarden {...initial} hintToken={7} undoToken={10} />);
    expect(document.querySelectorAll('[data-state="filled"]').length).toBe(1);
    expect(screen.queryByRole("button", { name: "应用这一步" })).toBeNull();
    view.rerender(<NonogramGarden {...initial} hintToken={7} undoToken={11} />);
    expect(document.querySelectorAll('[data-state="filled"]').length).toBe(0);
  });
  it("reports completion once and supports undo, reset and level switches", () => {
    const initial = props();
    const view = render(<NonogramGarden {...initial} />);
    const solution = nonogramLevels[0].solution;
    for (let index = 0; index < solution.length; index++)
      if (solution[index]) fireEvent.click(pixel(index));
    expect(initial.onComplete).toHaveBeenCalledTimes(1);
    expect(pixel(0).disabled).toBe(true);
    view.rerender(<NonogramGarden {...initial} undoToken={1} />);
    expect(pixel(0).disabled).toBe(false);
    fireEvent.click(pixel(solution.lastIndexOf(1)));
    expect(initial.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(<NonogramGarden {...initial} resetToken={1} undoToken={1} />);
    expect(document.querySelectorAll('[data-state="blank"]').length).toBe(25);
    expect(screen.queryByRole("button", { name: "应用这一步" })).toBeNull();
    view.rerender(
      <NonogramGarden {...initial} level={4} resetToken={1} undoToken={1} />,
    );
    expect(document.querySelectorAll('[data-state="blank"]').length).toBe(36);
    expect(screen.getByText("寄给花园的信")).toBeTruthy();
  });
  it("exposes conflict-repair hints and right-click marking", () => {
    const initial = props();
    const view = render(<NonogramGarden {...initial} />);
    fireEvent.contextMenu(pixel(2));
    expect(pixel(2).dataset.state).toBe("marked");
    view.rerender(<NonogramGarden {...initial} hintToken={1} />);
    expect(screen.getByText("先修正一笔")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "应用这一步" }));
    expect(pixel(2).dataset.state).toBe("blank");
  });
});

describe("BoxGarden interaction", () => {
  it("supports touch, keyboard, blocked movement and push-aware undo", () => {
    const initial = props();
    const view = render(<BoxGarden {...initial} />);
    const board = screen.getByRole("group", {
      name: "推箱棋盘，方向键或 WASD 移动",
    });
    fireEvent.click(screen.getByRole("button", { name: "向左移动" }));
    expect(playerCell()).toBe(boxLevels[0].player);
    expect(initial.onStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("这里走不通"),
    );
    fireEvent.keyDown(board, { key: "ArrowRight" });
    expect(playerCell()).toBe(9);
    fireEvent.click(screen.getByRole("button", { name: "向右移动" }));
    expect(boxesOnBoard()).toEqual([11]);
    view.rerender(<BoxGarden {...initial} undoToken={1} />);
    expect(playerCell()).toBe(9);
    expect(boxesOnBoard()).toEqual([10]);
    fireEvent.keyDown(board, { key: "d" });
    expect(boxesOnBoard()).toEqual([11]);
  });
  it("hints use the current board and pause blocks movement, hints and undo", () => {
    const initial = props({ hintToken: 4, undoToken: 8 });
    const view = render(<BoxGarden {...initial} />);
    expect(screen.queryByText("下一步有方向")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "向下移动" }));
    expect(playerCell()).toBe(15);
    view.rerender(<BoxGarden {...initial} hintToken={5} />);
    expect(
      screen.getByRole("button", { name: "向上移动" }).className,
    ).toContain("is-hinted");
    view.rerender(
      <BoxGarden {...initial} hintToken={6} undoToken={9} paused />,
    );
    fireEvent.keyDown(
      screen.getByRole("group", { name: "推箱棋盘，方向键或 WASD 移动" }),
      { key: "ArrowUp" },
    );
    expect(playerCell()).toBe(15);
    expect(
      (screen.getByRole("button", { name: "向上移动" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    view.rerender(<BoxGarden {...initial} hintToken={6} undoToken={9} />);
    expect(playerCell()).toBe(15);
    view.rerender(<BoxGarden {...initial} hintToken={6} undoToken={10} />);
    expect(playerCell()).toBe(8);
  });
  it("completes once, undoes a winning push and fully resets without replaying tokens", () => {
    const initial = props();
    const view = render(<BoxGarden {...initial} />);
    for (let count = 0; count < 3; count++)
      fireEvent.click(screen.getByRole("button", { name: "向右移动" }));
    expect(initial.onComplete).toHaveBeenCalledTimes(1);
    expect(boxesOnBoard()).toEqual([12]);
    view.rerender(<BoxGarden {...initial} undoToken={1} />);
    expect(boxesOnBoard()).toEqual([11]);
    fireEvent.click(screen.getByRole("button", { name: "向右移动" }));
    expect(initial.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <BoxGarden {...initial} undoToken={1} hintToken={3} resetToken={1} />,
    );
    expect(playerCell()).toBe(8);
    expect(boxesOnBoard()).toEqual([10]);
    expect(screen.queryByText("下一步有方向")).toBeNull();
    view.rerender(
      <BoxGarden
        {...initial}
        undoToken={1}
        hintToken={3}
        resetToken={1}
        level={11}
      />,
    );
    expect(boxesOnBoard()).toEqual(boxLevels[11].boxes);
  });
  it("supports tapping an adjacent tile and gives recoverable deadlock feedback", () => {
    const initial = props();
    const view = render(<BoxGarden {...initial} />);
    fireEvent.click(document.querySelector('[data-box-cell="15"]')!);
    expect(playerCell()).toBe(15);
    for (const direction of ["R", "R", "R", "U", "L", "L"] as BoxDirection[]) {
      fireEvent.click(
        document.querySelector(`[data-direction="${direction}"]`)!,
      );
    }
    expect(boxesOnBoard()).toEqual([8]);
    view.rerender(<BoxGarden {...initial} hintToken={1} />);
    expect(screen.getByText("换一条路线")).toBeTruthy();
    expect(initial.onStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("当前箱子已无法全部到家"),
    );
    view.rerender(<BoxGarden {...initial} hintToken={1} undoToken={1} />);
    expect(boxesOnBoard()).toEqual([9]);
    expect(screen.queryByText("换一条路线")).toBeNull();
  });
});
