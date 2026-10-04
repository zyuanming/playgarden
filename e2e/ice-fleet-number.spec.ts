import { test, expect } from "@playwright/test";
import { openGame, chooseLevel, complete, captureErrors } from "./helpers";
import { iceStopsLevels } from "../src/games/iceStopsLevels";
import { fleetLevels } from "../src/games/fleetLevels";
import { carryLettersLevels } from "../src/games/carryLettersLevels";
import { binaryBalanceLevels } from "../src/games/binaryBalanceLevels";
test("all movable-stop ice journeys and continuous keyboard visibility", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "冰原停靠");
  await page.screenshot({
    path: info.outputPath("ice-stops-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < 12; level++) {
    await chooseLevel(page, level);
    await expect(page.locator("[data-ice-goal-legend]")).toContainText("A");
    for (const move of iceStopsLevels[level].certificate.moves) {
      const puck = page.locator(`[data-ice-puck="${move.puck}"]`);
      await puck.click();
      if (level === 11) {
        await page.keyboard.press(
          { N: "ArrowUp", E: "ArrowRight", S: "ArrowDown", W: "ArrowLeft" }[
            move.direction
          ],
        );
      } else
        await page.locator(`[data-ice-direction="${move.direction}"]`).click();
      if (level === 11) {
        const area = await page.locator("[data-ice-viewport]").boundingBox();
        const box = await puck.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(area!.x - 1);
        expect(box!.x + box!.width).toBeLessThanOrEqual(
          area!.x + area!.width + 1,
        );
      }
    }
    await expect(page.locator('[data-ice-won]')).toHaveAttribute(
      "data-ice-won",
      "true",
    );
    await complete(page, info, "ice-stops", level);
  }
  expect(errors).toEqual([]);
});
test("all uniquely reconstructed fleets from public fragment clues", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "船队海图");
  await page.screenshot({
    path: info.outputPath("fleet-logic-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < 12; level++) {
    await chooseLevel(page, level);
    const config = fleetLevels[level];
    await page.locator('[data-fleet-brush="ship"]').click();
    for (const cell of config.certificate.occupied)
      if (!config.clues.some((c) => c.cell === cell))
        await page.locator(`[data-fleet-cell="${cell}"]`).click();
    await page.locator("[data-fleet-fill-sea]").click();
    await expect(page.locator('[data-fleet-won]')).toHaveAttribute(
      "data-fleet-won",
      "true",
    );
    await complete(page, info, "fleet-logic", level);
  }
  expect(errors).toEqual([]);
});
test("all original carry-letter equations and cancellable hint results", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "进位字母");
  await page.screenshot({
    path: info.outputPath("carry-letters-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  await chooseLevel(page, 11);
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(page.locator("[data-carry-letters-hint]")).toBeVisible({
    timeout: 10000,
  });
  for (let level = 0; level < 12; level++) {
    await chooseLevel(page, level);
    const config = carryLettersLevels[level];
    for (const [symbol, value] of Object.entries(config.certificate.mapping))
      if (!(symbol in config.givens))
        await page
          .locator(`[data-carry-letter="${symbol}"]`)
          .selectOption(String(value));
    expect(
      await page
        .locator("[data-carry-letter]")
        .evaluateAll((ns) =>
          ns.every((n) => getComputedStyle(n).opacity === "1"),
        ),
    ).toBe(true);
    await complete(page, info, "carry-letters", level);
  }
  expect(errors).toEqual([]);
});
test("all unique balanced binary grids with fixed clue preservation", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "双符平衡");
  await page.screenshot({
    path: info.outputPath("binary-balance-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  await chooseLevel(page, 11);
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(page.locator("[data-binary-balance-hint]")).toBeVisible({
    timeout: 10000,
  });
  for (let level = 0; level < 12; level++) {
    await chooseLevel(page, level);
    const config = binaryBalanceLevels[level];
    for (const [index, value] of config.certificate.cells.entries())
      if (config.givens[index] === 0) {
        const cell = page.locator(`[data-binary-cell="${index}"]`);
        await cell.click();
        if (level === 11) await page.keyboard.press(value === 1 ? "a" : "b");
        else await page.locator(`[data-binary-input="${value}"]`).click();
      }
    expect(
      await page
        .locator("[data-binary-cell]")
        .evaluateAll((ns) =>
          ns.every((n) => getComputedStyle(n).opacity === "1"),
        ),
    ).toBe(true);
    await complete(page, info, "binary-balance", level);
  }
  expect(errors).toEqual([]);
});
