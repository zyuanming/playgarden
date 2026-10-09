// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Locator } from "@playwright/test";
import { openGame, captureErrors } from "./helpers";

type Live = {
  phase: "welcome" | "playing" | "lost";
  paused: boolean;
  score: number;
  best: number;
  energy: number;
  multiplier: number;
  multiplierProgress: number;
  duration: number;
  frame: number;
  captures: number;
  bombsCaught: number;
  expired: number;
  difficulty: number;
  width: number;
  height: number;
  cursor: { x: number; y: number };
  enemies: { x: number; y: number; type: number; age: number; alive: boolean }[];
};

test("Coil original: actual loops, bombs, natural loss, frozen pause, restart, records and cleanup", async ({ page }, info) => {
  test.setTimeout(150000);
  const mobile = info.project.name === "mobile";
  const errors = captureErrors(page);
  const remote: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (/^https?:/.test(url.protocol) && !["127.0.0.1", "localhost"].includes(url.hostname)) remote.push(url.href);
  });
  // Deterministic randomness only; all spawns, collisions, scores and losses remain original.
  await page.addInitScript(() => {
    if (!location.pathname.includes("/coil-original/")) return;
    let seed = 715146;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  });
  const act = async (locator: Locator) => {
    if (await locator.evaluate((element) => !!element.ownerDocument.defaultView?.frameElement))
      await page.locator('iframe[title="Coil 光迹围球原作"]').scrollIntoViewIfNeeded();
    return mobile ? locator.tap() : locator.click();
  };
  await openGame(page, "光迹围球");
  const root = page.locator("[data-coil-game]");
  const iframe = page.locator('iframe[title="Coil 光迹围球原作"]');
  const frame = page.frameLocator('iframe[title="Coil 光迹围球原作"]');
  const canvas = frame.locator("#world");
  const read = async () => JSON.parse((await frame.locator("body").getAttribute("data-coil-state"))!) as Live;
  await expect(root).toHaveAttribute("data-coil-ready", "true");
  await expect(page.getByLabel("选择关卡", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("coil-welcome.png"), fullPage: true });
  await act(frame.getByRole("button", { name: "开始画圈", exact: true }));
  await expect.poll(async () => (await read()).phase).toBe("playing");
  await canvas.scrollIntoViewIfNeeded();
  if (!mobile) {
    await canvas.focus();
    const before = (await read()).cursor.x;
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(140);
    await page.keyboard.up("ArrowRight");
    await expect.poll(async () => (await read()).cursor.x).toBeGreaterThan(before + 12);
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await read()).paused).toBe(true);
    const frozen = await read();
    await page.waitForTimeout(350);
    expect((await read()).frame).toBe(frozen.frame);
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await read()).paused).toBe(false);
  }
  const cdp = mobile ? await page.context().newCDPSession(page) : null;
  const drawLoop = async (x: number, y: number, radius = 43) => {
    await iframe.scrollIntoViewIfNeeded();
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    const live = await read();
    const point = (angle: number) => ({
      x: box.x + (x + Math.cos(angle) * radius) * box.width / live.width,
      y: box.y + (y + Math.sin(angle) * radius) * box.height / live.height,
    });
    const first = point(0);
    if (cdp) await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...first, id: 1 }] });
    else { await page.mouse.move(first.x, first.y); await page.mouse.down(); }
    // Let the original 0.4 interpolation settle at the entry point first.
    await page.waitForTimeout(100);
    // A little over one revolution crosses the actual 45-point trail.
    for (let n = 1; n <= 33; n++) {
      const p = point(n / 26 * Math.PI * 2);
      if (cdp) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...p, id: 1 }] });
      else await page.mouse.move(p.x, p.y);
      await page.waitForTimeout(12);
    }
    if (cdp) await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    else await page.mouse.up();
    await page.waitForTimeout(130);
  };
  await expect.poll(async () => (await read()).duration).toBeGreaterThan(1100);
  // Five natural captures reach x2. Select a blue ball with room to avoid a bomb.
  for (let attempt = 0; attempt < 12 && (await read()).captures < 5; attempt++) {
    let target: Live["enemies"][number] | undefined;
    await expect.poll(async () => {
      const state = await read();
      target = state.enemies.find((e) => e.type === 1 && e.alive && e.age < 65 &&
        state.enemies.every((b) => b.type !== 2 || Math.hypot(e.x - b.x, e.y - b.y) > 67));
      return !!target;
    }, { timeout: 9000 }).toBe(true);
    const captures = (await read()).captures;
    await drawLoop(target!.x, target!.y);
    await expect.poll(async () => (await read()).captures).toBeGreaterThan(captures);
  }
  const caught = await read();
  expect(caught.captures).toBeGreaterThanOrEqual(5);
  expect(caught.multiplier).toBeGreaterThanOrEqual(2);
  expect(caught.score).toBeGreaterThan(150);
  await page.screenshot({ path: info.outputPath("coil-real-enclosures.png"), fullPage: true });

  // Freeze the entire original engine, including enemy age and difficulty.
  await act(page.getByRole("button", { name: "暂停", exact: true }));
  await expect.poll(async () => (await read()).paused).toBe(true);
  const frozen = await read();
  await page.waitForTimeout(1100);
  expect(await read()).toEqual(frozen);
  await act(page.getByRole("button", { name: "继续游戏", exact: true }));
  await expect.poll(async () => (await read()).frame).toBeGreaterThan(frozen.frame);

  // The actual red target is enclosed with the same physical input, costing energy.
  let bomb: Live["enemies"][number] | undefined;
  await expect.poll(async () => {
    bomb = (await read()).enemies.find((e) => e.type === 2 && e.alive && e.age < 65);
    return !!bomb;
  }, { timeout: 9000 }).toBe(true);
  const penalties = (await read()).bombsCaught;
  await drawLoop(bomb!.x, bomb!.y);
  await expect.poll(async () => (await read()).bombsCaught).toBeGreaterThan(penalties);
  expect((await read()).energy).toBeLessThanOrEqual(73);

  // Let blue balls expire through the unchanged clock and energy rules.
  await expect.poll(async () => (await read()).phase, { timeout: 40000 }).toBe("lost");
  const lost = await read();
  expect(lost.energy).toBe(0);
  expect(lost.expired).toBeGreaterThan(0);
  await expect(frame.getByRole("button", { name: "再来一局", exact: true })).toBeVisible();
  await expect(page.locator(".status")).not.toHaveClass(/success/);
  await page.screenshot({ path: info.outputPath("coil-natural-loss.png"), fullPage: true });
  await act(frame.getByRole("button", { name: "再来一局", exact: true }));
  await expect.poll(async () => (await read()).phase).toBe("playing");
  expect((await read()).energy).toBe(100);
  expect((await read()).captures).toBe(0);
  expect((await read()).best).toBeGreaterThanOrEqual(lost.score);
  await act(page.getByRole("button", { name: "重来", exact: true }));
  await expect(root).toHaveAttribute("data-coil-ready", "true");
  await expect.poll(async () => (await read()).phase).toBe("welcome");
  expect((await read()).score).toBe(0);
  expect((await read()).best).toBeGreaterThanOrEqual(lost.score);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await frame.locator("body").evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await act(page.getByRole("button", { name: "返回游戏大厅", exact: true }));
  await expect(iframe).toHaveCount(0);
  expect(page.frames().filter((f) => f.url().includes("/coil-original/"))).toHaveLength(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("playgarden.coil.original.records") || "null"));
  expect(saved.best).toBeGreaterThanOrEqual(lost.score);
  expect(saved.runs).toBe(1);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("playgarden.coil.original.records") || "null"))).toEqual(saved);
  await page.reload();
  await openGame(page, "光迹围球");
  await expect(root).toHaveAttribute("data-coil-ready", "true");
  expect((await read()).best).toBe(saved.best);
  expect((await read()).phase).toBe("welcome");
  await page.screenshot({ path: info.outputPath("coil-restored-record.png"), fullPage: true });
  expect(remote).toEqual([]);
  expect(errors).toEqual([]);
  await cdp?.detach();
});
