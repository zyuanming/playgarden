// SPDX-License-Identifier: GPL-3.0-only
import { test, expect } from "@playwright/test";
import { openBreakout, freezeBreakout, playBreakout } from "./breakoutJourney";
for (let group = 0; group < 4; group++)
  test(`breakout original stages ${group * 3 + 1}-${group * 3 + 3} by real paddle input`, async ({
    page,
  }, info) => {
    test.setTimeout(240000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openBreakout(page);
    await expect(
      page.getByRole("heading", { name: "反弹砖园", exact: true }),
    ).toBeVisible();
    await freezeBreakout(page);
    for (let level = group * 3; level < group * 3 + 3; level++)
      await playBreakout(page, info, level);
    expect(errors).toEqual([]);
  });
test("breakout keyboard touch cancellation pause reset and narrow layout", async ({
  page,
}, info) => {
  await openBreakout(page);
  await freezeBreakout(page);
  const stage = page.locator(".breakout-stage");
  await stage.focus();
  await page.keyboard.down("ArrowRight");
  await page.clock.runFor(180);
  await page.keyboard.up("ArrowRight");
  expect(
    Number(
      await page
        .locator(".breakout-garden")
        .getAttribute("data-breakout-paddle"),
    ),
  ).toBeGreaterThan(200);
  await page.screenshot({
    path: info.outputPath("breakout-keyboard-focus.png"),
    fullPage: true,
  });
  await page.keyboard.press("Control+Space");
  await expect(page.locator(".breakout-garden")).toHaveAttribute(
    "data-breakout-phase",
    "ready",
  );
  await page.keyboard.press("Space");
  await page.clock.runFor(200);
  await page.getByRole("button", { name: "暂停接球", exact: true }).click();
  const y = await page
    .locator(".breakout-garden")
    .getAttribute("data-breakout-y");
  await page.clock.runFor(1000);
  expect(
    await page.locator(".breakout-garden").getAttribute("data-breakout-y"),
  ).toBe(y);
  await page.screenshot({
    path: info.outputPath("breakout-paused.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "继续接球", exact: true }).click();
  await page.clock.runFor(200);
  expect(
    await page.locator(".breakout-garden").getAttribute("data-breakout-y"),
  ).not.toBe(y);
  await page.getByRole("button", { name: "重来", exact: true }).click();
  await expect(page.locator(".breakout-garden")).toHaveAttribute(
    "data-breakout-phase",
    "ready",
  );
  const touch = await page.context().newCDPSession(page);
  const bounds = await stage.boundingBox();
  if (!bounds) throw Error("missing stage");
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: bounds.x + bounds.width * 0.35, y: bounds.y + bounds.height * 0.8 },
    ],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await touch.detach();
  await page.screenshot({
    path: info.outputPath("breakout-touch-cancel.png"),
    fullPage: true,
  });
  await page.clock.runFor(200);
  for (const [width, height] of [
    [320, 844],
    [390, 844],
    [740, 390],
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`breakout-${width}x${height}-controls.png`),
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "返回游戏大厅", exact: true }).click();
  await page.clock.runFor(1000);
  await expect(page.locator(".breakout-garden")).toHaveCount(0);
});

test("breakout real misses lead to a visible loss and restart recovers", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openBreakout(page);
  await freezeBreakout(page);
  await page.getByLabel("选择关卡", { exact: true }).selectOption("11");
  await page.locator(".breakout-stage").scrollIntoViewIfNeeded();
  for (let n = 0; n < 400; n++) {
    const phase = await page
      .locator(".breakout-garden")
      .getAttribute("data-breakout-phase");
    if (phase === "lost") break;
    expect(phase).not.toBe("won");
    if (phase === "ready")
      await page.getByRole("button", { name: "发球", exact: true }).click();
    const b = await page.locator(".breakout-stage").boundingBox();
    if (!b) throw Error("missing board");
    await page.mouse.move(b.x + 2, b.y + b.height * 0.8);
    await page.clock.runFor(1000);
  }
  await expect(page.locator(".breakout-garden")).toHaveAttribute(
    "data-breakout-phase",
    "lost",
  );
  await expect(page.locator(".breakout-garden")).toHaveAttribute(
    "data-breakout-lives",
    "0",
  );
  await page.screenshot({
    path: info.outputPath("breakout-lost-three-lives.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "重来", exact: true }).click();
  await expect(page.locator(".breakout-garden")).toHaveAttribute(
    "data-breakout-lives",
    "3",
  );
  await expect(
    page.getByRole("button", { name: "发球", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: info.outputPath("breakout-restart-after-loss.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
