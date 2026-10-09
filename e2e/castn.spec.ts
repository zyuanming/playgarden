// SPDX-License-Identifier: GPL-3.0-only
import { test, expect } from "@playwright/test";
import { crispJourney } from "./crisp-helpers";
type Cast = { blue: number; red: number; casts: number; pulls: number; net: string; power: number; waterY: number; multiplier: number; nodes: { x: number; y: number }[]; fishes: { x: number; y: number; type: number }[] };
test("CAST N original: genuine net physics, blue/red catches, flood loss, replay and teardown", async ({ page }, info) => {
  test.setTimeout(150000);
  const j = await crispJourney<Cast>(page, info, "castn", "抛网捕鱼");
  await j.pauseAndSound();
  function distance(f: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((f.x - a.x) * dx + (f.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(f.x - a.x - dx * t, f.y - a.y - dy * t);
  }
  // Observe the real net and fish, charge, cast, and pull when a fish reaches the rope.
  // This controller only emits physical input. It does not set positions, ticks or scores.
  const until = Date.now() + 85000;
  while (Date.now() < until) {
    const s = await j.read(), m = s.mechanics;
    if (s.phase !== "inGame" || (m.blue > 0 && m.red > 0)) break;
    if (m.net === "ready") {
      await j.hold(true);
      await expect.poll(async () => (await j.read()).mechanics.net, { intervals: [40] }).toBe("angle");
      await expect.poll(async () => (await j.read()).mechanics.power, { intervals: [40] }).toBeGreaterThan(2.6);
      await j.hold(false);
    } else if (m.net === "throw") {
      const wanted = m.fishes.filter(f => m.blue === 0 ? f.type === 1 : f.type === 0);
      const touching = wanted.some(f => m.nodes.some((n, i) => i > 0 && distance(f, n, m.nodes[i - 1]) < 6));
      if (touching || m.waterY < 21) await j.tap();
      else await page.waitForTimeout(100);
    } else await page.waitForTimeout(80);
  }
  const caught = await j.read();
  expect(caught.mechanics.blue).toBeGreaterThan(0);
  expect(caught.mechanics.red).toBeGreaterThan(0);
  expect(caught.mechanics.nodes).toHaveLength(20);
  expect(caught.mechanics.casts).toBeGreaterThan(0); expect(caught.mechanics.pulls).toBeGreaterThan(0);
  expect(caught.score).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath("castn-real-fish-and-net.png"), fullPage: true });
  await j.hold(false);
  // No more fishing: the untouched rising-water rule causes the real game over.
  await expect.poll(async () => (await j.read()).phase, { timeout: 55000, intervals: [100] }).toBe("gameOver");
  const lost = await j.read(); expect(lost.mechanics.waterY).toBeLessThan(16.1);
  await j.finish(lost);
});
