// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { StrictMode } from "react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CarryLetters from "../src/games/CarryLetters";
import BinaryBalance from "../src/games/BinaryBalance";
import { carryLettersLevels } from "../src/games/carryLettersLevels";
import { binaryBalanceLevels } from "../src/games/binaryBalanceLevels";
import type { GameProps } from "../src/lib/types";
import * as carryLogic from "../src/games/carryLettersLogic";
import * as binaryLogic from "../src/games/binaryBalanceLogic";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const props = (): GameProps => ({
  level: 0,
  paused: false,
  resetToken: 0,
  hintToken: 0,
  undoToken: 0,
  onComplete: vi.fn(),
  onStatus: vi.fn(),
});
function carryFill(
  container: HTMLElement,
  symbol: string,
  digit: number | null,
) {
  fireEvent.change(
    container.querySelector(`[data-carry-letter="${symbol}"]`)!,
    { target: { value: digit ?? "" } },
  );
}
function binaryFill(container: HTMLElement, index: number, value: number) {
  fireEvent.click(container.querySelector(`[data-binary-cell="${index}"]`)!);
  fireEvent.click(container.querySelector(`[data-binary-input="${value}"]`)!);
}
describe("CarryLetters rendered journeys", () => {
  it.each(carryLettersLevels.map((l, i) => [i, l] as const))(
    "replays level %i's independent mapping via labelled controls",
    (index, level) => {
      const p = { ...props(), level: index },
        view = render(<CarryLetters {...p} />);
      for (const [symbol, digit] of Object.entries(level.certificate.mapping))
        if (!(symbol in level.givens)) {
          const control = view.container.querySelector(
            `[data-carry-letter="${symbol}"]`,
          )!;
          expect(control.getAttribute("aria-label")).toContain(
            `字母 ${symbol}`,
          );
          carryFill(view.container, symbol, digit);
        }
      expect(
        view.container.querySelector("[data-carry-letters-won=true]"),
      ).not.toBeNull();
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      const symbol = Object.keys(level.certificate.mapping).find(
        (s) => !(s in level.givens),
      )!;
      expect(
        (
          view.container.querySelector(
            `[data-carry-letter="${symbol}"]`,
          ) as HTMLSelectElement
        ).disabled,
      ).toBe(true);
      view.rerender(<CarryLetters {...p} undoToken={1} hintToken={1} />);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        view.container.querySelector("[data-carry-letters-won=true]"),
      ).not.toBeNull();
    },
  );
  it("preserves real keyboard focus through selection, hint, clear, undo and a StrictMode completion", async () => {
    const user = userEvent.setup(),
      p = props(),
      view = render(
        <StrictMode>
          <CarryLetters {...p} />
        </StrictMode>,
      );
    await user.tab();
    const a = view.getByLabelText("字母 A 的数字");
    expect(document.activeElement).toBe(a);
    await user.selectOptions(a, "3");
    expect(document.activeElement).toBe(a);
    view.rerender(
      <StrictMode>
        <CarryLetters {...p} hintToken={1} />
      </StrictMode>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(a);
    expect(
      view.container.querySelector("[data-carry-letters-hint]")?.textContent,
    ).toContain("当前填写");
    await user.selectOptions(a, "");
    expect(document.activeElement).toBe(a);
    view.rerender(
      <StrictMode>
        <CarryLetters {...p} hintToken={1} undoToken={1} />
      </StrictMode>,
    );
    expect((a as HTMLSelectElement).value).toBe("3");
    expect(document.activeElement).toBe(a);
    await user.selectOptions(a, "8");
    await user.tab();
    const b = view.getByLabelText("字母 B 的数字");
    expect(document.activeElement).toBe(b);
    await user.selectOptions(b, "1");
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <CarryLetters {...p} resetToken={1} />
      </StrictMode>,
    );
    expect(
      (view.getByLabelText("字母 A 的数字") as HTMLSelectElement).value,
    ).toBe("");
    carryFill(view.container, "A", 8);
    carryFill(view.container, "B", 1);
    expect(p.onComplete).toHaveBeenCalledTimes(2);
  });
  it("locks given digits, consumes paused tokens and resets on level changes", () => {
    const p = props(),
      view = render(<CarryLetters {...p} />);
    carryFill(view.container, "A", 3);
    expect(
      (view.getByLabelText("字母 C，已知数字") as HTMLSelectElement).disabled,
    ).toBe(true);
    view.rerender(<CarryLetters {...p} paused hintToken={1} undoToken={1} />);
    expect(
      (view.getByLabelText("字母 A 的数字") as HTMLSelectElement).disabled,
    ).toBe(true);
    view.rerender(<CarryLetters {...p} hintToken={1} undoToken={1} />);
    expect(
      (view.getByLabelText("字母 A 的数字") as HTMLSelectElement).value,
    ).toBe("3");
    view.rerender(<CarryLetters {...p} hintToken={1} undoToken={2} />);
    expect(
      (view.getByLabelText("字母 A 的数字") as HTMLSelectElement).value,
    ).toBe("");
    view.rerender(<CarryLetters {...p} level={1} />);
    expect(
      (view.getByLabelText("字母 A，已知数字") as HTMLSelectElement).value,
    ).toBe("2");
  });
  it.each(["edit", "undo", "pause", "reset", "level", "cancel", "unmount"])(
    "discards stale hint work after %s",
    async (action) => {
      vi.useFakeTimers();
      const p = { ...props(), level: 11 },
        view = render(<CarryLetters {...p} />);
      carryFill(view.container, "A", 3);
      view.rerender(<CarryLetters {...p} hintToken={1} />);
      expect(
        view.container.querySelector("[data-carry-letters-cancel]"),
      ).not.toBeNull();
      if (action === "edit") carryFill(view.container, "A", 4);
      if (action === "undo")
        view.rerender(<CarryLetters {...p} hintToken={1} undoToken={1} />);
      if (action === "pause")
        view.rerender(<CarryLetters {...p} hintToken={1} paused />);
      if (action === "reset")
        view.rerender(<CarryLetters {...p} hintToken={1} resetToken={1} />);
      if (action === "level")
        view.rerender(<CarryLetters {...p} hintToken={1} level={0} />);
      if (action === "cancel")
        fireEvent.click(
          view.container.querySelector("[data-carry-letters-cancel]")!,
        );
      if (action === "unmount") view.unmount();
      const calls = vi.mocked(p.onStatus).mock.calls.length;
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(
        view.container.querySelector("[data-carry-letters-hint]"),
      ).toBeNull();
      expect(p.onStatus).toHaveBeenCalledTimes(calls);
    },
  );
  it("returns focused explicit cancellation to the last field without stealing unrelated focus", async () => {
    vi.spyOn(carryLogic, "findCarryHint").mockImplementation(
      () => new Promise(() => {}),
    );
    const user = userEvent.setup(),
      p = props(),
      view = render(<CarryLetters {...p} />);
    await user.tab();
    await user.tab();
    const field = view.getByLabelText("字母 B 的数字");
    expect(document.activeElement).toBe(field);
    view.rerender(<CarryLetters {...p} hintToken={1} />);
    await user.click(view.getByRole("button", { name: "取消计算" }));
    expect(document.activeElement).toBe(field);
    expect(
      view.container.querySelector("[data-carry-letters-cancel]"),
    ).toBeNull();
    view.rerender(<CarryLetters {...p} hintToken={2} />);
    const summary = view.getByText("怎样读一列？");
    await user.click(summary);
    fireEvent.click(view.getByRole("button", { name: "取消计算" }));
    expect(document.activeElement).toBe(summary);
    view.rerender(<CarryLetters {...p} hintToken={3} />);
    carryFill(view.container, "A", 3);
    expect(document.activeElement).toBe(summary);
  });
  it("presents a current-state hint without filling any digit", async () => {
    const p = props(),
      view = render(<CarryLetters {...p} />);
    view.rerender(<CarryLetters {...p} hintToken={1} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      view.container.querySelector("[data-carry-letters-hint]")?.textContent,
    ).toContain("只能");
    expect(
      (view.getByLabelText("字母 A 的数字") as HTMLSelectElement).value,
    ).toBe("");
    expect(p.onComplete).not.toHaveBeenCalled();
  });
});

describe("BinaryBalance rendered journeys", () => {
  it.each(binaryBalanceLevels.map((l, i) => [i, l] as const))(
    "replays every empty cell for level %i through A/B controls",
    (index, level) => {
      const p = { ...props(), level: index },
        view = render(<BinaryBalance {...p} />);
      level.certificate.cells.forEach((value, i) => {
        if (!level.givens[i]) binaryFill(view.container, i, value);
      });
      expect(
        view.container.querySelector("[data-binary-balance-won=true]"),
      ).not.toBeNull();
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      view.rerender(<BinaryBalance {...p} undoToken={1} hintToken={1} />);
      expect(
        view.container.querySelector("[data-binary-balance-won=true]"),
      ).not.toBeNull();
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        (view.getByRole("button", { name: "清空" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    },
  );
  it("maintains roving keyboard focus and meaningful fixed-clue labels", async () => {
    const user = userEvent.setup(),
      p = props(),
      view = render(<BinaryBalance {...p} />),
      level = binaryBalanceLevels[0];
    const blank = level.givens.indexOf(0);
    await user.tab();
    const first = view.container.querySelector(
      `[data-binary-cell="${blank}"]`,
    )!;
    expect(document.activeElement).toBe(first);
    expect(first.getAttribute("aria-label")).toContain("空白，可填写");
    await user.keyboard("a");
    expect(first.getAttribute("data-value")).toBe("1");
    expect(document.activeElement).toBe(first);
    await user.keyboard("b");
    expect(first.getAttribute("data-value")).toBe("2");
    expect(document.activeElement).toBe(first);
    await user.keyboard("{Backspace}");
    expect(first.getAttribute("data-value")).toBe("0");
    view.rerender(<BinaryBalance {...p} undoToken={1} />);
    expect(first.getAttribute("data-value")).toBe("2");
    expect(document.activeElement).toBe(first);
    const direction = blank % 4 < 3 ? "{ArrowRight}" : "{ArrowLeft}",
      next = blank + (blank % 4 < 3 ? 1 : -1);
    await user.keyboard(direction);
    expect(document.activeElement).toBe(
      view.container.querySelector(`[data-binary-cell="${next}"]`),
    );
    const given = level.givens.findIndex(Boolean),
      givenButton = view.container.querySelector(
        `[data-binary-cell="${given}"]`,
      )!;
    expect(givenButton.getAttribute("aria-label")).toContain("固定线索");
    fireEvent.click(givenButton);
    expect(
      (view.getByRole("button", { name: "清空" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.keyDown(givenButton, { key: "Delete" });
    expect(givenButton.getAttribute("data-value")).toBe(
      String(level.givens[given]),
    );
  });
  it("reveals keyboard-focused cells inside a horizontally clipped board", async () => {
    const user = userEvent.setup(),
      view = render(<BinaryBalance {...props()} level={4} />);
    const viewport = view.container.querySelector(
      ".bb-board-wrap",
    ) as HTMLDivElement;
    const first = view.container.querySelector(
      '[data-binary-cell="0"]',
    ) as HTMLButtonElement;
    const next = view.container.querySelector(
      '[data-binary-cell="1"]',
    ) as HTMLButtonElement;
    // Synthetic geometry verifies scroll behavior only, not real-browser layout.
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
      left: 0,
      right: 280,
    } as DOMRect);
    vi.spyOn(next, "getBoundingClientRect").mockReturnValue({
      left: 276,
      right: 320,
    } as DOMRect);
    await user.tab();
    expect(document.activeElement).toBe(first);
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(next);
    expect(viewport.scrollLeft).toBe(46);
    vi.spyOn(first, "getBoundingClientRect").mockReturnValue({
      left: -16,
      right: 28,
    } as DOMRect);
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(first);
    expect(viewport.scrollLeft).toBe(24);
    expect(
      view.getByText("窄屏可左右滑动棋盘；方向键移动会显示所选格。"),
    ).toBeTruthy();
  });
  it("consumes paused tokens and resets both cells and single-completion bookkeeping", () => {
    const p = props(),
      view = render(
        <StrictMode>
          <BinaryBalance {...p} />
        </StrictMode>,
      ),
      level = binaryBalanceLevels[0],
      i = level.givens.indexOf(0);
    binaryFill(view.container, i, 1);
    view.rerender(
      <StrictMode>
        <BinaryBalance {...p} paused hintToken={1} undoToken={1} />
      </StrictMode>,
    );
    expect(
      (view.getByRole("button", { name: "填 A" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    view.rerender(
      <StrictMode>
        <BinaryBalance {...p} hintToken={1} undoToken={1} />
      </StrictMode>,
    );
    expect(
      view.container
        .querySelector(`[data-binary-cell="${i}"]`)
        ?.getAttribute("data-value"),
    ).toBe("1");
    view.rerender(
      <StrictMode>
        <BinaryBalance {...p} hintToken={1} undoToken={2} />
      </StrictMode>,
    );
    expect(
      view.container
        .querySelector(`[data-binary-cell="${i}"]`)
        ?.getAttribute("data-value"),
    ).toBe("0");
    level.certificate.cells.forEach((v, k) => {
      if (!level.givens[k]) binaryFill(view.container, k, v);
    });
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <BinaryBalance {...p} resetToken={1} />
      </StrictMode>,
    );
    expect(
      view.container
        .querySelector(`[data-binary-cell="${i}"]`)
        ?.getAttribute("data-value"),
    ).toBe("0");
    level.certificate.cells.forEach((v, k) => {
      if (!level.givens[k]) binaryFill(view.container, k, v);
    });
    expect(p.onComplete).toHaveBeenCalledTimes(2);
    view.rerender(
      <StrictMode>
        <BinaryBalance {...p} level={4} />
      </StrictMode>,
    );
    expect(view.container.querySelectorAll("[data-binary-cell]")).toHaveLength(
      36,
    );
  });
  it.each(["edit", "undo", "pause", "reset", "level", "cancel", "unmount"])(
    "invalidates current hint work after %s",
    async (action) => {
      vi.useFakeTimers();
      const p = { ...props(), level: 11 },
        view = render(<BinaryBalance {...p} />),
        i = binaryBalanceLevels[11].givens.indexOf(0);
      binaryFill(view.container, i, 1);
      view.rerender(<BinaryBalance {...p} hintToken={1} />);
      expect(
        view.container.querySelector("[data-binary-balance-cancel]"),
      ).not.toBeNull();
      if (action === "edit") binaryFill(view.container, i, 2);
      if (action === "undo")
        view.rerender(<BinaryBalance {...p} hintToken={1} undoToken={1} />);
      if (action === "pause")
        view.rerender(<BinaryBalance {...p} hintToken={1} paused />);
      if (action === "reset")
        view.rerender(<BinaryBalance {...p} hintToken={1} resetToken={1} />);
      if (action === "level")
        view.rerender(<BinaryBalance {...p} hintToken={1} level={0} />);
      if (action === "cancel")
        fireEvent.click(
          view.container.querySelector("[data-binary-balance-cancel]")!,
        );
      if (action === "unmount") view.unmount();
      const calls = vi.mocked(p.onStatus).mock.calls.length;
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(
        view.container.querySelector("[data-binary-balance-hint]"),
      ).toBeNull();
      expect(p.onStatus).toHaveBeenCalledTimes(calls);
    },
  );
  it("restores the selected cell only when explicit cancellation held focus", async () => {
    vi.spyOn(binaryLogic, "findBinaryHint").mockImplementation(
      () => new Promise(() => {}),
    );
    const user = userEvent.setup(),
      p = props(),
      view = render(<BinaryBalance {...p} />);
    await user.tab();
    await user.keyboard("{ArrowDown}");
    const field = view.container.querySelector('[data-binary-cell="4"]');
    expect(document.activeElement).toBe(field);
    view.rerender(<BinaryBalance {...p} hintToken={1} />);
    await user.click(view.getByRole("button", { name: "取消计算" }));
    expect(document.activeElement).toBe(field);
    expect(
      view.container.querySelector("[data-binary-balance-cancel]"),
    ).toBeNull();
    view.rerender(<BinaryBalance {...p} hintToken={2} />);
    const summary = view.getByText("几个小推论");
    await user.click(summary);
    fireEvent.click(view.getByRole("button", { name: "取消计算" }));
    expect(document.activeElement).toBe(summary);
    view.rerender(<BinaryBalance {...p} hintToken={3} />);
    fireEvent.keyDown(field!, { key: "a" });
    expect(document.activeElement).toBe(summary);
  });
  it("leaves browser modifier shortcuts, state and focus untouched", async () => {
    const user = userEvent.setup(),
      view = render(<BinaryBalance {...props()} />);
    await user.tab();
    const field = document.activeElement as HTMLButtonElement;
    for (const modifier of ["ctrlKey", "metaKey", "altKey"])
      for (const key of ["a", "b", "ArrowRight", "Delete"]) {
        const event = new KeyboardEvent("keydown", {
          key,
          [modifier]: true,
          bubbles: true,
          cancelable: true,
        });
        fireEvent(field, event);
        expect(event.defaultPrevented).toBe(false);
        expect(field.getAttribute("data-value")).toBe("0");
        expect(document.activeElement).toBe(field);
      }
  });
  it("keeps current-state hint advisory and preserves the focused cell", async () => {
    const p = props(),
      view = render(<BinaryBalance {...p} />),
      i = binaryBalanceLevels[0].givens.indexOf(0),
      cell = view.container.querySelector(
        `[data-binary-cell="${i}"]`,
      ) as HTMLButtonElement;
    cell.focus();
    view.rerender(<BinaryBalance {...p} hintToken={1} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      view.container.querySelector("[data-binary-balance-hint]")?.textContent,
    ).toContain("只能填");
    expect(cell.getAttribute("data-value")).toBe("0");
    expect(document.activeElement).toBe(cell);
    expect(p.onComplete).not.toHaveBeenCalled();
  });
});

it("declares 44px touch targets, readable disabled values and visible keyboard focus without claiming browser layout QA", () => {
  for (const name of ["carryLetters", "binaryBalance"]) {
    const css = readFileSync(`${process.cwd()}/src/games/${name}.css`, "utf8");
    expect(css).toMatch(/min-height:\s*44px/);
    expect(css).toMatch(/:focus-visible/);
    expect(css).toMatch(/:disabled[^}]*opacity:\s*1/s);
  }
});
