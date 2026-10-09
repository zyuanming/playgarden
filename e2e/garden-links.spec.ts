// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Locator } from "@playwright/test";
import { openGame, chooseLevel, captureErrors } from "./helpers";
test("Two-turn links first/final with independently checked visible routes", async ({
  page,
}, info) => {
  const errors = captureErrors(page),
    act = async (l: Locator) =>
      info.project.name === "mobile" ? l.tap() : l.click();
  await openGame(page, "花径连连看");
  const root = page.locator("[data-garden-links-game]"),
    cell = (i: number) => root.locator(`[data-link-cell="${i}"]`);
  const hint = async () => {
    await act(page.getByRole("button", { name: "提示", exact: true }));
    const pair = JSON.parse(
      (await root.getAttribute("data-links-hint"))!,
    ) as number[];
    expect(pair).toHaveLength(2);
    return pair;
  };
  await page.screenshot({
    path: info.outputPath("links-first-start.png"),
    fullPage: true,
  });
  const initial = await root.getAttribute("data-links-state"),
    pair = await hint();
  if (info.project.name === "desktop") {
    await cell(pair[0]).focus();
    await cell(pair[0]).press("Enter");
  } else await act(cell(pair[0]));
  await act(cell(pair[1]));
  await act(page.getByRole("button", { name: "暂停", exact: true }));
  await expect(root.locator("button:enabled")).toHaveCount(0);
  await act(page.getByRole("button", { name: "继续游戏", exact: true }));
  await act(page.getByRole("button", { name: "撤销", exact: true }));
  await expect(root).toHaveAttribute("data-links-state", initial!);
  await act(cell(pair[0]));
  await act(cell(pair[1]));
  await act(page.getByRole("button", { name: "重来", exact: true }));
  await expect(root).toHaveAttribute("data-links-state", initial!);
  for (const index of [0, 7]) {
    await chooseLevel(page, index);
    await page.screenshot({
      path: info.outputPath(`links-${index}-start.png`),
      fullPage: true,
    });
    for (
      let count = 0;
      count < 20 && (await root.getAttribute("data-links-won")) === "false";
      count++
    ) {
      const state = JSON.parse(
          (await root.getAttribute("data-links-state"))!,
        ) as (number | null)[],
        cols = Number(await root.getAttribute("data-links-cols")),
        rows = Number(await root.getAttribute("data-links-rows"));
      const [a, b] = await hint(),
        path = JSON.parse((await root.getAttribute("data-links-path"))!) as {
          row: number;
          col: number;
        }[];
      expect(state[a]).toBe(state[b]);
      expect(state[a]).not.toBeNull();
      expect(path[0]).toEqual({
        row: Math.floor(a / cols) + 1,
        col: (a % cols) + 1,
      });
      expect(path.at(-1)).toEqual({
        row: Math.floor(b / cols) + 1,
        col: (b % cols) + 1,
      });
      let direction = "",
        turns = 0;
      for (let k = 1; k < path.length; k++) {
        const p = path[k],
          prev = path[k - 1],
          dr = p.row - prev.row,
          dc = p.col - prev.col;
        expect(Math.abs(dr) + Math.abs(dc)).toBe(1);
        const d = `${dr},${dc}`;
        if (direction && direction !== d) turns++;
        direction = d;
        if (
          k < path.length - 1 &&
          p.row > 0 &&
          p.row <= rows &&
          p.col > 0 &&
          p.col <= cols
        )
          expect(state[(p.row - 1) * cols + p.col - 1]).toBeNull();
      }
      expect(turns).toBeLessThanOrEqual(2);
      await act(cell(a));
      await act(cell(b));
    }
    await expect(root).toHaveAttribute("data-links-won", "true");
    await expect(page.locator(".status")).toHaveClass(/success/);
    await expect(
      page.getByRole("button", { name: "撤销", exact: true }),
    ).toBeDisabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`links-${index}-complete.png`),
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
