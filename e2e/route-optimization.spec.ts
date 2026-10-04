import { test, expect } from "@playwright/test";
import { openGame, chooseLevel, complete, captureErrors } from "./helpers";
import {
  townTourLevels,
  postmanRoutesLevels,
} from "../src/games/routeOptimizationLevels";
for (const [title, id, levels] of [
  ["巡回探访", "town-tour", townTourLevels],
  ["邮差路线", "postman-routes", postmanRoutesLevels],
] as const)
  test(`all optimal ${id} walks`, async ({ page }, info) => {
    const errors = captureErrors(page);
    await openGame(page, title);
    await expect(page.locator("[data-route-game]")).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`${id}-start.png`),
      fullPage: true,
      animations: "disabled",
    });
    for (let level = 0; level < levels.length; level++) {
      await chooseLevel(page, level);
      const walk = levels[level].certificate.walk;
      for (let step = 1; step < walk.length; step++) {
        const a = walk[step - 1],
          b = walk[step];
        const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
        const target = page.locator(`[data-route-road-key="${key}"]`);
        if (level === 0) {
          if (step === 1) await target.focus();
          else {
            await expect(page.locator("[data-route-road]:focus")).toBeEnabled();
            await page.keyboard.press("Home");
            const keys = await page
              .locator("[data-route-road]:not(:disabled)")
              .evaluateAll((nodes) =>
                nodes.map((node) => node.getAttribute("data-route-road-key")),
              );
            const index = keys.indexOf(key);
            expect(index).toBeGreaterThanOrEqual(0);
            for (let i = 0; i < index; i++)
              await page.keyboard.press("ArrowRight");
          }
          await expect(target).toBeFocused();
          await page.keyboard.press("Enter");
        } else await target.click();
      }
      await complete(page, info, id, level);
    }
    expect(errors).toEqual([]);
  });
