import { test, expect } from "@playwright/test";
import { openGame, chooseLevel, complete, captureErrors } from "./helpers";
import { futoshikiLevels } from "../src/games/futoshikiLogic";
import { skylineLevels } from "../src/games/skylineLogic";
import { waterJugLevels } from "../src/games/waterJugLogic";
import { riverLevels } from "../src/games/riverLogic";
for (const [name, id, levels] of [
  ["不等号花园", "futoshiki", futoshikiLevels],
  ["城市天际线", "skyline", skylineLevels],
] as const)
  test(`all ${id} number constraints`, async ({ page }, info) => {
    const errors = captureErrors(page);
    await openGame(page, name);
    if (id === "skyline") await expect(page.locator("canvas")).toBeVisible();
    for (let level = 0; level < levels.length; level++) {
      await chooseLevel(page, level);
      const config = levels[level];
      for (let index = 0; index < config.solution.length; index++) {
        if (config.givens[index]) continue;
        await page.locator(`[data-constraint-cell="${index}"]`).click();
        await page
          .getByRole("button", {
            name: `填入 ${config.solution[index]}`,
            exact: true,
          })
          .click();
      }
      await complete(page, info, id, level);
    }
    expect(errors).toEqual([]);
  });
test("all exact-volume jug puzzles", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "量水实验室");
  for (let level = 0; level < waterJugLevels.length; level++) {
    await chooseLevel(page, level);
    for (const move of waterJugLevels[level].solution) {
      const jug = move.kind === "pour" ? move.from : move.jug;
      await page.locator(`[data-jug="${jug}"]`).click();
      if (move.kind === "pour")
        await page
          .locator(
            `[data-jug-action="pour"][data-jug-from="${move.from}"][data-jug-to="${move.to}"]`,
          )
          .click();
      else await page.locator(`[data-jug-action="${move.kind}"]`).click();
    }
    await complete(page, info, "jugs", level);
  }
  expect(errors).toEqual([]);
});
test("all safe river-crossing plans", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "过河伙伴");
  for (let level = 0; level < riverLevels.length; level++) {
    await chooseLevel(page, level);
    for (const passengers of riverLevels[level].solution) {
      for (const item of passengers)
        await page.locator(`[data-river-item="${item}"]`).click();
      await page.locator("[data-river-sail]").click();
    }
    await complete(page, info, "river", level);
  }
  expect(errors).toEqual([]);
});
