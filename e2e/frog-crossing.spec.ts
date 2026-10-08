// SPDX-License-Identifier: GPL-3.0-only
// One final targeted invocation runs this actual-control journey on both projects.
// No engine imports, injected game state, solver, or all-campaign sweep.
import { test, expect, type Locator } from "@playwright/test";
import { openGame, chooseLevel, captureErrors } from "./helpers";
test("pond crossing: log ride, arrivals, safe interruption and retry", async ({ page }, info) => {
  const errors = captureErrors(page);
  const touch = info.project.name === "mobile";
  const activate = async (node: Locator) => { if (touch) await node.tap(); else await node.click(); };
  const game = page.locator("[data-frog-game]");
  const board = page.getByRole("group", { name: "池塘过河画面，方向键或 WASD 跳一步", exact: true });
  const arrow = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };
  const label = { up: "向前跳", down: "向后跳", left: "向左跳", right: "向右跳" };
  async function hop(direction: keyof typeof arrow, count = 1) {
    for (let n = 0; n < count; n++) {
      if (touch) await page.getByRole("button", { name: label[direction], exact: true }).tap();
      else { await board.focus(); await board.press(arrow[direction]); }
    }
  }
  await openGame(page, "池塘过客");
  await page.clock.install();
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 100));
  await expect(game).toHaveAttribute("data-phase", "ready");
  const targets = await page.locator(".fc-directions button, .fc-main-button, .fc-pace button").evaluateAll((nodes) => nodes.map((node) => {
    const r = node.getBoundingClientRect(); return { width: r.width, height: r.height };
  }));
  for (const target of targets) { expect(target.width).toBeGreaterThanOrEqual(44); expect(target.height).toBeGreaterThanOrEqual(44); }
  await page.screenshot({ path: info.outputPath("frog-first-ready.png"), fullPage: true });
  await activate(page.getByRole("button", { name: "开始过河", exact: true }));
  await hop("right"); await expect(game).toHaveAttribute("data-x", "4.500");
  await hop("left"); await hop("up");
  await expect(game).toHaveAttribute("data-row", "1");
  await page.clock.runFor(200);
  await activate(page.getByRole("button", { name: "暂停", exact: true }));
  const stopped = await game.getAttribute("data-time");
  await page.clock.runFor(3000);
  await expect(game).toHaveAttribute("data-time", stopped!);
  await expect(page.getByRole("button", { name: "向前跳", exact: true })).toBeDisabled();
  await activate(page.getByRole("button", { name: "继续游戏", exact: true }));
  await hop("up", 2);
  await expect(game).toHaveAttribute("data-row", "3");
  const beforeRide = Number(await game.getAttribute("data-x"));
  await page.clock.runFor(850);
  expect(Number(await game.getAttribute("data-x"))).toBeGreaterThan(beforeRide + 0.1);
  await expect(game).toHaveAttribute("data-phase", "playing");
  await page.screenshot({ path: info.outputPath("frog-riding-log.png"), fullPage: true });
  await hop("up");
  await expect(game).toHaveAttribute("data-phase", "won");
  await expect(page.locator(".status")).toHaveClass(/success/);
  await page.screenshot({ path: info.outputPath("frog-first-arrived.png"), fullPage: true });

  // Deliberately enter a visible vehicle, then retry using the actual button.
  await activate(page.getByRole("button", { name: "重来", exact: true }));
  await activate(page.getByRole("button", { name: "开始过河", exact: true }));
  await hop("left", 3); await hop("up");
  await expect(game).toHaveAttribute("data-phase", "stranded");
  await expect(page.locator(".fc-sheet")).toContainText("碰到小车");
  await activate(page.getByRole("button", { name: "再试这次", exact: true }));
  await expect(game).toHaveAttribute("data-row", "0");
  await expect(game).toHaveAttribute("data-time", "0.000");
  await hop("up", 2); await hop("left", 3); await hop("up");
  await expect(game).toHaveAttribute("data-phase", "stranded");
  await expect(page.locator(".fc-sheet")).toContainText("落在水里");

  // Two distinct goals: the first arrival survives an actual return via the lobby.
  await chooseLevel(page, 2);
  await activate(page.getByRole("button", { name: "开始过河", exact: true }));
  await hop("left", 2); await hop("up", 6);
  await expect(game).toHaveAttribute("data-phase", "ready");
  await expect(game).toHaveAttribute("data-arrived", "0");
  await openGame(page, "池塘过客");
  await expect(game).toHaveAttribute("data-stage", "two-neighbours");
  await expect(game).toHaveAttribute("data-arrived", "0");
  await activate(page.getByRole("button", { name: "送下一位", exact: true }));
  await hop("up", 2); await hop("right", 2); await hop("up", 4);
  await expect(game).toHaveAttribute("data-phase", "won");
  await expect(game).toHaveAttribute("data-arrived", "0,1");

  await chooseLevel(page, 5);
  await activate(page.getByRole("button", { name: "开始过河", exact: true }));
  await page.clock.runFor(200);
  // Dispatch lifecycle events only; never change engine data or award arrivals.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(game).toHaveAttribute("data-held", "true");
  const hiddenTime = await game.getAttribute("data-time");
  await page.clock.runFor(4000);
  await expect(game).toHaveAttribute("data-time", hiddenTime!);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(game).toHaveAttribute("data-held", "true");
  await activate(page.getByRole("button", { name: "继续过河", exact: true }));
  await page.clock.runFor(180);
  const resumedTime = Number(await game.getAttribute("data-time"));
  expect(resumedTime).toBeGreaterThan(Number(hiddenTime));
  expect(resumedTime - Number(hiddenTime)).toBeLessThan(0.3);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(game).toHaveAttribute("data-held", "true");
  await activate(page.getByRole("button", { name: "继续过河", exact: true }));
  await activate(page.getByRole("button", { name: "提示", exact: true }));
  await expect(page.locator(".status")).toContainText("小岛");
  await chooseLevel(page, 11);
  await page.clock.runFor(2000);
  await expect(game).toHaveAttribute("data-stage", "evening-visit");
  await expect(game).toHaveAttribute("data-phase", "ready");
  await expect(game).toHaveAttribute("data-time", "0.000");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("frog-final-stage-ready.png"), fullPage: true });
  // A corrupt checkpoint must fail closed, without blocking this browser.
  await page.evaluate(() => localStorage.setItem("playgarden.frog-crossing.v1.round.11", '{"version":1,"stage":"evening-visit","arrived":[999]}'));
  await openGame(page, "池塘过客");
  await expect(game).toHaveAttribute("data-arrived", "");
  await expect(game).toHaveAttribute("data-phase", "ready");
  expect(errors).toEqual([]);
});
