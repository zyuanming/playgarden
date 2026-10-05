import { test, expect, type Page } from "@playwright/test";
import { lightsOutLevels } from "../src/games/lightsOutLogic";
import { lightsOutChapters } from "../src/games/lightsOutCampaign";
import { completeLevel, initialProgress, STORAGE_KEY } from "../src/lib/progress";
import { solveLightsOutOracle } from "../tests/fixtures/lightsOutOracle";
import { openGame, chooseLevel, captureErrors } from "./helpers";

const board = (page: Page) => page.locator(".mlg-light");
const readBoard = (page: Page) => board(page).evaluateAll(
  (buttons) => buttons.map((button) => button.getAttribute("aria-pressed") === "true"),
);
async function solve(page: Page, level: number) {
  const config = lightsOutLevels[level];
  const moves = solveLightsOutOracle(config.initial, config.size);
  expect(moves).not.toBeNull();
  for (const cell of moves!) await board(page).nth(cell).click();
  await expect(page.locator(".status")).toHaveClass(/success/);
}

// Bounded chapter journeys cover every actual board in both viewport projects.
for (const [chapterIndex, chapter] of lightsOutChapters.entries()) {
  test(`Lights Out chapter ${chapterIndex + 1}: all 14 real boards`, async ({ page }, info) => {
    const errors = captureErrors(page);
    await openGame(page, "熄灯谜阵");
    const picker = page.getByLabel("选择关卡", { exact: true });
    await expect(picker.locator("option")).toHaveCount(112);
    await chooseLevel(page, chapter.start);
    for (let level = chapter.start; level < chapter.start + chapter.count; level++) {
      await expect(page.locator(".game-main")).toHaveAttribute("data-level", String(level));
      expect(await readBoard(page)).toEqual(lightsOutLevels[level].initial);
      await expect(page.getByLabel("本章练习")).toContainText(chapter.lesson);
      await expect(page.locator(".mlg-round-badge")).toHaveText(`${String(level + 1).padStart(2, "0")} / 112`);
      await solve(page, level);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (level === chapter.start + chapter.count - 1) {
        await page.screenshot({ path: info.outputPath(`lights-out-chapter-${chapterIndex + 1}.png`), fullPage: true, animations: "disabled" });
      }
      if (level < 111) await page.getByRole("button", { name: "下一关", exact: true }).click();
    }
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
    expect(saved.completed["lights-out"]).toEqual(Array.from({ length: 14 }, (_,i) => chapter.start + i));
    if (chapterIndex < 7) {
      await expect(picker).toHaveValue(String(chapter.start + chapter.count));
      await expect(page.getByLabel("本章练习")).toContainText(lightsOutChapters[chapterIndex + 1].title);
    } else {
      await page.getByRole("button", { name: "返回大厅", exact: true }).click();
      await expect(page.getByRole("textbox", { name: "搜索游戏" })).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
}

test("Lights Out earns level 100, resumes at 101, and finishes 112 with current saves", async ({ page }, info) => {
  const errors = captureErrors(page);
  // Build a current-format earned-progress fixture, then earn high indices by UI.
  let progress = initialProgress();
  for (let level = 0; level < 99; level++) progress = completeLevel(progress, "lights-out", level);
  await page.goto("/");
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: progress });
  await openGame(page, "熄灯谜阵");
  const picker = page.getByLabel("选择关卡", { exact: true });
  await expect(picker).toHaveValue("99");
  await solve(page, 99);
  await expect.poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).completed["lights-out"].includes(99), STORAGE_KEY)).toBe(true);
  await page.reload();
  await openGame(page, "熄灯谜阵");
  await expect(picker).toHaveValue("100");
  expect(await readBoard(page)).toEqual(lightsOutLevels[100].initial);

  await board(page).nth(0).click();
  const changed = await readBoard(page);
  expect(changed).not.toEqual(lightsOutLevels[100].initial);
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(board(page).first()).toBeDisabled();
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  expect(await readBoard(page)).toEqual(changed);
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(page.locator(".mlg-light.is-hinted")).toHaveCount(1);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  expect(await readBoard(page)).toEqual(lightsOutLevels[100].initial);
  await board(page).nth(0).focus();
  await page.keyboard.press("Space");
  expect(await readBoard(page)).toEqual(changed);
  await page.getByRole("button", { name: "重来", exact: true }).click();
  expect(await readBoard(page)).toEqual(lightsOutLevels[100].initial);
  await expect(page.locator(".mlg-light.is-hinted")).toHaveCount(0);

  await chooseLevel(page, 111);
  await expect(page.getByRole("heading", { name: "满园星光", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("lights-out-level-112.png"), fullPage: true, animations: "disabled" });
  await solve(page, 111);
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(saved.version).toBe(2);
  expect(saved.completed["lights-out"]).toContain(99);
  expect(saved.completed["lights-out"]).toContain(111);
  expect(saved.completed["lights-out"]).not.toContain(100);
  await expect(page.getByRole("button", { name: "下一关", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "返回大厅", exact: true }).click();
  await expect(page.locator(".catalog-count")).toContainText("112 个关卡");
  await page.reload();
  await openGame(page, "熄灯谜阵");
  await expect(picker).toHaveValue("100");
  await expect(picker.locator('option[value="111"]')).toHaveText("第 112 关 · 已完成");
  expect(errors).toEqual([]);
});
