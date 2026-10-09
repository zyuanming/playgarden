// SPDX-License-Identifier: GPL-3.0-only
import { test, expect } from "@playwright/test";
import { crispJourney } from "./crisp-helpers";
type Parking = { parked: number; pickups: number; collisionLosses: number; bottomLosses: number; carAngle: number; carCount: number; multiplier: number; roadY: number; gold: { x: number; y: number } | null; cars: { x: number; y: number }[]; parkedCars: { x: number; y: number }[] };
test("PARKING original: coin, open-space parking, simultaneous cars, collision and lifecycle", async ({ page }, info) => {
  test.setTimeout(120000);
  const j = await crispJourney<Parking>(page, info, "parking", "同步泊车");
  await j.pauseAndSound();
  // Cruise toward a reachable coin, then approach the curb before committing to a gap.
  // Shallow steering pulses preserve forward travel: a sustained turn across the whole
  // road lets the original scrolling carry the car past the bottom before it can park.
  const until = Date.now() + 55000;
  let committing = false;
  while (Date.now() < until) {
    const s = await j.read(), m = s.mechanics;
    if (s.phase !== "inGame" || (m.parked >= 2 && m.pickups >= 1 && m.cars.length >= 2)) break;
    const car = m.cars[0];
    if (!car || car.y < 5) { committing = false; await j.hold(false); await page.waitForTimeout(60); continue; }
    const gold = m.gold;
    const seekingCoin = m.pickups === 0 && gold !== null && gold.x >= car.x - 3 && gold.x < 73;
    const targetX = seekingCoin ? gold!.x : 68;
    const stoppingTravel = Math.max(0, (m.carAngle + Math.PI / 2) * 7);
    // Every car shares the steering input. A second car can already be next to
    // the curb while cars[0] is still changing lanes; protect its turn as well.
    const trafficBesideFleet = m.cars.some(c => c.y >= 3 && c.x + stoppingTravel > 66 &&
      m.parkedCars.some(p => Math.abs(p.y - (c.y - 8)) <= 22));
    if (trafficBesideFleet) {
      committing = false;
      await j.hold(false);
    } else if (!committing && car.x + stoppingTravel < targetX - 1.5) {
      // Observe the actual heading and release before the car becomes horizontal.
      // This is physical button control, with no game-state or physics changes.
      await j.hold(m.carAngle < -Math.PI / 3);
    } else if (!committing && seekingCoin) {
      // If the first coin passed during the lifecycle checks, cruise in its lane.
      // The original game replaces missed coins; do not rush into a long crossing.
      await j.hold(false);
    } else {
      const gap = m.parkedCars.every(p => Math.abs(p.y - (car.y - 8)) > 22);
      if (gap || committing) { committing = true; await j.hold(true); }
      else await j.hold(false);
    }
    const previous = m.parked;
    await page.waitForTimeout(45);
    if ((await j.read()).mechanics.parked > previous) { committing = false; await j.hold(false); }
  }
  const scored = await j.read();
  expect(scored.mechanics.parked).toBeGreaterThanOrEqual(2);
  expect(scored.mechanics.pickups).toBeGreaterThanOrEqual(1);
  expect(scored.mechanics.carCount).toBeGreaterThan(2);
  expect(scored.mechanics.cars.length).toBeGreaterThanOrEqual(2);
  expect(scored.score).toBeGreaterThanOrEqual(21);
  await page.screenshot({ path: info.outputPath("parking-real-parks-and-multiple-cars.png"), fullPage: true });
  // Deliberately steer toward an occupied strip using the real controller.
  await j.hold(false);
  await expect.poll(async () => {
    const m = (await j.read()).mechanics, c = m.cars[0];
    return !!c && m.parkedCars.some(p => Math.abs(p.y - (c.y - 8)) < 9);
  }, { timeout: 15000, intervals: [45] }).toBe(true);
  await j.hold(true);
  await expect.poll(async () => (await j.read()).phase, { timeout: 16000, intervals: [60] }).toBe("gameOver");
  const lost = await j.read(); expect(lost.mechanics.collisionLosses).toBeGreaterThan(0);
  await j.hold(false);
  await j.finish(lost);
});
