import { test, expect } from "@playwright/test";
import { openGame, chooseLevel, complete, captureErrors } from "./helpers";
import { shikakuLevels } from "../src/games/shikakuLogic";
import { tentsLevels } from "../src/games/tentsLogic";
import { fractionMosaicLevels } from "../src/games/fractionMosaicLogic";
import { coordinateTreasureLevels } from "../src/games/coordinateTreasureLogic";
test("all unique rectangular partitions", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "矩形花园");
  await expect(page.locator('[data-region-game="shikaku"]')).toBeVisible();
  await page.screenshot({
    path: info.outputPath("shikaku-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < shikakuLevels.length; level++) {
    await chooseLevel(page, level);
    const config = shikakuLevels[level];
    for (const [r0, c0, r1, c1] of config.solution) {
      await page
        .locator(`[data-shikaku-cell="${r0 * config.size + c0}"]`)
        .click();
      await page
        .locator(`[data-shikaku-cell="${r1 * config.size + c1}"]`)
        .click();
    }
    await complete(page, info, "shikaku", level);
  }
  expect(errors).toEqual([]);
});
test("all uniquely placed forest tents", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "林间帐篷");
  await expect(page.locator('[data-region-game="tents"]')).toBeVisible();
  await page.screenshot({
    path: info.outputPath("tents-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < tentsLevels.length; level++) {
    await chooseLevel(page, level);
    for (const cell of tentsLevels[level].solution)
      await page.locator(`[data-tents-cell="${cell}"]`).click();
    await complete(page, info, "tents", level);
  }
  expect(errors).toEqual([]);
});
test("all exact fraction recipes", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "分数拼盘");
  await expect(
    page.locator('[data-number-spatial-game="fraction"]'),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("fraction-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < fractionMosaicLevels.length; level++) {
    await chooseLevel(page, level);
    for (const move of fractionMosaicLevels[level].solution) {
      if (move.kind === "join") {
        await page.locator(`[data-fraction-piece="${move.first}"]`).click();
        await page.locator(`[data-fraction-piece="${move.second}"]`).click();
        await page.locator('[data-fraction-action="join"]').click();
      } else {
        await page.locator(`[data-fraction-piece="${move.piece}"]`).click();
        if (move.kind === "split")
          await page
            .locator(`[data-fraction-action="split-${move.parts}"]`)
            .click();
        else await page.locator(`[data-fraction-tray="${move.tray}"]`).click();
      }
    }
    await complete(page, info, "fraction", level);
  }
  expect(errors).toEqual([]);
});
test("all vector-card treasure routes", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "坐标寻宝");
  await expect(
    page.locator('[data-number-spatial-game="coordinate"]'),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("coordinate-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < coordinateTreasureLevels.length; level++) {
    await chooseLevel(page, level);
    for (const card of coordinateTreasureLevels[level].solution) {
      await page.locator(`[data-vector-card="${card}"]`).click();
      await page.locator('[data-coordinate-action="move"]').click();
    }
    await complete(page, info, "coordinate", level);
  }
  expect(errors).toEqual([]);
});
