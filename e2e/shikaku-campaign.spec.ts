import { test, expect, type Page } from "@playwright/test";
import { openGame, chooseLevel, captureErrors } from "./helpers";
import { shikakuLevels, shikakuCandidates } from "../src/games/shikakuLogic";
import { STORAGE_KEY } from "../src/lib/progress";

const checkpoints = [0, 11, 12, 25, 39, 40, 64, 89, 90, 114, 139, 140, 169, 199];
async function draw(page: Page, level: number, rect: readonly number[]) {
  const n = shikakuLevels[level].size;
  await page.locator(`[data-shikaku-cell="${rect[0] * n + rect[1]}"]`).click();
  await page.locator(`[data-shikaku-cell="${rect[2] * n + rect[3]}"]`).click();
}
async function solve(page: Page, level: number) {
  for (const rect of shikakuLevels[level].solution) await draw(page, level, rect);
  await expect(page.locator('[data-region-game="shikaku"]')).toHaveAttribute("data-complete", "true");
  await expect(page.locator(".status")).toHaveClass(/success/);
}
// Five whole boards per test, never split a round or replace real controls with state injection.
for (let start = 0; start < shikakuLevels.length; start += 5) {
  const end = Math.min(start + 5, shikakuLevels.length);
  test(`Shikaku genuine completion ${start + 1}–${end}`, async ({ page }, info) => {
    const errors = captureErrors(page);
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await openGame(page, "矩形花园");
    await chooseLevel(page, start);
    await expect(page.getByLabel("选择关卡", { exact: true }).locator("option")).toHaveCount(200);
    for (let level = start; level < end; level++) {
      const puzzle = shikakuLevels[level];
      await expect(page.locator(".rc-level")).toHaveText(`${String(level + 1).padStart(3, "0")} / 200`);
      await expect(page.locator("[data-shikaku-cell]")).toHaveCount(puzzle.size ** 2);
      await expect(page.locator("[data-shikaku-chapter]")).toHaveAttribute("data-shikaku-chapter", String(puzzle.chapter ?? 0));
      if (checkpoints.includes(level)) {
        await page.screenshot({ path: info.outputPath(`shikaku-${level + 1}-start.png`), fullPage: true, animations: "disabled" });
        expect(await page.locator(".rc-square strong").evaluateAll(nodes => nodes.every(node => {
          const text = node.getBoundingClientRect(), cell = node.parentElement!.getBoundingClientRect();
          return parseFloat(getComputedStyle(node).fontSize) >= 17 && text.width <= cell.width && text.height <= cell.height;
        }))).toBe(true);
      }
      await solve(page, level);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const earned = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).completed.shikaku, STORAGE_KEY);
      expect(earned).toContain(level);
      if (checkpoints.includes(level)) await page.screenshot({ path: info.outputPath(`shikaku-${level + 1}-won.png`), fullPage: true, animations: "disabled" });
      if (level < end - 1) {
        await page.getByRole("button", { name: "下一关", exact: true }).click();
        await expect(page.getByRole("heading", { name: "矩形花园", exact: true })).toBeFocused();
      }
    }
    expect(errors).toEqual([]);
  });
}

test("Shikaku final level pause, keyboard, repair, undo, hints and terminal lock", async ({ page }) => {
  const errors = captureErrors(page);
  await openGame(page, "矩形花园");
  await chooseLevel(page, 199);
  const puzzle = shikakuLevels[199], board = page.locator("[data-shikaku-cell]");
  await board.first().click(); await board.first().click();
  await expect(page.locator("[data-region-count]")).toHaveAttribute("data-region-count", "0");
  const r = puzzle.solution[0];
  const first = board.nth(r[0] * puzzle.size + r[1]);
  await first.focus(); await expect(first).toBeFocused();
  for (const modifier of ["Control", "Meta", "Alt"]) {
    await first.press(`${modifier}+ArrowRight`);
    await expect(first).toBeFocused();
    await expect(page.locator("[data-anchor]")).toHaveAttribute("data-anchor", "");
  }
  await first.press("Enter");
  for (let row = r[0]; row < r[2]; row++) await page.keyboard.press("ArrowDown");
  for (let col = r[1]; col < r[3]; col++) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await expect(page.locator("[data-region-count]")).toHaveAttribute("data-region-count", "1");
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(first).toBeDisabled();
  await expect(page.getByRole("button", { name: "撤销", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  await expect(page.locator("[data-region-count]")).toHaveAttribute("data-region-count", "1");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(page.locator("[data-region-count]")).toHaveAttribute("data-region-count", "0");
  const wrong = shikakuCandidates(puzzle).flat().find(candidate => !puzzle.solution.some(correct => candidate.every((value, i) => value === correct[i])))!;
  expect(wrong).toBeTruthy();
  await draw(page, 199, wrong);
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(page.locator("[data-region-hint]")).toHaveAttribute("data-region-hint", "repair");
  await page.getByRole("button", { name: "撤回这块矩形", exact: true }).click();
  await expect(page.locator("[data-region-count]")).toHaveAttribute("data-region-count", "0");
  await draw(page, 199, r);
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await page.getByRole("button", { name: "采用这个矩形", exact: true }).click();
  await expect(page.locator("[data-region-count]")).toHaveAttribute("data-region-count", "2");
  await page.getByRole("button", { name: "重来", exact: true }).click();
  await expect(page.locator("[data-region-count]")).toHaveAttribute("data-region-count", "0");
  await expect(page.locator("[data-region-hint]")).toHaveCount(0);
  await solve(page, 199);
  await expect(first).toBeDisabled();
  await expect(page.getByRole("button", { name: "撤销", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(page.locator("[data-region-count]")).toHaveAttribute("data-region-count", String(puzzle.clues.length));
  await expect(page.getByRole("button", { name: "下一关", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "返回大厅", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "搜索游戏" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Shikaku current first, second, twelfth and 200th achievements survive reload", async ({ page }) => {
  const errors = captureErrors(page);
  await openGame(page, "矩形花园");
  for (const level of [0, 1, 11, 199]) { await chooseLevel(page, level); await solve(page, level); }
  await page.reload();
  const saved = await page.evaluate(key => localStorage.getItem(key)!, STORAGE_KEY);
  expect(JSON.parse(saved).completed.shikaku).toEqual([0, 1, 11, 199]);
  expect(new TextEncoder().encode(saved).length).toBeLessThan(5000);
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("矩形花园");
  await page.getByRole("button", { name: "开始玩矩形花园", exact: true }).click();
  await expect(page.getByLabel("选择关卡", { exact: true })).toHaveValue("2");
  for (const index of [0, 1, 11, 199]) await expect(page.getByLabel("选择关卡", { exact: true }).locator(`option[value="${index}"]`)).toContainText("已完成");
  await chooseLevel(page, 199);
  await expect(page.locator(".rc-heading h3")).toHaveText(shikakuLevels[199].title);
  await expect(page.locator("[data-region-count]")).toHaveAttribute("data-region-count", "0");
  expect(errors).toEqual([]);
});
