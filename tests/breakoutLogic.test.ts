// SPDX-License-Identifier: GPL-3.0-only
import { describe, it, expect } from "vitest";
import {
  segmentIntercept,
  sweepBox,
  paddleBounce,
} from "../src/vendor/breakout/geometry";
import {
  createBreakout,
  movePaddle,
  launchBreakout,
  stepBreakout,
  breakoutLevels,
  COURT,
  type BreakoutState,
} from "../src/games/breakoutLogic";
describe("breakout continuous geometry and state", () => {
  it("ports segment intersection including parallel and endpoints", () => {
    expect(segmentIntercept(0, 0, 10, 10, 0, 10, 10, 0)).toEqual({
      t: 0.5,
      x: 5,
      y: 5,
    });
    expect(segmentIntercept(0, 0, 10, 0, 0, 1, 10, 1)).toBeNull();
    expect(segmentIntercept(0, 0, 1, 1, 1, 0, 1, 1)?.t).toBe(1);
  });
  it("chooses earliest top crossing rather than a later side crossing", () => {
    const h = sweepBox(0, 0, 20, 10, 5, 4, 15, 8);
    expect(h?.t).toBe(0.4);
    expect(h?.ny).toBe(-1);
    expect(h?.x).toBe(8);
  });
  it("reflects exact corner on both axes and ignores receding faces", () => {
    expect(sweepBox(0, 0, 10, 10, 5, 5, 9, 9)).toMatchObject({
      t: 0.5,
      nx: -1,
      ny: -1,
    });
    expect(sweepBox(4, 6, -3, 0, 5, 5, 9, 9)).toBeNull();
  });
  it("paddle preserves speed, stays upward and clamps offset", () => {
    for (const o of [-10, -1, -0.5, 0, 0.5, 1, 10]) {
      const v = paddleBounce(o, 250);
      expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(250);
      expect(v.vy).toBeLessThan(-100);
    }
    expect(paddleBounce(0, 250)).toEqual({ vx: 0, vy: -250 });
  });
  it("contains twelve distinct original brick maps", () => {
    expect(breakoutLevels).toHaveLength(12);
    expect(new Set(breakoutLevels.map((l) => l.rows.join("/"))).size).toBe(12);
    for (let i = 0; i < 12; i++) {
      const s = createBreakout(i);
      expect(s.bricks.length).toBeGreaterThan(2);
      for (const b of s.bricks) {
        expect(b.x).toBeGreaterThan(0);
        expect(b.x + b.w).toBeLessThan(400);
        expect(b.hp).toBeGreaterThan(0);
      }
    }
  });
  it("clamps paddle and respects terminal/invalid input", () => {
    let s = createBreakout(0);
    expect(movePaddle(s, -9).paddle).toBe(44);
    expect(movePaddle(s, 999).paddle).toBe(356);
    expect(movePaddle(s, NaN)).toBe(s);
    expect(createBreakout(-1).level).toBe(0);
    s = { ...s, phase: "won" };
    expect(movePaddle(s, 100)).toBe(s);
    expect(launchBreakout(s)).toBe(s);
    expect(stepBreakout(s, 0.03)).toBe(s);
  });
  it("launch happens once, no mutation and invalid time is ignored", () => {
    const s = createBreakout(0);
    const a = launchBreakout(s);
    expect(s.phase).toBe("ready");
    expect(a.phase).toBe("playing");
    expect(launchBreakout(a)).toBe(a);
    expect(stepBreakout(a, NaN)).toBe(a);
    expect(stepBreakout(a, -1)).toBe(a);
    expect(stepBreakout(a, 1).elapsed).toBeCloseTo(0.05);
  });
  it("continuous sweep catches high-speed bricks and updates damage once", () => {
    const s = {
      ...launchBreakout(createBreakout(5)),
      x: 150,
      y: 120,
      vx: 0,
      vy: -10000,
    };
    const a = stepBreakout(s, 0.006);
    expect(a.hits).toBe(1);
    expect(a.score).toBe(10);
    expect(s.bricks[0].hp).toBe(2);
    expect(a.bricks[0].hp).toBe(1);
    expect(a.vy).toBeGreaterThan(0);
  });
  it("wall reflections keep the ball inside and do not score", () => {
    for (const [x, vx] of [
      [7, -250],
      [393, 250],
    ]) {
      const a = stepBreakout(
        { ...launchBreakout(createBreakout(0)), x, y: 330, vx, vy: 0 },
        0.05,
      );
      expect(a.x).toBeGreaterThanOrEqual(6);
      expect(a.x).toBeLessThanOrEqual(394);
      expect(Math.sign(a.vx)).toBe(-Math.sign(vx));
      expect(a.score).toBe(0);
    }
  });
  it("a miss takes exactly one life; below-paddle balls cannot be rescued", () => {
    const s = {
      ...launchBreakout(createBreakout(0)),
      x: 200,
      y: 498,
      vx: 0,
      vy: 250,
    };
    const a = stepBreakout(s, 0.05);
    expect(a.phase).toBe("ready");
    expect(a.lives).toBe(2);
    expect(stepBreakout(a, 0.05)).toBe(a);
    expect(stepBreakout({ ...s, lives: 1 }, 0.05).phase).toBe("lost");
  });
  it("last brick wins once; all later inputs remain locked", () => {
    const base = launchBreakout(createBreakout(0));
    const s = {
      ...base,
      bricks: [{ id: 1, x: 180, y: 60, w: 40, h: 20, hp: 1 }],
      x: 200,
      y: 100,
      vx: 0,
      vy: -250,
    };
    let a = s;
    for (let n = 0; n < 30 && a.phase === "playing"; n++)
      a = stepBreakout(a, 0.01);
    expect(a.phase).toBe("won");
    expect(a.score).toBe(10);
    expect(a.hits).toBe(1);
    expect(stepBreakout(a, 0.05)).toBe(a);
  });
});
// Test controller uses the same information visibly presented to a player,
// chooses legal paddle positions, and never mutates ball/brick state.
export function choosePaddle(s: BreakoutState, _turn: number) {
  if (s.vy <= 0) return s.paddle;
  let x = s.x + s.vx * ((COURT.paddleY - COURT.radius - s.y) / s.vy);
  const span = COURT.width - 2 * COURT.radius;
  let p = (((x - COURT.radius) % (2 * span)) + 2 * span) % (2 * span);
  x = COURT.radius + (p <= span ? p : 2 * span - p);
  const target = [...s.bricks]
    .filter((b) => b.hp)
    .sort(
      (a, b) => b.y - a.y || Math.abs(a.x + 22 - x) - Math.abs(b.x + 22 - x),
    )[0];
  if (!target) return x;
  const slope =
    (target.x + target.w / 2 - x) /
    (COURT.paddleY - COURT.radius - target.y - target.h - COURT.radius);
  const offset =
    (slope / Math.sqrt(1 + slope * slope) / 0.85) * (COURT.paddleWidth / 2);
  return x - offset;
}
it("all 12 stages clear by legal paddle control, without state injection", () => {
  for (let level = 0; level < 12; level++) {
    let s: BreakoutState = launchBreakout(createBreakout(level));
    for (let t = 0; t < 90000 && s.phase !== "won" && s.phase !== "lost"; t++) {
      s = movePaddle(s, choosePaddle(s, t));
      if (s.phase === "ready") s = launchBreakout(s);
      s = stepBreakout(s, 1 / 120);
      expect(Number.isFinite(s.x) && Number.isFinite(s.y)).toBe(true);
    }
    expect(
      s.phase,
      `stage ${level + 1} bricks ${s.bricks.filter((b) => b.hp).length}`,
    ).toBe("won");
  }
}, 30000);
