// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import SymmetryRepair from "../src/games/SymmetryRepair";
import ProbabilityBag from "../src/games/ProbabilityBag";
import type { GameProps } from "../src/lib/types";
import { symmetryRepairLevels } from "../src/games/symmetryRepairLevels";
import { probabilityBagLevels } from "../src/games/probabilityBagLevels";
import type { SymmetryCell } from "../src/games/symmetryRepairLogic";
import type { BagCounts } from "../src/games/probabilityBagLogic";
import {
  independentBagSolutions,
  independentBagValid,
  independentSymmetrySolutions,
  independentSymmetryValid,
} from "./symmetryProbabilityOracle";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const props = (level = 0): GameProps => ({
  level,
  paused: false,
  resetToken: 0,
  hintToken: 0,
  undoToken: 0,
  onComplete: vi.fn(),
  onStatus: vi.fn(),
});
const cell = (container: HTMLElement, i: number) =>
  container.querySelector<HTMLButtonElement>(`[data-symmetry-cell="${i}"]`)!;
const board = (container: HTMLElement): SymmetryCell[] =>
  container
    .querySelector("[data-symmetry-board]")!
    .getAttribute("data-symmetry-board")!
    .split("")
    .map((v) => (v === "?" ? null : (Number(v) as 0 | 1)));
const counts = (container: HTMLElement): BagCounts =>
  container
    .querySelector("[data-probability-counts]")!
    .getAttribute("data-probability-counts")!
    .split(",")
    .map(Number) as BagCounts;
const won = (container: HTMLElement, key: string) =>
  container
    .querySelector(`[data-${key}-won]`)!
    .getAttribute(`data-${key}-won`) === "true";
describe("all 24 authored journeys use independent public-condition certificates", () => {
  it.each(symmetryRepairLevels.map((l, i) => [i + 1, l, i] as const))(
    "Symmetry Repair %i completes through real keyboard editing",
    (_, l, index) => {
      const p = props(index),
        { container, rerender } = render(
          <StrictMode>
            <SymmetryRepair {...p} />
          </StrictMode>,
        ),
        target = independentSymmetrySolutions(l)[0];
      expect(won(container, "symmetry")).toBe(false);
      for (let i = 0; i < target.length; i++) {
        if (board(container)[i] !== target[i])
          fireEvent.keyDown(cell(container, i), {
            key: target[i] === 1 ? "f" : "e",
          });
        if (won(container, "symmetry")) break;
      }
      expect(independentSymmetryValid(l, board(container))).toBe(true);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      const final = board(container);
      fireEvent.keyDown(cell(container, 1), { key: "f" });
      rerender(
        <StrictMode>
          <SymmetryRepair {...p} hintToken={1} undoToken={1} />
        </StrictMode>,
      );
      expect(board(container)).toEqual(final);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    },
  );
  it.each(probabilityBagLevels.map((l, i) => [i + 1, l, i] as const))(
    "Probability Bag %i completes by real integer add/remove controls",
    (_, l, index) => {
      const p = props(index),
        { container, rerender } = render(
          <StrictMode>
            <ProbabilityBag {...p} />
          </StrictMode>,
        ),
        target = independentBagSolutions(l)[0];
      expect(won(container, "probability")).toBe(false);
      for (let color = 0; color < 3; color++)
        while (counts(container)[color] > target[color])
          fireEvent.click(
            container.querySelector(`[data-probability-remove="${color}"]`)!,
          );
      for (let color = 0; color < 3; color++)
        while (counts(container)[color] < target[color])
          fireEvent.click(
            container.querySelector(`[data-probability-add="${color}"]`)!,
          );
      expect(independentBagValid(l, counts(container))).toBe(true);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      const final = counts(container);
      fireEvent.click(
        container.querySelector('[data-probability-remove="0"]')!,
      );
      rerender(
        <StrictMode>
          <ProbabilityBag {...p} hintToken={1} undoToken={1} />
        </StrictMode>,
      );
      expect(counts(container)).toEqual(final);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    },
  );
});
describe("public controls, lifecycle and accessibility", () => {
  it("pauses all edits, consumes paused hints/undo, then resets without replaying stale tokens", () => {
    const p = props(),
      view = render(<SymmetryRepair {...p} />);
    fireEvent.keyDown(cell(view.container, 1), { key: "f" });
    const edited = board(view.container);
    view.rerender(<SymmetryRepair {...p} paused hintToken={1} undoToken={1} />);
    fireEvent.keyDown(cell(view.container, 2), { key: "f" });
    expect(board(view.container)).toEqual(edited);
    view.rerender(<SymmetryRepair {...p} hintToken={1} undoToken={1} />);
    expect(board(view.container)).toEqual(edited);
    view.rerender(<SymmetryRepair {...p} hintToken={1} undoToken={2} />);
    expect(board(view.container)).toEqual(symmetryRepairLevels[0].initial);
    fireEvent.keyDown(cell(view.container, 1), { key: "f" });
    view.rerender(
      <SymmetryRepair {...p} resetToken={1} hintToken={1} undoToken={2} />,
    );
    expect(board(view.container)).toEqual(symmetryRepairLevels[0].initial);
  });
  it("uses public touch paint, locks anchors, navigates grid, and leaves modifier keys untouched", () => {
    const p = props(),
      view = render(<SymmetryRepair {...p} />),
      first = cell(view.container, 0),
      editable = cell(view.container, 1);
    fireEvent.click(view.getByRole("button", { name: "□ 留空" }));
    fireEvent.click(editable);
    expect(board(view.container)[1]).toBe(0);
    fireEvent.click(first);
    expect(board(view.container)[0]).toBe(1);
    for (const modifier of ["ctrlKey", "metaKey", "altKey"])
      for (const key of ["f", "e", "?", "ArrowRight"]) {
        const before = board(view.container);
        expect(fireEvent.keyDown(editable, { key, [modifier]: true })).toBe(
          true,
        );
        expect(board(view.container)).toEqual(before);
      }
    editable.focus();
    fireEvent.keyDown(editable, { key: "ArrowRight" });
    expect(document.activeElement).toBe(cell(view.container, 2));
    expect(view.getByText(/任何满足条件的图案都可以/)).toBeTruthy();
    expect(first.getAttribute("aria-label")).toContain("锁定");
  });
  it("repairs internal focus on pause/reset/level change without stealing external shell focus", () => {
    const p = props(),
      shell = document.createElement("button");
    shell.textContent = "Shell";
    document.body.append(shell);
    const view = render(<SymmetryRepair {...p} />),
      spy = vi.spyOn(HTMLElement.prototype, "focus");
    cell(view.container, 1).focus();
    view.rerender(<SymmetryRepair {...p} paused />);
    expect(document.activeElement).toBe(
      view.container.querySelector("[data-symmetry-host]"),
    );
    expect(spy).toHaveBeenCalledWith({ preventScroll: true });
    view.rerender(<SymmetryRepair {...p} />);
    cell(view.container, 1).focus();
    view.rerender(<SymmetryRepair {...p} resetToken={1} />);
    expect(document.activeElement).toBe(
      view.container.querySelector("[data-symmetry-host]"),
    );
    cell(view.container, 1).focus();
    view.rerender(<SymmetryRepair {...p} level={1} />);
    expect(document.activeElement).toBe(
      view.container.querySelector("[data-symmetry-host]"),
    );
    shell.focus();
    view.rerender(<SymmetryRepair {...p} level={2} paused resetToken={2} />);
    expect(document.activeElement).toBe(shell);
    spy.mockRestore();
    shell.remove();
  });
  it("probability pause, reset, undo, focus and modifier keys preserve exact state", () => {
    const p = props(),
      view = render(<ProbabilityBag {...p} />);
    const add = () =>
      view.container.querySelector<HTMLButtonElement>(
        '[data-probability-add="0"]',
      )!;
    fireEvent.click(add());
    expect(counts(view.container)).toEqual([2, 1, 1]);
    view.rerender(<ProbabilityBag {...p} undoToken={1} />);
    expect(counts(view.container)).toEqual([1, 1, 1]);
    fireEvent.click(add());
    add().focus();
    view.rerender(<ProbabilityBag {...p} paused undoToken={2} hintToken={1} />);
    expect(document.activeElement).toBe(
      view.container.querySelector("[data-probability-host]"),
    );
    fireEvent.click(add());
    expect(counts(view.container)).toEqual([2, 1, 1]);
    view.rerender(<ProbabilityBag {...p} undoToken={2} hintToken={1} />);
    expect(counts(view.container)).toEqual([2, 1, 1]);
    for (const modifier of ["ctrlKey", "metaKey", "altKey"])
      expect(
        fireEvent.keyDown(add(), { key: "ArrowUp", [modifier]: true }),
      ).toBe(true);
    add().focus();
    view.rerender(
      <ProbabilityBag {...p} resetToken={1} undoToken={2} hintToken={1} />,
    );
    expect(document.activeElement).toBe(
      view.container.querySelector("[data-probability-host]"),
    );
    expect(counts(view.container)).toEqual([1, 1, 1]);
    const shell = document.createElement("button");
    document.body.append(shell);
    shell.focus();
    view.rerender(<ProbabilityBag {...p} level={1} />);
    expect(document.activeElement).toBe(shell);
    shell.remove();
  });
  it("never turns an empty conditional population into a zero-probability success", () => {
    const p = props(2),
      view = render(<ProbabilityBag {...p} />);
    fireEvent.click(
      view.container.querySelector('[data-probability-remove="1"]')!,
    );
    fireEvent.click(
      view.container.querySelector('[data-probability-remove="2"]')!,
    );
    expect(
      view.container.querySelector('[data-probability-value="1"]')!.textContent,
    ).toBe("未定义");
    expect(view.getAllByText(/分母为 0/).length).toBeGreaterThan(0);
    expect(p.onComplete).not.toHaveBeenCalled();
  });
  it("cancels outdated hint jobs on edit, repeated request, pause, reset and unmount", async () => {
    vi.useFakeTimers();
    const p = props(3),
      view = render(<SymmetryRepair {...p} />);
    view.rerender(<SymmetryRepair {...p} hintToken={1} />);
    expect(
      view
        .getByRole("button", { name: "取消提示搜索" })
        .hasAttribute("disabled"),
    ).toBe(false);
    fireEvent.keyDown(cell(view.container, 0), { key: "f" });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(view.container.querySelector('[data-hint="true"]')).toBeNull();
    view.rerender(<SymmetryRepair {...p} hintToken={2} />);
    view.rerender(<SymmetryRepair {...p} hintToken={3} />);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(
      view.container.querySelector("[data-symmetry-status]")!.textContent,
    ).toContain("提示：");
    view.rerender(<SymmetryRepair {...p} hintToken={4} />);
    view.rerender(<SymmetryRepair {...p} paused hintToken={4} />);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(view.container.querySelector('[data-hint="true"]')).toBeNull();
    view.rerender(<SymmetryRepair {...p} hintToken={5} />);
    view.rerender(<SymmetryRepair {...p} hintToken={5} resetToken={1} />);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(
      view.container.querySelector("[data-symmetry-status]")!.textContent,
    ).not.toContain("提示：");
    view.rerender(<SymmetryRepair {...p} hintToken={6} resetToken={1} />);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("probability hints are cancellable and do not silently apply an answer", async () => {
    vi.useFakeTimers();
    const p = props(11),
      view = render(<ProbabilityBag {...p} />),
      initial = counts(view.container);
    view.rerender(<ProbabilityBag {...p} hintToken={1} />);
    fireEvent.click(view.getByRole("button", { name: "取消提示搜索" }));
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(counts(view.container)).toEqual(initial);
    expect(
      view.container.querySelector("[data-probability-status]")!.textContent,
    ).toContain("已取消");
    view.rerender(<ProbabilityBag {...p} hintToken={2} />);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(
      view.container.querySelector("[data-probability-status]")!.textContent,
    ).toContain("提示：");
    expect(counts(view.container)).toEqual(initial);
    view.rerender(<ProbabilityBag {...p} hintToken={3} />);
    view.rerender(<ProbabilityBag {...p} paused hintToken={3} />);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(view.container.querySelector('[data-hint="true"]')).toBeNull();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("focus repair is conditional on losing a usable control", () => {
  for (const [name, Component, controlSelector, hostSelector] of [
    [
      "symmetry",
      SymmetryRepair,
      '[data-symmetry-cell="1"]',
      "[data-symmetry-host]",
    ],
    [
      "probability",
      ProbabilityBag,
      '[data-probability-add="0"]',
      "[data-probability-host]",
    ],
  ] as const) {
    it(`${name} preserves an enabled details summary during pause`, () => {
      const p = props(),
        view = render(<Component {...p} />);
      const summary = view.container.querySelector("summary")!;
      summary.focus();
      view.rerender(<Component {...p} paused />);
      expect(document.activeElement).toBe(summary);
    });
    it(`${name} repairs a native disabled-control focus drop to body`, () => {
      const p = props(),
        view = render(<Component {...p} />);
      const control =
        view.container.querySelector<HTMLButtonElement>(controlSelector)!;
      control.focus();
      control.disabled = true;
      fireEvent.focusOut(control, { relatedTarget: null });
      // JSDOM leaves disabled controls focused; emulate the other browser behavior.
      const active = vi
        .spyOn(document, "activeElement", "get")
        .mockReturnValue(document.body);
      view.rerender(<Component {...p} paused />);
      active.mockRestore();
      expect(document.activeElement).toBe(
        view.container.querySelector(hostSelector),
      );
    });
    it(`${name} preserves a deliberate blur before pause`, () => {
      const p = props(),
        view = render(<Component {...p} />);
      const control =
        view.container.querySelector<HTMLButtonElement>(controlSelector)!;
      control.focus();
      control.blur();
      view.rerender(<Component {...p} paused />);
      expect(document.activeElement).toBe(document.body);
    });
  }
});
