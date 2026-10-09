// SPDX-License-Identifier: GPL-3.0-only
// One final desktop/mobile invocation by the integration owner. No solver sweep.
import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { openGame, chooseLevel, captureErrors } from "./helpers";
import { pipeTurnsLevels, rotatePipe } from "../src/games/pipeTurnsLogic";
const root = (page: Page) => page.locator(".pt-game");
async function activate(page: Page, info: TestInfo, cell: number) {
  const button = page.locator(`[data-pipe-cell="${cell}"]`);
  if (info.project.name === "mobile") await button.tap(); else { await button.focus(); await button.press("Enter"); }
}
async function solve(page: Page, info: TestInfo, index: number) {
  const config = pipeTurnsLevels[index];
  for (let cell = 0; cell < config.solution.length; cell++) {
    if (await root(page).getAttribute("data-pipe-turns-won") === "true") break;
    if (!config.solution[cell] || cell === config.source) continue;
    let mask = Number(await page.locator(`[data-pipe-cell="${cell}"]`).getAttribute("data-pipe-mask"));
    while (mask !== config.solution[cell]) { await activate(page, info, cell); mask = rotatePipe(mask); }
  }
  await expect(root(page)).toHaveAttribute("data-pipe-turns-won", "true");
  await expect(page.locator(".status")).toHaveClass(/success/);
  expect(await root(page).locator("button").evaluateAll(buttons => buttons.every(button => (button as HTMLButtonElement).disabled))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
test("Pipe rotations: complete first and final networks with live controls", async ({ page }, info) => {
  const errors = captureErrors(page); await openGame(page, "水管转转");
  const initial = await root(page).getAttribute("data-pipe-turns-board");
  await expect(root(page)).toHaveAttribute("data-pipe-turns-won", "false");
  await page.screenshot({path:info.outputPath("pipe-turns-first.png"), fullPage:true, animations:"disabled"});
  await activate(page, info, 1);
  await expect(root(page)).toHaveAttribute("data-pipe-turns-moves", "1");
  await page.getByRole("button", {name:"暂停",exact:true}).click();
  expect(await root(page).locator("button").evaluateAll(buttons => buttons.every(button => (button as HTMLButtonElement).disabled))).toBe(true);
  await page.getByRole("button", {name:"继续游戏",exact:true}).click();
  await page.getByRole("button", {name:"撤销",exact:true}).click();
  await expect(root(page)).toHaveAttribute("data-pipe-turns-board", initial!);
  await activate(page, info, 1);
  await page.getByRole("button", {name:"重来",exact:true}).click();
  await expect(root(page)).toHaveAttribute("data-pipe-turns-board", initial!);
  await page.getByRole("button", {name:"提示",exact:true}).click();
  await expect(page.locator(".pt-hinted")).toHaveCount(1);
  await expect(root(page)).toHaveAttribute("data-pipe-turns-board", initial!);
  await solve(page, info, 0);
  const wonBoard = await root(page).getAttribute("data-pipe-turns-board");
  await expect(page.getByRole("button", {name:"撤销",exact:true})).toBeDisabled();
  await expect(root(page)).toHaveAttribute("data-pipe-turns-board", wonBoard!);
  await chooseLevel(page, 9); await solve(page, info, 9);
  await page.screenshot({path:info.outputPath("pipe-turns-final.png"), fullPage:true, animations:"disabled"});
  expect(await root(page).locator("button").evaluateAll(buttons => buttons.every(button => { const r=button.getBoundingClientRect();return r.width>=44&&r.height>=44; }))).toBe(true);
  const completed = await page.evaluate(() => JSON.parse(localStorage.getItem("playgarden.progress.v2")!).completed["pipe-turns"]);
  expect(completed).toEqual(expect.arrayContaining([0,9])); expect(errors).toEqual([]);
});
