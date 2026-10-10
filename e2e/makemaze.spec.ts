// SPDX-License-Identifier: GPL-3.0-only
import { test, expect } from "@playwright/test";
import { crispJourney } from "./crisp-helpers";

type Point = { x: number; y: number };
type Gold = Point & { id: number; screenY: number };
type Award = Point & { award: number; scoreBefore: number; scoreAfter: number;
  multiplierBefore: number; multiplierAfter: number };
type Maze = { size: Point; offset: Point; walls: boolean[][]; golds: Gold[];
  enemies: (Point & { id: number; angle: number; angleVel: number; ticks: number; angry: boolean })[];
  wallEdits: number; goldCollected: number; angryMoves: number; brokenWalls: number;
  escapes: number; losses: number; multiplier: number; missScr: number;
  lastEdit: (Point & { before: boolean; after: boolean; onGold: boolean }) | null;
  lastGold: Award | null; lastBreak: (Point & { before: boolean; after: boolean }) | null;
  lastEscape: { award: number; scoreBefore: number; scoreAfter: number;
    multiplierAfter: number; missScrAfter: number } | null;
  lastLoss: { missed: (Point & { screenY: number })[] } | null };

test("MAKE MAZE original: real wall drawing, gold routes, angry demolition, missed-gold loss and lifecycle", async ({ page }, info) => {
  test.setTimeout(240000);
  const j = await crispJourney<Maze>(page, info, "makemaze", "迷墙导金");
  const touch = info.project.name === "mobile" ? await page.context().newCDPSession(page) : null;
  let down = false, maxAward = 0;
  const awards: Award[] = [];
  let observedGold = 0;
  async function read() {
    const s = await j.read();
    if (s.mechanics.goldCollected > observedGold && s.mechanics.lastGold) {
      const event = s.mechanics.lastGold;
      expect(event.award).toBe(event.multiplierBefore);
      expect(event.scoreAfter).toBe(event.scoreBefore + event.award);
      expect(event.multiplierAfter).toBe(event.multiplierBefore + 1);
      maxAward = Math.max(maxAward, event.award); awards.push(event);
      observedGold = s.mechanics.goldCollected;
    }
    return s;
  }
  async function release(cancel = false) {
    if (!down) return;
    if (touch) await touch.send("Input.dispatchTouchEvent", { type: cancel ? "touchCancel" : "touchEnd", touchPoints: [] });
    else await page.mouse.up();
    down = false;
    await page.waitForTimeout(35);
  }
  async function visit(x: number, y: number) {
    await j.canvas.scrollIntoViewIfNeeded();
    const s = await read(), m = s.mechanics;
    const logicalY = m.offset.y + y * 6;
    if (s.phase !== "inGame" || logicalY < 3 || logicalY > 97) return false;
    const b = (await j.canvas.boundingBox())!;
    const p = { x: b.x + b.width * (m.offset.x + x * 6) / 100,
      y: b.y + b.height * logicalY / 100 };
    if (touch) await touch.send("Input.dispatchTouchEvent", {
      type: down ? "touchMove" : "touchStart", touchPoints: [{ ...p, id: 2 }],
    });
    else {
      await page.mouse.move(p.x, p.y);
      if (!down) await page.mouse.down();
    }
    down = true;
    await page.waitForTimeout(45);
    return true;
  }
  async function setCell(x: number, y: number, value: boolean) {
    const s = await read(), m = s.mechanics;
    if (s.phase !== "inGame" || !m.walls[x] || m.walls[x][y] === value ||
        m.golds.some(g => g.x === x && g.y === y)) return;
    await visit(x, y); await release();
  }
  async function paint(cells: (Point & { value: boolean })[], stopAfterGold = false) {
    // A genuine continuous pointer stroke. Jumping across already-correct cells
    // does not dispatch an intermediate event or toggle them a second time.
    for (const c of cells) {
      const s = await read(), m = s.mechanics;
      if (s.phase !== "inGame") break;
      if (stopAfterGold && m.goldCollected >= 2 && maxAward >= 2) break;
      if (m.walls[c.x]?.[c.y] !== c.value && !m.golds.some(g => g.x === c.x && g.y === c.y)) {
        await visit(c.x, c.y);
      }
    }
    await release();
  }

  expect((await read()).mechanics.size).toEqual({ x: 16, y: 18 });
  // Let the original opening scroll settle before precise cell gestures.
  await expect.poll(async () => Math.min(...(await read()).mechanics.golds.map(g => g.screenY)),
    { timeout: 10000, intervals: [60] }).toBeLessThan(54);
  // Add and remove the same ordinary cell by two separate physical presses.
  await setCell(7, 3, false);
  await setCell(7, 3, true);
  let edit = (await read()).mechanics.lastEdit!;
  expect(edit).toMatchObject({ x: 7, before: false, after: true, onGold: false });
  // Re-read the current row; the board is allowed to scroll during the gesture.
  await setCell(7, edit.y, false);
  expect((await read()).mechanics.lastEdit).toMatchObject({ x: 7, before: true, after: false });

  // Touch cancellation / mouse release ends a real two-cell drag.
  await setCell(6, 4, false); await setCell(7, 4, false);
  const beforeDrag = (await read()).mechanics.wallEdits;
  await visit(6, 4); await visit(7, 4); await release(true);
  await expect.poll(async () => (await read()).pressed).toBe(false);
  expect((await read()).mechanics.wallEdits).toBeGreaterThanOrEqual(beforeDrag + 2);
  await j.pauseAndSound();

  // Side boundaries and an actual gold cell cannot be toggled.
  let ignored = (await read()).mechanics.wallEdits;
  await visit(0, 6); await release();
  expect((await read()).mechanics.wallEdits).toBe(ignored);
  const coin = (await read()).mechanics.golds.find(g => g.screenY > 12 && g.screenY < 90)!;
  expect(coin).toBeTruthy();
  ignored = (await read()).mechanics.wallEdits;
  const currentCoin = (await read()).mechanics.golds.find(g => g.id === coin.id)!;
  await visit(currentCoin.x, currentCoin.y); await release();
  expect((await read()).mechanics.wallEdits).toBe(ignored);

  // A complete wall across a gold-free upper row blocks the downward exit.
  // New collectors turn red and use their original timed downward demolition.
  await paint(Array.from({ length: 14 }, (_, i) => ({ x: i + 1, y: 2, value: true })));
  await expect.poll(async () => (await read()).mechanics.angryMoves, { timeout: 12000, intervals: [60] }).toBeGreaterThan(0);
  await expect.poll(async () => (await read()).mechanics.brokenWalls, { timeout: 12000, intervals: [60] }).toBeGreaterThan(0);
  expect((await read()).mechanics.lastBreak).toMatchObject({ before: true, after: false });
  await page.screenshot({ path: info.outputPath("makemaze-angry-demolition.png"), fullPage: true });

  // Build ordinary alternating shelves below the visible gold field. Each
  // shelf has an opening under a gold; gold cells themselves stay untouchable.
  // The live original collectors do all navigation, scoring and movement.
  const until = Date.now() + 65000;
  while (Date.now() < until) {
    const s = await read(), m = s.mechanics;
    if (s.phase !== "inGame" || (m.goldCollected >= 2 && maxAward >= 2)) break;
    const top = [...m.golds].sort((a, b) => a.y - b.y)[0];
    if (!top) { await page.waitForTimeout(90); continue; }
    const floors = new Map<number, number>();
    for (let y = top.y + 1; y <= 15; y += 2) {
      const target = m.golds.find(g => g.y === y - 1);
      floors.set(y, target?.x ?? (y % 4 < 2 ? 3 : 12));
    }
    const cells: (Point & { value: boolean })[] = [];
    for (let y = 2; y <= 15; y++) for (let x = 1; x <= 14; x++) {
      cells.push({ x, y, value: floors.has(y) && floors.get(y) !== x });
    }
    await paint(cells, true);
    await page.waitForTimeout(400);
  }
  const earned = await read();
  expect(earned.phase).toBe("inGame");
  expect(earned.mechanics.goldCollected).toBeGreaterThanOrEqual(2);
  expect(maxAward).toBeGreaterThanOrEqual(2);
  expect(awards.length).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath("makemaze-earned-gold.png"), fullPage: true });

  // Deliberately leave an isolated gold behind while opening the rest of the
  // maze. Physical wall edits are the only way this test causes a bad route;
  // normal scrolling and escape penalties must produce the actual loss.
  if (earned.phase === "inGame") {
    const target = [...earned.mechanics.golds].sort((a, b) => a.y - b.y).find(g =>
      g.x > 1 && g.x < 14 && g.screenY > 10 && g.screenY < 83 &&
      !earned.mechanics.golds.some(o => o.id !== g.id && Math.abs(o.x - g.x) + Math.abs(o.y - g.y) === 1));
    const cells: (Point & { value: boolean })[] = [];
    for (let y = 2; y <= 15; y++) for (let x = 1; x <= 14; x++) {
      cells.push({ x, y, value: !!target && Math.abs(target.x - x) + Math.abs(target.y - y) === 1 });
    }
    await paint(cells);
  }
  await expect.poll(async () => (await read()).phase, { timeout: 110000, intervals: [60] }).toBe("gameOver");
  const lost = await read();
  expect(lost.mechanics.losses).toBeGreaterThan(0);
  expect(lost.mechanics.lastLoss!.missed.some(g => g.screenY < 0)).toBe(true);
  expect(lost.mechanics.escapes).toBeGreaterThan(0);
  const escaped = lost.mechanics.lastEscape!;
  expect(escaped.award).toBe(-escaped.multiplierAfter);
  expect(escaped.scoreAfter).toBe(escaped.scoreBefore + escaped.award);
  expect(escaped.missScrAfter).toBeGreaterThanOrEqual(1);
  await info.attach("makemaze-real-input-proof.json", {
    body: Buffer.from(JSON.stringify({ strategy: "Alternating physical wall shelves, openings below gold, then leave isolated gold behind",
      awards, maxAward, earnedGold: earned.mechanics.goldCollected, earnedScore: earned.score,
      wallEdits: lost.mechanics.wallEdits, angryMoves: lost.mechanics.angryMoves,
      brokenWalls: lost.mechanics.brokenWalls, escapes: lost.mechanics.escapes,
      loss: lost.mechanics.lastLoss, finalScore: lost.score, best: lost.best, runs: lost.runs }, null, 2)),
    contentType: "application/json",
  });
  await touch?.detach();
  // Escapes may legitimately make the final score zero or negative. Earned
  // gold is proved above. Keep every shared replay/storage/cleanup assertion.
  await j.finish(lost, { requirePositiveScore: false });
});
