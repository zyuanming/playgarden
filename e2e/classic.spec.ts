import { test, expect } from "@playwright/test";
import { openGame, chooseLevel, complete, captureErrors } from "./helpers";
import { sowingLevels } from "../src/games/sowingLogic";
import { nimLevels } from "../src/games/nimLogic";
import { pegLevels } from "../src/games/pegLogic";
import { knightLevels } from "../src/games/knightLogic";
test("all Kalah sowing challenges against AI", async ({ page }, info) => {
  test.setTimeout(180000);
  const errors = captureErrors(page);
  await openGame(page, "播种花园");
  await expect(page.locator('[data-testid="sowing-board"]')).toBeVisible();
  await page.screenshot({
    path: info.outputPath("sowing-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < sowingLevels.length; level++) {
    await chooseLevel(page, level);
    for (const pit of sowingLevels[level].solution) {
      await page.locator(`[data-sowing-pit="${pit}"]`).click();
      await expect(page.getByTestId("sowing-board")).not.toHaveAttribute(
        "data-turn",
        "2",
      );
    }
    await complete(page, info, "sowing", level);
  }
  expect(errors).toEqual([]);
});
test("all normal-play Nim challenges against AI", async ({ page }, info) => {
  test.setTimeout(180000);
  const errors = captureErrors(page);
  await openGame(page, "尼姆花园");
  await expect(page.locator('[data-testid="nim-board"]')).toBeVisible();
  await page.screenshot({
    path: info.outputPath("nim-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < nimLevels.length; level++) {
    await chooseLevel(page, level);
    for (const { pile, remove } of nimLevels[level].solution) {
      await page.locator(`[data-nim-pile="${pile}"]`).click();
      await page.locator(`[data-nim-remove="${remove}"]`).click();
      await page.getByTestId("nim-confirm").click();
      await expect(page.getByTestId("nim-board")).not.toHaveAttribute(
        "data-turn",
        "2",
      );
    }
    await complete(page, info, "nim", level);
  }
  expect(errors).toEqual([]);
});
test("all peg-solitaire certificates", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "跳棋独奏");
  await expect(page.locator('[data-solitaire-game="peg"]')).toBeVisible();
  await page.screenshot({
    path: info.outputPath("peg-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < pegLevels.length; level++) {
    await chooseLevel(page, level);
    for (const [from, , to] of pegLevels[level].solution) {
      const source = page.locator(`[data-peg-cell="${from}"]`);
      if ((await source.getAttribute("data-peg-selected")) !== "true")
        await source.click();
      await page.locator(`[data-peg-cell="${to}"]`).click();
    }
    const holes = await page.locator(".st-hole").evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect();
        return { width: r.width, ratio: r.width / r.height };
      }),
    );
    expect(
      holes.every(
        (hole) => hole.width > 15 && hole.ratio > 0.8 && hole.ratio < 1.2,
      ),
    ).toBe(true);
    await complete(page, info, "peg", level);
  }
  expect(errors).toEqual([]);
});
test("all knight-tour certificates", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "骑士巡游");
  await expect(page.locator('[data-solitaire-game="knight"]')).toBeVisible();
  await page.screenshot({
    path: info.outputPath("knight-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < knightLevels.length; level++) {
    await chooseLevel(page, level);
    for (const cell of knightLevels[level].solution.slice(1))
      await page.locator(`[data-knight-cell="${cell}"]`).click();
    await complete(page, info, "knight", level);
  }
  expect(errors).toEqual([]);
});
