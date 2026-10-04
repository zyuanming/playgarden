import { test, expect } from "@playwright/test";
import { openGame, chooseLevel, complete, captureErrors } from "./helpers";
import { hashiLevels } from "../src/games/hashiLogic";
import { slitherlinkLevels } from "../src/games/slitherlinkLogic";
import { booleanCircuitLevels } from "../src/games/booleanCircuitLogic";
import { stackQueueLevels } from "../src/games/stackQueueLogic";
test("all connected Hashi island networks", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "桥岛连心");
  for (let level = 0; level < hashiLevels.length; level++) {
    await chooseLevel(page, level);
    for (let edge = 0; edge < hashiLevels[level].solution.length; edge++) {
      const value = hashiLevels[level].solution[edge];
      if (!value) continue;
      await page.locator("[data-hashi-route]").selectOption(String(edge));
      await page.locator(`[data-network-action="${value}"]`).click();
    }
    await complete(page, info, "hashi", level);
  }
  expect(errors).toEqual([]);
});
test("all single-loop Slitherlink puzzles", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "数回花环");
  for (let level = 0; level < slitherlinkLevels.length; level++) {
    await chooseLevel(page, level);
    for (let edge = 0; edge < slitherlinkLevels[level].solution.length; edge++)
      if (slitherlinkLevels[level].solution[edge])
        await page.locator(`[data-slitherlink-edge="${edge}"]`).click();
    await complete(page, info, "slitherlink", level);
  }
  expect(errors).toEqual([]);
});
test("all complete-truth-table circuits", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "逻辑电路");
  for (let level = 0; level < booleanCircuitLevels.length; level++) {
    await chooseLevel(page, level);
    for (const [index, gate] of booleanCircuitLevels[
      level
    ].solution.entries()) {
      await page
        .locator(`[data-circuit-op="${gate.op}"][data-gate-index="${index}"]`)
        .click();
      for (const field of ["a", "b"] as const)
        if (gate[field] && !(field === "b" && gate.op === "NOT"))
          await page
            .locator(
              `[data-circuit-field="${field}"][data-gate-index="${index}"]`,
            )
            .selectOption(gate[field]!);
    }
    await complete(page, info, "circuit", level);
  }
  expect(errors).toEqual([]);
});
test("all capacity-limited stack and queue plans", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "栈与队列工坊");
  for (let level = 0; level < stackQueueLevels.length; level++) {
    await chooseLevel(page, level);
    for (const move of stackQueueLevels[level].solution)
      await page.locator(`[data-cargo-move="${move}"]`).click();
    await complete(page, info, "stack-queue", level);
  }
  expect(errors).toEqual([]);
});
