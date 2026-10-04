// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { act } from "react";
import App from "../src/App";
import RobotRoutes from "../src/games/RobotRoutes";
import LightLab from "../src/games/LightLab";
import BridgeBlocks from "../src/games/BridgeBlocks";
import { robotLevels, commandLabels } from "../src/games/robotLogic";
import { lightLevels } from "../src/games/lightLogic";
import { bridgeLevels } from "../src/games/bridgeLogic";
import { STORAGE_KEY } from "../src/lib/progress";
vi.mock("../src/components/BridgeScene", () => ({
  BridgeScene: () => <div>3D preview mocked for DOM tests</div>,
}));
vi.mock("../src/lib/sound", () => ({ completionChime: vi.fn() }));
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const base = {
  paused: false,
  resetToken: 0,
  hintToken: 0,
  undoToken: 0,
  onComplete: vi.fn(),
  onStatus: vi.fn(),
};
describe("Catalog and shell interactions", () => {
  it("filters, favorites and reload persistence", () => {
    const first = render(<App />);
    expect(screen.getAllByRole("article")).toHaveLength(3);
    fireEvent.change(screen.getByRole("textbox", { name: "搜索游戏" }), {
      target: { value: "机器人" },
    });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.change(screen.getByRole("textbox", { name: "搜索游戏" }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "收藏光线实验室" }));
    fireEvent.click(screen.getByRole("button", { name: "我的收藏" }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).favorites).toEqual([
      "light",
    ]);
    first.unmount();
    render(<App />);
    expect(
      screen
        .getByRole("button", { name: "取消收藏光线实验室" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
  it("handles empty results and difficulty", () => {
    render(<App />);
    fireEvent.change(screen.getByRole("combobox", { name: "筛选难度" }), {
      target: { value: "中级" },
    });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "不存在" },
    });
    expect(screen.getByText("暂时没有匹配的游戏")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "查看全部游戏" }));
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });
  it("wins, persists progress, resets and pauses with Escape", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "开始玩光线实验室" }));
    const mirror = await screen.findByRole("button", { name: /镜子 1/ });
    fireEvent.click(mirror);
    expect(await screen.findByRole("button", { name: "下一关" })).toBeTruthy();
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).completed.light,
    ).toEqual([0]);
    fireEvent.click(screen.getByRole("button", { name: "重来" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "下一关" })).toBeNull(),
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByText("休息一下，也很好。")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /镜子 1/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("休息一下，也很好。")).toBeNull();
  });
});
describe("All nine playable levels", () => {
  lightLevels.forEach((l, level) =>
    it(`Light level ${level + 1} click solution`, () => {
      const done = vi.fn();
      render(<LightLab {...base} level={level} onComplete={done} />);
      l.mirrors.forEach((m, i) => {
        if (m.slash !== l.solution[i])
          fireEvent.click(
            screen.getByRole("button", { name: new RegExp(`镜子 ${i + 1}`) }),
          );
      });
      expect(done).toHaveBeenCalledOnce();
    }),
  );
  bridgeLevels.forEach((l, level) =>
    it(`Bridge level ${level + 1} click solution`, () => {
      const done = vi.fn();
      render(<BridgeBlocks {...base} level={level} onComplete={done} />);
      l.tiles.forEach((t, i) => {
        const btn = screen.getByRole("button", {
          name: `${t.x + 1} 列 ${t.y + 1} 行桥块，旋转`,
        });
        for (let n = 0; n < (l.solution[i] - t.rotation + 4) % 4; n++)
          fireEvent.click(btn);
      });
      expect(done).toHaveBeenCalledOnce();
    }),
  );
  robotLevels.forEach((l, level) =>
    it(`Robot level ${level + 1} runs program`, async () => {
      vi.useFakeTimers();
      const done = vi.fn();
      render(<RobotRoutes {...base} level={level} onComplete={done} />);
      l.solution.forEach((c) =>
        fireEvent.click(screen.getByRole("button", { name: commandLabels[c] })),
      );
      fireEvent.change(screen.getByRole("combobox"), {
        target: { value: String(l.repeat) },
      });
      fireEvent.click(screen.getByRole("button", { name: "运行程序" }));
      for (let i = 0; i <= l.solution.length * l.repeat; i++)
        await act(async () => {
          await vi.advanceTimersByTimeAsync(410);
        });
      expect(done).toHaveBeenCalledOnce();
    }),
  );
});
it("robot pauses and resumes execution", async () => {
  vi.useFakeTimers();
  const done = vi.fn();
  const props = { ...base, level: 0, onComplete: done };
  const view = render(<RobotRoutes {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "前进" }));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "4" } });
  fireEvent.click(screen.getByRole("button", { name: "运行程序" }));
  view.rerender(<RobotRoutes {...props} paused />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(done).not.toHaveBeenCalled();
  view.rerender(<RobotRoutes {...props} />);
  for (let i = 0; i < 5; i++)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(410);
    });
  expect(done).toHaveBeenCalledOnce();
});
it("light undo restores its previous mirror", () => {
  const view = render(<LightLab {...base} level={1} />);
  fireEvent.click(screen.getByRole("button", { name: /镜子 1/ }));
  expect(
    screen.getByRole("button", { name: "镜子 1，斜杠，点击旋转" }),
  ).toBeTruthy();
  view.rerender(<LightLab {...base} level={1} undoToken={1} />);
  expect(
    screen.getByRole("button", { name: "镜子 1，反斜杠，点击旋转" }),
  ).toBeTruthy();
});

it("changing robot levels after a long program never renders an invalid frame", async () => {
  vi.useFakeTimers();
  const props = { ...base, level: 1 };
  const view = render(<RobotRoutes {...props} />);
  for (const c of robotLevels[1].solution)
    fireEvent.click(screen.getByRole("button", { name: commandLabels[c] }));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "4" } });
  fireEvent.click(screen.getByRole("button", { name: "运行程序" }));
  for (let i = 0; i < 18; i++)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(410);
    });
  expect(() =>
    view.rerender(<RobotRoutes {...props} level={2} />),
  ).not.toThrow();
  expect(screen.getByRole("button", { name: "前进" })).toBeTruthy();
});
