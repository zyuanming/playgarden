// SPDX-License-Identifier: GPL-3.0-only
import { test, expect } from "@playwright/test";
import { crispJourney } from "./crisp-helpers";
type Bamboo = { harvests: number; bounces: number; heldPasses: number; x: number; vx: number; avx: number; bamboos: { x: number; height: number; speed: number }[] };
test("BAMBOO original: ripe harvest, hold-through, overripe rebound, natural loss and lifecycle", async ({ page }, info) => {
  test.setTimeout(110000);
  const j = await crispJourney<Bamboo>(page, info, "bamboo", "竹林巧收");
  await j.pauseAndSound();
  const direction = (await j.read()).mechanics.vx;
  await j.tap();
  expect((await j.read()).mechanics.vx).toBe(-direction);
  // Let the original runner meet naturally grown yellow bamboo with the button released.
  await expect.poll(async () => (await j.read()).mechanics.harvests, { timeout: 18000, intervals: [80] }).toBeGreaterThan(0);
  expect((await j.read()).score).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath("bamboo-ripe-harvest.png"), fullPage: true });
  await j.hold(true);
  await expect.poll(async () => (await j.read()).mechanics.heldPasses, { timeout: 6000, intervals: [80] }).toBeGreaterThan(0);
  // Keep walking through until a real overripe stalk is close enough to strike on release.
  await expect.poll(async () => {
    const s = await j.read(), m = s.mechanics;
    return m.bamboos.some(b => b.height > 27 && Math.abs(b.x - m.x) < 7);
  }, { timeout: 16000, intervals: [35] }).toBe(true);
  const beforeBounce = (await j.read()).mechanics.bounces;
  await j.hold(false);
  await expect.poll(async () => (await j.read()).mechanics.bounces, { timeout: 5000, intervals: [50] }).toBeGreaterThan(beforeBounce);
  await page.screenshot({ path: info.outputPath("bamboo-overripe-rebound.png"), fullPage: true });
  // Holding prevents every harvest; unchanged bamboo growth reaches the top.
  await j.hold(true);
  await expect.poll(async () => (await j.read()).phase, { timeout: 50000, intervals: [80] }).toBe("gameOver");
  const lost = await j.read(); expect(lost.mechanics.bamboos.some(b => b.height >= 89)).toBe(true);
  await j.hold(false);
  await j.finish(lost);
});
