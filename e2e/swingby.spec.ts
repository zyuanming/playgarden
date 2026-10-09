// SPDX-License-Identifier: GPL-3.0-only
import { test, expect } from "@playwright/test";
import { crispJourney, type Live } from "./crisp-helpers";

type Star = { x: number; y: number; radius: number; screenX: number; screenY: number };
type Damage = { before: number; after: number; x: number; y: number; difficulty: number };
type Swingby = {
  ship: { x: number; y: number; vx: number; vy: number };
  hitCount: number;
  stars: Star[];
  starAddPos: { x: number; y: number };
  shipScreenPos: { x: number; y: number };
  collisionFrames: number;
  healingFrames: number;
  heldFrames: number;
  releasedFrames: number;
  starGenerations: number;
  maxDamage: number;
  lastDamageDelta: number;
  lastCollision: Damage | null;
  lastRecovery: Damage | null;
};

const tau = Math.PI * 2;
const clockwise = (angle: number) => ((angle % tau) + tau) % tau;
const heading = (m: Swingby) => Math.atan2(m.ship.vy, m.ship.vx);
const angleDifference = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

test("SWINGBY original: right-turn flight, distance score, collision recovery and natural loss", async ({ page }, info) => {
  test.setTimeout(180000);
  const j = await crispJourney<Swingby>(page, info, "swingby", "引力远航");
  const evidence: unknown[] = [];
  let stage = "controls";
  const record = (s: Live<Swingby>) => {
    const m = s.mechanics;
    evidence.push({ stage, phase: s.phase, run: s.run, frames: s.frames, ticks: s.ticks,
      score: s.score, difficulty: s.difficulty, pressed: s.pressed, ship: m.ship,
      hitCount: m.hitCount, collisionFrames: m.collisionFrames, healingFrames: m.healingFrames,
      starGenerations: m.starGenerations, maxDamage: m.maxDamage,
      nearestStars: [...m.stars].sort((a, b) => Math.hypot(a.x - m.ship.x, a.y - m.ship.y)
        - Math.hypot(b.x - m.ship.x, b.y - m.ship.y)).slice(0, 3),
      lastCollision: m.lastCollision, lastRecovery: m.lastRecovery });
  };
  const assertDistance = (s: Live<Swingby>) => {
    // This score is displacement from the origin. It may decrease on a return
    // orbit; neither peak score nor accumulated path length is the rule.
    expect(s.score).toBe(Math.floor(Math.hypot(s.mechanics.ship.x, s.mechanics.ship.y)));
  };
  const sameStar = (a: Star, b: Star) => Math.abs(a.x - b.x) < 0.00001 && Math.abs(a.y - b.y) < 0.00001;
  const chooseStar = (m: Swingby, small: boolean) => {
    const preferred = m.stars.filter(s => small ? s.radius < 10 : s.radius >= 10);
    const candidates = preferred.length ? preferred : m.stars;
    const cost = (s: Star) => Math.hypot(s.x - m.ship.x, s.y - m.ship.y)
      + 12 * clockwise(Math.atan2(s.y - m.ship.y, s.x - m.ship.x) - heading(m));
    return [...candidates].sort((a, b) => cost(a) - cost(b))[0];
  };
  const turnToward = async (m: Swingby, desired: number) => {
    const turn = clockwise(desired - heading(m));
    // The one original button only turns right. Allow a small alignment band
    // instead of repeatedly committing to another full circle at its boundary.
    await j.hold(turn > 0.10 && turn < tau - 0.22);
  };

  try {
    await j.pauseAndSound();
    await j.hold(false);
    const before = await j.read();
    await j.hold(true);
    await expect.poll(async () => (await j.read()).mechanics.heldFrames, { intervals: [25] })
      .toBeGreaterThan(before.mechanics.heldFrames + 7);
    const held = await j.read();
    expect(held.phase).toBe("inGame");
    expect(held.pressed).toBe(true);
    expect(Math.abs(angleDifference(heading(held.mechanics), heading(before.mechanics)))).toBeGreaterThan(0.03);
    await j.hold(false);
    await expect.poll(async () => (await j.read()).pressed, { intervals: [25] }).toBe(false);
    const releaseStart = await j.read();
    await expect.poll(async () => (await j.read()).mechanics.releasedFrames, { intervals: [25] })
      .toBeGreaterThan(releaseStart.mechanics.releasedFrames + 7);
    const released = await j.read();
    expect(released.pressed).toBe(false);
    expect(released.mechanics.heldFrames).toBe(releaseStart.mechanics.heldFrames);
    expect(Math.hypot(released.mechanics.ship.x - held.mechanics.ship.x, released.mechanics.ship.y - held.mechanics.ship.y)).toBeGreaterThan(0.1);
    expect(released.difficulty).toBeGreaterThanOrEqual(1);
    assertDistance(released);
    record(before); record(held); record(released);

    stage = "approach and damage";
    let target = chooseStar(released.mechanics, false);
    let trajectoryCaptured = false;
    let damaged: Live<Swingby> | undefined;
    const approachDeadline = Date.now() + 40000;
    while (Date.now() < approachDeadline) {
      const s = await j.read(), m = s.mechanics;
      record(s); assertDistance(s);
      expect(s.phase, "The original ship must survive long enough to show damage and recovery").toBe("inGame");
      if (!trajectoryCaptured && s.score >= 20) {
        await page.screenshot({ path: info.outputPath("swingby-real-trajectory.png"), fullPage: true });
        trajectoryCaptured = true;
      }
      if (m.hitCount > 0 && m.lastCollision) { damaged = s; break; }
      if (!target || !m.stars.some(star => sameStar(star, target!))) target = chooseStar(m, false);
      expect(target, "A real generated star must be available to approach").toBeDefined();
      await turnToward(m, Math.atan2(target!.y - m.ship.y, target!.x - m.ship.x));
      await page.waitForTimeout(35);
    }
    expect(damaged, "Physical right-turn steering must reach an original star ring").toBeDefined();
    const damage = damaged!;
    expect(damage.mechanics.collisionFrames).toBeGreaterThan(0);
    expect(damage.mechanics.lastCollision!.after - damage.mechanics.lastCollision!.before)
      .toBeCloseTo(4 * damage.mechanics.lastCollision!.difficulty, 5);
    expect(damage.score).toBeGreaterThan(0);
    await j.hold(false);
    await page.screenshot({ path: info.outputPath("swingby-real-collision-damage.png"), fullPage: true });

    stage = "damage recovery";
    // Stars are thick rings, not solid disks. Continue the physical flight
    // through the ring; the unmodified original heals in the empty interior
    // and outside. Do not manufacture damage, healing, position, or velocity.
    let recovered: Live<Swingby> | undefined;
    const recoveryDeadline = Date.now() + 18000;
    while (Date.now() < recoveryDeadline) {
      const s = await j.read(), m = s.mechanics;
      record(s); assertDistance(s);
      expect(s.phase, "A real collision must be followed by surviving recovery").toBe("inGame");
      if (m.healingFrames > damage.mechanics.healingFrames && m.lastRecovery
          && m.hitCount < m.maxDamage && (m.lastDamageDelta < 0 || m.hitCount <= 0)) {
        recovered = s;
        break;
      }
      await page.waitForTimeout(35);
    }
    expect(recovered, "The original damage meter must decrease during actual free flight").toBeDefined();
    const recovery = recovered!;
    expect(recovery.mechanics.lastRecovery!.before).toBeGreaterThan(0);
    expect(recovery.mechanics.lastRecovery!.before - recovery.mechanics.lastRecovery!.after)
      .toBeCloseTo(recovery.mechanics.lastRecovery!.difficulty, 5);
    expect(recovery.mechanics.hitCount).toBeLessThan(recovery.mechanics.maxDamage);
    await page.screenshot({ path: info.outputPath("swingby-real-damage-recovery.png"), fullPage: true });
    // A short first approach can meet a ring before the trajectory threshold.
    // Recovery still supplies a real scored-flight screenshot in that case.
    if (!trajectoryCaptured) {
      expect(recovery.score).toBeGreaterThan(0);
      await page.screenshot({ path: info.outputPath("swingby-real-trajectory.png"), fullPage: true });
    }

    stage = "sustained collision and natural loss";
    target = chooseStar(recovery.mechanics, true);
    let lost: Live<Swingby> | undefined;
    const lossDeadline = Date.now() + 65000;
    while (Date.now() < lossDeadline) {
      const s = await j.read(), m = s.mechanics;
      record(s); assertDistance(s);
      if (s.phase === "gameOver") { lost = s; break; }
      expect(s.phase).toBe("inGame");
      if (!target || !m.stars.some(star => sameStar(star, target!))) target = chooseStar(m, true);
      expect(target).toBeDefined();
      const dx = m.ship.x - target!.x, dy = m.ship.y - target!.y;
      const distance = Math.hypot(dx, dy);
      if (distance > target!.radius + 16) {
        await turnToward(m, Math.atan2(-dy, -dx));
      } else {
        // Steer clockwise along the visible ring, correcting toward its edge.
        // This is geometric guidance from the live observation, not a second
        // physics simulation or a replacement for original collision checks.
        const radial = Math.atan2(dy, dx);
        const correction = Math.max(-2, Math.min(2, (target!.radius - 2 - distance) * 0.35));
        const desired = Math.atan2(Math.cos(radial) + Math.sin(radial) * correction,
          -Math.sin(radial) + Math.cos(radial) * correction);
        await turnToward(m, desired);
      }
      await page.waitForTimeout(35);
    }
    expect(lost, "Repeated physical ring contact must cause the original >99 damage loss").toBeDefined();
    expect(lost!.mechanics.hitCount).toBeGreaterThan(99);
    expect(lost!.mechanics.maxDamage).toBeGreaterThan(99);
    expect(lost!.mechanics.collisionFrames).toBeGreaterThan(recovery.mechanics.collisionFrames);
    expect(lost!.mechanics.healingFrames).toBeGreaterThan(0);
    expect(lost!.mechanics.starGenerations).toBeGreaterThan(0);
    expect(lost!.difficulty).toBeGreaterThanOrEqual(recovery.difficulty);
    expect(lost!.replaying).toBe(false);
    assertDistance(lost!);
    await j.hold(false);
    await j.finish(lost!);
  } finally {
    await info.attach("swingby-physical-flight-observations", {
      body: JSON.stringify(evidence, null, 2), contentType: "application/json",
    });
  }
});
