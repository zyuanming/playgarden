// SPDX-License-Identifier: GPL-3.0-only
import { test, expect } from "@playwright/test";
import { openSnake, freezeSnake, firstFruit } from "../e2e/snakeJourney";
test("snake exact public build and first fruit use real controls", async ({
  page,
}, info) => {
  await openSnake(page, "./");
  if (process.env.GITHUB_SHA)
    await expect(
      page.locator('meta[name="playgarden-commit"]'),
    ).toHaveAttribute("content", process.env.GITHUB_SHA);
  await freezeSnake(page);
  await firstFruit(page);
  await page.keyboard.press("ArrowUp");
  await page.clock.runFor(260);
  await expect(page.locator(".snake-garden")).toHaveAttribute(
    "data-snake-direction",
    "0",
  );
  await page.screenshot({
    path: info.outputPath("snake-public-playing.png"),
    fullPage: true,
  });
});
