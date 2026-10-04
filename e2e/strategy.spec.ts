import { test, expect } from "@playwright/test";
import { openGame, chooseLevel, complete, captureErrors } from "./helpers";
import { nonogramLevels } from "../src/games/nonogramLogic";
import { boxLevels } from "../src/games/boxLogic";
import { connectLevels } from "../src/games/connectLogic";
import { reversiLevels } from "../src/games/reversiLogic";
test("all Nonogram pictures", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "像素逻辑画");
  for (let level = 0; level < nonogramLevels.length; level++) {
    await chooseLevel(page, level);
    const config = nonogramLevels[level];
    for (let i = 0; i < config.solution.length; i++)
      if (config.solution[i])
        await page.locator(`[data-nonogram-cell="${i}"]`).click();
    await complete(page, info, "nonogram", level);
  }
  expect(errors).toEqual([]);
});
test("all box-pushing routes", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "推箱花园");
  for (let level = 0; level < boxLevels.length; level++) {
    await chooseLevel(page, level);
    for (const direction of boxLevels[level].solution)
      await page.locator(`[data-direction="${direction}"]`).click();
    await complete(page, info, "boxes", level);
  }
  expect(errors).toEqual([]);
});
test("all Four-in-a-Row tactics against AI", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "四子花径");
  for (let level = 0; level < connectLevels.length; level++) {
    await chooseLevel(page, level);
    for (const column of connectLevels[level].solution)
      await page
        .getByRole("button", { name: new RegExp(`^第 ${column + 1} 列落子`) })
        .click();
    await complete(page, info, "connect", level);
  }
  expect(errors).toEqual([]);
});
test("all Reversi endgames against AI", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "翻转花园");
  for (let level = 0; level < reversiLevels.length; level++) {
    await chooseLevel(page, level);
    for (const index of reversiLevels[level].solution)
      await page.locator(`button[data-cell="${index}"]`).click();
    await complete(page, info, "reversi", level);
  }
  expect(errors).toEqual([]);
});
