import { test, expect } from "@playwright/test";
import { openGame, chooseLevel, complete, captureErrors } from "./helpers";
import { balanceLevels, balanceSolutions } from "../src/games/balanceLogic";
import { gearLevels, gearSolutions } from "../src/games/gearLogic";
import {
  oneStrokeLevels,
  oneStrokeSolutions,
} from "../src/games/oneStrokeLogic";
import {
  mapColorsLevels,
  mapColorsSolutions,
} from "../src/games/mapColorsLogic";
test("all lever balance experiments", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "杠杆实验室");
  await expect(page.locator("canvas")).toBeVisible();
  for (let level = 0; level < balanceLevels.length; level++) {
    await chooseLevel(page, level);
    for (const move of balanceSolutions[level]) {
      await page.locator(`[data-weight="${move.weight}"]`).click();
      if (move.position === null)
        await page
          .getByRole("button", { name: "放回托盘", exact: true })
          .click();
      else await page.locator(`[data-position="${move.position}"]`).click();
    }
    await complete(page, info, "balance", level);
  }
  expect(errors).toEqual([]);
});
test("all compound gear experiments", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "齿轮工坊");
  await expect(page.locator("canvas")).toBeVisible();
  for (let level = 0; level < gearLevels.length; level++) {
    await chooseLevel(page, level);
    for (const move of gearSolutions[level])
      await page
        .locator(
          `[data-stage="${move.stage}"][data-part="${move.part}"][data-teeth="${move.teeth}"]`,
        )
        .click();
    await complete(page, info, "gears", level);
  }
  expect(errors).toEqual([]);
});
test("all one-stroke graph trails", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "一笔花园");
  for (let level = 0; level < oneStrokeLevels.length; level++) {
    await chooseLevel(page, level);
    for (const node of oneStrokeSolutions[level])
      await page.locator(`[data-node="${node}"]`).click();
    await complete(page, info, "one-stroke", level);
  }
  expect(errors).toEqual([]);
});
test("all map-coloring challenges", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "缤纷地图");
  for (let level = 0; level < mapColorsLevels.length; level++) {
    await chooseLevel(page, level);
    for (let node = 0; node < mapColorsSolutions[level].length; node++) {
      await page
        .locator(`[data-color="${mapColorsSolutions[level][node]}"]`)
        .click();
      await page.locator(`[data-node="${node}"]`).click();
    }
    await complete(page, info, "map-colors", level);
  }
  expect(errors).toEqual([]);
});
