// SPDX-License-Identifier: GPL-3.0-only
import { test, expect } from "@playwright/test";
import { openSnake, freezeSnake, firstFruit } from "./snakeJourney";
test("贪吃蛇花园 eats, accepts immediate keyboard, saves paused and restarts after real loss", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openSnake(page);
  await freezeSnake(page);
  await page.screenshot({
    path: info.outputPath("snake-ready.png"),
    fullPage: true,
  });
  await firstFruit(page);
  await page.keyboard.press("ArrowUp");
  await page.clock.runFor(260);
  await expect(page.locator(".snake-garden")).toHaveAttribute(
    "data-snake-direction",
    "0",
  );
  await page.screenshot({
    path: info.outputPath("snake-growing.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "暂停一下", exact: true }).click();
  const head = await page
    .locator(".snake-garden")
    .getAttribute("data-snake-head");
  await page.clock.runFor(1000);
  await expect(page.locator(".snake-garden")).toHaveAttribute(
    "data-snake-head",
    head!,
  );
  // Let React finish lazy-loading after reload; the saved round itself stays paused.
  await page.clock.resume();
  await page.reload();
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("贪吃蛇花园");
  await page
    .getByRole("button", { name: "开始玩贪吃蛇花园", exact: true })
    .click();
  await expect(page.locator(".snake-garden")).toHaveAttribute(
    "data-snake-head",
    head!,
  );
  await expect(page.locator(".snake-garden")).toHaveAttribute(
    "data-snake-paused",
    "true",
  );
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000));
  await page
    .locator(".snake-overlay")
    .getByRole("button", { name: "继续", exact: true })
    .click();
  await page.clock.runFor(3000);
  await expect(page.locator(".snake-garden")).toHaveAttribute(
    "data-snake-phase",
    "dead",
  );
  await page.screenshot({
    path: info.outputPath("snake-lost.png"),
    fullPage: true,
  });
  const peak = await page
    .locator(".snake-garden")
    .getAttribute("data-snake-best");
  expect(Number(peak)).toBeGreaterThanOrEqual(1);
  const again = page.getByRole("button", { name: "再来一局", exact: true });
  await again.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".snake-garden")).toHaveAttribute(
    "data-snake-phase",
    "ready",
  );
  await expect(page.locator(".snake-garden")).toHaveAttribute(
    "data-snake-best",
    peak!,
  );
  expect(errors).toEqual([]);
});
test("snake genuine touch turns and portrait/short-landscape controls stay usable", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openSnake(page);
  await freezeSnake(page);
  await firstFruit(page);
  const board = page.locator(".snake-board");
  await board.scrollIntoViewIfNeeded();
  const r = await board.boundingBox();
  if (!r) throw Error("missing snake board");
  const c = await page.context().newCDPSession(page);
  await c.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: r.x + r.width * 0.6, y: r.y + r.height * 0.6 }],
  });
  await c.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: r.x + r.width * 0.6, y: r.y + r.height * 0.25 }],
  });
  await c.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await c.detach();
  await page.clock.runFor(260);
  await expect(page.locator(".snake-garden")).toHaveAttribute(
    "data-snake-direction",
    "0",
  );
  await page.getByRole("button", { name: "暂停一下", exact: true }).click();
  for (const [width, height] of [
    [320, 844],
    [740, 390],
    [500, 480],
  ]) {
    await page.setViewportSize({ width, height });
    await page.locator(".snake-garden").scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width > height) {
      for (const selector of [
        ".snake-board",
        ".snake-directions",
        ".snake-pause",
      ]) {
        const b = await page.locator(selector).boundingBox();
        if (!b) throw Error(selector);
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(width);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.y + b.height).toBeLessThanOrEqual(height);
      }
    }
    await page.screenshot({
      path: info.outputPath(`snake-${width}x${height}-viewport.png`),
      fullPage: width < height,
    });
  }
  expect(errors).toEqual([]);
});
