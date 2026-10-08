// SPDX-License-Identifier: GPL-3.0-only
// Contributor delivery: UNRUN. Run once after integration with desktop/mobile projects.
// Uses only visible controls, rendered coordinates and real keyboard/touch events.
// No state injection, storage writes, engine imports, solver or forced victory.
import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { captureErrors, chooseLevel, openGame } from "./helpers";

const root = (page: Page) => page.locator(".star-sentry");
const number = async (page: Page, key: string) => Number(await root(page).getAttribute(`data-sentry-${key}`));
const activate = async (page: Page, info: TestInfo, name: string) => {
  const button = page.getByRole("button", { name, exact: true });
  if (info.project.name === "mobile") await button.tap(); else await button.click();
};

test("Star sentry: real first-stage clear, damage/retry, released holds, pause and honest resume", async ({ page }, info) => {
  test.setTimeout(120000);
  const errors = captureErrors(page);
  await openGame(page, "星门守望");
  await expect(root(page)).toBeVisible();
  // The component must load before freezing rAF; reset removes any old timestamp.
  await page.clock.install({ time: new Date("2026-10-08T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-08T12:00:01Z"));
  await activate(page, info, "重来");
  const touch = info.project.name === "mobile" ? await page.context().newCDPSession(page) : null;
  const keyFor = { left: "ArrowLeft", right: "ArrowRight", fire: "Space" };
  type Control = keyof typeof keyFor;
  let touchActive = false;
  async function hold(controls: Control[]) {
    if (touch) {
      await root(page).locator(`[data-sentry-control="${controls[0]}"]`).scrollIntoViewIfNeeded();
      const points = [];
      for (const [id, control] of controls.entries()) {
        const bounds = await root(page).locator(`[data-sentry-control="${control}"]`).boundingBox();
        expect(bounds).not.toBeNull();
        points.push({ id, x: bounds!.x + bounds!.width / 2, y: bounds!.y + bounds!.height / 2 });
      }
      await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points });
      touchActive = true;
    } else {
      await root(page).locator(".sentry-arena").focus();
      for (const control of controls) await page.keyboard.down(keyFor[control]);
    }
  }
  async function release(cancel = false) {
    if (touch) {
      if (!touchActive) return;
      await touch.send("Input.dispatchTouchEvent", { type: cancel ? "touchCancel" : "touchEnd", touchPoints: [] });
      touchActive = false;
    }
    else for (const key of Object.values(keyFor)) await page.keyboard.up(key);
  }
  async function snapshot() {
    return root(page).evaluate(el => ["x", "time", "shields", "fired", "hits", "remaining"].map(key => el.getAttribute(`data-sentry-${key}`)));
  }
  async function layout() {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await root(page).locator("button").evaluateAll(buttons => buttons.every(button => {
      const r = button.getBoundingClientRect(); return r.width >= 44 && r.height >= 44;
    }))).toBe(true);
  }
  await layout();
  await expect(root(page)).toHaveAttribute("data-sentry-remaining", "3");
  const ready = await snapshot();
  await page.clock.runFor(1000);
  expect(await snapshot()).toEqual(ready);
  await root(page).locator(".sentry-arena").focus();
  await page.keyboard.press("Control+ArrowRight");
  await page.keyboard.press("Control+Space");
  expect(await snapshot()).toEqual(ready);
  await activate(page, info, "开始守望");
  await hold(["right", "fire"]);
  await page.clock.runFor(280);
  expect(await number(page, "x")).toBeGreaterThan(330);
  expect(await number(page, "fired")).toBeGreaterThan(0);
  await release(true);
  await expect(root(page)).toHaveAttribute("data-sentry-right", "false");
  await expect(root(page)).toHaveAttribute("data-sentry-fire", "false");
  const stoppedX = await number(page, "x"), stoppedShots = await number(page, "fired");
  await page.clock.runFor(200);
  expect(await number(page, "x")).toBe(stoppedX);
  expect(await number(page, "fired")).toBe(stoppedShots);

  await activate(page, info, "开启自动射击");
  await hold(["left"]);
  await page.clock.runFor(100);
  // A lifecycle notification exercises real pause handling; no game state is modified.
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(root(page)).toHaveAttribute("data-sentry-frozen", "true");
  await expect(root(page)).toHaveAttribute("data-sentry-left", "false");
  await expect(root(page)).toHaveAttribute("data-sentry-auto", "false");
  await release();
  const interrupted = await snapshot();
  await page.clock.runFor(1300);
  expect(await snapshot()).toEqual(interrupted);
  await page.screenshot({ path: info.outputPath("star-sentry-interrupted.png"), fullPage: true });
  await activate(page, info, "继续守望");
  await page.clock.runFor(200);
  expect(await number(page, "x")).toBe(Number(interrupted[0]));
  expect(await number(page, "fired")).toBe(Number(interrupted[3]));

  await activate(page, info, "开启自动射击");
  await hold(["right"]);
  await page.clock.runFor(80);
  await page.keyboard.press("Escape");
  await expect(root(page)).toHaveAttribute("data-sentry-frozen", "true");
  const shellPaused = await snapshot();
  await release();
  await page.clock.runFor(1000);
  expect(await snapshot()).toEqual(shellPaused);
  await activate(page, info, "继续游戏");
  await expect(root(page)).toHaveAttribute("data-sentry-auto", "false");
  await expect(root(page)).toHaveAttribute("data-sentry-right", "false");

  // Staying still, without firing, genuinely allows three announced robot shots to hit.
  await activate(page, info, "重来");
  await activate(page, info, "开始守望");
  await page.clock.runFor(18000);
  await expect(root(page)).toHaveAttribute("data-sentry-phase", "lost");
  await expect(root(page)).toHaveAttribute("data-sentry-shields", "0");
  await expect(root(page)).toHaveAttribute("data-sentry-won", "false");
  await expect(root(page)).toHaveAttribute("data-sentry-remaining", "3");
  await page.screenshot({ path: info.outputPath("star-sentry-real-shield-loss.png"), fullPage: true });
  await activate(page, info, "重新尝试");
  await expect(root(page)).toHaveAttribute("data-sentry-shields", "3");
  await expect(root(page)).toHaveAttribute("data-sentry-phase", "ready");
  const retried = await snapshot();
  await page.clock.runFor(800);
  expect(await snapshot()).toEqual(retried);

  await activate(page, info, "开始守望");
  await activate(page, info, "开启自动射击");
  // Aim at the nearest visible robot, then give the actual beam time to reach it.
  // Coordinates are exposed on the same SVG figures a person sees; only hold controls act.
  for (let attempt = 0; attempt < 10 && await root(page).getAttribute("data-sentry-phase") === "playing"; attempt++) {
    const shipX = await number(page, "x");
    const targets = await root(page).locator("[data-sentry-robot]").evaluateAll(robots => robots.map(robot => Number(robot.getAttribute("data-x"))));
    targets.sort((a, b) => Math.abs(a - shipX) - Math.abs(b - shipX));
    if (!targets.length) break;
    const offset = targets[0] - shipX;
    if (Math.abs(offset) > 7) {
      await hold([offset < 0 ? "left" : "right"]);
      await page.clock.runFor(Math.min(900, Math.round(Math.abs(offset) / 225 * 1000)));
      await release();
    }
    await page.clock.runFor(1100);
  }
  await release();
  await expect(root(page)).toHaveAttribute("data-sentry-won", "true");
  await expect(root(page)).toHaveAttribute("data-sentry-remaining", "0");
  expect(await number(page, "hits")).toBe(3);
  expect(await number(page, "shields")).toBeGreaterThan(0);
  await expect(page.locator(".status")).toHaveClass(/success/);
  await expect(root(page).locator('[data-sentry-control="fire"]')).toBeDisabled();
  await layout();
  await page.screenshot({ path: info.outputPath("star-sentry-first-clear.png"), fullPage: true });

  await chooseLevel(page, 11);
  await expect(root(page)).toHaveAttribute("data-sentry-remaining", "12");
  await expect(root(page).locator("[data-sentry-shelter]")).toHaveCount(3);
  await page.screenshot({ path: info.outputPath("star-sentry-final-formation-preview.png"), fullPage: true });
  // Leave a held-input flight. The shell preserves the stage; the flight intentionally restarts.
  await chooseLevel(page, 4);
  await activate(page, info, "开始守望");
  await hold(["right"]);
  await page.clock.runFor(120);
  await page.getByRole("button", { name: "返回游戏大厅", exact: true }).click();
  await release();
  await page.clock.runFor(500);
  await expect(root(page)).toHaveCount(0);
  if (touch) await touch.detach();
  // A reload needs a running clock for React/Suspense to mount. Never navigate with it paused.
  await page.clock.resume();
  await openGame(page, "星门守望");
  await expect(root(page)).toBeVisible();
  await expect(page.getByLabel("选择关卡", { exact: true })).toHaveValue("4");
  await expect(page.getByLabel("选择关卡", { exact: true }).locator('option[value="0"]')).toContainText("已完成");
  await expect(root(page)).toHaveAttribute("data-sentry-phase", "ready");
  await expect(root(page)).toHaveAttribute("data-sentry-x", "300.000");
  await expect(root(page)).toHaveAttribute("data-sentry-auto", "false");
  await expect(root(page)).toContainText("本轮飞行不保存");
  await layout();
  expect(errors).toEqual([]);
});
