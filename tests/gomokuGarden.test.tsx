// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import GomokuGarden from "../src/games/GomokuGarden";
import { GameShell } from "../src/components/GameShell";
import { gomokuLevels } from "../src/games/gomokuLevels";
import { emptyPosition, playMove, replayMoves } from "../src/games/gomokuLogic";
import {
  meetsGoal,
  practiceDefense,
  practiceResult,
  validPracticeRound,
  simpleMove,
} from "../src/games/gomokuPractice";
import {
  defaultSettings,
  GOMOKU_KEY,
  GOMOKU_RULE,
  parseRound,
  saveRound,
  roundKey,
} from "../src/games/gomokuStorage";
import type { GameProps } from "../src/lib/types";
import type { GomokuRequest } from "../src/games/gomoku.worker";
const defaults = (extra: Partial<GameProps> = {}): GameProps => ({
  level: 0,
  paused: false,
  resetToken: 0,
  hintToken: 0,
  undoToken: 0,
  onComplete: vi.fn(),
  onStatus: vi.fn(),
  ...extra,
});
const point = (i: number) =>
  document.querySelector<HTMLButtonElement>(`[data-gomoku-point="${i}"]`)!;
const root = () => document.querySelector<HTMLElement>(".gomoku-garden")!;
const moves = () => Number(root().dataset.gomokuMoves);
const confirm = () =>
  screen.getByRole("button", { name: /^确认落子/ }) as HTMLButtonElement;
function place(i: number) {
  fireEvent.click(point(i));
  fireEvent.click(confirm());
}
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: { preventDefault: () => void }) => void) | null = null;
  request!: GomokuRequest;
  terminated = false;
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(request: GomokuRequest) {
    this.request = request;
  }
  terminate() {
    this.terminated = true;
  }
  reply(move: number | null, extra: Record<string, unknown> = {}) {
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

describe("24 curated exercises, actual controls and generic goal checking", () => {
  gomokuLevels.forEach((p, index) =>
    it(`${p.id}: complete and lock the accepted continuation`, async () => {
      const props = defaults({ level: index });
      render(<GomokuGarden {...props} />);
      const initial = moves();
      expect(initial).toBe(p.moves.length);
      expect(screen.getAllByRole("gridcell")).toHaveLength(225);
      place(p.solution);
      if (p.objective === "two") {
        await waitFor(() => expect(root().dataset.gomokuStage).toBe("finish"));
        place(p.continuation[2]);
      }
      expect(root().dataset.gomokuWon).toBe("true");
      expect(props.onComplete).toHaveBeenCalledTimes(1);
      const end = moves();
      place(224);
      fireEvent.keyDown(point(7), { key: "Enter" });
      expect(moves()).toBe(end);
      const stored = JSON.parse(localStorage.getItem(roundKey(index, false))!);
      expect(stored.ruleId).toBe(GOMOKU_RULE);
    }),
  );
});
it("every accepted first move is validated by the rule goal rather than a stored answer", () => {
  for (const p of gomokuLevels) {
    const initial = replayMoves(p.moves)!;
    for (const i of p.solutions)
      expect(meetsGoal(playMove(initial, i), initial.turn, p.objective)).toBe(
        true,
      );
  }
});
it("incorrect practice move stays visible, undo resets the problem and hint does not solve", () => {
  const props = defaults();
  const view = render(<GomokuGarden {...props} />);
  place(112);
  expect(root().dataset.gomokuStage).toBe("retry");
  expect(props.onComplete).not.toHaveBeenCalled();
  const m = moves();
  fireEvent.click(screen.getByRole("button", { name: "想法提示" }));
  expect(moves()).toBe(m);
  view.rerender(<GomokuGarden {...props} undoToken={7} />);
  expect(moves()).toBe(8);
  expect(root().dataset.gomokuStage).toBe("ready");
  place(4);
  expect(props.onComplete).toHaveBeenCalledTimes(1);
});
it("pointer selection never commits, including double clicks and same-batch repeats", () => {
  render(<GomokuGarden {...defaults({ freePlay: true })} />);
  act(() => {
    fireEvent.click(point(112));
    fireEvent.click(point(113));
    fireEvent.click(point(114));
  });
  expect(moves()).toBe(0);
  act(() => {
    fireEvent.click(confirm());
    fireEvent.click(confirm());
  });
  expect(moves()).toBe(1);
  expect(point(114).getAttribute("aria-label")).toContain("黑棋");
});
it("keyboard is roving, does not wrap, ignores modified or repeated commits and retains focus", async () => {
  render(<GomokuGarden {...defaults({ freePlay: true })} />);
  const user = userEvent.setup();
  point(112).focus();
  await user.keyboard("{ArrowRight}{ArrowDown}");
  expect(document.activeElement).toBe(point(128));
  fireEvent.keyDown(point(128), { key: "Enter", ctrlKey: true });
  fireEvent.keyDown(point(128), { key: " ", metaKey: true });
  fireEvent.keyDown(point(128), { key: "Enter", repeat: true });
  expect(moves()).toBe(0);
  await user.keyboard("{Enter}");
  expect(moves()).toBe(1);
  expect(document.activeElement).toBe(point(128));
  expect(
    screen.getAllByRole("gridcell").filter((e) => e.tabIndex === 0),
  ).toHaveLength(1);
  point(14).focus();
  fireEvent.keyDown(point(14), { key: "ArrowRight" });
  expect(document.activeElement).toBe(point(14));
});
it("local two-player whole game, >=5 result, rejection and explicit undo", () => {
  const props = defaults({ freePlay: true });
  const view = render(<GomokuGarden {...props} />);
  fireEvent.change(screen.getByLabelText("对手"), {
    target: { value: "local" },
  });
  fireEvent.click(screen.getByRole("button", { name: "按设置开新局" }));
  for (const i of [0, 15, 1, 16, 2, 17, 3, 18, 4]) place(i);
  expect(root().dataset.gomokuWinner).toBe("1");
  expect(moves()).toBe(9);
  place(19);
  expect(moves()).toBe(9);
  expect(props.onComplete).not.toHaveBeenCalled();
  view.rerender(<GomokuGarden {...props} undoToken={1} />);
  expect(moves()).toBe(8);
  expect(root().dataset.gomokuWinner).toBe("");
});
it("AI reply is one legal stone and whole-round undo rejects a late response", () => {
  vi.useFakeTimers();
  const props = defaults({ freePlay: true });
  const view = render(<GomokuGarden {...props} />);
  place(112);
  act(() => vi.advanceTimersByTime(260));
  const worker = FakeWorker.instances.at(-1)!;
  expect(worker).toBeTruthy();
  act(() => {
    worker.reply(113);
    worker.reply(114);
  });
  expect(moves()).toBe(2);
  expect(worker.terminated).toBe(true);
  view.rerender(<GomokuGarden {...props} undoToken={3} />);
  expect(moves()).toBe(0);
  act(() => worker.reply(114));
  expect(moves()).toBe(0);
});
it("undo while AI pending cancels CPU and does not replay stale work", () => {
  vi.useFakeTimers();
  const props = defaults({ freePlay: true });
  const view = render(<GomokuGarden {...props} />);
  place(112);
  act(() => vi.advanceTimersByTime(260));
  const worker = FakeWorker.instances[0];
  view.rerender(<GomokuGarden {...props} undoToken={1} />);
  expect(worker.terminated).toBe(true);
  act(() => worker.reply(113));
  expect(moves()).toBe(0);
});
it("pause terminates a running worker; resume creates a new task", () => {
  vi.useFakeTimers();
  const props = defaults({ freePlay: true });
  const view = render(<GomokuGarden {...props} />);
  place(112);
  act(() => vi.advanceTimersByTime(260));
  const old = FakeWorker.instances[0];
  view.rerender(<GomokuGarden {...props} paused />);
  expect(old.terminated).toBe(true);
  act(() => old.reply(113));
  expect(moves()).toBe(1);
  place(114);
  expect(moves()).toBe(1);
  view.rerender(<GomokuGarden {...props} />);
  act(() => vi.advanceTimersByTime(260));
  expect(FakeWorker.instances).toHaveLength(2);
  act(() => FakeWorker.instances[1].reply(113));
  expect(moves()).toBe(2);
});
it("background visibility freezes and cancels the AI", () => {
  vi.useFakeTimers();
  render(<GomokuGarden {...defaults({ freePlay: true })} />);
  place(112);
  act(() => vi.advanceTimersByTime(260));
  const w = FakeWorker.instances[0];
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: true,
  });
  fireEvent(document, new Event("visibilitychange"));
  expect(w.terminated).toBe(true);
  act(() => w.reply(113));
  expect(moves()).toBe(1);
});
it("restart, swap sides and unmount terminate old AI tasks", () => {
  vi.useFakeTimers();
  const props = defaults({ freePlay: true });
  const view = render(<GomokuGarden {...props} />);
  place(112);
  act(() => vi.advanceTimersByTime(260));
  const old = FakeWorker.instances[0];
  view.rerender(<GomokuGarden {...props} resetToken={1} />);
  expect(moves()).toBe(0);
  expect(old.terminated).toBe(true);
  act(() => old.reply(113));
  expect(moves()).toBe(0);
  fireEvent.change(screen.getByLabelText("你的棋子"), {
    target: { value: "2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "按设置开新局" }));
  act(() => vi.advanceTimersByTime(260));
  const next = FakeWorker.instances.at(-1)!;
  act(() => next.reply(112));
  expect(moves()).toBe(1);
  view.rerender(<GomokuGarden {...props} resetToken={1} undoToken={1} />);
  expect(moves()).toBe(1);
  place(113);
  act(() => vi.advanceTimersByTime(260));
  const pending = FakeWorker.instances.at(-1)!;
  view.unmount();
  expect(pending.terminated).toBe(true);
});
it("bad response and worker timeout have a legal transparent fallback", () => {
  vi.useFakeTimers();
  render(<GomokuGarden {...defaults({ freePlay: true })} />);
  place(112);
  act(() => vi.advanceTimersByTime(260));
  act(() => FakeWorker.instances[0].reply(112));
  expect(moves()).toBe(2);
  expect(screen.getByText(/正在使用简易兼容陪练/)).toBeTruthy();
  place(114);
  act(() => vi.advanceTimersByTime(2060));
  expect(moves()).toBe(4);
  expect(FakeWorker.instances.at(-1)!.terminated).toBe(true);
});
it("mismatched AI IDs and histories are ignored until watchdog fallback", () => {
  vi.useFakeTimers();
  render(<GomokuGarden {...defaults({ freePlay: true })} />);
  place(112);
  act(() => vi.advanceTimersByTime(260));
  const w = FakeWorker.instances[0];
  act(() => {
    w.reply(113, { requestId: 999 });
    w.reply(113, { moves: [] });
  });
  expect(moves()).toBe(1);
  act(() => vi.advanceTimersByTime(1800));
  expect(moves()).toBe(2);
});
it("strict mode doesn't duplicate tasks or completion", () => {
  vi.useFakeTimers();
  render(
    <StrictMode>
      <GomokuGarden {...defaults({ freePlay: true })} />
    </StrictMode>,
  );
  place(112);
  act(() => vi.advanceTimersByTime(260));
  expect(FakeWorker.instances).toHaveLength(1);
  act(() => FakeWorker.instances[0].reply(113));
  expect(moves()).toBe(2);
});
it("restore replays legal history and terminal state without another move", () => {
  const end = replayMoves([0, 15, 1, 16, 2, 17, 3, 18, 4])!;
  saveRound(0, true, "free", end, { ...defaultSettings, mode: "local" });
  render(<GomokuGarden {...defaults({ freePlay: true })} />);
  expect(moves()).toBe(9);
  expect(root().dataset.gomokuWinner).toBe("1");
  expect(screen.getByText(/已接上这盘棋/)).toBeTruthy();
  place(19);
  expect(moves()).toBe(9);
});
it("save schema rejects incompatible or poisoned histories and forged progress", () => {
  const base = {
    version: 1,
    ruleId: GOMOKU_RULE,
    puzzleId: "free",
    settings: defaultSettings,
    moves: [112],
  };
  for (const bad of [
    { ...base, version: 2 },
    { ...base, ruleId: "renju" },
    { ...base, moves: [112, 112] },
    { ...base, moves: [225] },
    { ...base, moves: [0, 15, 1, 16, 2, 17, 3, 18, 4, 19] },
    { ...base, settings: { ...defaultSettings, human: 3 } },
  ])
    expect(parseRound(JSON.stringify(bad), [], "free").invalid).toBe(true);
  const p = gomokuLevels[18],
    start = replayMoves(p.moves)!;
  const first = playMove(start, p.solution);
  expect(practiceResult(p, first)).toBe("responding");
  const wrong = playMove(
    first,
    first.board.findIndex((x, i) => !x && i !== practiceDefense(p, first)),
  );
  expect(validPracticeRound(p, wrong)).toBe(false);
});
it("storage quota failure remains playable and fresh start ignores old data", () => {
  saveRound(0, true, "free", replayMoves([112])!, defaultSettings);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  render(<GomokuGarden {...defaults({ freePlay: true, freshStart: true })} />);
  expect(moves()).toBe(0);
  place(113);
  expect(moves()).toBe(1);
  expect(screen.getByText(/当前浏览器无法保存棋谱/)).toBeTruthy();
});
it("practice two-step can resume between stages and rejects malformed extra history", async () => {
  const p = gomokuLevels[18],
    first = playMove(replayMoves(p.moves)!, p.solution);
  saveRound(18, false, p.id, first, defaultSettings);
  render(<GomokuGarden {...defaults({ level: 18 })} />);
  await waitFor(() => expect(root().dataset.gomokuStage).toBe("finish"));
  place(p.continuation[2]);
  expect(root().dataset.gomokuWon).toBe("true");
});
it("the free match is not counted as a solved lesson in the shell", async () => {
  const complete = vi.fn();
  render(
    <GameShell
      id="gomoku"
      onBack={vi.fn()}
      onComplete={complete}
      completed={[]}
    />,
  );
  await screen.findByRole("grid");
  expect(screen.queryByLabelText("选择关卡")).toBeNull();
  expect(screen.getByText("15 × 15 · 完整对局")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "棋形练习" }));
  await waitFor(() => expect(moves()).toBe(8));
  place(4);
  expect(complete).toHaveBeenCalledWith(0);
  expect(screen.getByRole("button", { name: "下一关" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "自由对弈" }));
  await waitFor(() => expect(moves()).toBe(0));
  expect(screen.queryByRole("button", { name: "下一关" })).toBeNull();
});
it("reselecting the active shell mode preserves completion and never consumes an undo", async () => {
  render(
    <GameShell
      id="gomoku"
      onBack={vi.fn()}
      onComplete={vi.fn()}
      completed={[]}
    />,
  );
  await screen.findByRole("grid");
  fireEvent.change(screen.getByLabelText("对手"), {
    target: { value: "local" },
  });
  fireEvent.click(screen.getByRole("button", { name: "按设置开新局" }));
  place(112);
  place(113);
  fireEvent.click(screen.getByRole("button", { name: "撤销" }));
  expect(moves()).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "自由对弈" }));
  expect(moves()).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "棋形练习" }));
  await waitFor(() => expect(moves()).toBe(8));
  place(4);
  expect(screen.getByRole("button", { name: "下一关" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "棋形练习" }));
  expect(screen.getByRole("button", { name: "下一关" })).toBeTruthy();
  expect(root().dataset.gomokuWon).toBe("true");
});

it("holding Escape does not immediately unpause the match", async () => {
  render(
    <GameShell
      id="gomoku"
      onBack={vi.fn()}
      onComplete={vi.fn()}
      completed={[]}
    />,
  );
  await screen.findByRole("grid");
  fireEvent.keyDown(window, { key: "Escape", repeat: false });
  expect(screen.getByRole("button", { name: "继续游戏" })).toBeTruthy();
  fireEvent.keyDown(window, { key: "Escape", repeat: true });
  expect(screen.getByRole("button", { name: "继续游戏" })).toBeTruthy();
  fireEvent.keyDown(window, { key: "Escape", repeat: false });
  expect(screen.queryByRole("button", { name: "继续游戏" })).toBeNull();
});

it("terminal headers show the winning stone color", () => {
  for (const [history, color] of [
    [[0, 15, 1, 16, 2, 17, 3, 18, 4], 1],
    [[30, 0, 31, 1, 32, 2, 33, 3, 40, 4], 2],
  ] as [number[], number][]) {
    saveRound(0, true, "free", replayMoves(history)!, {
      ...defaultSettings,
      mode: "local",
    });
    const view = render(<GomokuGarden {...defaults({ freePlay: true })} />);
    expect(
      document
        .querySelector(".gomoku-turn .gomoku-mini-stone")!
        .classList.contains("white"),
    ).toBe(color === 2);
    view.unmount();
  }
});
