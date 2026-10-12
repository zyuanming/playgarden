// SPDX-License-Identifier: GPL-3.0-only
// Prepared from static source inspection only. This file has NOT been run.
// One targeted invocation runs this same real-input journey on desktop/mobile.
import { expect, test, type CDPSession, type Frame, type Page, type TestInfo } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { captureErrors } from './helpers';

type Point = { x: number; y: number; ghost: boolean };
type Game = { level: number; ready: boolean; moving: boolean; cleared: boolean;
  turnsLeft: number; undoDepth: number; width: number; height: number;
  bottom: number[]; top: number[]; player: Point };
type Snapshot = { scene: 't' | 'c' | 'ls' | 'g' | 'e'; initialized: boolean;
  frames: number; paused: boolean; saved: boolean; progress: boolean[];
  title: { phase: number; ready: boolean }; menu: { selected: number; ready: boolean };
  game: Game | null; audio: { state: string; hostMuted: boolean; enabled: boolean; activeSamples: number; effectiveGain: number } };
type Checkpoint = { x: number; y: number; turnsLeft: number; coins: number; bottom: number[]; rocks: number[] };
type Trace = { level: number; status: string; inputs: string; width: number; height: number;
  initial: Checkpoint; checkpoints: Checkpoint[]; packedOriginalMap: string };
const fixture = JSON.parse(readFileSync(new URL('./fixtures/ghosted-input-traces.json', import.meta.url), 'utf8')) as {
  status: string; upstreamCommit: string; levels: Trace[];
};
const FRAME = 'iframe[title="Ghosted 原版游戏"]';
const STORAGE = 'playgarden.ghosted.original-progress.v1';
const INPUT = { R: 'ArrowRight', U: 'ArrowUp', L: 'ArrowLeft', D: 'ArrowDown' } as const;
type Key = 'ArrowRight' | 'ArrowUp' | 'ArrowLeft' | 'ArrowDown' | 'Enter' | 'Escape' | 'KeyR' | 'KeyZ';
const physicalKey = (key: Key) => key === 'KeyR' ? 'r' : key === 'KeyZ' ? 'z' : key;

async function frame(page: Page): Promise<Frame | null> {
  const element = await page.locator(FRAME).elementHandle();
  return element ? element.contentFrame() : null;
}
async function read(page: Page): Promise<Snapshot | null> {
  try {
    const current = await frame(page);
    return current ? await current.evaluate(() => {
      const getter = (window as unknown as { __ghostedSnapshot?: () => Snapshot }).__ghostedSnapshot;
      return getter ? getter() : null;
    }) : null;
  } catch (error) {
    // Native stage changes replace the iframe through the ordinary host callback.
    // Only these expected transient reads are retried; other errors still fail.
    if (/detached|destroyed|Cannot find context|Execution context/.test(String(error))) return null;
    throw error;
  }
}
async function observed(page: Page): Promise<Snapshot> {
  await expect.poll(async () => (await read(page)) !== null, { timeout: 10000, intervals: [30] }).toBe(true);
  const state = await read(page);
  if (!state) throw new Error('Ghosted observer disappeared after readiness');
  return state;
}
async function platformCredits(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const progress = JSON.parse(localStorage.getItem('playgarden.progress.v2') ?? '{}');
    return progress.completed?.ghosted ?? [];
  });
}
async function expectPlatformCredits(page: Page, count: number) {
  await expect.poll(() => platformCredits(page), { timeout: 5000, intervals: [30] })
    .toEqual(Array.from({ length: count }, (_, i) => i));
}
async function waitFrames(page: Page, count: number) {
  const start = (await observed(page)).frames;
  await expect.poll(async () => (await read(page))?.frames ?? start,
    { timeout: 10000, intervals: [30, 50] }).toBeGreaterThanOrEqual(start + count);
}
function material(game: Game | null): Checkpoint | null {
  if (!game) return null;
  return { x: game.player.x, y: game.player.y, turnsLeft: game.turnsLeft,
    coins: game.bottom.filter(value => (value & 31) === 7).length,
    bottom: game.bottom.map(value => value & 31),
    rocks: game.top.flatMap((value, index) => (value & 31) === 3 ? [index] : []) };
}
async function expectBoard(page: Page, level: number, expected: Checkpoint, label: string) {
  await expect.poll(async () => {
    const s = await read(page);
    if (!s || s.scene !== 'g' || s.game?.level !== level || (!s.game.ready && !s.game.cleared)) return null;
    return material(s.game);
  }, { message: label, timeout: 10000, intervals: [20, 30, 50] }).toEqual(expected);
  const game = (await observed(page)).game!;
  expect(game.player.ghost).toBe(expected.turnsLeft <= 0);
}

async function driver(page: Page, mobile: boolean) {
  const cdp: CDPSession | null = mobile ? await page.context().newCDPSession(page) : null;
  let held: Key | null = null;
  async function down(key: Key) {
    if (held) throw new Error(`Input ${held} was not released before ${key}`);
    if (cdp) {
      const control = page.locator(`.ghosted-host [data-ghosted-key="${key}"]`);
      await expect(control).toBeVisible();
      await control.scrollIntoViewIfNeeded();
      const b = await control.boundingBox();
      if (!b) throw new Error(`Missing touch control ${key}`);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2, id: 1 }] });
    } else {
      // A real pointer click focuses the iframe; keyboard events then originate
      // inside the game's browsing context, using the original keyboard handler.
      await page.locator(FRAME).click({ position: { x: 12, y: 12 } });
      await page.keyboard.down(physicalKey(key));
    }
    held = key;
  }
  async function up(cancel = false) {
    if (!held) return;
    if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
    else await page.keyboard.up(physicalKey(held));
    held = null;
  }
  async function pulse(key: Key) {
    await down(key);
    // 50ms crosses normal rendering ticks but is shorter than the original
    // sixteen-frame move. No clocks, timers, random numbers or state are patched.
    await page.waitForTimeout(50);
    await up();
  }
  return { down, up, pulse, dispose: async () => { await up(); await cdp?.detach(); } };
}

async function openCatalogGame(page: Page, navigate = true, requireObserver = true) {
  if (navigate) await page.goto('/');
  await page.getByRole('textbox', { name: '搜索游戏' }).fill('Ghosted');
  const card = page.locator('.game-card').filter({ hasText: /Ghosted/i });
  await expect(card).toHaveCount(1);
  await card.getByRole('button', { name: /^开始玩/, exact: false }).first().click();
  await expect(page.locator('.game-main')).toHaveAttribute('data-game', 'ghosted');
  await expect(page.locator(FRAME)).toBeVisible();
  if (requireObserver) await observed(page);
}
// Authorized environment fault simulation only. It never writes a completed
// flag, changes engine state/time, or makes unavailable storage succeed.
function denyNativeProgressWrites(key: string) {
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function(name: string, value: string) {
    if (name === key) throw new DOMException('Simulated native progress quota failure', 'QuotaExceededError');
    return original.call(this, name, value);
  };
}
async function reachNativeMenu(page: Page, input: Awaited<ReturnType<typeof driver>>, info?: TestInfo, audioEvidence?: unknown[]) {
  if (audioEvidence && await page.getByRole('button', { name: '开启声音', exact: true }).count()) {
    await page.getByRole('button', { name: '开启声音', exact: true }).click();
  }
  let state = await observed(page);
  if (!state.initialized) await input.pulse('Enter');
  await expect.poll(async () => (await read(page))?.initialized, { timeout: 10000 }).toBe(true);
  state = await observed(page);
  expect(state.scene).toBe('t');
  if (audioEvidence) {
    // The original intro music is scheduled when native title phase 2 starts.
    // This observes live oscillator ownership, not audible device output.
    await expect.poll(async () => {
      const s = await read(page); return Boolean(s?.scene === 't' && s.title.phase === 2 && s.audio.activeSamples > 0);
    }, { timeout: 12000, intervals: [20] }).toBe(true);
    const sounding = (await observed(page)).audio;
    expect(sounding.hostMuted).toBe(false); expect(sounding.effectiveGain).toBe(1);
    expect(['running', 'suspended']).toContain(sounding.state);
    audioEvidence.push({ moment: 'original intro scheduled', observation: sounding, audibility: 'not measured; browser may suspend audio output' });
    await page.getByRole('button', { name: '静音', exact: true }).click();
    await expect.poll(async () => {
      const audio = (await read(page))?.audio;
      return audio ? { muted: audio.hostMuted, gain: audio.effectiveGain, activeSamples: audio.activeSamples } : null;
    }, { intervals: [20] }).toEqual({ muted: true, gain: 0, activeSamples: 0 });
    audioEvidence.push({ moment: 'host mute stops scheduled samples', observation: (await observed(page)).audio });
    await page.getByRole('button', { name: '开启声音', exact: true }).click();
    await expect.poll(async () => {
      const audio = (await read(page))?.audio;
      return audio ? { muted: audio.hostMuted, gain: audio.effectiveGain } : null;
    }, { intervals: [20] }).toEqual({ muted: false, gain: 1 });
  }
  await expect.poll(async () => {
    const s = await read(page); return Boolean(s?.scene === 't' && s.title.ready && s.title.phase >= 2);
  }, { timeout: 12000, intervals: [50] }).toBe(true);
  if (info) await page.screenshot({ path: info.outputPath('ghosted-original-title.png'), fullPage: true });
  if ((await observed(page)).title.phase === 2) await input.pulse('Enter');
  await expect.poll(async () => (await read(page))?.title.phase).toBe(3);
  await input.pulse('Enter');
  await expect.poll(async () => (await read(page))?.scene, { timeout: 4000, intervals: [20] }).toBe('c');
  // The original guide slides in for thirty engine frames. Observe their
  // passage; do not alter time or skip the guide through a setter.
  await waitFrames(page, 32);
  if (info) await page.screenshot({ path: info.outputPath('ghosted-original-controls.png'), fullPage: true });
  await input.pulse('Enter');
  await expect.poll(async () => {
    const s = await read(page); return Boolean(s?.scene === 'ls' && s.menu.ready);
  }, { timeout: 5000, intervals: [30] }).toBe(true);
  if (info) await page.screenshot({ path: info.outputPath('ghosted-original-twelve-level-menu.png'), fullPage: true });
}
async function selectNativeLevel(page: Page, input: Awaited<ReturnType<typeof driver>>, level: number) {
  expect(level).toBeGreaterThanOrEqual(1); expect(level).toBeLessThanOrEqual(12);
  await expect.poll(async () => {
    const s = await read(page); return Boolean(s?.scene === 'ls' && s.menu.ready);
  }, { timeout: 6000, intervals: [30] }).toBe(true);
  const current = (await observed(page)).menu.selected;
  const col = (current - 1) % 4, row = Math.floor((current - 1) / 4);
  const targetCol = (level - 1) % 4, targetRow = Math.floor((level - 1) / 4);
  for (let n = 0; n < (targetCol - col + 4) % 4; n++) await input.pulse('ArrowRight');
  for (let n = 0; n < (targetRow - row + 3) % 3; n++) await input.pulse('ArrowDown');
  await expect.poll(async () => (await read(page))?.menu.selected).toBe(level);
  await input.pulse('Enter');
  await expectBoard(page, level, fixture.levels[level - 1].initial, `Original level ${level} starts at its own board`);
}

// Gameplay is earned through physical keyboard/pointer/touch input. The only
// non-input interventions are explicitly authorized environment failures:
// one blocked bridge request and native-key storage writes throwing an error.
// No completed flags, board, clock, forced win or scene setter is injected.
// The host selector is used for a locked-finale negative check, not completion.
test('Ghosted: native title/menu, all twelve earned prerequisites, real nightmare ending and lifecycle', async ({ page }, info) => {
  test.setTimeout(600000);
  expect(fixture.upstreamCommit).toBe('846454c3b2f7509515cbcbf8852b09f7b7d98b24');
  expect(fixture.levels.map(trace => trace.level)).toEqual(Array.from({ length: 13 }, (_, i) => i + 1));
  for (const trace of fixture.levels) {
    expect(trace.status).toBe('planned-not-runtime-verified');
    expect(trace.inputs).toMatch(/^[RULD]+$/);
    expect(trace.checkpoints).toHaveLength(trace.inputs.length);
    expect(trace.checkpoints.at(-1)!.coins).toBe(0);
  }
  const mobile = info.project.name === 'mobile';
  const errors = captureErrors(page), outside: string[] = [], earned: unknown[] = [], audioEvidence: unknown[] = [], startupEvidence: unknown[] = [];
  const origin = new URL(info.project.use.baseURL ?? 'http://127.0.0.1:4173').origin;
  page.on('request', request => {
    const url = request.url();
    if (/^https?:/.test(url) && new URL(url).origin !== origin) outside.push(url);
  });
  const input = await driver(page, mobile);
  try {
    // Narrow card-copy verification requested for the shared caption correction.
    // These existing games are searched only; no old game is launched or replayed.
    await page.goto('/');
    for (const [index, [title, caption]] of [
      ['小黑屋远行', '完整战役 · 自动存档'],
      ['格境求生', '完整战役 · 黎明存档'],
      ['SQL迷案', '完整案件 · 两阶段推理'],
      ['信任的进化', '完整互动旅程 · 自由沙盒'],
    ].entries()) {
      await page.getByRole('textbox', {name: '搜索游戏'}).fill(title);
      const card = page.locator('.game-card').filter({has: page.getByRole('heading', {name: title, exact: true})});
      await expect(card).toHaveCount(1);
      await expect(card.locator('small')).toHaveText(caption);
      await card.scrollIntoViewIfNeeded();
      await page.screenshot({path: info.outputPath(`campaign-card-caption-${index + 1}.png`), fullPage: false});
      await expect(page.locator('.game-main')).toHaveCount(0);
    }
    // A missing module must produce a bounded visible error, then recover using
    // the normal retry button after the resource becomes available again.
    const blockedBridge = '**/games/ghosted/js/bridge.js';
    await page.route(blockedBridge, route => route.abort('failed'));
    await openCatalogGame(page, false, false);
    await expect(page.locator('.ghosted-start-error [role="alert"]')).toContainText('游戏资源未能启动', { timeout: 15000 });
    await page.screenshot({ path: info.outputPath('ghosted-bounded-load-failure.png'), fullPage: true });
    for (const error of errors) expect(error).toMatch(/Failed to fetch|Failed to load module|Failed to load resource|Importing a module script failed|dynamically imported module/);
    startupEvidence.push({ failure: 'one blocked local bridge request', expectedBrowserErrors: errors.splice(0) });
    await page.unroute(blockedBridge);
    await page.getByRole('button', { name: '重试载入 Ghosted', exact: true }).click();
    await observed(page);
    await expect(page.locator('.ghosted-start-error')).toHaveCount(0);
    expect((await observed(page)).progress).toEqual(Array(13).fill(false));
    await expectPlatformCredits(page, 0);
    await reachNativeMenu(page, input, info, audioEvidence);
    // Selecting the locked finale in the ordinary host UI must preserve the
    // original title/menu and zero progress, without entering nightmare early.
    await page.getByLabel('选择关卡', { exact: true }).selectOption('12');
    await expect(page.locator('.game-main')).toHaveAttribute('data-level', '12');
    await expect(page.locator('.ghosted-unlock')).toBeVisible();
    expect((await observed(page)).progress).toEqual(Array(13).fill(false));
    await reachNativeMenu(page, input);
    const locked = await observed(page);
    expect(locked.scene).toBe('ls');
    expect(locked.menu.selected).toBeGreaterThanOrEqual(1);
    expect(locked.menu.selected).toBeLessThanOrEqual(12);
    expect(locked.game?.level).not.toBe(13);
    expect(locked.progress).toEqual(Array(13).fill(false));
    await expectPlatformCredits(page, 0);
    await page.screenshot({ path: info.outputPath('ghosted-locked-nightmare-original-menu.png'), fullPage: true });
    await selectNativeLevel(page, input, 1);
    const first = fixture.levels[0];
    await page.screenshot({ path: info.outputPath('ghosted-level-01-original-board.png'), fullPage: true });

    // A real attempted move into the original west boundary is rejected without
    // consuming a turn or changing the board. Retry then uses the native R action.
    await input.pulse('ArrowLeft');
    await waitFrames(page, 3);
    await expectBoard(page, 1, first.initial, 'Wall collision is rejected without invented progress');

    // Genuine move, native undo, and native restart before the earned campaign.
    await input.pulse(INPUT[first.inputs[0] as keyof typeof INPUT]);
    await expectBoard(page, 1, first.checkpoints[0], 'First move');
    const afterMoveDepth = (await observed(page)).game!.undoDepth;
    expect(afterMoveDepth).toBeGreaterThan(1);
    await input.pulse('KeyZ');
    await expectBoard(page, 1, first.initial, 'Undo restores the actual prior board');
    expect((await observed(page)).game!.undoDepth).toBe(afterMoveDepth - 1);
    await input.pulse(INPUT[first.inputs[0] as keyof typeof INPUT]);
    await expectBoard(page, 1, first.checkpoints[0], 'Move before native restart');
    await input.pulse('KeyR');
    await expectBoard(page, 1, first.initial, 'Restart restores original board and thirteen turns');

    if (!mobile) {
      // Ordinary browser key events with a non-US character/code mapping.
      // These reach the original e.key actions; no game state is written.
      const layout = await page.context().newCDPSession(page);
      try {
        for (const [key, code] of [['z', 'KeyY'], ['r', 'KeyP']]) {
          await input.pulse(INPUT[first.inputs[0] as keyof typeof INPUT]);
          await expectBoard(page, 1, first.checkpoints[0], 'Move before alternate-layout action');
          await page.locator(FRAME).click({position: {x: 12, y: 12}});
          await layout.send('Input.dispatchKeyEvent', {type: 'keyDown', key, code, text: key});
          await page.waitForTimeout(50);
          await layout.send('Input.dispatchKeyEvent', {type: 'keyUp', key, code});
          await expectBoard(page, 1, first.initial, `Original ${key} character action on ${code}`);
        }
      } finally { await layout.detach(); }
    }

    await input.pulse(INPUT[first.inputs[0] as keyof typeof INPUT]);
    await expectBoard(page, 1, first.checkpoints[0], 'Move before host undo');
    await page.locator('.game-toolbar').getByRole('button', { name: '撤销', exact: true }).click();
    await expectBoard(page, 1, first.initial, 'Host undo reaches the original undo action');

    // Native pause is a real original menu; host pause must halt engine frames.
    await input.pulse('Escape');
    await expect.poll(async () => (await read(page))?.game?.ready).toBe(false);
    const nativePausedBoard = material((await observed(page)).game);
    await input.pulse('ArrowRight');
    await waitFrames(page, 22);
    expect(material((await observed(page)).game)).toEqual(nativePausedBoard);
    await page.screenshot({ path: info.outputPath('ghosted-original-pause-menu.png'), fullPage: true });
    await input.pulse('Escape');
    await expectBoard(page, 1, first.initial, 'Native pause resumes');
    await page.locator('.game-toolbar').getByRole('button', { name: '暂停', exact: true }).click();
    await expect.poll(async () => (await read(page))?.paused).toBe(true);
    const stopped = await observed(page);
    await page.waitForTimeout(450);
    const frozen = await observed(page);
    expect(frozen.frames).toBe(stopped.frames);
    expect(material(frozen.game)).toEqual(material(stopped.game));
    await page.getByRole('button', { name: '继续游戏', exact: true }).click();
    await expect.poll(async () => (await read(page))?.paused).toBe(false);
    await expectBoard(page, 1, first.initial, 'Host pause resumes without catch-up');

    if (mobile) {
      await input.down(INPUT[first.inputs[0] as keyof typeof INPUT]);
      await expect.poll(async () => (await read(page))?.game?.moving, { intervals: [10] }).toBe(true);
      await input.up(true);
      await expectBoard(page, 1, first.checkpoints[0], 'A cancelled touch finishes only the already accepted move');
      await waitFrames(page, 35);
      expect(material((await observed(page)).game)).toEqual(first.checkpoints[0]);
      await input.pulse('KeyR');
      await expectBoard(page, 1, first.initial, 'Fresh move after touch cancellation is accepted');
      await page.setViewportSize({ width: 320, height: 760 });
      await page.screenshot({ path: info.outputPath('ghosted-320px-touch-controls.png'), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await (await frame(page))!.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.setViewportSize({ width: 390, height: 844 });
    }

    await input.pulse(INPUT[first.inputs[0] as keyof typeof INPUT]);
    await expectBoard(page, 1, first.checkpoints[0], 'Move before host restart');
    const restarting = await frame(page);
    await page.locator('.game-toolbar').getByRole('button', { name: '重来', exact: true }).click();
    await expectBoard(page, 1, first.initial, 'Host restart remounts the same original level');
    expect(restarting?.isDetached()).toBe(true);
    expect((await observed(page)).progress).toEqual(Array(13).fill(false));

    // Exit during an actual in-progress move. The old iframe must be detached;
    // any late frame or key must not change the saved completion flags.
    await input.down(INPUT[first.inputs[0] as keyof typeof INPUT]);
    await expect.poll(async () => (await read(page))?.game?.moving, { intervals: [10] }).toBe(true);
    const departing = await frame(page);
    const storedBeforeExit = await page.evaluate(key => localStorage.getItem(key), STORAGE);
    await page.getByRole('button', { name: '返回游戏大厅', exact: true }).click();
    await input.up();
    await expect(page.locator(FRAME)).toHaveCount(0);
    expect(departing?.isDetached()).toBe(true);
    await page.waitForTimeout(400);
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE)).toBe(storedBeforeExit);
    expect(page.frames().some(f => /\/games\/ghosted\//.test(f.url()))).toBe(false);
    await openCatalogGame(page);
    await reachNativeMenu(page, input);

    for (const trace of fixture.levels) {
      if (trace.level <= 12) await selectNativeLevel(page, input, trace.level);
      else {
        // Never select/deep-link/set stage 13. The original game must enter it
        // itself after the twelfth distinct prerequisite was genuinely cleared.
        await expect.poll(async () => {
          const s = await read(page); return s?.scene === 'g' ? s.game?.level : null;
        }, { timeout: 10000, intervals: [30] }).toBe(13);
        const unlocked = await observed(page);
        expect(unlocked.progress.slice(0, 12)).toEqual(Array(12).fill(true));
        expect(unlocked.progress[12]).toBe(false);
        await expectBoard(page, 13, trace.initial, 'Nightmare begins in the original ghost state');
        await page.screenshot({ path: info.outputPath('ghosted-earned-nightmare-entry.png'), fullPage: true });
      }
      let before = await observed(page);
      expect(before.game!.width).toBe(trace.width); expect(before.game!.height).toBe(trace.height);
      expect(before.progress.slice(0, trace.level - 1)).toEqual(Array(trace.level - 1).fill(true));
      expect(before.progress.slice(trace.level - 1)).toEqual(Array(14 - trace.level).fill(false));
      await expectPlatformCredits(page, trace.level - 1);

      if (trace.level === 2) {
        // Original persistence saves earned clears, not a fabricated mid-board
        // continuation. Reload after moving, then verify the board honestly resets.
        await input.pulse(INPUT[trace.inputs[0] as keyof typeof INPUT]);
        await expectBoard(page, 2, trace.checkpoints[0], 'Real second-stage move before reload');
        const saved = await page.evaluate(key => localStorage.getItem(key), STORAGE);
        expect(saved).toBe('1000000000000');
        await page.reload();
        await openCatalogGame(page, false);
        expect((await observed(page)).progress).toEqual([true, ...Array(12).fill(false)]);
        await reachNativeMenu(page, input);
        await selectNativeLevel(page, input, 2);
        await expectBoard(page, 2, trace.initial, 'Reload preserves level-one clear and restarts level-two board');
        // Preserve the ordinary successful stage-one save/reload check above.
        // From now on only this game's native setItem fails, including in every
        // newly mounted iframe. Later wins still come entirely from real input.
        await page.addInitScript(denyNativeProgressWrites, STORAGE);
        await (await frame(page))!.evaluate(denyNativeProgressWrites, STORAGE);
        await input.pulse('Escape');
        await expect.poll(async () => (await read(page))?.game?.ready).toBe(false);
        for (let n = 0; n < 3; n++) await input.pulse('ArrowDown');
        await input.pulse('Enter');
        await expect.poll(async () => (await read(page))?.audio.enabled).toBe(false);
        await input.pulse('Escape');
        await expectBoard(page, 2, trace.initial, 'Native AUDIO OFF is selected through the original pause menu');
        before = await observed(page);
      }
      if (trace.level >= 3) {
        expect(before.audio.enabled).toBe(false);
        expect(before.saved).toBe(false);
        expect(await page.evaluate(key => localStorage.getItem(key), STORAGE)).toBe('1000000000000');
      }
      if (trace.level === 3) {
        // Explicit host restart must retain the same actual session too, while
        // resetting only this unfinished board. No flag was written to disk.
        await input.pulse(INPUT[trace.inputs[0] as keyof typeof INPUT]);
        await expectBoard(page, 3, trace.checkpoints[0], 'Move before restart with storage unavailable');
        const oldFrame = await frame(page);
        await page.locator('.game-toolbar').getByRole('button', {name: '重来', exact: true}).click();
        await expectBoard(page, 3, trace.initial, 'Host restart resets board but preserves actual earned memory');
        expect(oldFrame?.isDetached()).toBe(true);
        const restarted = await observed(page);
        expect(restarted.progress).toEqual([true, true, ...Array(11).fill(false)]);
        expect(restarted.audio.enabled).toBe(false); expect(restarted.saved).toBe(false);
        await expectPlatformCredits(page, 2);
        before = restarted;
      }

      for (const [index, symbol] of [...trace.inputs].entries()) {
        await input.pulse(INPUT[symbol as keyof typeof INPUT]);
        await expectBoard(page, trace.level, trace.checkpoints[index], `Level ${trace.level}, input ${index + 1}/${trace.inputs.length} (${symbol})`);
        const state = await observed(page);
        if (index < trace.inputs.length - 1) expect(state.progress[trace.level - 1]).toBe(false);
      }
      const cleared = await observed(page);
      expect(cleared.game!.cleared).toBe(true);
      expect(cleared.game!.bottom.some(value => (value & 31) === 7)).toBe(false);
      expect(cleared.progress[trace.level - 1]).toBe(true);
      if (trace.level >= 2) {
        expect(cleared.saved).toBe(false); expect(cleared.audio.enabled).toBe(false);
        expect(await page.evaluate(key => localStorage.getItem(key), STORAGE)).toBe('1000000000000');
        await expect(page.locator('.ghosted-host [role="alert"]')).toContainText('未能保存');
      }
      // Platform credit must match this exact original stage across remounts.
      // The final badge is intentionally withheld until the real ending scene.
      await expectPlatformCredits(page, Math.min(trace.level, 12));
      earned.push({ level: trace.level, inputs: trace.inputs, before: material(before.game), after: material(cleared.game), progress: cleared.progress });
      await page.screenshot({ path: info.outputPath(`ghosted-level-${String(trace.level).padStart(2, '0')}-earned-clear.png`), fullPage: true });
      if (trace.level < 12) {
        await expect.poll(async () => {
          const s = await read(page); return Boolean(s?.scene === 'ls' && s.menu.ready);
        }, { timeout: 7000, intervals: [30] }).toBe(true);
      }
    }

    await expect.poll(async () => (await read(page))?.scene, { timeout: 7000, intervals: [30] }).toBe('e');
    await waitFrames(page, 25);
    await expectPlatformCredits(page, 13);
    expect((await observed(page)).progress).toEqual(Array(13).fill(true));
    await page.screenshot({ path: info.outputPath('ghosted-original-thank-you-ending.png'), fullPage: true });
    await input.pulse('Enter');
    await expect.poll(async () => {
      const s = await read(page); return Boolean(s?.scene === 't' && s.title.ready);
    }, { timeout: 12000, intervals: [30] }).toBe(true);
    const saved = await page.evaluate(key => localStorage.getItem(key), STORAGE);
    expect(saved).toBe('1000000000000');
    expect((await observed(page)).saved).toBe(false);
    expect((await observed(page)).audio.enabled).toBe(false);
    await page.getByRole('button', { name: '返回游戏大厅', exact: true }).click();
    await expect(page.locator(FRAME)).toHaveCount(0);
    await openCatalogGame(page);
    // A real exit ends the ephemeral session. Only the genuinely persisted first
    // clear returns; unavailable storage is never pretended to have recovered.
    expect((await observed(page)).progress).toEqual([true, ...Array(12).fill(false)]);
    expect((await observed(page)).audio.enabled).toBe(true);
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE)).toBe(saved);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: '返回游戏大厅', exact: true }).click();
    await expect(page.locator(FRAME)).toHaveCount(0);
    expect(page.frames().some(f => /\/games\/ghosted\//.test(f.url()))).toBe(false);
    expect(errors).toEqual([]); expect(outside).toEqual([]);
  } finally {
    await input.dispose();
    await info.attach('ghosted-real-input-journey', { body: JSON.stringify({
      source: fixture.upstreamCommit, project: info.project.name, completedJourneys: earned, audioEvidence, startupEvidence, errors, outside,
    }, null, 2), contentType: 'application/json' });
  }
});
