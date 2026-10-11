// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Locator } from '@playwright/test';
import { openGame, captureErrors } from './helpers';

type Live = {
  phase: 'welcome' | 'playing' | 'lost'; paused: boolean; hostPaused: boolean; localPause: string;
  score: number; best: number; multiplier: number; branch: number; frame: number; elapsed: number;
  difficultyTimer: number; level: number; effects: number[]; held: string[]; pointerCount: number;
  lines: { x: number; y: number; r: number; speed: number; dead: boolean; target: number; mergeFrames: number }[];
  keyMaps: string[][];
};

test('Avabranch original: group and independent steering, multi-touch, pause, natural loss, records and teardown', async ({ page }, info) => {
  test.setTimeout(210000);
  const mobile = info.project.name === 'mobile';
  const errors = captureErrors(page);
  const remote: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (/^https?:/.test(url.protocol) && !['127.0.0.1', 'localhost'].includes(url.hostname)) remote.push(url.href);
  });
  // Fixed seed 174 identifies this integration, without selecting a favorable
  // board. Only Math.random is seeded, in the test page; original spawn odds,
  // collision, life counts, scoring, pickups and clocks are never overwritten.
  await page.addInitScript(() => {
    if (!location.pathname.includes('/avabranch/')) return;
    let seed = 174;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  });
  const act = async (locator: Locator) => mobile ? locator.tap() : locator.click();
  const root = page.locator('[data-avabranch-game]');
  const iframe = page.locator('iframe[title="Avabranch 四线分流原作"]');
  const frame = page.frameLocator('iframe[title="Avabranch 四线分流原作"]');
  const canvas = frame.locator('#canv');
  const read = async () => JSON.parse((await frame.locator('body').getAttribute('data-avabranch-state'))!) as Live;
  const point = async (locator: Locator) => { const box = (await locator.boundingBox())!; return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; };
  await openGame(page, '四线分流');
  await expect(root).toHaveAttribute('data-avabranch-ready', 'true');
  await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveCount(0);
  expect((await read()).phase).toBe('welcome');
  await expect(frame.getByRole('button', { name: '开始挑战', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('avabranch-title.png'), fullPage: true });
  await act(frame.getByRole('button', { name: '开始挑战', exact: true }));
  await expect.poll(async () => (await read()).phase).toBe('playing');
  await canvas.scrollIntoViewIfNeeded();
  const initial = await read();
  expect(initial.lines.map(line => line.dead)).toEqual([false, false, true, true]);
  const cdp = mobile ? await page.context().newCDPSession(page) : null;

  // Actual held group input moves both original living lines together.
  const groupBefore = await read();
  if (cdp) {
    const left = await point(frame.getByRole('button', { name: '红线向左', exact: true }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...left, id: 1 }] });
    await page.waitForTimeout(150);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await canvas.focus(); await page.keyboard.down('a'); await page.waitForTimeout(150); await page.keyboard.up('a');
  }
  const groupAfter = await read();
  expect(groupAfter.lines[0].x).toBeLessThan(groupBefore.lines[0].x - 10);
  expect(groupAfter.lines[1].x).toBeLessThan(groupBefore.lines[1].x - 10);
  expect(Math.abs((groupAfter.lines[0].x - groupBefore.lines[0].x) - (groupAfter.lines[1].x - groupBefore.lines[1].x))).toBeLessThan(0.1);
  expect(groupAfter.multiplier).toBe(2);
  expect(groupAfter.score).toBeGreaterThan(groupBefore.score);
  const groupRate = (groupAfter.score - groupBefore.score) / (groupAfter.frame - groupBefore.frame);

  await act(frame.getByRole('button', { name: '分流 · 空格', exact: true }));
  await expect.poll(async () => (await read()).branch).toBe(1);
  // The original twenty-frame split/merge interpolation completes naturally.
  await expect.poll(async () => (await read()).lines[1].target).toBe(-1);
  const splitBefore = await read();
  if (cdp) {
    const red = await point(frame.getByRole('button', { name: '红线向左', exact: true }));
    const yellow = await point(frame.getByRole('button', { name: '黄线向右', exact: true }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...red, id: 1 }, { ...yellow, id: 2 }] });
    await expect.poll(async () => (await read()).pointerCount).toBe(2);
    await page.waitForTimeout(160);
    const held = await read();
    expect(held.lines[0].x).toBeLessThan(splitBefore.lines[0].x - 10);
    expect(held.lines[1].x).toBeGreaterThan(splitBefore.lines[1].x + 10);
    // Drag a held finger beyond its button; that color releases immediately.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: red.x, y: red.y - 65, id: 1 }, { ...yellow, id: 2 }] });
    await expect.poll(async () => (await read()).pointerCount).toBe(1);
    expect((await read()).held).toEqual(['F']);
    // Browser-level touch cancellation, not a synthetic DOM pointer event.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect.poll(async () => (await read()).pointerCount).toBe(0);
    expect((await read()).held).toEqual([]);
  } else {
    await canvas.focus(); await page.keyboard.down('a'); await page.keyboard.down('f'); await page.waitForTimeout(160);
    const held = await read();
    expect(held.lines[0].x).toBeLessThan(splitBefore.lines[0].x - 10);
    expect(held.lines[1].x).toBeGreaterThan(splitBefore.lines[1].x + 10);
    await page.keyboard.up('a'); await page.keyboard.up('f');
  }
  const splitAfter = await read();
  expect(splitAfter.multiplier).toBe(8);
  const splitRate = (splitAfter.score - splitBefore.score) / (splitAfter.frame - splitBefore.frame);
  // Original ceil-per-frame scoring means displayed ×4 is not exactly a fourfold
  // per-second ratio at 60 Hz. Verify the actual frame-rounded increase.
  expect(splitRate).toBeGreaterThan(groupRate * 1.4);

  // Toggle while a keyboard direction is held: old mode input cannot survive.
  await canvas.focus(); await page.keyboard.down('a'); await page.keyboard.press('Space');
  await expect.poll(async () => (await read()).branch).toBe(0);
  expect((await read()).held).toEqual([]);
  await page.keyboard.up('a');
  await expect.poll(async () => (await read()).lines.filter(line => !line.dead).every(line => line.target === -1)).toBe(true);
  await act(frame.getByRole('button', { name: '暂停 · P', exact: true }));
  await expect.poll(async () => (await read()).paused).toBe(true);
  const frozen = await read();
  await page.waitForTimeout(450);
  expect(await read()).toEqual(frozen);
  await canvas.scrollIntoViewIfNeeded();
  if (mobile) {
    // Align the actual core play area using real scrolling, rather than merely
    // finding a control somewhere in a long full-page screenshot.
    const beforeScroll = (await canvas.boundingBox())!;
    await page.mouse.move(4, 4);
    await page.mouse.wheel(0, beforeScroll.y - 8);
    await expect.poll(async () => {
      const box = (await canvas.boundingBox())!;
      return box.y >= -1 && box.y <= 16;
    }).toBe(true);
    const canvasBox = (await canvas.boundingBox())!;
    const controlsBox = (await frame.locator('.touch-controls').boundingBox())!;
    expect(canvasBox.y).toBeGreaterThanOrEqual(-1);
    expect(controlsBox.y + controlsBox.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
    for (const button of await frame.locator('[data-steer]').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: info.outputPath('avabranch-controls-viewport.png') });
  await page.screenshot({ path: info.outputPath('avabranch-controls-paused.png'), fullPage: true });
  // Local pause remains owned locally across a host pause/resume cycle. The
  // inner resume button cannot override an active host pause.
  await act(page.getByRole('button', { name: '暂停', exact: true }));
  await expect.poll(async () => (await read()).hostPaused).toBe(true);
  await expect(frame.locator('#pause')).toBeDisabled();
  await act(page.getByRole('button', { name: '继续游戏', exact: true }));
  await expect.poll(async () => (await read()).hostPaused).toBe(false);
  expect((await read()).paused).toBe(true);
  await act(frame.getByRole('button', { name: '继续挑战 · P', exact: true }));
  await expect.poll(async () => (await read()).frame).toBeGreaterThan(frozen.frame);

  // Host pause is independent of local input. It must freeze every observable
  // engine field, including timers and positions, and resume with no held keys.
  await act(page.getByRole('button', { name: '暂停', exact: true }));
  await expect.poll(async () => (await read()).hostPaused).toBe(true);
  const hostFrozen = await read();
  await page.waitForTimeout(500);
  expect(await read()).toEqual(hostFrozen);
  await act(page.getByRole('button', { name: '继续游戏', exact: true }));
  await expect.poll(async () => (await read()).paused).toBe(false);
  expect((await read()).held).toEqual([]);

  // No steering, no game-state edits: original random obstacles eventually
  // consume the remaining lives through the original collision rule.
  await expect.poll(async () => (await read()).phase, { timeout: 130000, intervals: [250, 500, 1000] }).toBe('lost');
  const lost = await read();
  expect(lost.lines.every(line => line.dead)).toBe(true);
  expect(lost.score).toBeGreaterThan(0);
  expect(lost.best).toBeGreaterThanOrEqual(lost.score);
  await expect(page.locator('.status')).not.toHaveClass(/success/);
  await expect(frame.getByRole('button', { name: '再来一局', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('avabranch-natural-loss.png'), fullPage: true });
  await act(frame.getByRole('button', { name: '再来一局', exact: true }));
  await expect.poll(async () => (await read()).phase).toBe('playing');
  expect((await read()).lines.map(line => line.dead)).toEqual([false, false, true, true]);
  expect((await read()).best).toBeGreaterThanOrEqual(lost.score);
  // Real focus transfer releases a held direction and pauses an active run.
  await canvas.focus(); await page.keyboard.down('a');
  await act(page.locator('.avabranch-heading h3'));
  await expect.poll(async () => (await read()).paused).toBe(true);
  expect((await read()).held).toEqual([]);
  await page.keyboard.up('a');
  await act(frame.getByRole('button', { name: '继续挑战 · P', exact: true }));

  // Settings pause real play, validate the complete mapping and persist via the
  // host. Nothing is injected into storage or rendered through innerHTML.
  await act(frame.locator('#settings summary'));
  await expect.poll(async () => (await read()).paused).toBe(true);
  await frame.getByLabel('红线左键', { exact: true }).fill('Q');
  await act(frame.getByRole('button', { name: '保存键位', exact: true }));
  expect((await read()).keyMaps[0][0]).toBe('Q');
  await act(page.getByRole('button', { name: '重来', exact: true }));
  await expect(root).toHaveAttribute('data-avabranch-ready', 'true');
  await expect.poll(async () => (await read()).phase).toBe('welcome');
  expect((await read()).score).toBe(0);
  expect((await read()).best).toBeGreaterThanOrEqual(lost.score);
  expect((await read()).keyMaps[0][0]).toBe('Q');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await frame.locator('body').evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await act(page.getByRole('button', { name: '返回游戏大厅', exact: true }));
  await expect(iframe).toHaveCount(0);
  expect(page.frames().filter(item => item.url().includes('/avabranch/'))).toHaveLength(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('playgarden.avabranch.v1.records') || 'null'));
  expect(saved.best).toBeGreaterThanOrEqual(lost.score);
  expect(saved.keyMaps[0][0]).toBe('Q');
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('playgarden.avabranch.v1.records') || 'null'))).toEqual(saved);
  await page.reload();
  await openGame(page, '四线分流');
  await expect(root).toHaveAttribute('data-avabranch-ready', 'true');
  expect((await read()).phase).toBe('welcome');
  expect((await read()).best).toBe(saved.best);
  expect((await read()).keyMaps[0][0]).toBe('Q');
  await page.screenshot({ path: info.outputPath('avabranch-restored-records.png'), fullPage: true });
  // Exercise a real storage failure without replacing any score or game state.
  // A previous genuine disk record remains readable while only this game's
  // writes fail. Current-page accepted key changes must survive a host restart.
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'playgarden.avabranch.v1.records') throw new DOMException('Test quota exhaustion', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.reload();
  await openGame(page, '四线分流');
  await expect(root).toHaveAttribute('data-avabranch-ready', 'true');
  await act(frame.locator('#settings summary'));
  await frame.getByLabel('红线左键', { exact: true }).fill('R');
  await act(frame.getByRole('button', { name: '保存键位', exact: true }));
  await expect.poll(async () => (await read()).keyMaps[0][0]).toBe('R');
  await act(page.getByRole('button', { name: '重来', exact: true }));
  await expect(root).toHaveAttribute('data-avabranch-ready', 'true');
  await expect.poll(async () => (await read()).keyMaps[0][0]).toBe('R');
  expect((await read()).best).toBe(saved.best);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('playgarden.avabranch.v1.records') || 'null'))).toEqual(saved);
  await page.screenshot({ path: info.outputPath('avabranch-quota-memory-restart.png'), fullPage: true });
  // Reload ends the in-memory fallback session and loads the actual old disk
  // record, rather than pretending the rejected write persisted.
  await page.reload();
  await openGame(page, '四线分流');
  await expect(root).toHaveAttribute('data-avabranch-ready', 'true');
  await expect.poll(async () => (await read()).keyMaps[0][0]).toBe('Q');
  expect((await read()).best).toBe(saved.best);
  expect(remote).toEqual([]);
  expect(errors).toEqual([]);
  await cdp?.detach();
});
