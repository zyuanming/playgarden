// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import App from "../src/App";
import { games } from "../src/lib/registry";
import { orderCatalog } from "../src/lib/catalogOrder";
import { STORAGE_KEY, parseProgress } from "../src/lib/progress";
afterEach(cleanup);
beforeEach(() => localStorage.clear());
describe("Large-catalog discovery", () => {
  it("keeps stable editorial/newest order without mutating the registry", () => {
    const before = games.map((g) => g.id);
    expect(orderCatalog(games, "featured", {}).map((g) => g.id)).toEqual(
      before,
    );
    expect(orderCatalog(games, "newest", {}).map((g) => g.id)).toEqual(
      [...before].reverse(),
    );
    expect(games.map((g) => g.id)).toEqual(before);
  });
  it("prioritizes in-progress games over unstarted and complete games, ignoring malformed level markers", () => {
    const sample = games.slice(0, 4),
      [a, b, c, d] = sample;
    const done = {
      [a.id]: Array.from({ length: a.levelCount }, (_, i) => i),
      [b.id]: [0, 0, 999, -1],
      [c.id]: [],
      [d.id]: [0, 1],
    };
    expect(orderCatalog(sample, "continue", done).map((g) => g.id)).toEqual([
      d.id,
      b.id,
      c.id,
      a.id,
    ]);
  });
  it("discovers newest games and resets pagination without losing filter access", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "再看看更多游戏" }));
    expect(screen.getAllByRole("article")).toHaveLength(24);
    fireEvent.change(screen.getByRole("combobox", { name: "游戏排序" }), {
      target: { value: "newest" },
    });
    expect(screen.getAllByRole("article")).toHaveLength(12);
    expect(screen.getAllByRole("article")[0].textContent).toContain(
      games.at(-1)!.title,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "搜索游戏" }), {
      target: { value: "机器人" },
    });
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });
  it("continues a started game from persisted progress", () => {
    const progress = parseProgress(null),
      last = games.at(-1)!;
    progress.completed[last.id] = [0];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    render(<App />);
    fireEvent.change(screen.getByRole("combobox", { name: "游戏排序" }), {
      target: { value: "continue" },
    });
    expect(screen.getAllByRole("article")[0].textContent).toContain(last.title);
    expect(screen.getByText(/优先显示已经开始/)).toBeTruthy();
  });
});
