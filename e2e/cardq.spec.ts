// SPDX-License-Identifier: GPL-3.0-only
import { test, expect } from "@playwright/test";
import { crispJourney } from "./crisp-helpers";

type Card = { column: number; num: number };
type Move = { frame: number; column: number; pile: number; num: number; previousNum: number;
  scoreBefore: number; scoreAfter: number; award: number; targetBefore: number; targetAfter: number;
  multiplierAfter: number; frontAfter: Card[]; cardCount: number };
type Mistake = { frame: number; column: number; piles: number[]; front: Card[];
  scoreBefore: number; scoreAfter: number; multiplierBefore: number; multiplierAfter: number;
  targetBefore: number; targetAfter: number };
type CardQ = { playerMoves: number; enemyMoves: number; mistakes: number; shuffles: number; losses: number;
  centerY: number; targetCenterY: number; multiplier: number; penaltyTicks: number;
  playerFront: Card[]; enemyFront: Card[]; playerCardCount: number; enemyCardCount: number; piles: number[];
  lastPlayer: Move | null; lastMistake: Mistake | null;
  lastEnemy: { frame: number; column: number; pilesBefore: number[]; pilesAfter: number[];
    frontBefore: Card[]; targetBefore: number; targetAfter: number } | null;
  lastShuffle: { frame: number; pilesBefore: number[]; pilesAfter: number[] } | null };
const adjacent = (a: number, b: number) => Math.abs(a - b) === 1 || Math.abs(a - b) === 12;

test("CARD Q original: real card races, queue refill, combo, wrong card, AI pressure, shuffle and lifecycle", async ({ page }, info) => {
  test.setTimeout(120000);
  const j = await crispJourney<CardQ>(page, info, "cardq", "纸牌争先");
  await j.pauseAndSound();
  const mobile = info.project.name === "mobile";
  const touch = mobile ? await page.context().newCDPSession(page) : null;
  async function tapAt(x: number) {
    await j.canvas.scrollIntoViewIfNeeded();
    const b = (await j.canvas.boundingBox())!;
    const p = { x: b.x + b.width * x / 100, y: b.y + b.height * .65 };
    if (touch) await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...p, id: 2 }] });
    else { await page.mouse.move(p.x, p.y); await page.mouse.down(); }
    await page.waitForTimeout(55);
    if (touch) await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    else await page.mouse.up();
    await page.waitForTimeout(35);
  }
  const tapColumn = (column: number) => tapAt(20.5 + column * 15);

  // Read exposed front cards and send physical input only. No state mutation,
  // time acceleration, artificial score, or synthetic win/end event.
  const start = await j.read();
  let earned = 0, maxAward = 0;
  for (let attempt = 0; attempt < 35 && (earned < 4 || maxAward < 2); attempt++) {
    const before = await j.read();
    expect(before.phase).toBe("inGame");
    const choices = before.mechanics.playerFront.filter(c => before.mechanics.piles.some(p => adjacent(c.num, p)));
    if (choices.length === 0) { await page.waitForTimeout(90); continue; }
    await tapColumn(choices[0].column);
    const after = await j.read();
    // The live opponent may take a central pile between observation and input.
    // A race lost to that move is an ordinary mistake, so choose again.
    if (after.mechanics.playerMoves === before.mechanics.playerMoves) continue;
    const event = after.mechanics.lastPlayer!;
    expect(adjacent(event.num, event.previousNum)).toBe(true);
    expect(event.award).toBeGreaterThan(0);
    expect(event.scoreAfter).toBe(event.scoreBefore + event.award);
    expect(event.cardCount).toBe(25);
    expect(event.frontAfter.map(c => c.column)).toEqual([0, 1, 2, 3, 4]);
    expect(after.mechanics.playerCardCount).toBe(25);
    expect(after.mechanics.enemyCardCount).toBe(25);
    earned++; maxAward = Math.max(maxAward, event.award);
  }
  expect(earned).toBeGreaterThanOrEqual(4);
  expect(maxAward).toBeGreaterThanOrEqual(2);
  expect((await j.read()).score).toBeGreaterThan(start.score);
  await page.screenshot({ path: info.outputPath("cardq-earned-combo.png"), fullPage: true });

  // A press outside the five columns is ignored, rather than scored or penalized.
  const outsideBefore = await j.read();
  await tapAt(2);
  const outsideAfter = await j.read();
  expect(outsideAfter.mechanics.playerMoves).toBe(outsideBefore.mechanics.playerMoves);
  expect(outsideAfter.mechanics.mistakes).toBe(outsideBefore.mechanics.mistakes);
  expect(outsideAfter.score).toBe(outsideBefore.score);

  let mistake: Mistake | null = null;
  for (let attempt = 0; attempt < 25 && !mistake; attempt++) {
    const before = await j.read();
    expect(before.phase).toBe("inGame");
    const invalid = before.mechanics.playerFront.find(c => !before.mechanics.piles.some(p => adjacent(c.num, p)));
    if (!invalid) { await page.waitForTimeout(90); continue; }
    await tapColumn(invalid.column);
    const after = await j.read();
    if (after.mechanics.mistakes > before.mechanics.mistakes) mistake = after.mechanics.lastMistake;
  }
  expect(mistake).not.toBeNull();
  const wrong = mistake!;
  const wrongCard = wrong.front.find(c => c.column === wrong.column)!;
  expect(wrong.piles.some(p => adjacent(wrongCard.num, p))).toBe(false);
  expect(wrong.scoreAfter).toBe(wrong.scoreBefore);
  expect(wrong.multiplierAfter).toBe(1);
  expect(wrong.targetAfter).toBeGreaterThanOrEqual(wrong.targetBefore + 5);
  await page.screenshot({ path: info.outputPath("cardq-wrong-card-penalty.png"), fullPage: true });

  await expect.poll(async () => (await j.read()).mechanics.enemyMoves, { timeout: 6000, intervals: [50] }).toBeGreaterThan(0);
  const enemy = (await j.read()).mechanics.lastEnemy!;
  const enemyCard = enemy.frontBefore.find(c => c.column === enemy.column)!;
  expect(enemy.pilesBefore.some(p => adjacent(enemyCard.num, p))).toBe(true);
  expect(enemy.pilesAfter).toContain(enemyCard.num);
  expect(enemy.targetAfter).toBeGreaterThanOrEqual(enemy.targetBefore + 5);

  // With no player input, the original AI eventually stalls and triggers the
  // original center-pile reshuffle. It then pushes the center to the loss edge.
  await expect.poll(async () => (await j.read()).mechanics.shuffles, { timeout: 20000, intervals: [50] }).toBeGreaterThan(0);
  const shuffled = await j.read();
  expect(shuffled.mechanics.lastShuffle!.pilesAfter).toHaveLength(2);
  for (const rank of shuffled.mechanics.lastShuffle!.pilesAfter) {
    expect(rank).toBeGreaterThanOrEqual(1); expect(rank).toBeLessThanOrEqual(13);
  }
  await expect.poll(async () => (await j.read()).phase, { timeout: 45000, intervals: [50] }).toBe("gameOver");
  const lost = await j.read();
  expect(lost.mechanics.losses).toBeGreaterThan(0);
  expect(lost.mechanics.centerY).toBeGreaterThan(94);
  await touch?.detach();
  await j.finish(lost);
});
