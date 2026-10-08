// SPDX-License-Identifier: GPL-3.0-only
// One final browser journey, shared by the existing desktop and touch-size projects.
// Unrun contributor deliverable. No solver, imported game engine, or victory-state injection.
import { test, expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { captureErrors, chooseLevel, openGame } from "./helpers";
const rootOf = (page: Page) => page.locator(".bubble-shooter-layout");
async function activate(control: Locator, info: TestInfo) { if (info.project.name === "mobile") await control.tap(); else await control.click(); }
async function aim(page: Page, angle: number) {
  await rootOf(page).getByRole("spinbutton", { name: "瞄准角度" }).fill(String(angle));
  await expect(rootOf(page)).toHaveAttribute("data-bubble-aim", String(angle));
}
async function fire(page: Page, info: TestInfo) {
  const before = Number(await rootOf(page).getAttribute("data-bubble-shots"));
  await activate(rootOf(page).locator("[data-bubble-fire]"), info);
  await expect(rootOf(page)).toHaveAttribute("data-bubble-shots", String(before + 1));
  await expect(rootOf(page)).toHaveAttribute("data-bubble-flying", "false");
}
async function reenter(page: Page) {
  await page.reload();
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("泡泡弹射");
  await page.getByRole("button", { name: /(?:开始玩|继续玩)泡泡弹射/ }).click();
  await expect(rootOf(page)).toBeVisible();
}
async function touchAndLayout(page: Page) {
  expect(await rootOf(page).locator("button").evaluateAll(buttons => buttons.every(button => { const rect = button.getBoundingClientRect(); return rect.width >= 44 && rect.height >= 44; }))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function won(page: Page, info: TestInfo, name: string) {
  await expect(rootOf(page)).toHaveAttribute("data-bubble-won", "true");
  await expect(page.locator(".status")).toHaveClass(/success/);
  await expect(rootOf(page).locator("[data-bubble-fire]")).toBeDisabled();
  await touchAndLayout(page);
  await page.screenshot({ path: info.outputPath(`bubble-${name}-complete.png`), fullPage: true, animations: "disabled" });
}

test("Bubble shooter: aimed first/middle/final wins, bank and floating drops, interrupted shots and safe restore", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "泡泡弹射");
  await touchAndLayout(page);
  // First stage: tapping the field aims without firing; keyboard and explicit fire work.
  const svg = rootOf(page).locator("[data-bubble-board-svg]");
  const box = await svg.boundingBox(); expect(box).not.toBeNull();
  const position = { x: box!.width / 2, y: box!.height * 0.2 };
  if (info.project.name === "mobile") await svg.tap({ position }); else await svg.click({ position });
  await expect(rootOf(page)).toHaveAttribute("data-bubble-shots", "0");
  await expect(rootOf(page)).toHaveAttribute("data-bubble-aim", "0");
  if (info.project.name === "desktop") {
    const stage = rootOf(page).getByRole("group", { name: /^泡泡瞄准区/ });
    await stage.focus(); await stage.press("ArrowLeft");
    await expect(rootOf(page)).toHaveAttribute("data-bubble-aim", "-2");
    await stage.press("ArrowRight"); await stage.press("Enter");
  } else await fire(page, info);
  await won(page, info, "first");

  // Real reflected projectile. The authored right-wall bank reaches the left red pair.
  await chooseLevel(page, 1); await aim(page, 46);
  await expect(rootOf(page).locator(".bubble-shooter-preview")).toHaveAttribute("data-bubble-preview-bounces", "1");
  await expect(rootOf(page).locator(".bubble-shooter-preview")).toHaveAttribute("data-bubble-preview-removed", "3");
  await page.screenshot({ path: info.outputPath("bubble-wall-bank-preview.png"), fullPage: true });
  await fire(page, info);
  await expect(rootOf(page)).toHaveAttribute("data-bubble-last-bounces", "1");
  await aim(page, 12); await fire(page, info); await won(page, info, "bank");

  // Middle stage: the yellow match drops a green satellite; the saved state must replay.
  await chooseLevel(page, 5);
  const initial = await rootOf(page).getAttribute("data-bubble-board");
  const fireControl = rootOf(page).locator("[data-bubble-fire]");
  await fireControl.focus(); await fireControl.press("Control+Enter");
  expect(await fireControl.evaluate(button => button.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true, cancelable: true })))).toBe(false);
  await expect(rootOf(page)).toHaveAttribute("data-bubble-shots", "0");
  await aim(page, 0);
  if (info.project.name === "desktop") await fireControl.dblclick(); else await fireControl.tap();
  await expect(rootOf(page)).toHaveAttribute("data-bubble-shots", "1");
  await expect(rootOf(page)).toHaveAttribute("data-bubble-last-dropped", "1");
  const after = await rootOf(page).getAttribute("data-bubble-board");
  await reenter(page);
  await expect(rootOf(page)).toHaveAttribute("data-bubble-level", "hanging-mobile");
  await expect(rootOf(page)).toHaveAttribute("data-bubble-board", after!);
  await expect(rootOf(page)).toHaveAttribute("data-bubble-shots", "1");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(rootOf(page)).toHaveAttribute("data-bubble-board", initial!);
  await expect(rootOf(page)).toHaveAttribute("data-bubble-shots", "0");
  // Pausing cancels a shot before it lands. The same bubble remains available on resume.
  await activate(rootOf(page).locator("[data-bubble-fire]"), info);
  await expect(rootOf(page)).toHaveAttribute("data-bubble-flying", "true");
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(rootOf(page)).toHaveAttribute("data-bubble-flying", "false");
  await expect(rootOf(page).locator("[data-bubble-fire]")).toBeDisabled();
  await expect(rootOf(page)).toHaveAttribute("data-bubble-shots", "0");
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  await activate(rootOf(page).locator("[data-bubble-fire]"), info);
  await expect(rootOf(page)).toHaveAttribute("data-bubble-flying", "true");
  await page.getByRole("button", { name: "重来", exact: true }).click();
  await page.waitForTimeout(1100); // Beyond the cancelled flight's maximum lifetime.
  await expect(rootOf(page)).toHaveAttribute("data-bubble-board", initial!);
  await expect(rootOf(page)).toHaveAttribute("data-bubble-shots", "0");
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(page.locator(".status")).toContainText("启发式");
  await expect(page.locator(".status")).toContainText("不保证");
  await expect(rootOf(page)).toHaveAttribute("data-bubble-shots", "0");
  for (let shot = 0; shot < 3; shot++) { await aim(page, 0); await fire(page, info); }
  await won(page, info, "middle");

  // Final authored two-lantern stage: deliberate bottom-up color order, through real controls.
  await chooseLevel(page, 11);
  await page.screenshot({ path: info.outputPath("bubble-final-start.png"), fullPage: true });
  for (const angle of [-26, 10, -23, 8, -19, 14, -15.5, 17]) { await aim(page, angle); await fire(page, info); }
  await expect(rootOf(page)).toHaveAttribute("data-bubble-shots", "8");
  await won(page, info, "final");
  const completed = await page.evaluate(() => JSON.parse(localStorage.getItem("playgarden.progress.v2")!).completed["bubble-shooter"]);
  expect(completed).toEqual(expect.arrayContaining([0, 5, 11]));

  // Navigation also destroys a pending flight, and malformed saves never supply board/win flags.
  await chooseLevel(page, 2); await activate(rootOf(page).locator("[data-bubble-fire]"), info);
  await chooseLevel(page, 3);
  const fourth = await rootOf(page).getAttribute("data-bubble-board");
  await page.waitForTimeout(1100);
  await expect(rootOf(page)).toHaveAttribute("data-bubble-board", fourth!);
  await expect(rootOf(page)).toHaveAttribute("data-bubble-shots", "0");
  await page.evaluate(() => localStorage.setItem("playgarden.bubble-shooter.v1.round.3", JSON.stringify({ version: 1, id: "three-bells", aim: 0, history: [99], board: [], won: true })));
  await reenter(page);
  await expect(rootOf(page)).toHaveAttribute("data-bubble-board", fourth!);
  await expect(rootOf(page)).toHaveAttribute("data-bubble-shots", "0");
  await expect(rootOf(page)).toHaveAttribute("data-bubble-won", "false");
  await touchAndLayout(page);
  expect(errors).toEqual([]);
});
