// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { StrictMode } from "react";
import XiangqiGarden from "../src/games/XiangqiGarden";
import { GameShell } from "../src/components/GameShell";
import { xiangqiLevels } from "../src/games/xiangqiLevels";
import {
  initialPosition,
  playMove,
  START_FEN,
} from "../src/games/xiangqiLogic";
import {
  saveRound,
  roundKey,
  defaultSettings,
} from "../src/games/xiangqiStorage";
import type { GameProps } from "../src/lib/types";
import type { XiangqiRequest } from "../src/games/xiangqi.worker";
const props = (extra: Partial<GameProps> = {}): GameProps => ({
  level: 0,
  paused: false,
  resetToken: 0,
  hintToken: 0,
  undoToken: 0,
  onComplete: vi.fn(),
  onStatus: vi.fn(),
  ...extra,
});
const square = (s: string) =>
  document.querySelector<HTMLButtonElement>(`[data-xiangqi-square="${s}"]`)!;
const root = () => document.querySelector(".xiangqi-garden")!;
const choose = (move: string) => {
  fireEvent.click(square(move.slice(0, 2)));
  fireEvent.click(square(move.slice(2)));
};
const move = (m: string) => {
  choose(m);
  fireEvent.click(screen.getByRole("button", { name: "确认走棋" }));
};
function local() {
  fireEvent.change(screen.getByLabelText("对手"), {
    target: { value: "local" },
  });
  fireEvent.click(screen.getByRole("button", { name: "按设置开新局" }));
}
class MockWorker {
  static all: MockWorker[] = [];
  request!: XiangqiRequest;
  terminated = false;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: { preventDefault: () => void }) => void) | null = null;
  constructor() {
    MockWorker.all.push(this);
  }
  postMessage(request: XiangqiRequest) {
    this.request = request;
  }
  terminate() {
    this.terminated = true;
  }
  reply(move = "a6a5", override: Record<string, unknown> = {}) {
    this.onmessage?.({
      data: { ...this.request, move, ...override },
    } as MessageEvent);
  }
}
beforeEach(() => {
  localStorage.clear();
  MockWorker.all = [];
  vi.stubGlobal("Worker", MockWorker);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("Chinese chess interaction and cancellation", () => {
  it("selects a man and a legal destination before an explicit commitment", () => {
    render(<XiangqiGarden {...props({ freePlay: true })} />);
    choose("a3a4");
    expect(root().getAttribute("data-xiangqi-moves")).toBe("0");
    expect(square("a4").getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "确认走棋" }));
    expect(root().getAttribute("data-xiangqi-moves")).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "确认走棋" }));
    expect(root().getAttribute("data-xiangqi-moves")).toBe("1");
  });
  it("rejects enemy pieces, backward soldiers and jumping a rook", () => {
    render(<XiangqiGarden {...props({ freePlay: true })} />);
    choose("a6a5");
    expect(
      screen.getByRole("button", { name: "确认走棋" }).hasAttribute("disabled"),
    ).toBe(true);
    choose("a3a2");
    expect(
      screen.getByRole("button", { name: "确认走棋" }).hasAttribute("disabled"),
    ).toBe(true);
    choose("a0a9");
    expect(root().getAttribute("data-xiangqi-moves")).toBe("0");
  });
  it("supports two humans and undoes exactly one ply", () => {
    const p = props({ freePlay: true }),
      v = render(<XiangqiGarden {...p} />);
    local();
    move("a3a4");
    move("a6a5");
    v.rerender(<XiangqiGarden {...p} undoToken={1} />);
    expect(root().getAttribute("data-xiangqi-moves")).toBe("1");
    expect(root().getAttribute("data-xiangqi-turn")).toBe("b");
    expect(square("a6").textContent).toContain("卒");
  });
  it("retains selected canonical coordinates through keyboard navigation and a flipped board", () => {
    render(<XiangqiGarden {...props({ freePlay: true })} />);
    square("a3").focus();
    fireEvent.keyDown(square("a3"), { key: "Enter" });
    fireEvent.keyDown(square("a3"), { key: "ArrowUp" });
    expect(document.activeElement).toBe(square("a4"));
    fireEvent.keyDown(square("a4"), { key: "Enter" });
    expect(square("a4").getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(square("a4"), { key: "Escape" });
    expect(square("a4").getAttribute("aria-selected")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "翻转棋盘" }));
    fireEvent.keyDown(square("a4"), { key: "ArrowUp" });
    expect(document.activeElement).toBe(square("a3"));
  });
  it("ignores repeated Enter and modifier clicks", () => {
    render(<XiangqiGarden {...props({ freePlay: true })} />);
    fireEvent.keyDown(square("a3"), { key: "Enter", repeat: true });
    fireEvent.click(square("a3"), { ctrlKey: true });
    expect(square("a3").getAttribute("aria-selected")).toBe("false");
  });
  it("never completes a practice from selecting alone; actual capture completes once under StrictMode", () => {
    const complete = vi.fn();
    render(
      <StrictMode>
        <XiangqiGarden {...props({ onComplete: complete })} />
      </StrictMode>,
    );
    choose("a0a6");
    expect(complete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "确认走棋" }));
    expect(complete).toHaveBeenCalledTimes(1);
    expect(root().getAttribute("data-xiangqi-stage")).toBe("success");
  });
  for (const [level, puzzle] of xiangqiLevels.entries())
    it(`completes ${puzzle.id} by real controls`, () => {
      const done = vi.fn();
      render(<XiangqiGarden {...props({ level, onComplete: done })} />);
      move(puzzle.solutions[0]);
      expect(done).toHaveBeenCalledTimes(1);
      expect(root().getAttribute("data-xiangqi-stage")).toBe("success");
    });
  it("allows a legal wrong practice move to be undone", () => {
    render(<XiangqiGarden {...props()} />);
    move("a0a1");
    expect(root().getAttribute("data-xiangqi-stage")).toBe("retry");
    fireEvent.click(screen.getByRole("button", { name: "撤销，再想一手" }));
    expect(root().getAttribute("data-xiangqi-stage")).toBe("ready");
    move("a0a6");
    expect(root().getAttribute("data-xiangqi-stage")).toBe("success");
  });
  it("cancels active search on pause and ignores its late result, then resumes a new worker", () => {
    vi.useFakeTimers();
    const p = props({ freePlay: true }),
      v = render(<XiangqiGarden {...p} />);
    move("a3a4");
    act(() => vi.advanceTimersByTime(300));
    const old = MockWorker.all[0];
    expect(old).toBeDefined();
    v.rerender(<XiangqiGarden {...p} paused />);
    expect(old.terminated).toBe(true);
    act(() => old.reply());
    expect(root().getAttribute("data-xiangqi-moves")).toBe("1");
    v.rerender(<XiangqiGarden {...p} />);
    act(() => vi.advanceTimersByTime(300));
    const next = MockWorker.all.at(-1)!;
    expect(next).not.toBe(old);
    act(() => next.reply());
    expect(root().getAttribute("data-xiangqi-moves")).toBe("2");
    expect(next.terminated).toBe(true);
  });
  it("undo cancels actual CPU work and rejects late or duplicate messages", () => {
    vi.useFakeTimers();
    const p = props({ freePlay: true }),
      v = render(<XiangqiGarden {...p} />);
    move("a3a4");
    act(() => vi.advanceTimersByTime(300));
    const old = MockWorker.all[0];
    v.rerender(<XiangqiGarden {...p} undoToken={1} />);
    expect(old.terminated).toBe(true);
    act(() => old.reply());
    expect(root().getAttribute("data-xiangqi-moves")).toBe("0");
    move("c3c4");
    act(() => vi.advanceTimersByTime(300));
    const fresh = MockWorker.all.at(-1)!;
    act(() => fresh.reply("a6a5", { moves: ["a3a4"] }));
    expect(root().getAttribute("data-xiangqi-moves")).toBe("1");
    act(() => fresh.reply());
    act(() => fresh.reply());
    expect(root().getAttribute("data-xiangqi-moves")).toBe("2");
  });
  it("an invalid worker move safely falls back to a legal move", () => {
    vi.useFakeTimers();
    render(<XiangqiGarden {...props({ freePlay: true })} />);
    move("a3a4");
    act(() => vi.advanceTimersByTime(300));
    act(() => MockWorker.all[0].reply("bad"));
    expect(root().getAttribute("data-xiangqi-moves")).toBe("2");
    expect(screen.getByText(/正在使用简易兼容陪练/)).toBeTruthy();
  });
  it("a watchdog terminates unresponsive work and commits only one legal response", () => {
    vi.useFakeTimers();
    render(<XiangqiGarden {...props({ freePlay: true })} />);
    move("a3a4");
    act(() => vi.advanceTimersByTime(300));
    const worker = MockWorker.all[0];
    act(() => vi.advanceTimersByTime(1700));
    expect(worker.terminated).toBe(true);
    expect(root().getAttribute("data-xiangqi-moves")).toBe("2");
    act(() => worker.reply());
    expect(root().getAttribute("data-xiangqi-moves")).toBe("2");
  });
  it("unmount stops a worker, and reloading replays the entire saved match", () => {
    vi.useFakeTimers();
    const v = render(<XiangqiGarden {...props({ freePlay: true })} />);
    move("a3a4");
    act(() => vi.advanceTimersByTime(300));
    const worker = MockWorker.all[0];
    v.unmount();
    expect(worker.terminated).toBe(true);
    render(<XiangqiGarden {...props({ freePlay: true })} />);
    expect(root().getAttribute("data-xiangqi-moves")).toBe("1");
    expect(square("a4").textContent).toContain("兵");
  });
  it("confirming new settings cancels a search but retaining a match does not reset it", () => {
    vi.useFakeTimers();
    render(<XiangqiGarden {...props({ freePlay: true })} />);
    move("a3a4");
    act(() => vi.advanceTimersByTime(300));
    const old = MockWorker.all[0];
    fireEvent.click(screen.getByRole("button", { name: "按设置开新局" }));
    fireEvent.click(screen.getByRole("button", { name: "保留这局" }));
    expect(root().getAttribute("data-xiangqi-moves")).toBe("1");
    fireEvent.change(screen.getByLabelText("对手"), {
      target: { value: "local" },
    });
    fireEvent.click(screen.getByRole("button", { name: "按设置开新局" }));
    fireEvent.click(
      screen.getByRole("button", { name: "确认结束这局并开新局" }),
    );
    expect(old.terminated).toBe(true);
    act(() => old.reply());
    expect(root().getAttribute("data-xiangqi-moves")).toBe("0");
  });
  it("restores a completed practice and reports it once, but free matches never earn levels", () => {
    saveRound(
      0,
      false,
      xiangqiLevels[0].id,
      playMove(initialPosition(xiangqiLevels[0].fen)!, "a0a6"),
      defaultSettings,
    );
    const p = props(),
      v = render(<XiangqiGarden {...p} />);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    v.unmount();
    const free = props({ freePlay: true });
    render(<XiangqiGarden {...free} />);
    local();
    move("a3a4");
    expect(free.onComplete).not.toHaveBeenCalled();
  });
  it("rejects corrupt saved history and remains playable when storage is denied", () => {
    localStorage.setItem(roundKey(0, true), "bad");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("denied");
    });
    render(<XiangqiGarden {...props({ freePlay: true })} />);
    expect(screen.getByText(/无法还原/)).toBeTruthy();
    expect(screen.getByText(/当前浏览器无法保存棋谱/)).toBeTruthy();
    move("a3a4");
    expect(root().getAttribute("data-xiangqi-moves")).toBe("1");
  });
  it("shows the actual BSD source license in the shared shell", () => {
    render(
      <GameShell
        id="xiangqi"
        onBack={vi.fn()}
        onComplete={vi.fn()}
        completed={[]}
      />,
    );
    expect(
      screen
        .getByRole("link", { name: "完整 BSD-2-Clause 许可" })
        .getAttribute("href"),
    ).toBe("./xiangqi-LICENSE.txt");
  });
});
