// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Locator } from "@playwright/test";
import { openGame, captureErrors } from "./helpers";

type Attached = { color: string; deleted: number; settled: number };
type Falling = { lane: number; color: string; distance: number; initializing: number; settled: number; ict: number };
type Live = {
  phase: "welcome" | "playing" | "lost";
  paused: boolean;
  score: number;
  best: number;
  highscores: number[];
  logicalTime: number;
  position: number;
  rows: number;
  platform: "mobile" | "nonmobile";
  rush: number;
  comboMultiplier: number;
  comboTime: number;
  lastCombo: number;
  wave: string;
  difficulty: number;
  nextGen: number;
  metrics: { spawned: number; placed: number; rotations: number; cleared: number; clearEvents: number; frame: number };
  stacks: Attached[][];
  falling: Falling[];
  hasSave: boolean;
  storageAvailable: boolean;
  helpOpen: boolean;
};

const SAVE_KEY = "playgarden.hextris.original.save.v1";
const RECORD_KEY = "playgarden.hextris.original.records.v1";
const FRAME = 'iframe[title="Hextris 六向彩环原作"]';
const mod6 = (n: number) => (n + 12) % 6;

// This is a player's decision aid over a local copy of the public observation.
// It never runs in the browser or writes an engine object, score, clock, or save.
function connected(board: string[][], side: number, row: number): [number, number][] {
  const color = board[side][row];
  const found: [number, number][] = [[side, row]];
  const seen = new Set([`${side}:${row}`]);
  for (let i = 0; i < found.length; i++) {
    const [s, r] = found[i];
    for (const [ns, nr] of [[mod6(s - 1), r], [mod6(s + 1), r], [s, r - 1], [s, r + 1]]) {
      const key = `${ns}:${nr}`;
      if (nr >= 0 && board[ns][nr] === color && !seen.has(key)) {
        seen.add(key);
        found.push([ns, nr]);
      }
    }
  }
  return found;
}

function choosePosition(state: Live, target: Falling, goal: "clear" | "overflow") {
  // Account for simultaneous original wave pieces, as well as the closest one.
  const imminent = state.falling.filter((piece) => !piece.settled &&
    Math.abs(piece.distance - target.distance) < 3).sort((a, b) => a.distance - b.distance);
  let bestPosition = state.position;
  let bestValue = -Infinity;
  for (let position = 0; position < 6; position++) {
    const board = state.stacks.map((lane) => lane.filter((b) => b.deleted === 0).map((b) => b.color));
    let clears = 0;
    let connections = 0;
    let highestArrival = 0;
    for (const piece of imminent) {
      const side = mod6(6 - piece.lane + position);
      const row = board[side].length;
      board[side].push(piece.color);
      highestArrival = Math.max(highestArrival, row + 1);
      const group = connected(board, side, row);
      connections += group.length;
      if (group.length >= 3) {
        clears += group.length;
        const removed = new Set(group.map(([s, r]) => `${s}:${r}`));
        for (let s = 0; s < 6; s++) board[s] = board[s].filter((_, r) => !removed.has(`${s}:${r}`));
      }
    }
    const heights = board.map((lane) => lane.length);
    const maximum = Math.max(...heights);
    const squaredHeight = heights.reduce((sum, height) => sum + height * height, 0);
    const turns = Math.min(mod6(position - state.position), mod6(state.position - position));
    const value = goal === "clear"
      ? clears * 10000 + connections * 100 - squaredHeight * 7 - (highestArrival > state.rows ? 100000 : 0) - turns
      : maximum * 1500 + squaredHeight * 25 - clears * 20000 - turns;
    if (value > bestValue) { bestValue = value; bestPosition = position; }
  }
  return bestPosition;
}

test("Hextris original: real rotations, connected clears, save/resume, natural loss, pause and teardown", async ({ page }, info) => {
  test.setTimeout(240000);
  const mobile = info.project.name === "mobile";
  const errors = captureErrors(page);
  const consoleErrors: string[] = [];
  const remote: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (/^https?:/.test(url.protocol) && !["127.0.0.1", "localhost"].includes(url.hostname)) remote.push(url.href);
  });
  // A conventional fixed LCG makes randomness repeatable. The original engine
  // still generates every piece, advances time, detects collisions and scores.
  await page.addInitScript(() => {
    if (!location.pathname.includes("/hextris-original/")) return;
    let seed = 0x48335831;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  });
  const act = async (locator: Locator) => mobile ? locator.tap() : locator.click();
  const root = page.locator("[data-hextris-game]");
  const iframe = page.locator(FRAME);
  const frame = page.frameLocator(FRAME);
  const canvas = frame.locator("#canvas");
  const read = async () => JSON.parse((await frame.locator("body").getAttribute("data-hextris-state"))!) as Live;
  const ready = async () => {
    await expect(root).toHaveAttribute("data-hextris-ready", "true");
    await expect(frame.locator("body")).toHaveAttribute("data-hextris-state", /"phase"/);
  };
  const frozenFor = async (milliseconds: number) => {
    await expect.poll(async () => (await read()).paused).toBe(true);
    const before = await read();
    await page.waitForTimeout(milliseconds);
    expect(await read()).toEqual(before);
    return before;
  };
  const resumeLocal = async () => {
    if ((await read()).paused) await act(frame.locator("#resume"));
    await expect.poll(async () => (await read()).paused).toBe(false);
    if (!mobile) await canvas.focus();
  };
  const cdp = mobile ? await page.context().newCDPSession(page) : null;
  let boosting = false;
  const boost = async (on: boolean) => {
    if (on === boosting) return;
    if (cdp) {
      if (on) {
        const control = frame.locator("#boost");
        await control.scrollIntoViewIfNeeded();
        const box = (await control.boundingBox())!;
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart", touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }],
        });
      } else await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else if (on) await page.keyboard.down("ArrowDown");
    else await page.keyboard.up("ArrowDown");
    boosting = on;
  };
  const rotate = async (direction: 1 | -1, allowLoss = false) => {
    const before = await read();
    // Respect the unchanged original desktop 75 ms rotation limiter.
    await page.waitForTimeout(85);
    if (allowLoss && (await read()).phase === "lost") return;
    if (mobile) await frame.locator(direction === 1 ? "#left" : "#right").tap();
    else await page.keyboard.press(direction === 1 ? "ArrowLeft" : "ArrowRight");
    await expect.poll(async () => {
      const state = await read();
      return state.position === mod6(before.position + direction) || (allowLoss && state.phase === "lost");
    }).toBe(true);
  };
  const turnTo = async (position: number, allowLoss = false) => {
    const before = await read();
    const left = mod6(position - before.position);
    const direction = left <= 3 ? 1 : -1;
    const count = left <= 3 ? left : 6 - left;
    for (let n = 0; n < count; n++) {
      if (allowLoss && (await read()).phase === "lost") return;
      await rotate(direction, allowLoss);
    }
  };
  const playUntil = async (goal: "clear" | "overflow", done: (state: Live) => boolean, milliseconds: number) => {
    const deadline = Date.now() + milliseconds;
    let planned = "";
    try {
      while (Date.now() < deadline) {
        const state = await read();
        if (done(state)) return state;
        expect(state.phase, `Natural play ended before ${goal} objective`).toBe("playing");
        expect(state.paused, "The player must remain active during physical controls").toBe(false);
        const target = state.falling.filter((piece) => !piece.settled).sort((a, b) => a.distance - b.distance)[0];
        if (target) {
          const identity = `${target.ict}:${target.lane}:${target.color}:${state.metrics.placed}:${state.metrics.cleared}`;
          if (identity !== planned) {
            await boost(false);
            const latest = await read();
            await turnTo(choosePosition(latest, target, goal), goal === "overflow");
            planned = identity;
          }
        }
        await boost(true);
        await page.waitForTimeout(70);
      }
      throw new Error(`Real-input ${goal} objective timed out: ${JSON.stringify(await read())}`);
    } finally { await boost(false); }
  };

  try {
    await openGame(page, "六向彩环");
    await ready();
    await expect(page.getByLabel("选择关卡", { exact: true })).toHaveCount(0);
    expect((await read()).phase).toBe("welcome");
    await page.screenshot({ path: info.outputPath("hextris-welcome.png"), fullPage: true });
    await act(frame.locator("#start"));
    await expect.poll(async () => (await read()).phase).toBe("playing");
    if (!mobile) await canvas.focus();
    await rotate(1);
    await rotate(-1);
    expect((await read()).metrics.rotations).toBeGreaterThanOrEqual(2);
    await boost(true);
    await expect.poll(async () => (await read()).rush).toBe(4);
    await page.waitForTimeout(160);
    await boost(false);
    await expect.poll(async () => (await read()).rush).toBe(1);

    // Native pause is exercised by a real key on desktop and a tap on mobile.
    if (mobile) await frame.locator("#pause").tap();
    else await page.keyboard.press("Escape");
    const nativePause = await frozenFor(500);
    await expect(frame.locator("#left")).toBeDisabled();
    if (mobile) await frame.locator("#resume").tap();
    else await page.keyboard.press("Escape");
    await expect.poll(async () => (await read()).logicalTime).toBeGreaterThan(nativePause.logicalTime);

    // A real click/tap on the focusable host heading blurs the iframe.
    await act(page.getByRole("heading", { name: "六向彩环", exact: true, level: 1 }));
    await frozenFor(500);
    expect((await read()).rush).toBe(1);
    await resumeLocal();

    await act(frame.locator("#help"));
    await expect.poll(async () => (await read()).helpOpen).toBe(true);
    await frozenFor(300);
    await act(frame.locator("#close-help"));
    await expect.poll(async () => (await read()).helpOpen).toBe(false);
    await resumeLocal();

    const cleared = await playUntil("clear", (state) => state.metrics.cleared >= 3 && state.score >= 9, 85000);
    expect(cleared.metrics.spawned).toBeGreaterThanOrEqual(3);
    expect(cleared.metrics.placed).toBeGreaterThanOrEqual(3);
    expect(cleared.metrics.clearEvents).toBeGreaterThanOrEqual(1);
    expect(cleared.metrics.rotations).toBeGreaterThan(2);
    await page.screenshot({ path: info.outputPath("hextris-real-connected-clear.png"), fullPage: true });

    await act(page.getByRole("button", { name: "暂停", exact: true }));
    const hostPause = await frozenFor(900);
    await act(page.getByRole("button", { name: "继续游戏", exact: true }));
    await resumeLocal();
    await expect.poll(async () => (await read()).logicalTime).toBeGreaterThan(hostPause.logicalTime);

    // Find a calm, nonempty board through play, then use the actual Save button.
    // The margin leaves time to tap pause after remount without a new collision.
    await playUntil("clear", (state) => state.stacks.some((lane) => lane.length > 0) &&
      state.stacks.every((lane) => lane.every((b) => b.deleted === 0 && b.settled === 1)) &&
      state.falling.every((b) => b.distance > 87 * Math.sqrt(3) / 2 + Math.max(...state.stacks.map((lane) => lane.length)) * 20 + 55), 35000);
    await act(frame.locator("#save"));
    const saved = await frozenFor(350);
    expect(saved.hasSave).toBe(true);
    expect(saved.score).toBeGreaterThan(0);
    expect(saved.stacks.flat().length).toBeGreaterThan(0);
    await page.screenshot({ path: info.outputPath("hextris-saved-board.png"), fullPage: true });
    const savedFrame = page.frames().find((candidate) => candidate.url().includes("/hextris-original/"))!;
    await act(page.getByRole("button", { name: "返回游戏大厅", exact: true }));
    await expect(iframe).toHaveCount(0);
    expect(savedFrame.isDetached()).toBe(true);
    const stored = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
    expect(stored).not.toBeNull();
    await page.waitForTimeout(350);
    expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).toBe(stored);

    await openGame(page, "六向彩环");
    await ready();
    expect((await read()).phase).toBe("welcome");
    expect((await read()).hasSave).toBe(true);
    await act(frame.locator("#resume-save"));
    await act(frame.locator("#pause"));
    const restored = await frozenFor(350);
    expect(restored.score).toBe(saved.score);
    expect(restored.stacks).toEqual(saved.stacks);
    expect(restored.position).toBe(saved.position);
    expect(restored.metrics.placed).toBe(saved.metrics.placed);
    expect(restored.metrics.cleared).toBe(saved.metrics.cleared);
    expect(restored.logicalTime).toBeGreaterThanOrEqual(saved.logicalTime);
    await page.screenshot({ path: info.outputPath("hextris-resumed-board.png"), fullPage: true });
    await resumeLocal();

    // Deliberately catch varied colors on tall sides. The original row limit,
    // collision code and ordinary passage of time must end the real round.
    const lost = await playUntil("overflow", (state) => state.phase === "lost", 65000);
    expect(lost.stacks.some((lane) => lane.filter((b) => b.deleted === 0).length > lost.rows)).toBe(true);
    expect(lost.score).toBeGreaterThanOrEqual(saved.score);
    expect(lost.highscores).toContain(lost.score);
    expect(lost.best).toBeGreaterThanOrEqual(lost.score);
    expect(lost.hasSave).toBe(false);
    await expect(frame.locator("#restart")).toBeVisible();
    await expect(page.locator(".status")).not.toHaveClass(/success/);
    await page.screenshot({ path: info.outputPath("hextris-natural-overflow.png"), fullPage: true });
    const records = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null"), RECORD_KEY);
    expect(records.version).toBe(1);
    expect(records.scores).toContain(lost.score);
    await act(frame.locator("#restart"));
    await expect.poll(async () => (await read()).phase).toBe("playing");
    expect((await read()).score).toBe(0);
    expect((await read()).metrics.cleared).toBe(0);
    expect((await read()).stacks.flat()).toEqual([]);
    expect((await read()).best).toBeGreaterThanOrEqual(lost.score);

    for (let cycle = 0; cycle < 2; cycle++) {
      const previousFrame = page.frames().find((candidate) => candidate.url().includes("/hextris-original/"))!;
      await act(page.getByRole("button", { name: "重来", exact: true }));
      await ready();
      await expect.poll(async () => (await read()).phase).toBe("welcome");
      expect(previousFrame.isDetached()).toBe(true);
      expect(page.frames().filter((candidate) => candidate.url().includes("/hextris-original/"))).toHaveLength(1);
      expect((await read()).score).toBe(0);
      expect((await read()).best).toBeGreaterThanOrEqual(lost.score);
      await act(frame.locator("#start"));
      if (!mobile) await canvas.focus();
      await rotate(1);
      expect((await read()).metrics.rotations).toBe(1);
      await expect.poll(async () => (await read()).metrics.frame).toBeGreaterThan(2);
      const activeFrame = page.frames().find((candidate) => candidate.url().includes("/hextris-original/"))!;
      await act(page.getByRole("button", { name: "返回游戏大厅", exact: true }));
      await expect(iframe).toHaveCount(0);
      expect(activeFrame.isDetached()).toBe(true);
      expect(page.frames().filter((candidate) => candidate.url().includes("/hextris-original/"))).toHaveLength(0);
      const exitedSave = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
      await page.waitForTimeout(350);
      expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).toBe(exitedSave);
      expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null"), RECORD_KEY)).toEqual(records);
      await openGame(page, "六向彩环");
      await ready();
    }

    await page.reload();
    await openGame(page, "六向彩环");
    await ready();
    expect((await read()).best).toBeGreaterThanOrEqual(lost.score);
    expect((await read()).highscores).toEqual(records.scores);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await frame.locator("body").evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath("hextris-persistent-record.png"), fullPage: true });
    expect(remote).toEqual([]);
    expect(errors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  } finally {
    await boost(false);
    await cdp?.detach();
  }
});

test("Hextris original: isolated malformed save is rejected without restoring gameplay", async ({ page }, info) => {
  const errors = captureErrors(page);
  // This separate Playwright test has a fresh browser context. Its sole storage
  // mutation is deliberately invalid JSON; no successful game state is seeded.
  await page.addInitScript((key) => {
    if (location.pathname.includes("/hextris-original/")) localStorage.setItem(key, "{invalid saved round");
  }, SAVE_KEY);
  await openGame(page, "六向彩环");
  await expect(page.locator("[data-hextris-game]")).toHaveAttribute("data-hextris-ready", "true");
  const frame = page.frameLocator(FRAME);
  const state = JSON.parse((await frame.locator("body").getAttribute("data-hextris-state"))!) as Live;
  expect(state.phase).toBe("welcome");
  expect(state.hasSave).toBe(false);
  expect(state.score).toBe(0);
  expect(state.stacks.flat()).toEqual([]);
  expect(state.falling).toEqual([]);
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).toBeNull();
  await expect(frame.locator("#resume-save")).toBeHidden();
  if (info.project.name === "mobile") await frame.locator("#start").tap();
  else await frame.locator("#start").click();
  await expect.poll(async () => JSON.parse((await frame.locator("body").getAttribute("data-hextris-state"))!).phase).toBe("playing");
  expect(errors).toEqual([]);
});
