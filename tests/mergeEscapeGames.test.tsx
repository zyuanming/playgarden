// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import MergeGarden from "../src/games/MergeGarden";
import TrafficEscape from "../src/games/TrafficEscape";
import {
  createMergeState,
  isMergeGameOver,
  isMergeWon,
  legalMergeMoves,
  mergeDirectionLabels,
  mergeHint,
  mergeLevels,
  mergeLine,
  mergeMove,
  nextMergeSeed,
  nextMergeValue,
  slideMergeBoard,
  spawnMergeTile,
  undoMerge,
  validMergeBoard,
} from "../src/games/mergeLogic";
import {
  createTrafficState,
  isTrafficSolved,
  legalTrafficMoves,
  moveTrafficVehicle,
  solveTraffic,
  trafficHint,
  trafficLevels,
  trafficMove,
  undoTraffic,
  validTrafficBoard,
  type TrafficLevel,
} from "../src/games/trafficLogic";

afterEach(cleanup);
const props = () => ({
  level: 0,
  paused: false,
  resetToken: 0,
  hintToken: 0,
  undoToken: 0,
  onComplete: vi.fn(),
  onStatus: vi.fn(),
});
const mergeBoard = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("[data-merge-cell]"), (tile) =>
    Number(tile.getAttribute("data-value")),
  );
const trafficPositions = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("[data-vehicle]"), (car) =>
    Number(car.getAttribute("data-position")),
  );
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

describe("original seeded merge rules", () => {
  it.each(mergeLevels.map((level, index) => [index + 1, level] as const))(
    "certifies challenge %i without a no-op, and every hint remains legal",
    (_index, level) => {
      expect(validMergeBoard(level.board)).toBe(true);
      expect(isMergeWon(level.board, level.target)).toBe(false);
      let state = createMergeState(level);
      for (const direction of level.solution) {
        expect(mergeHint(state)).toEqual({ kind: "move", direction });
        expect(legalMergeMoves(state.board)).toContain(direction);
        const previous = state;
        state = mergeMove(deepFreeze(state), direction);
        expect(state).not.toBe(previous);
        expect(validMergeBoard(state.board)).toBe(true);
      }
      expect(isMergeWon(state.board, level.target)).toBe(true);
      expect(state.history).toHaveLength(level.solution.length);
      expect(mergeHint(state)).toEqual({ kind: "finished" });
      expect(mergeMove(state, "left")).toBe(state);
      const replay = level.solution.reduce(mergeMove, createMergeState(level));
      expect(replay).toEqual(state);
      while (state.history.length) state = undoMerge(state);
      expect(state).toEqual(createMergeState(level));
    },
  );
  it("merges a tile only once, preserves gaps correctly and adds merge scores", () => {
    expect(mergeLine([2, 2, 4, 0])).toEqual({ line: [4, 4, 0, 0], score: 4 });
    expect(mergeLine([2, 2, 2, 2])).toEqual({ line: [4, 4, 0, 0], score: 8 });
    expect(mergeLine([4, 0, 4, 4])).toEqual({ line: [8, 4, 0, 0], score: 8 });
    const board = [2, 2, 4, 4, ...Array(12).fill(0)];
    expect(slideMergeBoard(board, "right").board.slice(0, 4)).toEqual([
      0, 0, 4, 8,
    ]);
    expect(
      slideMergeBoard([2, 0, 0, 0, 2, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0], "down")
        .board,
    ).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 8, 0, 0, 0]);
  });
  it("does not consume spawns or history for a no-op", () => {
    const state = {
      ...createMergeState(mergeLevels[0]),
      board: [2, 0, 0, 0, ...Array(12).fill(0)],
    };
    expect(mergeMove(deepFreeze(state), "left")).toBe(state);
    expect(mergeMove(state, "up")).toBe(state);
    expect(undoMerge(state)).toBe(state);
    const moved = mergeMove(state, "right");
    expect(moved.seed).toBe(nextMergeSeed(state.seed));
    expect(moved.board.filter(Boolean)).toHaveLength(2);
    expect(moved.board[moved.spawned!]).toBe(nextMergeValue(state.seed));
    expect(undoMerge(moved)).toEqual(state);
    expect(mergeMove(undoMerge(moved), "right")).toEqual(moved);
  });
  it("recognizes a full stuck board, while a full board with a pair still plays", () => {
    const blocked = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
    expect(isMergeGameOver(blocked)).toBe(true);
    expect(legalMergeMoves(blocked)).toEqual([]);
    expect(spawnMergeTile(blocked, 17)).toEqual({
      board: blocked,
      seed: 17,
      index: null,
    });
    const playable = [...blocked];
    playable[1] = 2;
    expect(isMergeGameOver(playable)).toBe(false);
    expect(validMergeBoard([3, ...Array(15).fill(0)])).toBe(false);
    expect(validMergeBoard([2, 2])).toBe(false);
  });
  it.each(mergeLevels.map((level, index) => [index + 1, level] as const))(
    "gives truthful current-state recovery after a detour in challenge %i",
    (_index, level) => {
      const start = createMergeState(level);
      for (const direction of legalMergeMoves(start.board)) {
        let detour = mergeMove(start, direction),
          hint = mergeHint(detour);
        if (hint.kind === "undo") {
          expect(hint.steps).toBeGreaterThan(0);
          for (let count = 0; count < hint.steps; count++)
            detour = undoMerge(detour);
          expect(detour).toEqual(start);
        }
        let count = 0;
        while (!isMergeWon(detour.board, level.target) && count++ < 20) {
          hint = mergeHint(detour);
          expect(hint.kind).toBe("move");
          if (hint.kind === "move") detour = mergeMove(detour, hint.direction);
        }
        expect(isMergeWon(detour.board, level.target)).toBe(true);
      }
    },
  );
});

describe("original traffic puzzles and current-state BFS", () => {
  it.each(trafficLevels.map((level, index) => [index + 1, level] as const))(
    "certifies original board %i and its exported shortest route",
    (_index, level) => {
      expect(validTrafficBoard(level)).toBe(true);
      expect(isTrafficSolved(level.positions)).toBe(false);
      const result = solveTraffic(level);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(level.par);
      expect(level.solution).toHaveLength(level.par);
      for (const route of [level.solution, result!]) {
        let state = createTrafficState(level);
        for (const move of route) {
          expect(legalTrafficMoves(level, state.positions)).toContainEqual(
            move,
          );
          const previous = state;
          state = trafficMove(deepFreeze(state), level, move);
          expect(state).not.toBe(previous);
          expect(validTrafficBoard(level, state.positions)).toBe(true);
        }
        expect(isTrafficSolved(state.positions)).toBe(true);
        expect(solveTraffic(level, state.positions)).toEqual([]);
        expect(legalTrafficMoves(level, state.positions)).toEqual([]);
        while (state.history.length) state = undoTraffic(state);
        expect(state).toEqual(createTrafficState(level));
      }
    },
  );
  it.each(trafficLevels.map((level, index) => [index + 1, level] as const))(
    "finds a fresh winning route after a detour in board %i",
    (_index, level) => {
      let state = createTrafficState(level);
      const detour = legalTrafficMoves(level, state.positions).find(
        (move) => JSON.stringify(move) !== JSON.stringify(level.solution[0]),
      )!;
      state = trafficMove(state, level, detour);
      const route = solveTraffic(level, state.positions)!;
      expect(trafficHint(level, state.positions)).toEqual(route[0]);
      for (const move of route) state = trafficMove(state, level, move);
      expect(isTrafficSolved(state.positions)).toBe(true);
    },
  );
  it("prevents blocked, fractional, zero, unknown and out-of-bounds moves", () => {
    const level = trafficLevels[0],
      state = deepFreeze(createTrafficState(level));
    for (const move of [
      { vehicle: "T", steps: 6 },
      { vehicle: "T", steps: -1 },
      { vehicle: "A", steps: -2 },
      { vehicle: "A", steps: 0 },
      { vehicle: "A", steps: 0.5 },
      { vehicle: "missing", steps: 1 },
    ]) {
      expect(moveTrafficVehicle(level, state.positions, move)).toBeNull();
      expect(trafficMove(state, level, move)).toBe(state);
    }
    expect(undoTraffic(state)).toBe(state);
    expect(validTrafficBoard(level, [0, 1, 5])).toBe(false);
    expect(validTrafficBoard(level, [2, 1, 3])).toBe(false);
  });
  it("stays on the vehicle axis, checks intervening cells and only lets the target exit", () => {
    const level = trafficLevels[0],
      state = createTrafficState(level);
    const moved = trafficMove(state, level, { vehicle: "A", steps: -1 });
    expect(moved.positions).toEqual([0, 0, 3]);
    expect(level.vehicles[1]).toEqual({
      id: "A",
      axis: "v",
      fixed: 3,
      length: 2,
    });
    expect(
      moveTrafficVehicle(level, state.positions, { vehicle: "T", steps: 4 }),
    ).toBeNull();
    expect(legalTrafficMoves(level, moved.positions)).toContainEqual({
      vehicle: "T",
      steps: 6,
    });
    expect(undoTraffic(moved)).toEqual(state);
    expect(
      moveTrafficVehicle(level, moved.positions, { vehicle: "A", steps: 6 }),
    ).toBeNull();
  });
  it("returns no solution for a valid blocked puzzle rather than making up a hint", () => {
    const level: TrafficLevel = {
      title: "blocked",
      vehicles: [
        { id: "T", axis: "h", fixed: 2, length: 2 },
        { id: "A", axis: "v", fixed: 3, length: 3 },
        { id: "B", axis: "v", fixed: 3, length: 3 },
      ],
      positions: [0, 0, 3],
      par: 0,
      solution: [],
      lesson: "",
    };
    expect(validTrafficBoard(level)).toBe(true);
    expect(solveTraffic(level)).toBeNull();
    expect(trafficHint(level, level.positions)).toBeNull();
  });
});

describe("merge and traffic accessible UI and interruptions", () => {
  it("plays every merge challenge through visible touch controls and notifies once", () => {
    for (let level = 0; level < mergeLevels.length; level++) {
      const base = { ...props(), level },
        view = render(<MergeGarden {...base} />);
      for (const direction of mergeLevels[level].solution)
        fireEvent.click(
          screen.getByRole("button", {
            name: `${mergeDirectionLabels[direction]}合并`,
          }),
        );
      expect(base.onComplete).toHaveBeenCalledTimes(1);
      expect(Math.max(...mergeBoard(view.container))).toBeGreaterThanOrEqual(
        mergeLevels[level].target,
      );
      view.rerender(<MergeGarden {...base} hintToken={1} />);
      fireEvent.keyDown(screen.getByRole("group", { name: /合并棋盘/ }), {
        key: "ArrowLeft",
      });
      expect(base.onComplete).toHaveBeenCalledTimes(1);
      view.unmount();
    }
  });
  it("plays all traffic boards with vehicle selection and explicit direction/step buttons", () => {
    for (let level = 0; level < trafficLevels.length; level++) {
      const base = { ...props(), level },
        view = render(<TrafficEscape {...base} />);
      for (const move of trafficLevels[level].solution) {
        fireEvent.click(
          view.container.querySelector(`[data-vehicle="${move.vehicle}"]`)!,
        );
        fireEvent.click(
          view.container.querySelector(
            `[data-traffic-for="${move.vehicle}"][data-traffic-step="${move.steps}"]`,
          )!,
        );
      }
      expect(base.onComplete).toHaveBeenCalledTimes(1);
      expect(screen.getByText("一路顺风！")).toBeTruthy();
      fireEvent.keyDown(screen.getByRole("group", { name: /六乘六停车场/ }), {
        key: "ArrowRight",
      });
      expect(base.onComplete).toHaveBeenCalledTimes(1);
      view.unmount();
    }
  });
  it("pauses merge input, ignores paused tokens, restores seeded undo and resets on level changes", () => {
    const base = props(),
      view = render(<MergeGarden {...base} />);
    const initial = mergeBoard(view.container),
      board = screen.getByRole("group", { name: /合并棋盘/ });
    fireEvent.keyDown(board, { key: "ArrowLeft" });
    const moved = mergeBoard(view.container);
    expect(moved).not.toEqual(initial);
    view.rerender(<MergeGarden {...base} paused hintToken={1} undoToken={1} />);
    fireEvent.keyDown(board, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("button", { name: "向下合并" }));
    expect(mergeBoard(view.container)).toEqual(moved);
    expect(base.onComplete).not.toHaveBeenCalled();
    view.rerender(<MergeGarden {...base} hintToken={1} undoToken={1} />);
    expect(mergeBoard(view.container)).toEqual(moved);
    view.rerender(<MergeGarden {...base} hintToken={1} undoToken={2} />);
    expect(mergeBoard(view.container)).toEqual(initial);
    fireEvent.keyDown(board, { key: "a" });
    expect(mergeBoard(view.container)).toEqual(moved);
    view.rerender(
      <MergeGarden {...base} resetToken={1} hintToken={1} undoToken={2} />,
    );
    expect(mergeBoard(view.container)).toEqual(initial);
    expect(view.container.querySelectorAll(".me-hinted")).toHaveLength(0);
    view.rerender(
      <MergeGarden
        {...base}
        level={5}
        resetToken={1}
        hintToken={1}
        undoToken={2}
      />,
    );
    expect(mergeBoard(view.container)).toEqual(mergeLevels[5].board);
    view.unmount();
    expect(base.onComplete).not.toHaveBeenCalled();
  });
  it("highlights a current merge hint and offers truthful detour recovery", () => {
    const base = props(),
      view = render(<MergeGarden {...base} />);
    view.rerender(<MergeGarden {...base} hintToken={1} />);
    expect(
      screen.getByRole("button", { name: "向左合并" }).className,
    ).toContain("me-hinted");
    fireEvent.click(screen.getByRole("button", { name: "向下合并" }));
    view.rerender(<MergeGarden {...base} hintToken={2} />);
    expect(screen.getByRole("status").textContent).toContain("撤销 1 步");
    expect(view.container.querySelectorAll(".me-hinted")).toHaveLength(0);
  });
  it("pauses traffic input, consumes interrupted tokens, handles keyboard axis and resets selections", () => {
    const base = props(),
      view = render(<TrafficEscape {...base} />);
    const initial = trafficPositions(view.container);
    const car = view.container.querySelector('[data-vehicle="A"]')!;
    fireEvent.focus(car);
    fireEvent.keyDown(car, { key: "ArrowLeft" });
    expect(trafficPositions(view.container)).toEqual(initial);
    expect(screen.getByRole("status").textContent).toContain("不能横着转弯");
    fireEvent.keyDown(car, { key: "ArrowUp" });
    const moved = trafficPositions(view.container);
    expect(moved).toEqual([0, 0, 3]);
    view.rerender(
      <TrafficEscape {...base} paused hintToken={1} undoToken={1} />,
    );
    fireEvent.keyDown(car, { key: "ArrowDown" });
    expect(trafficPositions(view.container)).toEqual(moved);
    view.rerender(<TrafficEscape {...base} hintToken={1} undoToken={1} />);
    expect(trafficPositions(view.container)).toEqual(moved);
    view.rerender(<TrafficEscape {...base} hintToken={2} undoToken={1} />);
    expect(
      view.container.querySelector('[data-vehicle="T"]')!.className,
    ).toContain("me-hinted");
    view.rerender(<TrafficEscape {...base} hintToken={2} undoToken={2} />);
    expect(trafficPositions(view.container)).toEqual(initial);
    expect(view.container.querySelectorAll(".me-hinted")).toHaveLength(0);
    fireEvent.click(view.container.querySelector('[data-vehicle="A"]')!);
    fireEvent.keyDown(screen.getByRole("group", { name: /六乘六停车场/ }), {
      key: "ArrowUp",
      shiftKey: true,
    });
    expect(trafficPositions(view.container)).toEqual(moved);
    view.rerender(
      <TrafficEscape {...base} resetToken={1} hintToken={2} undoToken={2} />,
    );
    expect(trafficPositions(view.container)).toEqual(initial);
    expect(
      view.container
        .querySelector('[data-vehicle="T"]')!
        .getAttribute("aria-pressed"),
    ).toBe("true");
    view.rerender(
      <TrafficEscape
        {...base}
        level={11}
        resetToken={1}
        hintToken={2}
        undoToken={2}
      />,
    );
    expect(trafficPositions(view.container)).toEqual(
      trafficLevels[11].positions,
    );
    view.unmount();
    expect(base.onComplete).not.toHaveBeenCalled();
  });
  it("can undo from completion without notifying again, and reset starts a fresh challenge", () => {
    const base = props(),
      view = render(<TrafficEscape {...base} />);
    for (const move of trafficLevels[0].solution) {
      fireEvent.click(
        view.container.querySelector(`[data-vehicle="${move.vehicle}"]`)!,
      );
      fireEvent.click(
        view.container.querySelector(
          `[data-traffic-for="${move.vehicle}"][data-traffic-step="${move.steps}"]`,
        )!,
      );
    }
    view.rerender(<TrafficEscape {...base} undoToken={1} />);
    expect(view.container.querySelector('[data-vehicle="T"]')).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "驶出花园 →" }));
    expect(base.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(<TrafficEscape {...base} resetToken={1} undoToken={1} />);
    expect(trafficPositions(view.container)).toEqual(
      trafficLevels[0].positions,
    );
  });
});
