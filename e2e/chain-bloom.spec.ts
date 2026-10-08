// SPDX-License-Identifier: GPL-3.0-only
// UNRUN handoff. One final targeted invocation covers desktop and mobile.
// Real placement/ignite controls only. No engine imports or injected wins.
import { test, expect, type Locator } from "@playwright/test";

test("chain bloom: placement, real chain success, retry, pause and safe restore", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const touch = info.project.name === "mobile";
  const activate = async (node: Locator) => { if (touch) await node.tap(); else await node.click(); };
  const open = async () => {
    await page.getByRole("textbox", { name: "搜索游戏" }).fill("连锁花火");
    await activate(page.getByRole("button", { name: "开始玩连锁花火", exact: true }));
  };
  const game = page.locator(".chain-bloom");
  const arena = page.locator(".cbl-arena");
  const ignite = page.getByRole("button", { name: "点燃这朵花", exact: true });
  await page.goto("/");
  await open();
  await expect(game).toBeVisible(); // Let lazy React loading complete before freezing timers.
  await page.clock.install();
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 100));
  await activate(page.getByRole("button", { name: "重来", exact: true }));
  await expect(game).toHaveAttribute("data-bloom-time", "0.000");
  await expect(game).toHaveAttribute("data-bloom-phase", "watching");

  // Tapping the arena merely previews. Clearing the preview prevents ignition.
  await activate(page.getByRole("button", { name: "取消选点", exact: true }));
  await expect(ignite).toBeDisabled();
  await arena.scrollIntoViewIfNeeded();
  const bounds = await arena.boundingBox();
  if (!bounds) throw Error("Missing bloom arena");
  const corner = { x: bounds.x + bounds.width * 0.04, y: bounds.y + bounds.height * 0.05 };
  if (touch) await page.touchscreen.tap(corner.x, corner.y);
  else await page.mouse.click(corner.x, corner.y);
  await expect(game).toHaveAttribute("data-bloom-phase", "watching");
  const aim = await game.getAttribute("data-bloom-aim-x");
  await arena.dispatchEvent("pointerdown", { pointerId: 71, isPrimary: true, button: 0, clientX: bounds.x + bounds.width / 2, clientY: bounds.y + bounds.height / 2 });
  await arena.dispatchEvent("pointercancel", { pointerId: 71 });
  await arena.dispatchEvent("pointerup", { pointerId: 71, isPrimary: true, button: 0, clientX: bounds.x + bounds.width / 2, clientY: bounds.y + bounds.height / 2 });
  await expect(game).toHaveAttribute("data-bloom-aim-x", aim!);
  await page.screenshot({ path: info.outputPath("chain-bloom-placement.png"), fullPage: true });
  await activate(ignite);
  await page.clock.runFor(3000);
  await expect(game).toHaveAttribute("data-bloom-phase", "retry");
  await expect(game).toHaveAttribute("data-bloom-hits", "0");
  await activate(page.getByRole("button", { name: "再试一次", exact: true }));
  await expect(game).toHaveAttribute("data-bloom-time", "0.000");
  await expect(game).toHaveAttribute("data-bloom-aim-x", "320");

  // The authored first stage has a central cluster: a real initial bloom
  // triggers it through expanding-circle collision, not a completion hook.
  await activate(ignite);
  await page.clock.runFor(450);
  await activate(page.getByRole("button", { name: "暂停观察", exact: true }));
  const time = await game.getAttribute("data-bloom-time");
  const hits = await game.getAttribute("data-bloom-hits");
  await page.clock.runFor(2000);
  await expect(game).toHaveAttribute("data-bloom-time", time!);
  await expect(game).toHaveAttribute("data-bloom-hits", hits!);
  await page.screenshot({ path: info.outputPath("chain-bloom-chain-paused.png"), fullPage: true });
  await activate(page.getByRole("button", { name: "继续漂动", exact: true }));
  await page.clock.runFor(8000);
  await expect(game).toHaveAttribute("data-bloom-phase", "won");
  expect(Number(await game.getAttribute("data-bloom-hits"))).toBeGreaterThanOrEqual(5);
  await expect(page.getByLabel("通关操作")).toBeVisible();
  await page.screenshot({ path: info.outputPath("chain-bloom-success.png"), fullPage: true });

  // Continue through the public shell and restore an unfinished second stage.
  await activate(page.getByRole("button", { name: "下一关", exact: true }));
  await activate(page.getByRole("button", { name: "向右", exact: true }));
  await page.clock.runFor(300);
  await activate(page.getByRole("button", { name: "暂停观察", exact: true }));
  const savedTime = await game.getAttribute("data-bloom-time");
  await activate(page.getByRole("button", { name: "返回游戏大厅", exact: true }));
  await page.clock.runFor(1000);
  await open();
  await expect(page.locator(".game-main")).toHaveAttribute("data-level", "1");
  await expect(game).toHaveAttribute("data-bloom-aim-x", "332");
  await expect(game).toHaveAttribute("data-bloom-time", savedTime!);
  await expect(game).toHaveAttribute("data-bloom-paused", "true");
  await activate(page.getByRole("button", { name: "继续漂动", exact: true }));
  await page.clock.runFor(300);
  expect(Number(await game.getAttribute("data-bloom-time"))).toBeGreaterThan(Number(savedTime));

  // Shell pause, background and blur freeze the actual simulation clock.
  await activate(page.getByRole("button", { name: "暂停", exact: true }));
  const shellTime = await game.getAttribute("data-bloom-time");
  await page.clock.runFor(1000);
  await expect(game).toHaveAttribute("data-bloom-time", shellTime!);
  await activate(page.getByRole("button", { name: "继续游戏", exact: true }));
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(game).toHaveAttribute("data-bloom-paused", "true");
  const hiddenTime = await game.getAttribute("data-bloom-time");
  await page.clock.runFor(1000);
  await expect(game).toHaveAttribute("data-bloom-time", hiddenTime!);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(game).toHaveAttribute("data-bloom-paused", "true");
  await activate(page.getByRole("button", { name: "继续漂动", exact: true }));
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(game).toHaveAttribute("data-bloom-paused", "true");
  await activate(page.getByRole("button", { name: "重来", exact: true }));
  await expect(game).toHaveAttribute("data-bloom-time", "0.000");
  await expect(game).toHaveAttribute("data-bloom-aim-x", "320");
  await expect(game).toHaveAttribute("data-bloom-phase", "watching");
  if (!touch) {
    await arena.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(game).toHaveAttribute("data-bloom-aim-x", "308");
    await page.keyboard.press("Control+Enter");
    await expect(game).toHaveAttribute("data-bloom-phase", "watching");
    await page.keyboard.press("Enter");
    await expect(game).toHaveAttribute("data-bloom-phase", "blooming");
  }
  for (const button of await page.locator(".cbl-controls button, .cbl-aim-controls button").all()) {
    const rect = await button.boundingBox();
    expect(rect?.height).toBeGreaterThanOrEqual(44);
    expect(rect?.width).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("chain-bloom-controls-restored.png"), fullPage: true });
  await activate(page.getByRole("button", { name: "返回游戏大厅", exact: true }));
  await page.clock.runFor(3000);
  await expect(game).toHaveCount(0);
  expect(errors).toEqual([]);
});
