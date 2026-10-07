import { test, expect } from "@playwright/test";
import {
  openFalling,
  freezeFalling,
  startFallingUI,
} from "../e2e/fallingJourney";
test("falling exact public build and real lock", async ({ page }, info) => {
  await openFalling(page, "./");
  if (process.env.GITHUB_SHA)
    await expect(
      page.locator('meta[name="playgarden-commit"]'),
    ).toHaveAttribute("content", process.env.GITHUB_SHA);
  await freezeFalling(page);
  await startFallingUI(page);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Space");
  await expect(page.locator(".falling-garden")).toHaveAttribute(
    "data-falling-placed",
    "1",
  );
  await expect(page.locator(".falling-garden")).toHaveAttribute(
    "data-falling-score",
    "10",
  );
  await page.screenshot({
    path: info.outputPath("falling-public-playing.png"),
    fullPage: true,
  });
});
