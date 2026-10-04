import { test, expect } from "@playwright/test";
import { openGame, chooseLevel, complete, captureErrors } from "./helpers";
import { mergeLevels } from "../src/games/mergeLogic";
import { trafficLevels } from "../src/games/trafficLogic";
import { arithmeticLevels } from "../src/games/arithmeticLogic";
import { wordSearchLevels } from "../src/games/wordSearchLogic";
test("all 12 seeded number merge challenges", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "合并花园");
  for (let level = 0; level < mergeLevels.length; level++) {
    await chooseLevel(page, level);
    for (const direction of mergeLevels[level].solution)
      await page.locator(`[data-merge-direction="${direction}"]`).click();
    await complete(page, info, "merge", level);
  }
  expect(errors).toEqual([]);
});
test("all 12 parking escape challenges", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "停车场出口");
  for (let level = 0; level < trafficLevels.length; level++) {
    await chooseLevel(page, level);
    for (const move of trafficLevels[level].solution) {
      await page.locator(`[data-vehicle="${move.vehicle}"]`).click();
      await page
        .locator(
          `[data-traffic-for="${move.vehicle}"][data-traffic-step="${move.steps}"]`,
        )
        .click();
    }
    await complete(page, info, "traffic", level);
  }
  expect(errors).toEqual([]);
});
test("all 12 exact arithmetic challenges", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "数字工坊");
  for (let level = 0; level < arithmeticLevels.length; level++) {
    await chooseLevel(page, level);
    for (const step of arithmeticLevels[level].solution) {
      await page.locator(`[data-token="${step.leftId}"]`).click();
      await page.locator(`[data-token="${step.rightId}"]`).click();
      await page.locator(`[data-operator="${step.operator}"]`).click();
    }
    await complete(page, info, "arithmetic", level);
  }
  expect(errors).toEqual([]);
});
test("all 12 Chinese word searches", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "寻词花园");
  for (let level = 0; level < wordSearchLevels.length; level++) {
    await chooseLevel(page, level);
    for (const word of wordSearchLevels[level].solution) {
      await page.locator(`[data-cell="${word.start}"]`).click();
      await page.locator(`[data-cell="${word.end}"]`).click();
    }
    await complete(page, info, "word-search", level);
  }
  expect(errors).toEqual([]);
});
