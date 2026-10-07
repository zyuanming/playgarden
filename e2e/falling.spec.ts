import { test, expect } from "@playwright/test";
import {
  openFalling,
  freezeFalling,
  startFallingUI,
  clearRealLine,
} from "./fallingJourney";
test("falling real line clear, keyboard, paused reload and loss/restart", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openFalling(page);
  await freezeFalling(page);
  await page.screenshot({
    path: info.outputPath("falling-ready.png"),
    fullPage: true,
  });
  await startFallingUI(page);
  const root = page.locator(".falling-garden");
  await page.keyboard.press("ArrowLeft");
  expect(JSON.parse((await root.getAttribute("data-falling-piece"))!).x).toBe(
    2,
  );
  await page.keyboard.press("ArrowRight");
  await clearRealLine(page);
  expect(Number(await root.getAttribute("data-falling-lines"))).toBeGreaterThan(
    0,
  );
  await page.screenshot({
    path: info.outputPath("falling-cleared-line.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "暂停一下", exact: true }).click();
  const saved = await root.getAttribute("data-falling-board");
  await page.clock.resume();
  await page.reload();
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("落块花园");
  await page
    .getByRole("button", { name: "开始玩落块花园", exact: true })
    .click();
  await expect(root).toHaveAttribute("data-falling-board", saved!);
  await expect(root).toHaveAttribute("data-falling-paused", "true");
  await page.clock.pauseAt(
    new Date((await page.evaluate(() => Date.now())) + 1000),
  );
  await page
    .locator(".falling-overlay")
    .getByRole("button", { name: "继续", exact: true })
    .click();
  for (
    let i = 0;
    i < 60 && (await root.getAttribute("data-falling-phase")) === "playing";
    i++
  )
    await page.keyboard.press("Space");
  await expect(root).toHaveAttribute("data-falling-phase", "lost");
  await page.screenshot({
    path: info.outputPath("falling-lost.png"),
    fullPage: true,
  });
  const best = await root.getAttribute("data-falling-best");
  await page.getByRole("button", { name: "再来一局", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(root).toHaveAttribute("data-falling-phase", "ready");
  await expect(root).toHaveAttribute("data-falling-best", best!);
  expect(errors).toEqual([]);
});
test("falling touch controls and short landscape fit", async ({
  page,
}, info) => {
  await openFalling(page);
  await freezeFalling(page);
  await startFallingUI(page);
  const root = page.locator(".falling-garden"),
    button = page.getByRole("button", { name: "右移", exact: true });
  await button.scrollIntoViewIfNeeded();
  const b = await button.boundingBox();
  if (!b) throw Error("Missing touch button");
  const c = await page.context().newCDPSession(page);
  await c.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }],
  });
  await c.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await c.detach();
  await expect
    .poll(
      async () =>
        JSON.parse((await root.getAttribute("data-falling-piece"))!).x,
    )
    .toBe(4);
  await page.getByRole("button", { name: "暂停一下", exact: true }).click();
  for (const [width, height] of [
    [320, 844],
    [740, 390],
    [500, 480],
  ]) {
    await page.setViewportSize({ width, height });
    await root.scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width > height) {
      for (const s of [
        ".falling-board",
        ".falling-controls",
        ".falling-pause",
      ]) {
        const r = await page.locator(s).boundingBox();
        expect(r).toBeTruthy();
        expect(r!.x).toBeGreaterThanOrEqual(0);
        expect(r!.x + r!.width).toBeLessThanOrEqual(width);
        expect(r!.y).toBeGreaterThanOrEqual(0);
        expect(r!.y + r!.height).toBeLessThanOrEqual(height);
      }
    }
    await page.screenshot({
      path: info.outputPath(`falling-${width}x${height}.png`),
      fullPage: width < height,
    });
  }
});
