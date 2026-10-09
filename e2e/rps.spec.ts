// SPDX-License-Identifier: GPL-3.0-only
import { test, expect } from "@playwright/test";
import { crispJourney, type Live } from "./crisp-helpers";

type Outcome = "win" | "tie" | "defeat";
type Encounter = {
  kind: Outcome;
  playerType: number;
  enemyType: number;
  laneIndex: number;
  scoreBefore: number;
  award: number;
  multiplierBefore: number;
  frame: number;
  freezeTicks: number;
};
type Rps = {
  wins: number;
  ties: number;
  defeats: number;
  acceptedInputs: number;
  blockedInputs: number;
  bottomLosses: number;
  multiplier: number;
  myHand: { laneIndex: number; x: number; y: number; targetY: number; vy: number; type: number; freezeTicks: number };
  hands: { laneIndex: number; y: number; my: number; baseMy: number; type: number; isDestroyed: boolean }[];
  lanes: { x: number; handType: number; nextTicks: number }[];
  lastEncounter: Encounter | null;
  lastWin: Encounter | null;
  lastTie: Encounter | null;
  lastDefeat: Encounter | null;
};

test("RPS original: coupled lane/gesture cycle, earned multiplier, tie, frozen defeat and lifecycle", async ({ page }, info) => {
  test.setTimeout(150000);
  const j = await crispJourney<Rps>(page, info, "rps", "猜拳四轨");
  await j.pauseAndSound();

  // The shared helper owns ordinary RNG seeding, real desktop mouse/mobile touch
  // input and lifecycle checks. Every read below is observation, never a mutation.
  async function acceptedTap() {
    const before = await j.read();
    expect(before.phase).toBe("inGame");
    expect(before.mechanics.myHand.freezeTicks).toBeLessThan(0);
    await j.tap();
    // Leave a real released interval between presses so the original edge-triggered
    // controller sees separate taps even when two Playwright calls finish quickly.
    await page.waitForTimeout(35);
    const after = await j.read();
    expect(after.mechanics.acceptedInputs).toBe(before.mechanics.acceptedInputs + 1);
    expect(after.mechanics.myHand.laneIndex).toBe((before.mechanics.myHand.laneIndex + 1) % 4);
    expect(after.mechanics.myHand.type).toBe((before.mechanics.myHand.type + 1) % 3);
    return after;
  }

  const cycleStart = await j.read();
  const lanes = new Set<number>(), gestures = new Set<number>(), pairs = new Set<string>();
  for (let i = 0; i < 12; i++) {
    const s = await acceptedTap(), hand = s.mechanics.myHand;
    lanes.add(hand.laneIndex); gestures.add(hand.type); pairs.add(`${hand.laneIndex}:${hand.type}`);
  }
  const cycleEnd = await j.read();
  expect(lanes.size).toBe(4); expect(gestures.size).toBe(3); expect(pairs.size).toBe(12);
  expect(cycleEnd.mechanics.acceptedInputs).toBe(cycleStart.mechanics.acceptedInputs + 12);
  expect(cycleEnd.mechanics.myHand.laneIndex).toBe(cycleStart.mechanics.myHand.laneIndex);
  expect(cycleEnd.mechanics.myHand.type).toBe(cycleStart.mechanics.myHand.type);

  const eventFor = (s: Live<Rps>, kind: Outcome) => kind === "win" ? s.mechanics.lastWin : kind === "tie" ? s.mechanics.lastTie : s.mechanics.lastDefeat;
  const countFor = (s: Live<Rps>, kind: Outcome) => kind === "win" ? s.mechanics.wins : kind === "tie" ? s.mechanics.ties : s.mechanics.defeats;

  async function meet(kind: Outcome) {
    // Select the lowest live hand in a lane: it is the one the rising player
    // encounters first. The 4-by-3 cycle makes any lane/gesture pair reachable.
    let start = await j.read();
    await expect.poll(async () => {
      start = await j.read();
      expect(start.phase).toBe("inGame");
      return start.mechanics.hands.some(h => !h.isDestroyed);
    }, { timeout: 8000, intervals: [35] }).toBe(true);
    const fronts = start.mechanics.lanes.flatMap((_, laneIndex) => {
      const front = start.mechanics.hands.filter(h => h.laneIndex === laneIndex && !h.isDestroyed).sort((a, b) => b.y - a.y)[0];
      if (!front) return [];
      const desiredType = (front.type + (kind === "win" ? 1 : kind === "defeat" ? 2 : 0)) % 3;
      let taps = 0;
      while ((start.mechanics.myHand.laneIndex + taps) % 4 !== laneIndex || (start.mechanics.myHand.type + taps) % 3 !== desiredType) taps++;
      // If this pair already matches but the hand has passed below us, a full
      // physical cycle brings the player back to the bottom to meet it again.
      if (taps === 0 && front.y > start.mechanics.myHand.targetY + 4) taps = 12;
      // Prefer a quick encounter, accounting for both actual taps and descent
      // above the original minimum player height. No difficulty is changed.
      const ascent = Math.max(0, 97 - Math.max(5, front.y)) / Math.sqrt(start.difficulty);
      const descent = Math.max(0, 5 - front.y) / Math.max(0.01, front.baseMy);
      return [{ front, taps, desiredType, cost: taps * 6 + Math.max(ascent, descent) }];
    }).sort((a, b) => a.cost - b.cost);
    const target = fronts[0];
    expect(target).toBeDefined();
    const previousCount = countFor(start, kind);
    const previousFrame = eventFor(start, kind)?.frame ?? -1;
    for (let i = 0; i < target.taps; i++) await acceptedTap();
    const aligned = await j.read();
    expect(aligned.mechanics.myHand.laneIndex).toBe(target.front.laneIndex);
    expect(aligned.mechanics.myHand.type).toBe(target.desiredType);

    let reached = aligned;
    await expect.poll(async () => {
      reached = await j.read();
      expect(reached.phase).toBe("inGame");
      const encounter = eventFor(reached, kind);
      return countFor(reached, kind) > previousCount && !!encounter && encounter.frame > previousFrame;
    }, { timeout: 15000, intervals: [25] }).toBe(true);
    const encounter = eventFor(reached, kind)!;
    expect(encounter.kind).toBe(kind);
    expect(encounter.laneIndex).toBe(target.front.laneIndex);
    expect((encounter.playerType - encounter.enemyType + 3) % 3).toBe(kind === "win" ? 1 : kind === "defeat" ? 2 : 0);
    return { state: reached, encounter };
  }

  const firstWin = await meet("win");
  expect(firstWin.encounter.award).toBe(firstWin.encounter.multiplierBefore);
  expect(firstWin.encounter.award).toBeGreaterThan(0);
  expect(firstWin.state.score).toBe(firstWin.encounter.scoreBefore + firstWin.encounter.award);
  expect(firstWin.state.mechanics.multiplier).toBe(firstWin.encounter.multiplierBefore + 1);

  const tie = await meet("tie");
  expect(tie.encounter.award).toBe(0);
  expect(tie.encounter.multiplierBefore).toBeGreaterThan(1);
  expect(tie.state.mechanics.multiplier).toBe(tie.encounter.multiplierBefore);
  expect(tie.state.mechanics.multiplier).toBe(firstWin.state.mechanics.multiplier);
  expect(tie.state.mechanics.defeats).toBe(firstWin.state.mechanics.defeats);
  expect(tie.state.score).toBe(tie.encounter.scoreBefore);
  expect(tie.state.mechanics.hands.some(h => h.laneIndex === tie.encounter.laneIndex && !h.isDestroyed && h.my < 0)).toBe(true);

  // Spend the retained multiplier in another real win, proving it affects earned
  // score rather than only trusting the observer's multiplier display.
  const nextWin = await meet("win");
  expect(nextWin.encounter.award).toBe(tie.state.mechanics.multiplier);
  expect(nextWin.encounter.award).toBeGreaterThan(1);
  expect(nextWin.state.score).toBe(nextWin.encounter.scoreBefore + nextWin.encounter.award);
  expect(nextWin.state.mechanics.multiplier).toBe(nextWin.encounter.award + 1);
  await page.screenshot({ path: info.outputPath("rps-earned-multiplier-and-tie.png"), fullPage: true });

  const defeat = await meet("defeat");
  expect(defeat.encounter.award).toBe(0);
  expect(defeat.encounter.multiplierBefore).toBeGreaterThan(1);
  expect(defeat.state.mechanics.multiplier).toBe(1);
  expect(defeat.state.score).toBe(defeat.encounter.scoreBefore);
  expect(defeat.state.mechanics.myHand.freezeTicks).toBeGreaterThan(0);
  const frozen = defeat.state.mechanics;
  for (let i = 0; i < 2; i++) {
    await j.tap();
    await page.waitForTimeout(35);
  }
  const blocked = await j.read();
  expect(blocked.phase).toBe("inGame");
  expect(blocked.mechanics.blockedInputs).toBeGreaterThanOrEqual(frozen.blockedInputs + 2);
  expect(blocked.mechanics.acceptedInputs).toBe(frozen.acceptedInputs);
  expect(blocked.mechanics.myHand.laneIndex).toBe(frozen.myHand.laneIndex);
  expect(blocked.mechanics.myHand.type).toBe(frozen.myHand.type);
  await page.screenshot({ path: info.outputPath("rps-defeat-rejects-frozen-taps.png"), fullPage: true });

  // Leaving the other lanes unattended lets an actual descending hand cross the
  // original y > 99 loss boundary; no state injection or synthetic end event.
  await j.hold(false);
  await expect.poll(async () => (await j.read()).phase, { timeout: 45000, intervals: [40] }).toBe("gameOver");
  const lost = await j.read();
  expect(lost.mechanics.bottomLosses).toBeGreaterThan(0);
  expect(lost.score).toBeGreaterThanOrEqual(nextWin.state.score);
  await j.finish(lost);
});
