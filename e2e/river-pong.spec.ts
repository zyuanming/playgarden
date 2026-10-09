// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Locator } from "@playwright/test";
import { openGame, chooseLevel, captureErrors } from "./helpers";
test("Paddle rallies: real first/final goals, pointer interception and pause", async ({
  page,
}, info) => {
  test.setTimeout(240000);
  const errors = captureErrors(page),
    act = async (l: Locator) =>
      info.project.name === "mobile" ? l.tap() : l.click();
  await openGame(page, "河畔乒乓");
  const root = page.locator("[data-river-pong-game]"),
    arena = root.locator(".rp-board"),
    serve = root.locator(".rp-serve");
  await expect(
    page.getByRole("button", { name: "撤销", exact: true }),
  ).toBeDisabled();
  await arena.focus();
  await arena.press("ArrowRight");
  await expect(root).toHaveAttribute("data-pong-paddle", "198");
  await arena.press("Space");
  await expect(root).toHaveAttribute("data-pong-phase", "play");
  await act(page.getByRole("button", { name: "暂停", exact: true }));
  const frozen = await root.getAttribute("data-pong-ball");
  await page.waitForTimeout(150);
  await expect(root).toHaveAttribute("data-pong-ball", frozen!);
  await act(page.getByRole("button", { name: "继续游戏", exact: true }));
  await act(page.getByRole("button", { name: "重来", exact: true }));
  await expect(root).toHaveAttribute("data-pong-score", "0:0");
  for (const index of [0, 7]) {
    await chooseLevel(page, index);
    await page.screenshot({
      path: info.outputPath(`pong-${index}-start.png`),
      fullPage: true,
    });
    const until = Date.now() + 100000;
    let rallies = 0;
    while (Date.now() < until) {
      const phase = await root.getAttribute("data-pong-phase");
      if (phase === "won" || phase === "lost") break;
      if (phase === "ready" || phase === "between") {
        await act(serve);
        await arena.scrollIntoViewIfNeeded();
        rallies++;
      }
      const ball = JSON.parse((await root.getAttribute("data-pong-ball"))!) as {
        x: number;
        y: number;
        vx: number;
        vy: number;
      };
      let x = ball.x;
      if (ball.vy > 0) {
        const time = Math.max(0, (413 - ball.y) / ball.vy),
          raw = ball.x - 6 + ball.vx * time,
          period = 696,
          m = ((raw % period) + period) % period;
        x = 6 + (m > 348 ? 696 - m : m);
      }
      const desired = Math.max(54, Math.min(306, x - (rallies % 2 ? 36 : -36))),
        box = await arena.boundingBox();
      expect(box).not.toBeNull();
      const screenX = box!.x + (desired / 360) * box!.width,
        screenY = box!.y + box!.height * 0.9;
      if (info.project.name === "mobile")
        await page.touchscreen.tap(screenX, screenY);
      else await page.mouse.move(screenX, screenY);
      await page.waitForTimeout(70);
    }
    await expect(root).toHaveAttribute("data-pong-phase", "won");
    await expect(page.locator(".status")).toHaveClass(/success/);
    await expect(serve).toBeDisabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`pong-${index}-complete.png`),
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
