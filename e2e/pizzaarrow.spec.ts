// SPDX-License-Identifier: GPL-3.0-only
import { test, expect } from "@playwright/test";
import { crispJourney } from "./crisp-helpers";
type Cut = { award: number; multiplier: number; removedRadians: number; beforeWidth: number; afterWidth: number; scoreBefore: number; frame: number };
type Pizza = { pulls: number; shots: number; autoShots: number; yellowHits: number; splits: number; glancingHits: number; redLosses: number;
  lastCut: Cut | null; lastShot: { automatic: boolean; frame: number; x: number; gameSpeed: number } | null;
  pizza: { from: number; to: number; angle: number; angleVel: number; y: number } | null;
  pizzaPart: { from: number; to: number; x: number; y: number } | null;
  arrow: { x: number; vx: number } | null; arrowCount: number; nextArrowCount: number; nextPizzaTicks: number; gameSpeed: number; multiplier: number };
const tau = Math.PI * 2;
const wrap = (a: number) => ((a % tau) + tau) % tau;
const difference = (a: number, b: number) => Math.abs(wrap(a - b + Math.PI) - Math.PI);

// Forecast only the timing of an ordinary physical shot from visible angle/speed.
// This pure arithmetic does not run upstream code or write any game state.
function shotRotation(speed: number, heldFrames: number, automatic: boolean, targetX = 53) {
  let x = 80, vx = 1, turn = 0, frame = 0;
  while (x > targetX && frame < 180) {
    turn += .2 * speed;
    const pressed = automatic ? vx > 0 : frame < heldFrames;
    if (pressed) speed += (.05 - speed) * .1;
    if ((!pressed && frame === heldFrames) || x > 90) vx = -5;
    if (vx < 0) speed += (1 - speed) * .2;
    x += vx * speed; frame++;
  }
  return turn;
}

test("PIZZA ARROW original: slow draw, area cut, increasing arrows, auto-release, red loss and lifecycle", async ({ page }, info) => {
  test.setTimeout(150000);
  const j = await crispJourney<Pizza>(page, info, "pizzaarrow", "披萨神箭");
  await j.pauseAndSound();
  // Lifecycle exercises can draw/release a real arrow. Begin the core loop from the
  // original title through the shell's real restart control, never a state setter.
  const restart = page.getByRole("button", { name: "重来", exact: true });
  if (info.project.name === "mobile") await restart.tap(); else await restart.click();
  await expect.poll(async () => (await j.read()).phase).toBe("title");
  await j.tap();
  await expect.poll(async () => (await j.read()).phase).toBe("inGame");
  const redTouch = info.project.name === "mobile" ? await page.context().newCDPSession(page) : null;

  async function aim(automatic: boolean, red = false) {
    await j.hold(false);
    await expect.poll(async () => {
      const s = await j.read(), m = s.mechanics;
      expect(s.phase).toBe("inGame");
      return m.nextPizzaTicks < 0 && !m.arrow && m.pizza?.y === 50;
    }, { timeout: 6000, intervals: [20] }).toBe(true);
    // Prepare the pointer before watching the rotating target. Scrolling,
    // measuring and moving after alignment consumed several live desktop
    // frames in the failed trace. Actual down/up events still drive the game.
    await j.canvas.scrollIntoViewIfNeeded();
    const bounds = (await j.canvas.boundingBox())!;
    const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    if (red && !redTouch) await page.mouse.move(point.x, point.y);
    const redHold = async (value: boolean) => {
      if (redTouch) await redTouch.send("Input.dispatchTouchEvent", {
        type: value ? "touchStart" : "touchEnd", touchPoints: value ? [{ ...point, id: 7 }] : [],
      });
      else if (value) await page.mouse.down();
      else await page.mouse.up();
    };
    await expect.poll(async () => {
      const m = (await j.read()).mechanics, p = m.pizza!;
      // Aim midway within the remaining edible arc, or centrally through its gap.
      // Gap shots meet the original inner red arc after travelling farther left.
      const target = red ? wrap((p.to + p.from + tau) / 2) : (p.from + p.to) / 2;
      const drawFrames = Math.max(1, Math.ceil(Math.log(.19 / Math.max(.191, m.gameSpeed - .05)) / Math.log(.9)));
      // A red shot must pass the outer yellow rim and the inner red arc.
      // Center that whole corridor in the gap instead of aiming only at its end.
      const turn = red
        ? (shotRotation(m.gameSpeed, drawFrames, automatic, 53) + shotRotation(m.gameSpeed, drawFrames, automatic, 38)) / 2
        : shotRotation(m.gameSpeed, drawFrames, automatic, 53);
      return difference(wrap(-p.angle - turn), target) < .17;
    }, { timeout: 8000, intervals: [15] }).toBe(true);
    const before = await j.read();
    if (red) await redHold(true); else await j.hold(true);
    if (automatic) {
      await expect.poll(async () => (await j.read()).mechanics.autoShots, { timeout: 3500, intervals: [20] }).toBeGreaterThan(before.mechanics.autoShots);
      if (red) await redHold(false); else await j.hold(false);
    } else {
      await expect.poll(async () => (await j.read()).mechanics.gameSpeed, { timeout: 1200, intervals: [15] }).toBeLessThan(.24);
      const slow = await j.read();
      expect(slow.mechanics.arrow?.vx).toBe(1);
      if (red) await redHold(false); else await j.hold(false);
    }
    return before;
  }
  const first = await aim(false);
  await expect.poll(async () => (await j.read()).mechanics.splits, { timeout: 5000, intervals: [20] }).toBe(first.mechanics.splits + 1);
  const cut = await j.read(), detail = cut.mechanics.lastCut!;
  expect(detail.removedRadians).toBeGreaterThan(0);
  expect(detail.afterWidth).toBeLessThan(detail.beforeWidth);
  expect(detail.beforeWidth - detail.afterWidth).toBeCloseTo(detail.removedRadians, 6);
  expect(detail.award).toBe(Math.ceil(detail.removedRadians * 100 * detail.multiplier));
  expect(cut.score).toBe(detail.scoreBefore + detail.award);
  expect(cut.mechanics.nextArrowCount).toBe(2);
  expect(cut.mechanics.arrowCount).toBe(2);
  await page.screenshot({ path: info.outputPath("pizzaarrow-earned-cut-and-two-arrow-platter.png"), fullPage: true });

  await aim(true);
  await expect.poll(async () => (await j.read()).mechanics.splits, { timeout: 5000, intervals: [20] }).toBe(2);
  const second = await j.read();
  expect(second.mechanics.autoShots).toBeGreaterThan(0);
  expect(second.mechanics.nextArrowCount).toBe(2);
  expect(second.mechanics.arrowCount).toBe(1);
  expect(second.mechanics.multiplier).toBe(2);
  expect(second.mechanics.lastCut!.multiplier).toBe(1);
  await page.screenshot({ path: info.outputPath("pizzaarrow-original-auto-release-and-shrinking-sector.png"), fullPage: true });

  // A gap shot genuinely reaches the red inner arc. Ordinary physical timing is
  // allowed several shots, but only original collision can end the run.
  for (let attempt = 0; attempt < 5 && (await j.read()).phase === "inGame"; attempt++) {
    await aim(false, true);
    await expect.poll(async () => {
      const s = await j.read(); return s.phase === "gameOver" || !s.mechanics.arrow;
    }, { timeout: 5000, intervals: [20] }).toBe(true);
  }
  const lost = await j.read();
  expect(lost.phase).toBe("gameOver");
  expect(lost.mechanics.redLosses).toBeGreaterThan(0);
  expect(lost.mechanics.glancingHits).toBe(lost.mechanics.yellowHits - lost.mechanics.splits);
  await j.finish(lost);
  await redTouch?.detach();
});
