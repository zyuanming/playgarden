import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { openGame, chooseLevel, captureErrors } from "./helpers";
import { tentsChapters, tentsLevels } from "../src/games/tentsLevels";
import { STORAGE_KEY } from "../src/lib/progress";

const checkpoints = new Set(tentsChapters.flatMap(({ start, count }) => [
  start, start + Math.floor((count - 1) / 2), start + count - 1,
]));
const cells = (page: Page) => page.locator("[data-tents-cell]");
const square = (page: Page, index: number) => page.locator(`[data-tents-cell="${index}"]`);
const values = (page: Page) => cells(page).evaluateAll(nodes => nodes.map(node => Number(node.getAttribute("data-value"))));
const snapshot = (page: Page, info: TestInfo, name: string) => page.screenshot({
  path: info.outputPath(name), fullPage: true, animations: "disabled",
});
async function solve(page: Page, index: number) {
  // Published certificates guide accessible controls. No component, storage, or DOM state injection.
  for (const cell of tentsLevels[index].solution) await square(page, cell).click();
  await expect(page.locator('[data-region-game="tents"]')).toHaveAttribute("data-complete", "true");
  await expect(page.locator(".status")).toHaveClass(/success/);
  for (const [row, count] of tentsLevels[index].rowCounts.entries())
    await expect(page.locator(`[data-tents-clue="row-${row}"]`)).toHaveAttribute("data-count", String(count));
  for (const [column, count] of tentsLevels[index].columnCounts.entries())
    await expect(page.locator(`[data-tents-clue="column-${column}"]`)).toHaveAttribute("data-count", String(count));
  await expect(page.locator(".rc-square.is-conflict")).toHaveCount(0);
}
async function layoutFits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await cells(page).evaluateAll(nodes => nodes.every(node => {
    const box = node.getBoundingClientRect();
    return box.width >= 28 && box.height >= 28 && box.left >= 0 && box.right <= innerWidth;
  }))).toBe(true);
  expect(await page.locator("[data-tents-clue]").evaluateAll(nodes => nodes.every(node => {
    const box = node.getBoundingClientRect();
    return parseFloat(getComputedStyle(node).fontSize) >= 16 && node.scrollWidth <= node.clientWidth && box.width > 0;
  }))).toBe(true);
  expect(await page.locator(".rc-square svg").evaluateAll(nodes => nodes.every(node => {
    const icon = node.getBoundingClientRect(), cell = node.parentElement!.getBoundingClientRect();
    return icon.width >= 18 && icon.height >= 18 && icon.width <= cell.width && icon.height <= cell.height;
  }))).toBe(true);
}

// Forty independent five-board journeys run in BOTH existing viewport projects.
// Each test owns whole rounds and retains the repository's 120-second timeout.
for (let start = 0; start < 200; start += 5) {
  const end = start + 5;
  test(`Tents genuine completion ${start + 1}–${end}`, async ({ page }, info) => {
    const errors = captureErrors(page);
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    expect(tentsLevels).toHaveLength(200);
    await openGame(page, "林间帐篷");
    await chooseLevel(page, start);
    await expect(page.getByLabel("选择关卡", { exact: true }).locator("option")).toHaveCount(200);
    for (let index = start; index < end; index++) {
      const level = tentsLevels[index];
      const chapter = tentsChapters.find(item => index >= item.start && index < item.start + item.count)!;
      await expect(page.locator(".rc-level")).toHaveText(`${String(index + 1).padStart(3, "0")} / 200`);
      await expect(page.locator(".rc-heading h3")).toHaveText(level.title);
      await expect(cells(page)).toHaveCount(level.size ** 2);
      await expect(page.locator("[data-tents-chapter]")).toHaveAttribute("data-tents-chapter", String(chapter.id));
      await expect(page.locator("[data-tents-chapter]")).toContainText(chapter.title);
      if (checkpoints.has(index)) {
        await layoutFits(page);
        await snapshot(page, info, `tents-${index + 1}-start.png`);
      }
      await solve(page, index);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).completed.tents, STORAGE_KEY)).toContain(index);
      await expect(page.getByLabel("选择关卡", { exact: true }).locator(`option[value="${index}"]`)).toContainText("已完成");
      if (checkpoints.has(index)) {
        await layoutFits(page);
        await snapshot(page, info, `tents-${index + 1}-won.png`);
      }
      if (index < 199) {
        // Also cross every batch and chapter boundary through the genuine Next control.
        await page.getByRole("button", { name: "下一关", exact: true }).click();
        await expect(page.getByRole("heading", { name: "林间帐篷", exact: true })).toBeFocused();
        await expect(page.getByLabel("选择关卡", { exact: true })).toHaveValue(String(index + 1));
        await expect(page.locator('[data-region-game="tents"]')).toHaveAttribute("data-complete", "false");
      } else {
        await expect(page.getByRole("button", { name: "下一关", exact: true })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "返回大厅", exact: true })).toBeFocused();
        await page.getByRole("button", { name: "返回大厅", exact: true }).click();
        await expect(page.getByRole("textbox", { name: "搜索游戏" })).toBeVisible();
      }
    }
    expect(errors).toEqual([]);
  });
}

for (const index of [11, 199]) test(`Tents ${index + 1} keyboard, interrupted play, live hints and repair`, async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "林间帐篷");
  await chooseLevel(page, index);
  const level = tentsLevels[index], firstIndex = level.solution[0], otherIndex = level.solution[1];
  const first = square(page, firstIndex), other = square(page, otherIndex);
  await first.focus();
  const blank = await values(page);
  for (const modifier of ["Control", "Meta", "Alt"]) {
    for (const key of ["ArrowRight", "t", "x", "Enter", "Space"]) {
      await first.press(`${modifier}+${key}`);
      await expect(first).toBeFocused();
      expect(await values(page)).toEqual(blank);
      await expect(first).toHaveAttribute("data-tents-cursor", "true");
    }
  }
  const right = firstIndex % level.size === level.size - 1 ? firstIndex - 1 : firstIndex + 1;
  await first.press(right > firstIndex ? "ArrowRight" : "ArrowLeft");
  await expect(square(page, right)).toBeFocused();
  await square(page, right).press(right > firstIndex ? "ArrowLeft" : "ArrowRight");
  await expect(first).toBeFocused();
  await expect(first).toHaveAttribute("aria-current", "true");
  expect(await first.evaluate(node => parseFloat(getComputedStyle(node).outlineWidth))).toBeGreaterThanOrEqual(2);
  await snapshot(page, info, `tents-${index + 1}-keyboard-focus.png`);
  await first.press("t"); await expect(first).toHaveAttribute("data-value", "1");
  await first.press("x"); await expect(first).toHaveAttribute("data-value", "0");
  await first.press("Delete"); await expect(first).toHaveAttribute("data-value", "-1");
  await first.press("Enter"); await expect(first).toHaveAttribute("data-value", "1");
  await first.press("Space"); await expect(first).toHaveAttribute("data-value", "0");
  await page.getByRole("button", { name: "清空", exact: true }).click();
  await expect(first).toHaveAttribute("data-value", "-1");
  await page.getByRole("button", { name: "搭帐篷 T", exact: true }).click();
  await expect(first).toHaveAttribute("data-value", "1");
  await expect(first).toHaveAttribute("data-tents-cursor", "true");
  const beforePause = await values(page);
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(first).toBeDisabled();
  for (const name of ["撤销", "提示", "搭帐篷 T", "草地 X", "清空"])
    await expect(page.getByRole("button", { name, exact: true })).toBeDisabled();
  for (const modifier of ["Control", "Meta", "Alt"]) {
    await page.keyboard.press(`${modifier}+Escape`);
    await expect(page.getByRole("button", { name: "继续游戏", exact: true })).toBeVisible();
  }
  await snapshot(page, info, `tents-${index + 1}-paused.png`);
  expect(await values(page)).toEqual(beforePause);
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  expect(await values(page)).toEqual(beforePause);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(first).toHaveAttribute("data-value", "-1");
  await first.press("x");
  await other.click();
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(page.locator("[data-region-hint]")).toHaveAttribute("data-region-hint", "repair");
  await expect(first).toBeFocused();
  await expect(other).toHaveAttribute("data-value", "1");
  await snapshot(page, info, `tents-${index + 1}-wrong-step-repair.png`);
  await page.getByRole("button", { name: "清除这个标记", exact: true }).click();
  await expect(first).toHaveAttribute("data-value", "-1");
  await expect(other).toHaveAttribute("data-value", "1");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(first).toHaveAttribute("data-value", "0");
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await page.getByRole("button", { name: "清除这个标记", exact: true }).click();
  const beforeHint = await values(page);
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(page.locator("[data-region-hint]")).toHaveAttribute("data-region-hint", "deduction");
  expect(await values(page)).toEqual(beforeHint);
  const hinted = page.locator(".rc-square.is-hinted");
  await expect(hinted).toBeFocused();
  await expect(hinted).toHaveAttribute("data-value", "-1");
  await snapshot(page, info, `tents-${index + 1}-live-hint.png`);
  await page.getByRole("button", { name: "采用这一步", exact: true }).click();
  expect((await values(page)).filter(value => value === 1)).toHaveLength(2);
  await expect(page.locator("[data-region-hint]")).toHaveCount(0);
  await page.getByRole("button", { name: "重来", exact: true }).click();
  expect(await values(page)).toEqual(blank);
  await expect(page.locator("[data-region-hint]")).toHaveCount(0);
  await solve(page, index);
  const won = await values(page);
  await expect(first).toBeDisabled();
  await expect(page.getByRole("button", { name: "撤销", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "提示", exact: true }).click();
  expect(await values(page)).toEqual(won);
  await expect(page.locator("[data-region-hint]")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Tents genuine current-twelve achievements and level 200 survive reload unchanged", async ({ page }) => {
  const errors = captureErrors(page);
  await openGame(page, "林间帐篷");
  const earned = [...Array.from({ length: 12 }, (_, index) => index), 199];
  for (const index of earned) { await chooseLevel(page, index); await solve(page, index); }
  await page.reload();
  const raw = await page.evaluate(key => localStorage.getItem(key)!, STORAGE_KEY);
  const saved = JSON.parse(raw);
  expect(saved.version).toBe(2);
  expect(saved.completed.tents).toEqual(earned);
  expect(new TextEncoder().encode(raw).length).toBeLessThan(5000);
  await openGame(page, "林间帐篷");
  await expect(page.getByLabel("选择关卡", { exact: true })).toHaveValue("12");
  for (const index of earned)
    await expect(page.getByLabel("选择关卡", { exact: true }).locator(`option[value="${index}"]`)).toContainText("已完成");
  for (const index of [0, 1, 11, 199]) {
    await chooseLevel(page, index);
    await expect(page.locator(".rc-heading h3")).toHaveText(tentsLevels[index].title);
    await expect(page.locator("[data-tents-cell][data-value='1']")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
