import { test, expect } from "@playwright/test";
import { openGame, chooseLevel, complete, captureErrors } from "./helpers";
import { conditionalSorterLevels } from "../src/games/conditionalSorterLevels";
import { stateMachineLocksLevels } from "../src/games/stateMachineLocksLogic";
test("all complete-domain conditional sorting programs", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "条件分拣");
  await expect(page.locator("[data-sorter-game]")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("conditional-sorter-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < conditionalSorterLevels.length; level++) {
    await chooseLevel(page, level);
    const solution = conditionalSorterLevels[level].solution;
    for (const [row, rule] of solution.rules.entries()) {
      await page
        .locator(`[data-sorter-condition="${row}"]`)
        .selectOption(rule.condition ?? "");
      await page
        .locator(`[data-sorter-bin="${row}"]`)
        .selectOption(String(rule.bin));
    }
    await page
      .locator("[data-sorter-otherwise]")
      .selectOption(String(solution.otherwise));
    expect(
      await page
        .locator("[data-sorter-game] select")
        .evaluateAll((nodes) =>
          nodes.every((node) => getComputedStyle(node).opacity === "1"),
        ),
    ).toBe(true);
    await complete(page, info, "conditional-sorter", level);
    if (level === 11) {
      const parcel = page.locator("[data-sorter-parcel]").last();
      await parcel.click();
      await expect(parcel).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("[data-sorter-game]")).toHaveAttribute(
        "data-sorter-won",
        "true",
      );
      await page.screenshot({
        path: info.outputPath("conditional-sorter-completed-inspection.png"),
        fullPage: true,
        animations: "disabled",
      });
    }
  }
  expect(errors).toEqual([]);
});
test("all resource-limited state machine door challenges", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "状态机门锁");
  const game = page.locator("[data-machine-lock-game]");
  await expect(game).toBeVisible();
  await page.screenshot({
    path: info.outputPath("state-machine-locks-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < stateMachineLocksLevels.length; level++) {
    await chooseLevel(page, level);
    if (level === 0) await game.focus();
    for (const input of stateMachineLocksLevels[level].solution) {
      if (level === 0) await page.keyboard.press(String(input + 1));
      else await page.locator(`[data-machine-lock-input="${input}"]`).click();
    }
    expect(
      await page
        .locator("[data-machine-lock-input]")
        .evaluateAll((nodes) =>
          nodes.every((node) => getComputedStyle(node).opacity === "1"),
        ),
    ).toBe(true);
    await complete(page, info, "state-machine-locks", level);
  }
  expect(errors).toEqual([]);
});
