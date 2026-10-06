import { test, expect } from "@playwright/test";
import { openGame, chooseLevel, complete, captureErrors } from "./helpers";
import { tentsLevels } from "../src/games/tentsLogic";
import {
  fractionMosaicLevels,
  formatFraction,
} from "../src/games/fractionMosaicLogic";
import { coordinateTreasureLevels } from "../src/games/coordinateTreasureLogic";
test("classic forest tents selected-cell controls", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "林间帐篷");
  await expect(page.locator('[data-region-game="tents"]')).toBeVisible();
  await page.screenshot({
    path: info.outputPath("tents-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  const target = Array.from(
    { length: tentsLevels[0].size ** 2 },
    (_, i) => i,
  ).filter((i) => !tentsLevels[0].trees.includes(i))[1];
  await page.locator(`[data-tents-cell="${target}"]`).click();
  await page.getByRole("button", { name: "草地 X", exact: true }).click();
  await expect(page.locator(`[data-tents-cell="${target}"]`)).toHaveAttribute(
    "data-value",
    "0",
  );
  await expect(page.locator(`[data-tents-cell="${target}"]`)).toHaveAttribute(
    "data-tents-cursor",
    "true",
  );
  await expect(page.getByTestId("tents-current-cell")).toContainText(
    "下方按钮只修改此格",
  );
  await page.screenshot({
    path: info.outputPath("tents-current-selection.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "重来", exact: true }).click();
  // Full 200-board completion lives in five-board tents-campaign journeys.
  for (const level of [0, 5, 11]) {
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
    for (const [tray, target] of fractionMosaicLevels[level].targets.entries())
      await expect(
        page.locator(`[data-fraction-tray="${tray}"]`),
      ).toContainText(
        formatFraction(target, fractionMosaicLevels[level].denominator),
      );
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
    expect(
      await page
        .locator(".ct-cell")
        .evaluateAll((nodes) =>
          nodes.every((node) => getComputedStyle(node).opacity === "1"),
        ),
    ).toBe(true);
    expect(
      await page
        .locator(".ct-cell small")
        .evaluateAll((nodes) =>
          nodes.every(
            (node) => parseFloat(getComputedStyle(node).fontSize) >= 12,
          ),
        ),
    ).toBe(true);
    await complete(page, info, "coordinate", level);
  }
  expect(errors).toEqual([]);
});
