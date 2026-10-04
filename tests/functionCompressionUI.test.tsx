// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FunctionFactory from "../src/games/FunctionFactory";
import CompressionPost from "../src/games/CompressionPost";
import { functionFactoryLevels } from "../src/games/functionFactoryLevels";
import { compressionPostLevels } from "../src/games/compressionPostLevels";
import { postPacketKey } from "../src/games/compressionPostLogic";
import type { GameProps } from "../src/lib/types";

afterEach(cleanup);
const props = (level = 0): GameProps => ({
  level,
  paused: false,
  resetToken: 0,
  hintToken: 0,
  undoToken: 0,
  onComplete: vi.fn(),
  onStatus: vi.fn(),
});
const get = (selector: string): HTMLElement => {
  const element = document.querySelector<HTMLElement>(selector);
  expect(element, selector).not.toBeNull();
  return element!;
};
function fillFactory(certificate: { A: string; B: string; main: string }) {
  for (const section of ["A", "B", "main"] as const)
    [...certificate[section]].forEach((command, index) => {
      fireEvent.click(get(`[data-factory-slot="${section}:${index}"]`));
      fireEvent.click(get(`[data-factory-command="${command}"]`));
    });
}

describe("24 rendered authored DOM journeys (jsdom, not browser claims)", () => {
  it.each(functionFactoryLevels.map((l, i) => [i, l] as const))(
    "Function Factory level %i: edit real definitions and calls, execute and complete once",
    (index, level) => {
      const p = props(index),
        certificate = level.certificate;
      Object.defineProperty(level, "certificate", {
        configurable: true,
        get() {
          throw Error("UI must not read witness");
        },
      });
      try {
        const view = render(
          <StrictMode>
            <FunctionFactory {...p} />
          </StrictMode>,
        );
        expect(
          screen.getByLabelText("公开目标的完整有序笔画").children,
        ).toHaveLength(level.target.length);
        fillFactory(certificate);
        fireEvent.click(get("[data-factory-run]"));
        expect(
          get("[data-function-factory]").getAttribute("data-factory-won"),
        ).toBe("true");
        expect(p.onComplete).toHaveBeenCalledTimes(1);
        fireEvent.click(get("[data-factory-run]"));
        view.rerender(
          <StrictMode>
            <FunctionFactory {...p} hintToken={1} />
          </StrictMode>,
        );
        expect(p.onComplete).toHaveBeenCalledTimes(1);
        view.rerender(
          <StrictMode>
            <FunctionFactory {...p} undoToken={1} />
          </StrictMode>,
        );
        const last = certificate.main.length - 1;
        expect(
          get(`[data-factory-slot="main:${last}"]`).getAttribute("aria-label"),
        ).toContain(certificate.main[last]);
        expect((get("[data-factory-run]") as HTMLButtonElement).disabled).toBe(
          true,
        );
        fireEvent.click(get(`[data-factory-slot="main:${last}"]`));
        expect(screen.queryByLabelText("选择指令")).toBeNull();
        expect(
          get("[data-function-factory]").getAttribute("data-factory-won"),
        ).toBe("true");
        view.rerender(
          <StrictMode>
            <FunctionFactory {...p} undoToken={2} paused />
          </StrictMode>,
        );
        view.rerender(
          <StrictMode>
            <FunctionFactory {...p} undoToken={2} />
          </StrictMode>,
        );
        expect(
          get("[data-function-factory]").getAttribute("data-factory-won"),
        ).toBe("true");
        expect(p.onComplete).toHaveBeenCalledTimes(1);
      } finally {
        Object.defineProperty(level, "certificate", {
          configurable: true,
          writable: true,
          value: certificate,
        });
      }
    },
  );
  it.each(compressionPostLevels.map((l, i) => [i, l] as const))(
    "Compression Post level %i: choose actual packet boundaries and decode within budget",
    (index, level) => {
      const p = props(index),
        certificate = level.certificate;
      Object.defineProperty(level, "certificate", {
        configurable: true,
        get() {
          throw Error("UI must not read witness");
        },
      });
      try {
        const view = render(
          <StrictMode>
            <CompressionPost {...p} />
          </StrictMode>,
        );
        expect(screen.getByLabelText("公开原始消息").textContent).toContain(
          level.message,
        );
        for (const packet of certificate)
          fireEvent.click(get(`[data-post-packet="${postPacketKey(packet)}"]`));
        expect(get("[data-post-decoded]").textContent).toBe(level.message);
        expect(
          get("[data-compression-post]").getAttribute("data-post-won"),
        ).toBe("true");
        expect(p.onComplete).toHaveBeenCalledTimes(1);
        expect((get("[data-post-undo]") as HTMLButtonElement).disabled).toBe(
          true,
        );
        fireEvent.click(get("[data-post-undo]"));
        view.rerender(
          <StrictMode>
            <CompressionPost {...p} undoToken={1} />
          </StrictMode>,
        );
        expect(get("[data-post-decoded]").textContent).toBe(level.message);
        expect(
          get("[data-compression-post]").getAttribute("data-post-cost"),
        ).toBe(String(level.budget));
        expect(
          get("[data-compression-post]").getAttribute("data-post-won"),
        ).toBe("true");
        view.rerender(
          <StrictMode>
            <CompressionPost {...p} undoToken={2} paused />
          </StrictMode>,
        );
        view.rerender(
          <StrictMode>
            <CompressionPost {...p} undoToken={2} />
          </StrictMode>,
        );
        expect(get("[data-post-decoded]").textContent).toBe(level.message);
        expect(
          get("[data-compression-post]").getAttribute("data-post-won"),
        ).toBe("true");
        expect(p.onComplete).toHaveBeenCalledTimes(1);
        view.rerender(
          <StrictMode>
            <CompressionPost {...p} hintToken={1} />
          </StrictMode>,
        );
        expect(p.onComplete).toHaveBeenCalledTimes(1);
      } finally {
        Object.defineProperty(level, "certificate", {
          configurable: true,
          writable: true,
          value: certificate,
        });
      }
    },
  );
});

describe("Function Factory interruption and accessible native keyboard lifecycle", () => {
  it("supports native buttons and command keys, ignores modifiers, returns focus after cancel and removed palette", async () => {
    const user = userEvent.setup(),
      p = props();
    render(<FunctionFactory {...p} />);
    const slot = get('[data-factory-slot="A:0"]');
    slot.focus();
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(screen.queryByLabelText("选择指令")).toBeNull();
    await user.keyboard("{Enter}");
    fireEvent.keyDown(slot, { key: "f", ctrlKey: true });
    fireEvent.keyDown(slot, { key: "f", metaKey: true });
    fireEvent.keyDown(slot, { key: "f", altKey: true });
    expect(slot.getAttribute("aria-label")).toContain("空");
    fireEvent.keyDown(slot, { key: "Escape", ctrlKey: true });
    expect(screen.queryByLabelText("选择指令")).not.toBeNull();
    get("[data-factory-cancel]").focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(slot);
    expect(screen.queryByLabelText("选择指令")).toBeNull();
    await user.keyboard("{Enter}f");
    expect(slot.getAttribute("aria-label")).toContain("F");
    expect(document.activeElement).toBe(slot);
    await user.keyboard("{Enter}{Delete}");
    expect(slot.getAttribute("aria-label")).toContain("空");
    expect(document.activeElement).toBe(slot);
    await user.keyboard("{Enter}{Escape}");
    expect(document.activeElement).toBe(slot);
  });
  it("blocks editing and hints while paused; undo, reset and level changes restore correct lifecycle", () => {
    const p = props(),
      view = render(<FunctionFactory {...p} />);
    fireEvent.click(get('[data-factory-slot="A:0"]'));
    fireEvent.click(get('[data-factory-command="F"]'));
    view.rerender(
      <FunctionFactory {...p} paused hintToken={1} undoToken={1} />,
    );
    fireEvent.click(get('[data-factory-slot="A:1"]'));
    expect(screen.queryByLabelText("选择指令")).toBeNull();
    expect(get('[data-factory-slot="A:0"]').textContent).toContain("F");
    view.rerender(<FunctionFactory {...p} hintToken={1} undoToken={1} />);
    expect(get('[data-factory-slot="A:0"]').textContent).toContain("F");
    view.rerender(<FunctionFactory {...p} hintToken={1} undoToken={2} />);
    expect(
      get('[data-factory-slot="A:0"]').getAttribute("aria-label"),
    ).toContain("空");
    fillFactory(functionFactoryLevels[0].certificate);
    fireEvent.click(get("[data-factory-run]"));
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(<FunctionFactory {...p} resetToken={1} />);
    expect(
      get("[data-function-factory]").getAttribute("data-factory-won"),
    ).toBe("false");
    expect(
      get('[data-factory-slot="A:0"]').getAttribute("aria-label"),
    ).toContain("空");
    view.rerender(<FunctionFactory {...p} level={4} />);
    expect(document.querySelectorAll('[data-factory-slot^="B:"]')).toHaveLength(
      2,
    );
  });
  it("cancels chunked hint searches explicitly and on pause, edit, reset, navigation and unmount", async () => {
    const p = props(11),
      view = render(<FunctionFactory {...p} />);
    view.rerender(<FunctionFactory {...p} hintToken={1} />);
    fireEvent.click(get("[data-factory-search-cancel]"));
    expect(document.activeElement).toBe(get("[data-function-factory]"));
    expect(screen.getByRole("status").textContent).toContain("已取消");
    view.rerender(<FunctionFactory {...p} hintToken={2} />);
    get("[data-factory-search-cancel]").focus();
    view.rerender(<FunctionFactory {...p} hintToken={2} paused />);
    expect(document.activeElement).toBe(get("[data-function-factory]"));
    expect(document.querySelector("[data-factory-search-cancel]")).toBeNull();
    view.rerender(<FunctionFactory {...p} hintToken={3} />);
    fireEvent.click(get('[data-factory-slot="A:0"]'));
    fireEvent.click(get('[data-factory-command="R"]'));
    expect(document.querySelector("[data-factory-search-cancel]")).toBeNull();
    view.rerender(<FunctionFactory {...p} hintToken={4} />);
    view.rerender(<FunctionFactory {...p} hintToken={4} resetToken={1} />);
    expect(document.querySelector("[data-factory-search-cancel]")).toBeNull();
    view.rerender(<FunctionFactory {...p} hintToken={5} resetToken={1} />);
    view.rerender(<FunctionFactory {...p} level={0} hintToken={5} />);
    expect(document.querySelector("[data-factory-search-cancel]")).toBeNull();
    view.rerender(<FunctionFactory {...p} />);
    view.rerender(<FunctionFactory {...p} hintToken={6} />);
    view.unmount();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(p.onComplete).not.toHaveBeenCalled();
  });
  it("renders a one-slot actual-state hint without filling or hiding its target", async () => {
    const p = props(),
      view = render(<FunctionFactory {...p} />);
    fireEvent.click(get('[data-factory-slot="A:0"]'));
    fireEvent.click(get('[data-factory-command="F"]'));
    view.rerender(<FunctionFactory {...p} hintToken={1} />);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("第 2 格"),
    );
    const hinted = get('[data-factory-slot="A:1"]');
    expect(hinted.getAttribute("aria-label")).toContain("空");
    expect(hinted.className).toContain("ff-hinted");
    expect(p.onComplete).not.toHaveBeenCalled();
  });
});

describe("Compression Post prefix budgets and accessible lifecycle", () => {
  it("is fully operable with native keyboard, ignores shortcut-like modified keys and keeps focus when choices disappear", async () => {
    const user = userEvent.setup(),
      p = props(),
      view = render(<CompressionPost {...p} />),
      root = get("[data-compression-post]");
    for (const modifier of ["ctrlKey", "metaKey", "altKey"])
      fireEvent.keyDown(root, { key: "1", [modifier]: true });
    expect(root.getAttribute("data-post-cursor")).toBe("0");
    get('[data-post-packet="literal:1"]').focus();
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(root.getAttribute("data-post-cursor")).toBe("0");
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(root);
    expect(root.getAttribute("data-post-cursor")).toBe("1");
    get("[data-post-undo]").focus();
    await user.keyboard(" ");
    expect(document.activeElement).toBe(root);
    expect(root.getAttribute("data-post-cursor")).toBe("0");
    get('[data-post-packet="literal:3"]').focus();
    await user.keyboard("{Enter}");
    expect(root.getAttribute("data-post-won")).toBe("true");
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(<CompressionPost {...p} resetToken={1} />);
    expect(
      get("[data-compression-post]").getAttribute("data-post-cursor"),
    ).toBe("0");
  });
  it("hints honestly recommend undo on an expensive actual prefix and never auto-select packets", () => {
    const p = props(11),
      view = render(<CompressionPost {...p} />);
    fireEvent.click(get('[data-post-packet="run:6"]'));
    view.rerender(<CompressionPost {...p} hintToken={1} />);
    expect(screen.getByRole("status").textContent).toContain("请撤销");
    expect(
      get("[data-compression-post]").getAttribute("data-post-cursor"),
    ).toBe("6");
    fireEvent.click(get("[data-post-undo]"));
    view.rerender(<CompressionPost {...p} hintToken={2} />);
    expect(screen.getByRole("status").textContent).toContain("× 5");
    expect(get('[data-post-packet="run:5"]').className).toContain("cp-hinted");
    expect(
      get("[data-compression-post]").getAttribute("data-post-cursor"),
    ).toBe("0");
  });
  it("moves disabled packet/undo focus to the workbench on pause while preserving external shell focus", () => {
    const p = props();
    const tree = (paused: boolean) => (
      <>
        <button data-test-shell>外部工具栏</button>
        <CompressionPost {...p} paused={paused} />
      </>
    );
    const view = render(tree(false));
    get('[data-post-packet="literal:1"]').focus();
    view.rerender(tree(true));
    expect(document.activeElement).toBe(get("[data-compression-post]"));
    view.rerender(tree(false));
    fireEvent.click(get('[data-post-packet="literal:1"]'));
    get("[data-post-undo]").focus();
    view.rerender(tree(true));
    expect(document.activeElement).toBe(get("[data-compression-post]"));
    view.rerender(tree(false));
    get("[data-test-shell]").focus();
    view.rerender(tree(true));
    expect(document.activeElement).toBe(get("[data-test-shell]"));
  });
  it("handles paused controls and consumed undo/hint tokens, complete overbudget messages, reset and navigation", () => {
    const p = props(),
      view = render(<CompressionPost {...p} />);
    fireEvent.click(get('[data-post-packet="literal:1"]'));
    view.rerender(
      <CompressionPost {...p} paused undoToken={1} hintToken={1} />,
    );
    fireEvent.click(get("[data-post-undo]"));
    fireEvent.click(get('[data-post-packet="literal:1"]'));
    expect(
      get("[data-compression-post]").getAttribute("data-post-cursor"),
    ).toBe("1");
    view.rerender(<CompressionPost {...p} undoToken={1} hintToken={1} />);
    expect(
      get("[data-compression-post]").getAttribute("data-post-cursor"),
    ).toBe("1");
    fireEvent.click(get('[data-post-packet="literal:1"]'));
    fireEvent.click(get('[data-post-packet="literal:1"]'));
    expect(get("[data-post-decoded]").textContent).toBe("ABC");
    expect(get("[data-compression-post]").getAttribute("data-post-won")).toBe(
      "false",
    );
    expect(p.onComplete).not.toHaveBeenCalled();
    view.rerender(<CompressionPost {...p} undoToken={2} hintToken={1} />);
    expect(
      get("[data-compression-post]").getAttribute("data-post-cursor"),
    ).toBe("2");
    view.rerender(<CompressionPost {...p} resetToken={1} />);
    expect(get("[data-compression-post]").getAttribute("data-post-cost")).toBe(
      "0",
    );
    view.rerender(<CompressionPost {...p} level={6} />);
    expect(screen.getByLabelText("公开共享词典").textContent).toContain("ABC");
  });
});
