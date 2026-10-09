// SPDX-License-Identifier: GPL-3.0-only
// One targeted desktop/mobile journey. Intentionally authored before the game;
// the integration owner runs it once after registration.
import { test, expect, type Locator } from "@playwright/test";
import { openGame, chooseLevel, captureErrors } from "./helpers";
import { perimeterGardenLevels } from "../src/games/perimeterGardenLevels";

test("perimeter garden: alternative first solution and final courtyard, real edits and recovery", async ({ page }, info) => {
  const errors = captureErrors(page);
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const activate = async (node: Locator) => info.project.name === "mobile" ? node.tap() : node.click();
  const game = page.locator("[data-perimeter-game]");
  const cell = (index: number) => page.locator(`[data-perim-cell="${index}"]`);
  const control = (name: string) => page.getByRole("button", { name, exact: true });
  const selected = async () => page.locator('[data-perim-selected="true"]').evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute("data-perim-cell"))));
  const screenshot = async (name: string) => page.screenshot({ path: info.outputPath(`perimeter-${name}.png`), fullPage: true, animations: "disabled" });
  const noOverflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await openGame(page, "周长花园");
  await expect(game).toHaveAttribute("data-perim-won", "false");
  await expect(cell(5)).toBeDisabled();
  expect(await selected()).toEqual([5]);
  await screenshot("first-start");

  // Native keyboard activation on desktop, genuine touch activation on mobile.
  if (info.project.name === "mobile") await cell(0).tap();
  else { await cell(0).focus(); await cell(0).press("Enter"); }
  await expect(game).toHaveAttribute("data-perim-components", "2");
  await activate(control("暂停"));
  await expect(cell(1)).toBeDisabled();
  expect(await selected()).toEqual([0, 5]);
  await activate(control("继续游戏"));
  await expect(cell(1)).toBeEnabled();
  expect(await selected()).toEqual([0, 5]);
  await activate(control("撤销"));
  expect(await selected()).toEqual([5]);
  await activate(cell(0));
  const beforeHint = await selected();
  await activate(control("提示"));
  await expect(page.locator(".perim-feedback")).toContainText("一种可行布局");
  expect(await selected()).toEqual(beforeHint);
  await expect(page.locator(".perim-hinted")).toHaveCount(1);
  await activate(control("重来"));
  expect(await selected()).toEqual([5]);
  await expect(page.locator(".perim-hinted")).toHaveCount(0);

  // This 2 × 2 square differs from the supplied witness and must still win.
  for (const [levelIndex, layout] of [[0, [0, 1, 4, 5]], [7, perimeterGardenLevels[7].witness]] as const) {
    if (levelIndex !== 0) await chooseLevel(page, levelIndex);
    const config = perimeterGardenLevels[levelIndex];
    if (levelIndex === 0) expect([...layout]).not.toEqual(config.witness);
    for (const required of config.required) await expect(cell(required)).toBeDisabled();
    for (const blocked of config.blocked) {
      await expect(cell(blocked)).toBeDisabled();
      await expect(cell(blocked)).toHaveAttribute("data-perim-selected", "false");
      await expect(cell(blocked)).toContainText("×");
    }
    const sizes = await page.locator("[data-perim-cell]").evaluateAll((nodes) => nodes.map((node) => { const rect = node.getBoundingClientRect(); return [rect.width, rect.height]; }));
    for (const [width, height] of sizes) { expect(width).toBeGreaterThanOrEqual(44); expect(height).toBeGreaterThanOrEqual(44); }
    let step = 0;
    for (const index of layout) {
      if (config.required.includes(index)) continue;
      await activate(cell(index));
      if (++step === 2) await screenshot(`${levelIndex + 1}-in-progress`);
    }
    await expect(game).toHaveAttribute("data-perim-won", "true");
    await expect(page.locator(".status")).toHaveClass(/success/);
    const planted = await selected();

    // Independent oracle: count exposed sides and flood-fill using DOM state,
    // without importing the game's measurement or completion implementation.
    const occupied = new Set(planted);
    const neighbors = (index: number) => [index % config.size > 0 ? index - 1 : -1, index % config.size < config.size - 1 ? index + 1 : -1, index >= config.size ? index - config.size : -1, index < config.size * (config.size - 1) ? index + config.size : -1];
    const perimeter = planted.reduce((total, index) => total + neighbors(index).filter((neighbor) => !occupied.has(neighbor)).length, 0);
    const visited = new Set<number>([planted[0]]), queue = [planted[0]];
    for (let head = 0; head < queue.length; head++) for (const neighbor of neighbors(queue[head])) if (occupied.has(neighbor) && !visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); }
    expect(planted).toHaveLength(config.area);
    expect(perimeter).toBe(config.perimeter);
    expect(visited.size).toBe(planted.length);
    expect(config.required.every((index) => occupied.has(index))).toBe(true);
    expect(config.blocked.some((index) => occupied.has(index))).toBe(false);
    await expect(page.locator("[data-perim-edge]")).toHaveCount(perimeter);
    if (levelIndex === 7) {
      // All four edges around the blocked courtyard contribute to the SVG.
      for (const edge of ["9-south", "14-east", "16-west", "21-north"]) {
        await expect(page.locator(`[data-perim-edge="${edge}"]`)).toHaveCount(1);
      }
    }
    await expect(game).toHaveAttribute("data-perim-components", "1");
    await expect(control("撤销")).toBeDisabled();
    await expect(cell(layout[0])).toBeDisabled();
    const solved = await selected();
    await activate(control("提示"));
    expect(await selected()).toEqual(solved);
    await expect(game).toHaveAttribute("data-perim-won", "true");
    await noOverflow();
    await screenshot(`${levelIndex + 1}-complete`);
  }

  // Reset on the final, holed board retains only locked anchors.
  await activate(control("重来"));
  await expect(game).toHaveAttribute("data-perim-won", "false");
  expect(await selected()).toEqual(perimeterGardenLevels[7].required);
  await expect(cell(8)).toBeEnabled();
  await expect(cell(15)).toBeDisabled();
  await noOverflow();
  expect(errors).toEqual([]);
});
