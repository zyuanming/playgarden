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
      if (id === "dots") {
        const targets = await page
          .locator("[data-dots-edge]")
          .evaluateAll((nodes) =>
            nodes.map((node) => {
              const r = node.getBoundingClientRect();
              return [r.width, r.height];
            }),
          );
        expect(targets.every(([w, h]) => w >= 43.5 && h >= 43.5)).toBe(true);
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
  await page.locator('[data-incline-part="height"][data-value="20"]').click();
  await page.getByTestId("incline-release").click();
  await page.locator('[data-incline-part="height"][data-value="40"]').click();
  await expect(page.getByTestId("incline-last-observation")).toContainText(
    "20 cm",
  );
  await page.screenshot({
    path: info.outputPath("physics-retained-trial.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "重来", exact: true }).click();
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
  await page.locator('[data-dock-kind="hull"][data-index="1"]').click();
  await page.getByTestId("buoyancy-launch").click();
  await page.locator('[data-dock-kind="cargo"][data-index="0"]').click();
  await expect(page.getByTestId("buoyancy-last-observation")).toContainText(
    "40 mm",
  );
  await page.screenshot({
    path: info.outputPath("physics-retained-trial.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "重来", exact: true }).click();
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
