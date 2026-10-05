// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import MemoryRoutes from "../src/games/MemoryRoutes";
import { memoryRoutesLevels } from "../src/games/memoryRoutesLevels";
import { memoryRoutesSolutions } from "../src/games/memoryRoutesSolutions";
import {
  beginMemoryRoute,
  createMemoryRouteState,
  enterMemoryRoute,
  memoryRouteHint,
  memoryRouteTarget,
  memoryRouteWon,
  replayMemoryRoute,
  routeAddress,
  undoMemoryRoute,
  type MemoryRouteLevel,
} from "../src/games/memoryRoutesLogic";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const props = () => ({
  level: 0,
  paused: false,
  resetToken: 0,
  hintToken: 0,
  undoToken: 0,
  onComplete: vi.fn(),
  onStatus: vi.fn(),
});
/** Independent coordinate-list oracle, not an answer copied from runtime. */
function walkOracle(level: MemoryRouteLevel): number[] {
  const coordinates: [number, number][] = [
    [level.start % level.size, Math.floor(level.start / level.size)],
  ];
  for (const direction of level.walk) {
    const [x, y] = coordinates.at(-1)!;
    const next: [number, number] =
      direction === "N"
        ? [x, y - 1]
        : direction === "S"
          ? [x, y + 1]
          : direction === "W"
            ? [x - 1, y]
            : [x + 1, y];
    expect(next.every((value) => value >= 0 && value < level.size)).toBe(true);
    coordinates.push(next);
  }
  return coordinates.map(([x, y]) => y * level.size + x);
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
const game = (container: HTMLElement) =>
  container.querySelector("[data-memory-routes-game]")!;
const cell = (container: HTMLElement, value: number) =>
  container.querySelector<HTMLButtonElement>(
    `[data-memory-routes-cell="${value}"]`,
  )!;
const ready = (container: HTMLElement) =>
  container.querySelector<HTMLButtonElement>("[data-memory-routes-ready]")!;
const replay = (container: HTMLElement) =>
  container.querySelector<HTMLButtonElement>("[data-memory-routes-replay]")!;

describe("MemoryRoutes public walks and original progression", () => {
  it("authors twelve different routes with turns, returns, crossings and two spatial scales", () => {
    expect(memoryRoutesLevels).toHaveLength(12);
    expect(
      new Set(
        memoryRoutesLevels.map((level) => `${level.size}:${walkOracle(level)}`),
      ).size,
    ).toBe(12);
    expect(memoryRoutesLevels.map((level) => level.walk.length + 1)).toEqual([
      3, 4, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10,
    ]);
    expect(new Set(memoryRoutesLevels.map((level) => level.size))).toEqual(
      new Set([3, 4]),
    );
    expect(
      memoryRoutesLevels
        .slice(4)
        .filter(
          (level) => new Set(walkOracle(level)).size < walkOracle(level).length,
        ).length,
    ).toBeGreaterThanOrEqual(6);
  });
  for (const [index, level] of memoryRoutesLevels.entries())
    it(`${level.id}: independent coordinate oracle, certificate, exact order, immutable completion`, () => {
      const route = walkOracle(level);
      expect(memoryRouteTarget(level)).toEqual(route);
      expect(memoryRoutesSolutions[index]).toEqual(route);
      expect(memoryRouteWon(level, route)).toBe(true);
      expect(memoryRouteWon(level, route.slice(1))).toBe(false);
      const wrong = [...route];
      wrong[1] = (wrong[1] + 1) % level.size ** 2;
      expect(memoryRouteWon(level, wrong)).toBe(false);
      let state = beginMemoryRoute(createMemoryRouteState());
      for (const value of route)
        state = enterMemoryRoute(level, deepFreeze(state), value);
      expect(state.phase).toBe("complete");
      expect(enterMemoryRoute(level, state, 0)).toBe(state);
      expect(undoMemoryRoute(state)).toBe(state);
      expect(replayMemoryRoute(state)).toBe(state);
      expect(beginMemoryRoute(state)).toBe(state);
      const poisoned = {
        ...level,
        solution: [99, 99],
        certificate: { path: [] },
      };
      expect(memoryRouteTarget(poisoned)).toEqual(route);
    });
  it("preserves safe observe/replay/undo transitions and rejects malformed or paused input", () => {
    const level = memoryRoutesLevels[0],
      initial = deepFreeze(createMemoryRouteState());
    expect(enterMemoryRoute(level, initial, 0)).toBe(initial);
    expect(beginMemoryRoute(initial, true)).toBe(initial);
    const recall = beginMemoryRoute(initial);
    for (const value of [-1, 9, 0.5, Infinity, NaN])
      expect(enterMemoryRoute(level, recall, value)).toBe(recall);
    expect(enterMemoryRoute(level, recall, 0, true)).toBe(recall);
    const one = enterMemoryRoute(level, recall, 0);
    expect(undoMemoryRoute(one, true)).toBe(one);
    expect(replayMemoryRoute(one, true)).toBe(one);
    expect(replayMemoryRoute(one)).toEqual({ phase: "observe", entered: [0] });
    expect(undoMemoryRoute(replayMemoryRoute(one)).entered).toEqual([]);
    expect(beginMemoryRoute(replayMemoryRoute(one)).entered).toEqual([0]);
  });
  it("gives a recoverable mismatch hint and allows exact correction, without silently erasing a failed attempt", () => {
    const level = memoryRoutesLevels[0];
    let state = beginMemoryRoute(createMemoryRouteState());
    state = enterMemoryRoute(level, state, 0);
    state = enterMemoryRoute(level, state, 2);
    state = enterMemoryRoute(level, state, 1);
    expect(state.phase).toBe("recall");
    expect(enterMemoryRoute(level, state, 2)).toBe(state);
    expect(memoryRouteHint(level, state)).toMatchObject({ step: 1, cell: 1 });
    state = undoMemoryRoute(undoMemoryRoute(state));
    expect(memoryRouteHint(level, state)).toMatchObject({ step: 1, cell: 1 });
    state = enterMemoryRoute(level, state, 1);
    state = enterMemoryRoute(level, state, 2);
    expect(state.phase).toBe("complete");
    expect(routeAddress(4, 15)).toBe("D4");
    expect(() =>
      memoryRouteTarget({ ...level, start: 0, walk: ["W"] }),
    ).toThrow();
  });
});

describe("MemoryRoutes DOM and shell contract", () => {
  for (const [index, solution] of memoryRoutesSolutions.entries())
    it(`completes authored level ${index + 1} through public controls only`, () => {
      const p = { ...props(), level: index },
        { container, rerender } = render(
          <StrictMode>
            <MemoryRoutes {...p} />
          </StrictMode>,
        );
      expect(game(container).getAttribute("data-memory-routes-phase")).toBe(
        "observe",
      );
      expect(cell(container, solution[0]).getAttribute("aria-label")).toContain(
        "路线第",
      );
      fireEvent.click(ready(container));
      expect(
        cell(container, solution[0]).getAttribute("aria-label"),
      ).not.toContain("路线第");
      for (const value of solution) fireEvent.click(cell(container, value));
      expect(game(container).getAttribute("data-memory-routes-won")).toBe(
        "true",
      );
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      const snapshot = game(container).getAttribute(
        "data-memory-routes-entered",
      );
      rerender(
        <StrictMode>
          <MemoryRoutes {...p} undoToken={1} hintToken={1} />
        </StrictMode>,
      );
      fireEvent.click(cell(container, 0));
      fireEvent.click(replay(container));
      expect(game(container).getAttribute("data-memory-routes-entered")).toBe(
        snapshot,
      );
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    });
  it("supports replay, wrong-route feedback, hint, undo and reset without disturbing Shell focus", () => {
    const p = props();
    const { container, rerender, getByText } = render(
      <>
        <button data-shell>Shell hint</button>
        <MemoryRoutes {...p} />
      </>,
    );
    fireEvent.click(ready(container));
    fireEvent.click(cell(container, 0));
    fireEvent.click(cell(container, 2));
    fireEvent.click(replay(container));
    expect(game(container).getAttribute("data-memory-routes-entered")).toBe(
      "0,2",
    );
    expect(cell(container, 1).getAttribute("aria-label")).toContain(
      "路线第 2 站",
    );
    fireEvent.click(ready(container));
    fireEvent.click(cell(container, 1));
    expect(getByText(/还有站点需要调整/)).toBeTruthy();
    const shell = container.querySelector<HTMLButtonElement>("[data-shell]")!;
    shell.focus();
    rerender(
      <>
        <button data-shell>Shell hint</button>
        <MemoryRoutes {...p} hintToken={1} undoToken={1} />
      </>,
    );
    expect(document.activeElement).toBe(shell);
    expect(game(container).getAttribute("data-memory-routes-entered")).toBe(
      "0,2",
    );
    rerender(
      <>
        <button data-shell>Shell hint</button>
        <MemoryRoutes {...p} hintToken={2} undoToken={1} />
      </>,
    );
    expect(cell(container, 1).getAttribute("aria-label")).toContain("提示位置");
    rerender(
      <>
        <button data-shell>Shell hint</button>
        <MemoryRoutes {...p} resetToken={1} />
      </>,
    );
    expect(game(container).getAttribute("data-memory-routes-phase")).toBe(
      "observe",
    );
    expect(game(container).getAttribute("data-memory-routes-entered")).toBe("");
    expect(document.activeElement).toBe(shell);
  });
  it("pause blocks input/hint/undo and hides observation; pause-token events cannot leak through resume", () => {
    const p = props(),
      { container, rerender } = render(<MemoryRoutes {...p} />);
    fireEvent.click(ready(container));
    fireEvent.click(cell(container, 0));
    rerender(<MemoryRoutes {...p} paused hintToken={1} undoToken={1} />);
    fireEvent.click(cell(container, 1));
    fireEvent.click(replay(container));
    expect(game(container).getAttribute("data-memory-routes-entered")).toBe(
      "0",
    );
    expect(container.querySelector(".mr-hint")).toBeNull();
    rerender(<MemoryRoutes {...p} hintToken={1} undoToken={1} />);
    expect(game(container).getAttribute("data-memory-routes-entered")).toBe(
      "0",
    );
    rerender(<MemoryRoutes {...p} paused resetToken={1} />);
    expect(cell(container, 0).getAttribute("data-memory-routes-steps")).toBe(
      "",
    );
    rerender(<MemoryRoutes {...p} resetToken={1} />);
    expect(cell(container, 0).getAttribute("data-memory-routes-steps")).toBe(
      "1",
    );
  });
  it("leaves Ctrl/Meta/Alt shortcuts unchanged and creates no clock jobs", () => {
    vi.useFakeTimers();
    const { container, unmount } = render(<MemoryRoutes {...props()} />);
    fireEvent.click(ready(container));
    for (const modifier of ["ctrlKey", "metaKey", "altKey"]) {
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
        [modifier]: true,
      });
      cell(container, 0).dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      fireEvent.click(cell(container, 0), { [modifier]: true });
    }
    expect(game(container).getAttribute("data-memory-routes-entered")).toBe("");
    expect(vi.getTimerCount()).toBe(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("MemoryRoutes keyed round focus recovery", () => {
  it("never moves external Shell focus on reset or level changes", () => {
    const p = props();
    const { container, rerender } = render(
      <>
        <button data-external>Shell level</button>
        <MemoryRoutes {...p} />
      </>,
    );
    const shell =
      container.querySelector<HTMLButtonElement>("[data-external]")!;
    const host = container.querySelector<HTMLDivElement>(
      "[data-memory-routes-host]",
    )!;
    const focus = vi.spyOn(host, "focus");
    shell.focus();
    rerender(
      <>
        <button data-external>Shell level</button>
        <MemoryRoutes {...p} resetToken={1} />
      </>,
    );
    expect(document.activeElement).toBe(shell);
    rerender(
      <>
        <button data-external>Shell level</button>
        <MemoryRoutes {...p} resetToken={1} level={1} />
      </>,
    );
    expect(document.activeElement).toBe(shell);
    expect(focus).not.toHaveBeenCalled();
  });
  it("repairs removed internal focus on reset and level changes, using preventScroll", () => {
    const p = props(),
      { container, rerender } = render(<MemoryRoutes {...p} />);
    const host = container.querySelector<HTMLDivElement>(
      "[data-memory-routes-host]",
    )!;
    const focused = ready(container);
    focused.focus();
    const focus = vi.spyOn(host, "focus");
    rerender(<MemoryRoutes {...p} resetToken={1} />);
    expect(focused.isConnected).toBe(false);
    expect(document.activeElement).toBe(host);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    ready(container).focus();
    focus.mockClear();
    rerender(<MemoryRoutes {...p} resetToken={1} level={1} />);
    expect(document.activeElement).toBe(host);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });
});

describe("MemoryRoutes disabled-control focus recovery", () => {
  it("recovers Ready, pause, wrong-full and completed input focus without scrolling", () => {
    const p = props(),
      { container, rerender } = render(<MemoryRoutes {...p} />);
    const host = container.querySelector<HTMLDivElement>(
      "[data-memory-routes-host]",
    )!;
    const focus = vi.spyOn(host, "focus");
    ready(container).focus();
    fireEvent.click(ready(container));
    expect(document.activeElement).toBe(host);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    cell(container, 0).focus();
    rerender(<MemoryRoutes {...p} paused />);
    expect(document.activeElement).toBe(host);
    rerender(<MemoryRoutes {...p} />);
    fireEvent.click(cell(container, 0));
    fireEvent.click(cell(container, 2));
    cell(container, 1).focus();
    fireEvent.click(cell(container, 1));
    expect(document.activeElement).toBe(host);
    rerender(<MemoryRoutes {...p} resetToken={1} />);
    fireEvent.click(ready(container));
    fireEvent.click(cell(container, 0));
    fireEvent.click(cell(container, 1));
    cell(container, 2).focus();
    fireEvent.click(cell(container, 2));
    expect(document.activeElement).toBe(host);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
  });
  it("does not restore deliberately blurred controls", () => {
    const p = props(),
      { container, rerender } = render(<MemoryRoutes {...p} />);
    fireEvent.click(ready(container));
    const control = cell(container, 0);
    control.focus();
    control.blur();
    const host = container.querySelector<HTMLDivElement>(
      "[data-memory-routes-host]",
    )!;
    const focus = vi.spyOn(host, "focus");
    rerender(<MemoryRoutes {...p} paused />);
    expect(document.activeElement).toBe(document.body);
    expect(focus).not.toHaveBeenCalled();
  });
});
