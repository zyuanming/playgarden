import { test, expect } from "@playwright/test";
import { openGame, chooseLevel, complete, captureErrors } from "./helpers";
import { hexLevels } from "../src/games/hexLogic";
import { dotsLevels } from "../src/games/dotsAndBoxesLogic";
import { inclineLevels, inclineSolutions } from "../src/games/inclineLogic";
import { buoyancyLevels, buoyancySolutions } from "../src/games/buoyancyLogic";
for (const [title, id, levels, selector] of [
  ["六角花径", "hex", hexLevels, "data-hex-cell"],
  ["点线花田", "dots", dotsLevels, "data-dots-edge"],
] as const)
  test(`all ${id} tactical challenges against AI`, async ({ page }, info) => {
    test.setTimeout(180000);
    const errors = captureErrors(page);
    await openGame(page, title);
    await expect(page.getByTestId(`${id}-board`)).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`${id}-start.png`),
      fullPage: true,
      animations: "disabled",
    });
    for (let level = 0; level < levels.length; level++) {
      await chooseLevel(page, level);
      for (const move of levels[level].solution) {
        await page.locator(`[${selector}="${move}"]`).click();
        await expect(page.getByTestId(`${id}-board`)).not.toHaveAttribute(
          "data-turn",
          "2",
        );
      }
      await complete(page, info, id, level);
    }
    expect(errors).toEqual([]);
  });
test("all exact incline energy experiments", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "斜坡停车实验室");
  await expect(page.getByTestId("incline-release")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("incline-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < inclineLevels.length; level++) {
    await chooseLevel(page, level);
    for (const move of inclineSolutions[level])
      if (move.part === "release")
        await page.getByTestId("incline-release").click();
      else
        await page
          .locator(
            `[data-incline-part="${move.part}"][data-value="${move.value}"]`,
          )
          .click();
    await complete(page, info, "incline", level);
  }
  expect(errors).toEqual([]);
});
test("all exact static buoyancy experiments", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "浮力码头");
  await expect(page.getByTestId("buoyancy-launch")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("buoyancy-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < buoyancyLevels.length; level++) {
    await chooseLevel(page, level);
    for (const move of buoyancySolutions[level])
      if (move.kind === "launch")
        await page.getByTestId("buoyancy-launch").click();
      else
        await page
          .locator(
            `[data-dock-kind="${move.kind}"][data-index="${move.index}"]`,
          )
          .click();
    await complete(page, info, "buoyancy", level);
  }
  expect(errors).toEqual([]);
});
