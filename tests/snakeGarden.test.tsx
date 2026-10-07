// @vitest-environment jsdom
// SPDX-License-Identifier: GPL-3.0-only
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SnakeGarden from "../src/games/SnakeGarden";
import { saveSnake, SNAKE_BEST, SNAKE_SAVE } from "../src/games/snakeStorage";
import { createSnake, startSnake, stepSnake } from "../src/vendor/snake/core";
let frames = new Map<number, FrameRequestCallback>(),
  id = 0,
  now = 0;
const props = {
  level: 0,
  paused: false,
  resetToken: 0,
  hintToken: 0,
  undoToken: 0,
  onStatus: vi.fn(),
  onComplete: vi.fn(),
};
function step(ms = 260) {
  act(() => {
    now += ms;
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((cb) => cb(now));
  });
}
beforeEach(() => {
  localStorage.clear();
  frames = new Map();
  id = 0;
  now = 0;
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.set(++id, cb);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (n: number) => frames.delete(n));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("click start immediately gives keyboard control; nested restart button keeps native Enter behavior", async () => {
  const u = userEvent.setup();
  render(<SnakeGarden {...props} />);
  await u.click(screen.getByRole("button", { name: "开始" }));
  const board = screen.getByRole("group", { name: /贪吃蛇游戏区/ });
  expect(document.activeElement).toBe(board);
  await u.keyboard("{ArrowUp}");
  step();
  step();
  expect(
    document
      .querySelector("[data-snake-head]")
      ?.getAttribute("data-snake-head"),
  ).toBe("117");
  for (let n = 0; n < 9; n++) step();
  expect(
    document
      .querySelector("[data-snake-phase]")
      ?.getAttribute("data-snake-phase"),
  ).toBe("dead");
  const again = screen.getByRole("button", { name: "再来一局" });
  again.focus();
  await u.keyboard("{Enter}");
  expect(
    document
      .querySelector("[data-snake-phase]")
      ?.getAttribute("data-snake-phase"),
  ).toBe("ready");
});
it("pause and visibility freeze motion, discard pending turns and require explicit resume", () => {
  render(<SnakeGarden {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "开始" }));
  const board = screen.getByRole("group", { name: /贪吃蛇游戏区/ });
  step();
  fireEvent.keyDown(board, { key: "ArrowUp" });
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: true,
  });
  fireEvent(document, new Event("visibilitychange"));
  const head = document
    .querySelector("[data-snake-head]")
    ?.getAttribute("data-snake-head");
  step(1000);
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  fireEvent(document, new Event("visibilitychange"));
  step(1000);
  expect(
    document
      .querySelector("[data-snake-head]")
      ?.getAttribute("data-snake-head"),
  ).toBe(head);
  fireEvent.click(screen.getByRole("button", { name: "继续" }));
  step();
  step();
  expect(
    document
      .querySelector("[data-snake-head]")
      ?.getAttribute("data-snake-head"),
  ).toBe("134");
});
it("reload is paused; restarting preserves best and storage denial remains playable", () => {
  let s = startSnake(createSnake(3));
  for (let i = 0; i < 4; i++) s = stepSnake(s);
  saveSnake(s, 7);
  const v = render(<SnakeGarden {...props} />);
  expect(screen.getByRole("button", { name: "继续" })).toBeTruthy();
  expect(
    document
      .querySelector("[data-snake-best]")
      ?.getAttribute("data-snake-best"),
  ).toBe("7");
  v.unmount();
  render(<SnakeGarden {...props} freshStart />);
  expect(localStorage.getItem(SNAKE_BEST)).toBe("7");
  expect(JSON.parse(localStorage.getItem(SNAKE_SAVE)!).state.score).toBe(0);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("blocked");
  });
  fireEvent.click(screen.getByRole("button", { name: "开始" }));
  expect(screen.getByText(/浏览器暂时无法保存/)).toBeTruthy();
  expect(
    document
      .querySelector("[data-snake-phase]")
      ?.getAttribute("data-snake-phase"),
  ).toBe("playing");
});
