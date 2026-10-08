// SPDX-License-Identifier: GPL-3.0-only
// One targeted invocation covers desktop + mobile projects. Deliberately unrun
// by the game contributor; the integration owner owns the final invocation.
import { test, expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { openGame, chooseLevel, captureErrors } from "./helpers";
import { numberlinkLevels } from "../src/games/numberlinkLevels";

const rootOf = (page: Page) => page.locator(".numberlink-layout");
const cellOf = (page: Page, cell: number) => rootOf(page).locator(`[data-numberlink-cell="${cell}"]`);
async function activate(target: Locator, info: TestInfo) {
  if (info.project.name === "mobile") await target.tap(); else await target.click();
}
async function pathsOf(page: Page): Promise<number[][]> {
  return JSON.parse((await rootOf(page).getAttribute("data-numberlink-paths"))!);
}
async function checkTargets(page: Page) {
  expect(await rootOf(page).locator("button").evaluateAll(buttons => buttons.every(button => {
    const box = button.getBoundingClientRect(); return box.width >= 44 && box.height >= 44;
  }))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function reenter(page: Page) {
  await page.reload();
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("彩线连园");
  await page.getByRole("button", { name: /(?:开始玩|继续玩)彩线连园/ }).click();
  await expect(rootOf(page)).toBeVisible();
}

test("Numberlink first, middle and final: genuine full-coverage completions using desktop and touch controls", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "彩线连园");
  for (const index of [0, 7, 14]) {
    const puzzle = numberlinkLevels[index];
    await chooseLevel(page, index);
    await page.getByRole("button", { name: "重来", exact: true }).click();
    await expect(rootOf(page)).toHaveAttribute("data-numberlink-id", puzzle.id);
    await checkTargets(page);
    await page.screenshot({ path: info.outputPath(`numberlink-${index + 1}-start.png`), fullPage: true, animations: "disabled" });
    for (const [pair, route] of puzzle.example.entries()) {
      for (const [step, cell] of route.entries()) {
        if (index === 0 && pair === 0 && info.project.name === "desktop" && step < 2) {
          if (step === 0) await cellOf(page, cell).focus();
          else await cellOf(page, route[step - 1]).press("ArrowRight");
          await expect(cellOf(page, cell)).toBeFocused();
          await cellOf(page, cell).press("Enter");
        } else await activate(cellOf(page, cell), info);
        expect((await pathsOf(page))[pair]).toEqual(route.slice(0, step + 1));
      }
      await expect(rootOf(page)).toHaveAttribute("data-numberlink-connected", String(pair + 1));
      if (pair === 0) await page.screenshot({ path: info.outputPath(`numberlink-${index + 1}-path.png`), fullPage: true, animations: "disabled" });
    }
    await expect(rootOf(page)).toHaveAttribute("data-numberlink-won", "true");
    await expect(rootOf(page)).toHaveAttribute("data-numberlink-covered", String(puzzle.rows * puzzle.cols - puzzle.holes.length));
    await expect(page.locator(".status")).toHaveClass(/success/);
    expect(await rootOf(page).locator("[data-numberlink-cell]").evaluateAll(buttons => buttons.every(button => (button as HTMLButtonElement).disabled))).toBe(true);
    // Independently check the actual displayed paths, not a stored win flag.
    const paths = await pathsOf(page), used = new Set<number>();
    for (const [pair, route] of paths.entries()) {
      expect([route[0], route[route.length - 1]].sort((a, b) => a - b)).toEqual([...puzzle.pairs[pair]].sort((a, b) => a - b));
      for (const [step, cell] of route.entries()) {
        expect(used.has(cell)).toBe(false); used.add(cell);
        expect(puzzle.holes.includes(cell)).toBe(false);
        if (step > 0) {
          const last = route[step - 1];
          expect(Math.abs(Math.floor(last / puzzle.cols) - Math.floor(cell / puzzle.cols)) + Math.abs(last % puzzle.cols - cell % puzzle.cols)).toBe(1);
        }
      }
    }
    expect(used.size).toBe(puzzle.rows * puzzle.cols - puzzle.holes.length);
    await checkTargets(page);
    await page.screenshot({ path: info.outputPath(`numberlink-${index + 1}-complete.png`), fullPage: true, animations: "disabled" });
  }
  const completed = await page.evaluate(() => JSON.parse(localStorage.getItem("playgarden.progress.v2")!).completed.numberlink);
  expect(completed).toEqual(expect.arrayContaining([0, 7, 14]));
  expect(errors).toEqual([]);
});

test("Numberlink overlap rejection, path revision, clear and undo, pause, reference hint, restore and reset", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "彩线连园");
  const root = rootOf(page);
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(root.locator("[data-numberlink-example]")).toBeVisible();
  await expect(page.locator(".status")).toContainText("不是根据当前走法");
  await expect(root).toHaveAttribute("data-numberlink-moves", "0");
  for (const cell of [0, 1, 2]) await activate(cellOf(page, cell), info);
  await activate(cellOf(page, 1), info);
  expect((await pathsOf(page))[0]).toEqual([0, 1]);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  expect((await pathsOf(page))[0]).toEqual([0, 1, 2]);
  for (const cell of [4, 5]) await activate(cellOf(page, cell), info);
  const before = JSON.stringify(await pathsOf(page));
  await activate(cellOf(page, 1), info);
  await expect(page.locator(".status")).toContainText("不能重叠");
  expect(JSON.stringify(await pathsOf(page))).toBe(before);
  await activate(cellOf(page, 11), info);
  await expect(page.locator(".status")).toContainText("相邻");
  expect(JSON.stringify(await pathsOf(page))).toBe(before);
  await activate(cellOf(page, 4), info);
  expect((await pathsOf(page))[1]).toEqual([4]);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  expect(JSON.stringify(await pathsOf(page))).toBe(before);
  await activate(root.getByRole("button", { name: "清除选中路线", exact: true }), info);
  expect((await pathsOf(page))[1]).toEqual([]);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  expect(JSON.stringify(await pathsOf(page))).toBe(before);
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(cellOf(page, 6)).toBeDisabled();
  await expect(root.getByRole("button", { name: "清除选中路线", exact: true })).toBeDisabled();
  await expect(root).toHaveAttribute("data-numberlink-selected", "");
  await expect(root.locator("[data-numberlink-example]")).toHaveCount(0);
  expect(JSON.stringify(await pathsOf(page))).toBe(before);
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  await reenter(page);
  expect(JSON.stringify(await pathsOf(page))).toBe(before);
  await expect(root).toHaveAttribute("data-numberlink-moves", "5");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  expect((await pathsOf(page))[1]).toEqual([4]);
  await page.getByRole("button", { name: "重来", exact: true }).click();
  expect(await pathsOf(page)).toEqual([[], [], []]);
  await expect(root).toHaveAttribute("data-numberlink-moves", "0");
  await reenter(page);
  expect(await pathsOf(page)).toEqual([[], [], []]);
  await checkTargets(page);
  expect(errors).toEqual([]);
});

test("Numberlink holes cannot be used and forged saves do not bypass replay", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "彩线连园");
  await chooseLevel(page, 2);
  await expect(cellOf(page, 5)).toHaveCount(0);
  await expect(rootOf(page).getByRole("img", { name: "2行2列，石凳，不能经过" })).toBeVisible();
  await activate(cellOf(page, 0), info);
  await activate(cellOf(page, 1), info);
  await checkTargets(page);
  await chooseLevel(page, 14);
  const puzzle = numberlinkLevels[14];
  // This is deliberately invalid storage only; completion above uses real input.
  await page.evaluate(({ id, paths }) => localStorage.setItem("playgarden.numberlink.v1.round.14", JSON.stringify({
    version: 1, id, won: true, paths,
    history: [{ kind: "start", pair: 0, cell: 0 }, { kind: "step", pair: 0, cell: 24 }],
  })), { id: puzzle.id, paths: puzzle.example });
  await reenter(page);
  await expect(rootOf(page)).toHaveAttribute("data-numberlink-id", puzzle.id);
  await expect(rootOf(page)).toHaveAttribute("data-numberlink-won", "false");
  await expect(rootOf(page)).toHaveAttribute("data-numberlink-moves", "0");
  expect(await pathsOf(page)).toEqual(puzzle.pairs.map(() => []));
  await expect(page.locator(".status")).not.toHaveClass(/success/);
  await checkTargets(page);
  await page.screenshot({ path: info.outputPath("numberlink-safe-restore.png"), fullPage: true, animations: "disabled" });
  expect(errors).toEqual([]);
});
