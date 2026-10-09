// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Locator } from "@playwright/test";
import { openGame, chooseLevel, captureErrors } from "./helpers";
// Independent breadth-first search using only the displayed board and goal.
function solution(start: string, goal: string): number[][] | null {
  const queue: { board: string; path: number[][] }[] = [
    { board: start, path: [] },
  ];
  const seen = new Set([start]);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const { board, path } = queue[cursor];
    if (board === goal) return path;
    for (let from = 0; from < board.length; from++) {
      if (board[from] === ".") continue;
      const direction = board[from] === "E" ? 1 : -1;
      for (const distance of [1, 2]) {
        const to = from + direction * distance;
        if (board[to] !== ".") continue;
        if (
          distance === 2 &&
          board[from + direction] !== (board[from] === "E" ? "W" : "E")
        )
          continue;
        const cells = board.split("");
        cells[to] = cells[from];
        cells[from] = ".";
        const next = cells.join("");
        if (!seen.has(next)) {
          seen.add(next);
          queue.push({ board: next, path: [...path, [from, to]] });
        }
      }
    }
  }
  return null;
}
test("frog interchange first/final and non-removing legal jumps", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors = captureErrors(page);
  const act = async (l: Locator) =>
    info.project.name === "mobile" ? l.tap() : l.click();
  await openGame(page, "青蛙换岸");
  const game = page.locator("[data-frog-swap-game]"),
    stone = (n: number) => page.locator(`[data-frog-stone="${n}"]`);
  const initial = (await game.getAttribute("data-state"))!;
  await page.screenshot({
    path: info.outputPath("frog-swap-first-start.png"),
    fullPage: true,
  });
  if (info.project.name === "mobile") await act(stone(0));
  else {
    await stone(0).focus();
    await stone(0).press("Space");
  }
  await act(stone(1));
  await expect(game).toHaveAttribute("data-moves", "1");
  await act(page.getByRole("button", { name: "暂停", exact: true }));
  await expect(stone(0)).toBeDisabled();
  await act(page.getByRole("button", { name: "继续游戏", exact: true }));
  await act(page.getByRole("button", { name: "撤销", exact: true }));
  await expect(game).toHaveAttribute("data-state", initial);
  await act(page.getByRole("button", { name: "提示", exact: true }));
  await expect(page.locator(".fs-stone.hinted")).toHaveCount(2);
  await act(stone(0));
  await act(stone(1));
  await act(page.getByRole("button", { name: "重来", exact: true }));
  await expect(game).toHaveAttribute("data-state", initial);
  for (const level of [0, 8]) {
    if (level) {
      await chooseLevel(page, level);
      await expect(page.locator(".status")).toContainText("点一只青蛙");
      await page.screenshot({
        path: info.outputPath("frog-swap-final-start.png"),
        fullPage: true,
      });
    }
    const start = (await game.getAttribute("data-state"))!,
      goal = (await game.getAttribute("data-goal"))!;
    const plan = solution(start, goal);
    expect(plan).not.toBeNull();
    const counts = [...start].filter((p) => p !== ".").length;
    for (const [from, to] of plan!) {
      await act(stone(from));
      await expect(stone(to)).toHaveClass(/target/);
      await act(stone(to));
      const state = (await game.getAttribute("data-state"))!;
      expect([...state].filter((p) => p !== ".")).toHaveLength(counts);
    }
    await expect(game).toHaveAttribute("data-state", goal);
    await expect(game).toHaveAttribute("data-won", "true");
    await expect(page.locator(".status")).toHaveClass(/success/);
    await expect(stone(0)).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "撤销", exact: true }),
    ).toBeDisabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`frog-swap-${level + 1}-won.png`),
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
