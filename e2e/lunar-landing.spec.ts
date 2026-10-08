// SPDX-License-Identifier: GPL-3.0-only
// UNRUN contributor deliverable. One final journey across the existing desktop/mobile projects.
// Only real keyboard/pointer flight controls change gameplay. No engine imports, solver or win injection.
import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { captureErrors, chooseLevel, openGame } from "./helpers";
const root = (page: Page) => page.locator(".lunar-landing");
const numeric = async (page: Page, attribute: string) => Number(await root(page).getAttribute(`data-lunar-${attribute}`));
const activate = async (page: Page, info: TestInfo, name: string) => {
  const button = page.getByRole("button", { name, exact: true });
  if (info.project.name === "mobile") await button.tap(); else await button.click();
};

test("Lunar landing: real thrust touchdowns, crash/retry, cancelled hold, safe resume and narrow controls", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "月面着陆");
  await expect(root(page)).toBeVisible();
  await page.clock.install({ time: new Date("2026-10-08T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-08T12:00:01Z"));
  // Install clock before the explicit fresh round so there is no mixed old rAF timestamp.
  await activate(page, info, "重来");
  const touch = info.project.name === "mobile" ? await page.context().newCDPSession(page) : null;
  async function hold(withRight = false) {
    if (touch) {
      const engine = root(page).locator('[data-lunar-control="engine"]');
      await engine.scrollIntoViewIfNeeded();
      const e = await engine.boundingBox();
      const r = await root(page).locator('[data-lunar-control="right"]').boundingBox();
      expect(e).not.toBeNull(); expect(r).not.toBeNull();
      await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [
        { id: 0, x: e!.x + e!.width / 2, y: e!.y + e!.height / 2 },
        ...(withRight ? [{ id: 1, x: r!.x + r!.width / 2, y: r!.y + r!.height / 2 }] : []),
      ] });
    } else {
      await root(page).locator(".lunar-stage").focus();
      await page.keyboard.down("Space");
      if (withRight) await page.keyboard.down("ArrowRight");
    }
  }
  async function release(cancel = false) {
    if (touch) await touch.send("Input.dispatchTouchEvent", { type: cancel ? "touchCancel" : "touchEnd", touchPoints: [] });
    else { await page.keyboard.up("Space"); await page.keyboard.up("ArrowRight"); }
  }
  async function snapshot() {
    return root(page).evaluate(el => ["x", "y", "vx", "vy", "fuel", "time"].map(key => el.getAttribute(`data-lunar-${key}`)));
  }
  async function checkLayout() {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await root(page).locator("button").evaluateAll(buttons => buttons.every(button => {
      const r = button.getBoundingClientRect(); return r.width >= 44 && r.height >= 44;
    }))).toBe(true);
  }

  await checkLayout();
  const ready = await snapshot();
  await page.clock.runFor(1200);
  expect(await snapshot()).toEqual(ready);
  await root(page).locator(".lunar-stage").focus();
  await page.keyboard.press("Control+Space");
  await expect(root(page)).toHaveAttribute("data-lunar-phase", "ready");
  await activate(page, info, "开始下降");
  await hold(true);
  await page.clock.runFor(600);
  expect(await numeric(page, "x")).toBeGreaterThan(360);
  expect(await numeric(page, "vx")).toBeGreaterThan(10);
  expect(await numeric(page, "fuel")).toBeLessThan(110);
  // Genuine touchCancel or keyboard releases stop thrust, but preserve the earned inertia.
  await release(true);
  await expect(root(page)).toHaveAttribute("data-lunar-engine", "false");
  const coastFuel = await numeric(page, "fuel");
  const coastX = await numeric(page, "x");
  await page.clock.runFor(200);
  expect(await numeric(page, "fuel")).toBe(coastFuel);
  expect(await numeric(page, "x")).toBeGreaterThan(coastX);

  await hold();
  await page.clock.runFor(150);
  // Dispatching a browser lifecycle notification exercises the real interruption handler,
  // without touching hidden game state. The clock proves no physics/fuel progresses afterward.
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(root(page)).toHaveAttribute("data-lunar-frozen", "true");
  await expect(root(page)).toHaveAttribute("data-lunar-engine", "false");
  const frozen = await snapshot();
  await release();
  await page.clock.runFor(1500);
  expect(await snapshot()).toEqual(frozen);
  await page.screenshot({ path: info.outputPath("lunar-interrupted-held-thrust.png"), fullPage: true });
  await activate(page, info, "继续飞行");
  await expect(root(page)).toHaveAttribute("data-lunar-engine", "false");
  const resumedFuel = await numeric(page, "fuel");
  await page.clock.runFor(200);
  expect(await numeric(page, "fuel")).toBe(resumedFuel);

  await hold();
  await page.clock.runFor(100);
  await page.keyboard.press("Escape");
  await expect(root(page)).toHaveAttribute("data-lunar-frozen", "true");
  const shellPause = await snapshot();
  await release();
  await page.clock.runFor(1000);
  expect(await snapshot()).toEqual(shellPause);
  await activate(page, info, "继续游戏");
  await expect(root(page)).toHaveAttribute("data-lunar-engine", "false");
  const shellResumeFuel = await numeric(page, "fuel");
  await page.clock.runFor(200);
  expect(await numeric(page, "fuel")).toBe(shellResumeFuel);

  // A real unpowered descent hits the pad too fast. Retry does not inherit the previous frame or input.
  await activate(page, info, "重来");
  await activate(page, info, "开始下降");
  await page.clock.runFor(6000);
  await expect(root(page)).toHaveAttribute("data-lunar-phase", "crashed");
  await expect(root(page)).toHaveAttribute("data-lunar-won", "false");
  await expect(root(page).locator(".lunar-stage-message")).toContainText("下降速度太快");
  await page.screenshot({ path: info.outputPath("lunar-real-fast-touchdown.png"), fullPage: true });
  await activate(page, info, "重新尝试");
  await expect(root(page)).toHaveAttribute("data-lunar-phase", "ready");
  const retry = await snapshot();
  await page.clock.runFor(1200);
  expect(await snapshot()).toEqual(retry);
  expect(await numeric(page, "fuel")).toBe(110);

  // First authored lesson: holding 30% offsets gravity and retains its genuine 12-unit descent.
  await activate(page, info, "开始下降");
  await hold();
  await page.clock.runFor(13000);
  await release();
  await expect(root(page)).toHaveAttribute("data-lunar-won", "true");
  await expect(page.locator(".status")).toHaveClass(/success/);
  expect(await numeric(page, "vy")).toBeLessThanOrEqual(20);
  expect(await numeric(page, "fuel")).toBeLessThan(85);
  await expect(root(page).locator('[data-lunar-control="engine"]')).toBeDisabled();
  await checkLayout();
  await page.screenshot({ path: info.outputPath("lunar-first-safe-landing.png"), fullPage: true });

  // Second lesson really needs braking: start above the allowed touchdown speed,
  // burn 100%, then choose 30% and hold it for the remaining descent.
  await chooseLevel(page, 1);
  expect(await numeric(page, "vy")).toBe(34);
  await activate(page, info, "油门 100%");
  await activate(page, info, "开始下降");
  await hold();
  await page.clock.runFor(550);
  await release();
  expect(await numeric(page, "vy")).toBeGreaterThan(8);
  expect(await numeric(page, "vy")).toBeLessThan(15);
  await activate(page, info, "油门 30%");
  await hold();
  await page.clock.runFor(21000);
  await release();
  await expect(root(page)).toHaveAttribute("data-lunar-won", "true");
  await expect(page.locator(".status")).toHaveClass(/success/);
  await page.screenshot({ path: info.outputPath("lunar-brake-then-land.png"), fullPage: true });

  // Leave during an active held control: unmount must cancel the previous flight loop.
  await chooseLevel(page, 2);
  await activate(page, info, "开始下降");
  await hold();
  await page.clock.runFor(100);
  await page.getByRole("button", { name: "返回游戏大厅", exact: true }).click();
  await release();
  await page.clock.runFor(1000);
  await expect(root(page)).toHaveCount(0);
  if (touch) await touch.detach();
  expect(errors).toEqual([]);
});
