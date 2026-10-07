// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import TrafficEscape from "../src/games/TrafficEscape";
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

describe("traffic accessible UI and interruptions", () => {
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
