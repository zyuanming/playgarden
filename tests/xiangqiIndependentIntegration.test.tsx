// @vitest-environment jsdom
// Independent integration review regression cases.
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode } from "react";
import XiangqiGarden from "../src/games/XiangqiGarden";
import { GameShell } from "../src/components/GameShell";
import {
  initialPosition,
  playMove,
  replayMoves,
  START_FEN,
  RULE_ID,
} from "../src/games/xiangqiLogic";
import {
  roundKey,
  parseRound,
  saveRound,
  defaultSettings,
} from "../src/games/xiangqiStorage";
import { xiangqiLevels } from "../src/games/xiangqiLevels";
import type { GameProps } from "../src/lib/types";
const defaults = (extra: Partial<GameProps> = {}): GameProps => ({
  level: 0,
  freePlay: true,
  paused: false,
  resetToken: 0,
  hintToken: 0,
  undoToken: 0,
  onComplete: vi.fn(),
  onStatus: vi.fn(),
  ...extra,
});
const point = (s: string) =>
  document.querySelector<HTMLButtonElement>(`[data-xiangqi-square="${s}"]`)!;
const root = () => document.querySelector<HTMLElement>(".xiangqi-garden")!;
const moves = () => Number(root().dataset.xiangqiMoves);
const confirm = () => screen.getByRole("button", { name: "确认走棋" });
function move(s: string) {
  fireEvent.click(point(s.slice(0, 2)));
  fireEvent.click(point(s.slice(2)));
  fireEvent.click(confirm());
}
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((e: { data: any }) => void) | null = null;
  onerror: ((e: { preventDefault: () => void }) => void) | null = null;
  request: any;
  terminated = false;
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(r: any) {
    this.request = r;
  }
  terminate() {
    this.terminated = true;
  }
  reply(move: string | null, extra: any = {}) {
    this.onmessage?.({ data: { ...this.request, move, ...extra } });
  }
}
beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const tick = () => act(() => vi.advanceTimersByTime(260));
function local() {
  fireEvent.change(screen.getByLabelText("对手"), {
    target: { value: "local" },
  });
  fireEvent.click(screen.getByRole("button", { name: "按设置开新局" }));
}
it("strict mode schedules exactly one legal reply and duplicate replies are inert", () => {
  vi.useFakeTimers();
  const p = defaults();
  render(
    <StrictMode>
      <XiangqiGarden {...p} />
    </StrictMode>,
  );
  move("a3a4");
  tick();
  expect(FakeWorker.instances).toHaveLength(1);
  const w = FakeWorker.instances[0];
  act(() => {
    w.reply("a6a5");
    w.reply("c6c5");
  });
  expect(moves()).toBe(2);
  expect(w.terminated).toBe(true);
  expect(p.onComplete).not.toHaveBeenCalled();
});
it("same-batch selects and duplicate confirms commit once in local mode", () => {
  render(<XiangqiGarden {...defaults()} />);
  local();
  act(() => {
    fireEvent.click(point("a3"));
    fireEvent.click(point("a4"));
  });
  act(() => {
    fireEvent.click(confirm());
    fireEvent.click(confirm());
  });
  expect(moves()).toBe(1);
});
it("pause cancels worker; old reply rejected; resume schedules new task", () => {
  vi.useFakeTimers();
  const p = defaults();
  const v = render(<XiangqiGarden {...p} />);
  move("a3a4");
  tick();
  const old = FakeWorker.instances[0];
  v.rerender(<XiangqiGarden {...p} paused />);
  expect(old.terminated).toBe(true);
  act(() => old.reply("a6a5"));
  expect(moves()).toBe(1);
  v.rerender(<XiangqiGarden {...p} />);
  tick();
  expect(FakeWorker.instances).toHaveLength(2);
  act(() => FakeWorker.instances[1].reply("a6a5"));
  expect(moves()).toBe(2);
});
it("hidden rejects reply even before visibility event; event cancels and restores", () => {
  vi.useFakeTimers();
  render(<XiangqiGarden {...defaults()} />);
  move("a3a4");
  tick();
  const old = FakeWorker.instances[0];
  Object.defineProperty(document, "hidden", {
    value: true,
    configurable: true,
  });
  act(() => old.reply("a6a5"));
  expect(moves()).toBe(1);
  fireEvent(document, new Event("visibilitychange"));
  expect(old.terminated).toBe(true);
  Object.defineProperty(document, "hidden", {
    value: false,
    configurable: true,
  });
  fireEvent(document, new Event("visibilitychange"));
  tick();
  act(() => FakeWorker.instances.at(-1)!.reply("a6a5"));
  expect(moves()).toBe(2);
});
it("undo pending rejects stale response and preserves initial position", () => {
  vi.useFakeTimers();
  const p = defaults();
  const v = render(<XiangqiGarden {...p} />);
  move("a3a4");
  tick();
  const old = FakeWorker.instances[0];
  v.rerender(<XiangqiGarden {...p} undoToken={1} />);
  expect(moves()).toBe(0);
  expect(old.terminated).toBe(true);
  act(() => old.reply("a6a5"));
  expect(moves()).toBe(0);
});
it("restart and unmount terminate workers and late replies are harmless", () => {
  vi.useFakeTimers();
  const p = defaults();
  const v = render(<XiangqiGarden {...p} />);
  move("a3a4");
  tick();
  const old = FakeWorker.instances[0];
  v.rerender(<XiangqiGarden {...p} resetToken={1} />);
  expect(moves()).toBe(0);
  expect(old.terminated).toBe(true);
  act(() => old.reply("a6a5"));
  expect(moves()).toBe(0);
  move("a3a4");
  tick();
  const other = FakeWorker.instances.at(-1)!;
  v.unmount();
  expect(other.terminated).toBe(true);
  act(() => other.reply("a6a5"));
});
it("worker wrong signature/id ignored; invalid matching move uses one transparent fallback", () => {
  vi.useFakeTimers();
  render(<XiangqiGarden {...defaults()} />);
  move("a3a4");
  tick();
  const w = FakeWorker.instances[0];
  act(() => w.reply("a6a5", { requestId: 999 }));
  expect(moves()).toBe(1);
  act(() => w.reply("a6a5", { moves: [] }));
  expect(moves()).toBe(1);
  act(() => w.reply("a0a9"));
  expect(moves()).toBe(2);
  expect(screen.getByText(/正在使用简易兼容/)).toBeTruthy();
});
it("worker constructor error and watchdog are legal and bounded", () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "Worker",
    class {
      constructor() {
        throw new Error("blocked");
      }
    },
  );
  render(<XiangqiGarden {...defaults()} />);
  move("a3a4");
  tick();
  expect(moves()).toBe(2);
  expect(screen.getByText(/正在使用简易兼容/)).toBeTruthy();
});
it("worker silence watchdog cannot later double-commit", () => {
  vi.useFakeTimers();
  render(<XiangqiGarden {...defaults()} />);
  move("a3a4");
  tick();
  const w = FakeWorker.instances[0];
  act(() => vi.advanceTimersByTime(1600));
  expect(moves()).toBe(2);
  act(() => w.reply("a6a5"));
  expect(moves()).toBe(2);
});
it("black human cannot undo computer opening; can undo their decision and computer reply", () => {
  vi.useFakeTimers();
  const p = defaults();
  const v = render(<XiangqiGarden {...p} />);
  fireEvent.change(screen.getByLabelText("你的棋子"), {
    target: { value: "b" },
  });
  fireEvent.click(screen.getByRole("button", { name: "按设置开新局" }));
  tick();
  act(() => FakeWorker.instances[0].reply("a3a4"));
  expect(moves()).toBe(1);
  v.rerender(<XiangqiGarden {...p} undoToken={1} />);
  expect(moves()).toBe(1);
  move("a6a5");
  tick();
  act(() => FakeWorker.instances.at(-1)!.reply("c3c4"));
  expect(moves()).toBe(3);
  v.rerender(<XiangqiGarden {...p} undoToken={2} />);
  expect(moves()).toBe(1);
  expect(root().dataset.xiangqiTurn).toBe("b");
});
it("keyboard roves, clamps, respects flipped view and requires explicit confirm", () => {
  render(<XiangqiGarden {...defaults()} />);
  local();
  point("a3").focus();
  fireEvent.keyDown(point("a3"), { key: "ArrowLeft" });
  expect(document.activeElement).toBe(point("a3"));
  fireEvent.keyDown(point("a3"), { key: "Enter", ctrlKey: true });
  expect(point("a3").getAttribute("aria-selected")).toBe("false");
  fireEvent.keyDown(point("a3"), { key: "Enter", repeat: true });
  expect(point("a3").getAttribute("aria-selected")).toBe("false");
  fireEvent.keyDown(point("a3"), { key: "Enter" });
  fireEvent.keyDown(point("a3"), { key: "ArrowUp" });
  expect(document.activeElement).toBe(point("a4"));
  fireEvent.keyDown(point("a4"), { key: " " });
  expect(moves()).toBe(0);
  fireEvent.click(confirm());
  expect(moves()).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "翻转棋盘" }));
  point("a6").focus();
  fireEvent.keyDown(point("a6"), { key: "ArrowLeft" });
  expect(document.activeElement).toBe(point("b6"));
  expect(
    screen.getAllByRole("gridcell").filter((e) => e.tabIndex === 0),
  ).toHaveLength(1);
});
it("escape cancels selection without bubbling; subsequent escape reaches shell", async () => {
  const p = defaults();
  render(
    <GameShell
      id="xiangqi"
      onBack={vi.fn()}
      onComplete={vi.fn()}
      completed={[]}
    />,
  );
  await waitFor(() => expect(root()).toBeTruthy());
  fireEvent.click(point("a3"));
  fireEvent.keyDown(point("a3"), { key: "Escape" });
  expect(screen.queryByText("休息一下，也很好。")).toBeNull();
  fireEvent.keyDown(point("a3"), { key: "Escape" });
  expect(screen.getByText("休息一下，也很好。")).toBeTruthy();
});
it("freeplay mode switch and return restores exact history and settings", async () => {
  render(
    <GameShell
      id="xiangqi"
      onBack={vi.fn()}
      onComplete={vi.fn()}
      completed={[]}
    />,
  );
  await waitFor(() => expect(root()).toBeTruthy());
  local();
  move("a3a4");
  move("a6a5");
  fireEvent.click(screen.getByRole("button", { name: "棋形练习" }));
  expect(moves()).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "自由对弈" }));
  expect(moves()).toBe(2);
  expect((screen.getByLabelText("对手") as HTMLSelectElement).value).toBe(
    "local",
  );
});
it("restored practice completion under strict mode completes only once", () => {
  const puzzle = xiangqiLevels[0];
  const p = playMove(initialPosition(puzzle.fen)!, puzzle.solutions[0]);
  saveRound(0, false, puzzle.id, p, defaultSettings);
  const props = defaults({ freePlay: false });
  render(
    <StrictMode>
      <XiangqiGarden {...props} />
    </StrictMode>,
  );
  expect(props.onComplete).toHaveBeenCalledTimes(1);
});
it("practice invalid second move archive resets safely", () => {
  const puzzle = xiangqiLevels[0];
  let p = initialPosition(puzzle.fen)!;
  p = playMove(
    p,
    p.legal.find((x) => !puzzle.solutions.includes(x))!,
  );
  p = playMove(p, p.legal[0]);
  saveRound(0, false, puzzle.id, p, defaultSettings);
  render(<XiangqiGarden {...defaults({ freePlay: false })} />);
  expect(moves()).toBe(0);
  expect(screen.getByText(/这份棋谱无法还原/)).toBeTruthy();
});
it.each([
  "null",
  "[]",
  "{}",
  '"text"',
  "{",
  JSON.stringify({
    version: 1,
    ruleId: RULE_ID,
    puzzleId: "free",
    initial: START_FEN,
    settings: defaultSettings,
    moves: [null],
  }),
  JSON.stringify({
    version: 1,
    ruleId: RULE_ID,
    puzzleId: "free",
    initial: START_FEN,
    settings: defaultSettings,
    moves: ["a0a9"],
  }),
  "x".repeat(60001),
])("corrupt storage rejects safely %s", (raw) => {
  const p = parseRound(raw, START_FEN, "free");
  expect(p.invalid).toBe(true);
  expect(p.position.moves).toHaveLength(0);
});
it("storage write failure remains playable with accurate warning", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  render(<XiangqiGarden {...defaults()} />);
  local();
  move("a3a4");
  expect(moves()).toBe(1);
  expect(screen.getByText(/当前浏览器无法保存棋谱/)).toBeTruthy();
});
it("local repetition terminal locks move, survives reload and undo reopens exact board", () => {
  const p = defaults();
  let view = render(<XiangqiGarden {...p} />);
  local();
  for (const s of [
    "b0c2",
    "b9c7",
    "c2b0",
    "c7b9",
    "b0c2",
    "b9c7",
    "c2b0",
    "c7b9",
  ])
    move(s);
  expect(moves()).toBe(8);
  expect(root().dataset.xiangqiResult).toBe("repetition");
  expect(p.onComplete).not.toHaveBeenCalled();
  move("a3a4");
  expect(moves()).toBe(8);
  view.unmount();
  view = render(<XiangqiGarden {...p} />);
  expect(moves()).toBe(8);
  expect(root().dataset.xiangqiResult).toBe("repetition");
  view.rerender(<XiangqiGarden {...p} undoToken={1} />);
  expect(moves()).toBe(7);
  expect(root().dataset.xiangqiResult).toBe("");
  expect(root().dataset.xiangqiTurn).toBe("b");
});
it("pending new settings do not alter an in-progress game before explicit replacement confirmation", () => {
  render(<XiangqiGarden {...defaults()} />);
  local();
  move("a3a4");
  fireEvent.change(screen.getByLabelText("对手"), {
    target: { value: "computer" },
  });
  fireEvent.change(screen.getByLabelText("你的棋子"), {
    target: { value: "b" },
  });
  fireEvent.click(screen.getByRole("button", { name: "按设置开新局" }));
  expect(moves()).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "保留这局" }));
  expect(moves()).toBe(1);
  move("a6a5");
  expect(moves()).toBe(2);
  fireEvent.click(screen.getByRole("button", { name: "按设置开新局" }));
  fireEvent.click(screen.getByRole("button", { name: "确认结束这局并开新局" }));
  expect(moves()).toBe(0);
  expect(root().dataset.xiangqiThinking).toBe("true");
});
for (const [level, puzzle] of xiangqiLevels.entries())
  for (const solution of puzzle.solutions)
    it(`practice controls accept ${puzzle.id} ${solution}, lock completion and preserve save`, () => {
      const p = defaults({ level, freePlay: false });
      render(<XiangqiGarden {...p} />);
      expect(screen.getAllByRole("gridcell")).toHaveLength(90);
      move(solution);
      expect(root().dataset.xiangqiStage).toBe("success");
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      fireEvent.click(point("e0"));
      fireEvent.keyDown(point("e0"), { key: "Enter" });
      expect(moves()).toBe(1);
      expect(
        JSON.parse(localStorage.getItem(roundKey(level, false))!).moves,
      ).toEqual([solution]);
    });
it("illegal target never commits; reselect changes target set without retaining old preview", () => {
  render(<XiangqiGarden {...defaults()} />);
  local();
  fireEvent.click(point("a3"));
  fireEvent.click(point("a5"));
  expect((confirm() as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(point("a4"));
  expect((confirm() as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(point("c3"));
  expect((confirm() as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(point("c4"));
  fireEvent.click(confirm());
  expect(moves()).toBe(1);
  expect(point("a3").getAttribute("aria-label")).toContain("红方兵");
  expect(point("c4").getAttribute("aria-label")).toContain("红方兵");
});
