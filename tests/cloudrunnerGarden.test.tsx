// SPDX-License-Identifier: GPL-3.0-only
// @vitest-environment jsdom
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { StrictMode } from "react";
import CloudrunnerGarden from "../src/games/CloudrunnerGarden";
import type { GameProps } from "../src/lib/types";
vi.mock("../src/games/cloudrunnerScene", () => ({ drawRunner: vi.fn() }));
const audio = vi.hoisted(() => ({
  init: vi.fn(),
  sfx: vi.fn(),
  setMuted: vi.fn(),
  dispose: vi.fn(),
}));
vi.mock("../src/vendor/cloudrunner/audio/index", () => ({
  createAudio: () => audio,
}));
let frames = new Map<number, FrameRequestCallback>(),
  nextFrame = 0,
  now = 1000;
const props = (extra: Partial<GameProps> = {}): GameProps => ({
  level: 0,
  freePlay: false,
  paused: false,
  resetToken: 0,
  hintToken: 0,
  undoToken: 0,
  onComplete: vi.fn(),
  onStatus: vi.fn(),
  ...extra,
});
const root = () => document.querySelector(".cloudrunner")!;
function tick(ms = 16) {
  act(() => {
    now += ms;
    const todo = [...frames.values()];
    frames.clear();
    todo.forEach((f) => f(now));
  });
}
function travel(ms: number) {
  for (let t = 0; t < ms; t += 16) tick(Math.min(16, ms - t));
}
function start() {
  fireEvent.click(screen.getByRole("button", { name: "开始这一段" }));
  tick();
}
beforeEach(() => {
  vi.clearAllMocks();
  frames = new Map();
  now = 1000;
  nextFrame = 0;
  localStorage.clear();
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => {
    frames.set(++nextFrame, f);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("requires an explicit start, then keyboard and button actions work", () => {
  render(<CloudrunnerGarden {...props()} />);
  expect(root().getAttribute("data-phase")).toBe("start");
  expect(
    screen.getByRole("button", { name: "跳跃" }).hasAttribute("disabled"),
  ).toBe(true);
  start();
  fireEvent.click(screen.getByRole("button", { name: "向右换道" }));
  expect(root().getAttribute("data-lane")).toBe("right");
  fireEvent.keyDown(screen.getByRole("group", { name: /云路跑道/ }), {
    code: "Space",
  });
  expect(root().getAttribute("data-action")).toBe("jumping");
  travel(700);
  expect(root().getAttribute("data-action")).toBe("grounded");
});
it("does not hijack modifier shortcuts or repeat keys", () => {
  render(<CloudrunnerGarden {...props()} />);
  start();
  const stage = screen.getByRole("group", { name: /云路跑道/ });
  for (const flags of [
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { repeat: true },
  ])
    fireEvent.keyDown(stage, { code: "ArrowRight", ...flags });
  expect(root().getAttribute("data-lane")).toBe("center");
});
it("pause freezes clock and all input, and resuming does not catch up", () => {
  const p = props(),
    r = render(<CloudrunnerGarden {...p} />);
  start();
  travel(600);
  r.rerender(<CloudrunnerGarden {...p} paused />);
  const d = root().getAttribute("data-distance");
  travel(3000);
  fireEvent.keyDown(screen.getByRole("group", { name: /云路跑道/ }), {
    code: "ArrowRight",
  });
  expect(root().getAttribute("data-distance")).toBe(d);
  expect(root().getAttribute("data-lane")).toBe("center");
  r.rerender(<CloudrunnerGarden {...p} />);
  travel(160);
  expect(Number(root().getAttribute("data-distance"))).toBeLessThan(
    Number(d) + 3,
  );
});
it("hidden pages stay safely held until explicit resume", () => {
  render(<CloudrunnerGarden {...props()} />);
  start();
  travel(160);
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: true,
  });
  fireEvent(document, new Event("visibilitychange"));
  const d = root().getAttribute("data-distance");
  travel(2000);
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  fireEvent(document, new Event("visibilitychange"));
  expect(root().getAttribute("data-held")).toBe("true");
  expect(root().getAttribute("data-distance")).toBe(d);
  fireEvent.click(screen.getByRole("button", { name: "回到云路" }));
  travel(160);
  expect(Number(root().getAttribute("data-distance"))).toBeGreaterThan(
    Number(d),
  );
});
it("a single long frame pauses rather than skipping an obstacle", () => {
  render(<CloudrunnerGarden {...props()} />);
  start();
  travel(160);
  const d = root().getAttribute("data-distance");
  tick(1500);
  expect(root().getAttribute("data-held")).toBe("true");
  expect(Number(root().getAttribute("data-distance"))).toBeLessThan(
    Number(d) + 1.5,
  );
});
it("removes animation and audio resources after strict-mode navigation", () => {
  const r = render(
    <StrictMode>
      <CloudrunnerGarden {...props()} />
    </StrictMode>,
  );
  start();
  expect(frames.size).toBe(1);
  r.unmount();
  expect(frames.size).toBe(0);
  expect(audio.dispose).toHaveBeenCalledTimes(2);
});
it("mute, hints, and unsupported undo are explicit", () => {
  const p = props(),
    r = render(<CloudrunnerGarden {...p} />);
  start();
  r.rerender(<CloudrunnerGarden {...p} muted hintToken={1} undoToken={1} />);
  expect(audio.setMuted).toHaveBeenLastCalledWith(true);
  expect(p.onStatus).toHaveBeenCalledWith(
    expect.stringContaining("跑酷不能撤回"),
  );
});
it("failure stops progress and replay resets the whole run", () => {
  const p = props();
  render(<CloudrunnerGarden {...p} />);
  start();
  travel(4000);
  expect(root().getAttribute("data-outcome")).toBe("crashed");
  expect(p.onComplete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "再跑一次" }));
  expect(root().getAttribute("data-distance")).toBe("0.000");
  expect(root().getAttribute("data-lane")).toBe("center");
});
it("storage denial cannot prevent start or replay", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw Error("denied");
  });
  const r = render(<CloudrunnerGarden {...props({ freePlay: true })} />);
  fireEvent.click(screen.getByRole("button", { name: "开始奔跑" }));
  expect(root().getAttribute("data-phase")).toBe("playing");
  r.unmount();
  vi.restoreAllMocks();
});
