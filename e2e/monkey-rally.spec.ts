// SPDX-License-Identifier: GPL-3.0-only
import { expect, test, type Frame, type Locator } from '@playwright/test';
import { openGame, chooseLevel, captureErrors } from './helpers';

type Reading = { scene: string; phase: string; level: number; paused: boolean; cursor: number; direction: string | null; queue: number[]; cell: { x: number; y: number }; player: { x: number; y: number; scaleX: number; scaleY: number; angle: number } | null; doors: { x: number; y: number; code: number; open: boolean }[]; slideCount: number; stopCount: number; toggleCounts: number[]; completed: number[]; introIndex: number };
const read = (frame: Frame) => frame.evaluate(() => (window as unknown as { __monkeyRead: () => Reading }).__monkeyRead());

test('original eight puzzles: physical first/middle/final routes, interruption and touch', async ({ page }, info) => {
  test.setTimeout(180000);
  const mobile = info.project.name === 'mobile', errors = captureErrors(page), outside: string[] = [];
  const origin = new URL(String(info.project.use.baseURL || 'http://127.0.0.1:4173')).origin;
  page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) outside.push(request.url()); });
  await openGame(page, '猴子救援');
  await expect(page.getByLabel('选择关卡', { exact: true }).locator('option')).toHaveCount(8);
  let frame: Frame;
  async function acquire() {
    await expect(page.locator('[data-monkey-ready]')).toHaveAttribute('data-monkey-ready', 'true');
    const next = page.frames().find(f => f.url().includes('/monkey-rally/index.html'));
    if (!next) throw new Error('Ready Monkey frame is missing');
    await expect.poll(async () => (await read(next)).scene).toBe('game');
    return next;
  }
  frame = await acquire();
  const earned = () => page.evaluate(() => JSON.parse(localStorage.getItem('playgarden.progress.v2') || '{}').completed?.['monkey-rally'] || []);
  expect(await earned()).toEqual([]);
  const unrelatedBefore = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => !key.includes('monkey-rally') && !key.startsWith('playgarden'))));
  const activate = async (node: Locator) => { if (mobile) await node.tap(); else await node.click(); };
  const action = (name: string) => activate(frame.getByRole('button', { name, exact: true }));
  const reset = () => action('清空并重置');
  const stop = () => action('停止并复位');
  const labels: Record<string, string> = { U: '向上', R: '向右', L: '向左', D: '向下' };
  const keys: Record<string, string> = { U: 'ArrowUp', R: 'ArrowRight', L: 'ArrowLeft', D: 'ArrowDown' };
  async function queue(sequence: string) {
    if (!mobile) await frame.locator('#app').focus();
    for (const direction of sequence) {
      if (mobile) await action('添加' + labels[direction] + '指令');
      else await page.keyboard.press(keys[direction]);
    }
  }
  async function select(index: number) { await chooseLevel(page, index); frame = await acquire(); }
  async function phase(value: string, timeout = 20000) { await expect.poll(async () => (await read(frame)).phase, { timeout }).toBe(value); }

  // Original illustrated title and all ten panels remain visible and captioned.
  await action('十幅故事');
  await expect(frame.locator('#caption')).toContainText('一整段指令');
  for (let i = 1; i <= 10; i++) {
    await action('下一幅故事');
    expect((await read(frame)).introIndex).toBe(i);
    await page.waitForTimeout(510);
  }
  await page.screenshot({ path: info.outputPath('monkey-original-tenth-story.png'), fullPage: true });
  await action('下一幅故事'); await action('开始第 1 关');

  // Blocked commands consume one slot; they never become live steering.
  await queue('DL');
  await action('执行序列'); await phase('finished');
  expect((await read(frame)).cursor).toBe(2);
  expect((await read(frame)).cell).toEqual({ x: 6, y: 7 });
  await stop(); expect((await read(frame)).queue).toEqual([3, 2]);
  await action('删除第 2 条向左指令'); expect((await read(frame)).queue).toEqual([3]);
  await reset(); expect((await read(frame)).queue).toEqual([]);

  // Pause while the first continuous slide is physically between two cells.
  await queue('UR'); await action('执行序列');
  await expect.poll(async () => { const s = await read(frame); return s.direction === 'UP' && !!s.player && Math.abs((s.player.y - 32) / 64 - Math.round((s.player.y - 32) / 64)) > .08; }, { intervals: [15], timeout: 2000 }).toBe(true);
  await action('暂停'); const frozen = await read(frame);
  await page.waitForTimeout(350);
  expect((await read(frame)).player).toEqual(frozen.player);
  expect((await read(frame)).cursor).toBe(frozen.cursor);
  await expect(frame.getByRole('button', { name: '添加向右指令', exact: true })).toBeDisabled();
  await page.screenshot({ path: info.outputPath('monkey-live-slide-paused.png'), fullPage: true });
  await action('继续'); await phase('won');
  expect((await read(frame)).completed).toContain(1);
  await expect.poll(earned).toEqual([0]);
  expect((await read(frame)).slideCount).toBe(6);
  await page.screenshot({ path: info.outputPath('monkey-first-earned-win.png'), fullPage: true });
  await action('前往下一关');
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue('1'); frame = await acquire();
  expect((await read(frame)).level).toBe(2);
  expect((await read(frame)).completed).not.toContain(2);

  // Level 2's authored hole lies directly above the starting monkey.
  await queue('U'); await action('执行序列'); await phase('failed');
  await expect(frame.locator('#caption')).toContainText('掉进了洞');
  await stop(); const afterFallStop = await read(frame);
  await page.waitForTimeout(1700);
  expect((await read(frame)).player).toEqual(afterFallStop.player);
  expect((await read(frame)).queue).toEqual([0]);
  expect((await read(frame)).completed).not.toContain(2);

  // Stop during motion cancels the old tween; Reset additionally clears queue.
  await select(0); await queue('UR'); await action('执行序列');
  await expect.poll(async () => (await read(frame)).direction).toBe('UP');
  await stop(); const stopped = await read(frame); await page.waitForTimeout(350);
  expect((await read(frame)).player).toEqual(stopped.player);
  expect((await read(frame)).phase).toBe('editing');
  await reset(); expect((await read(frame)).queue).toEqual([]);
  // Middle puzzle: the same red switch reversibly controls its door.
  await select(4); await queue('LURDUD'); await action('执行序列'); await phase('finished');
  expect((await read(frame)).toggleCounts[0]).toBe(2);
  expect((await read(frame)).doors.every(door => !door.open)).toBe(true);
  await stop(); expect((await read(frame)).queue).toHaveLength(6);
  await reset(); await queue('LURDLDRULD'); await action('执行序列'); await phase('won');
  expect((await read(frame)).toggleCounts[0]).toBe(1);
  expect((await read(frame)).completed).toContain(5);
  await expect.poll(earned).toEqual([0, 4]);
  await page.screenshot({ path: info.outputPath('monkey-middle-earned-red-door.png'), fullPage: true });

  // Final authored route, manually read from the frozen map. This uses the stop
  // pad, all three reversible colors, and avoids the four original holes.
  await select(7); await queue('LLURDRRULDRULDLU');
  await page.screenshot({ path: info.outputPath('monkey-final-original-board-and-queue.png'), fullPage: true });
  await action('执行序列');
  await phase('ending', 35000);
  expect((await read(frame)).stopCount).toBeGreaterThanOrEqual(3);
  expect((await read(frame)).toggleCounts.every(count => count > 0)).toBe(true);
  expect((await read(frame)).completed).toEqual(expect.arrayContaining([1, 5, 8]));
  await expect.poll(earned).toEqual([0, 4, 7]);
  await expect(frame.locator('#caption')).toContainText('科学家得救');
  await page.screenshot({ path: info.outputPath('monkey-final-actual-ending.png'), fullPage: true });

  // Reentry preserves only earned stage marks. A victory callback interrupted
  // by navigation cannot grant a new selected puzzle completion.
  await select(0); await queue('UR'); await action('执行序列'); await phase('celebrating');
  await select(3); await page.waitForTimeout(750);
  expect((await read(frame)).completed).not.toContain(4);
  expect((await read(frame)).phase).toBe('editing');
  await action('八关选择');
  await expect(frame.getByRole('button', { name: '开始第 8 关 ✓', exact: true })).toBeVisible();
  await action('开始第 8 关 ✓');
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue('7'); frame = await acquire();
  expect((await read(frame)).completed).not.toContain(4);
  expect((await read(frame)).queue).toEqual([]);
  await openGame(page, '猴子救援'); frame = await acquire();
  expect((await read(frame)).completed).toEqual(expect.arrayContaining([1, 5, 8]));
  await expect.poll(earned).toEqual([0, 4, 7]);
  await page.reload(); await openGame(page, '猴子救援'); frame = await acquire();
  expect((await read(frame)).completed).toEqual(expect.arrayContaining([1, 5, 8]));
  await expect.poll(earned).toEqual([0, 4, 7]);
  // CI's configured webServer is Vite dev, and src/main.tsx wraps App in
  // StrictMode. These physical remounts therefore also exercise development
  // effect setup/cleanup replay, without a special runtime/testing state hook.
  const oldSession = new URL(frame.url()).searchParams.get('session')!;
  const oldWindow = await page.locator('iframe[title="猴子救援原作八关"]').evaluateHandle(node => (node as HTMLIFrameElement).contentWindow);
  for (let cycle = 0; cycle < 3; cycle++) {
    await activate(page.getByRole('button', { name: 'Playgarden 首页', exact: true }));
    await expect(page.locator('iframe[title="猴子救援原作八关"]')).toHaveCount(0);
    await activate(page.getByRole('button', { name: '开始玩猴子救援', exact: true }));
    await expect(page.locator('iframe[title="猴子救援原作八关"]')).toHaveCount(1);
    // The first two exits deliberately do not wait for the child's ready event.
  }
  frame = await acquire();
  expect(new URL(frame.url()).searchParams.get('session')).not.toBe(oldSession);
  expect((await read(frame)).queue).toEqual([]);

  // A late listener has missed the original ready notification. It can recover
  // by requesting the bridge's idempotent ready handshake, repeatedly.
  for (let attempt = 0; attempt < 2; attempt++) {
    const readyReply = await page.evaluate(() => new Promise<{ revision: string; levelCount: number }>((resolve, reject) => {
      const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="猴子救援原作八关"]')!;
      const target = iframe.contentWindow!, session = new URL(iframe.src).searchParams.get('session');
      const deadline = setTimeout(() => { window.removeEventListener('message', receive); reject(new Error('Late ready handshake timed out')); }, 3000);
      function receive(event: MessageEvent) {
        if (event.source !== target || event.origin !== location.origin || event.data?.source !== 'playgarden-monkey-rally' || event.data.session !== session || event.data.type !== 'ready') return;
        clearTimeout(deadline); window.removeEventListener('message', receive);
        resolve({ revision: event.data.revision, levelCount: event.data.levelCount });
      }
      window.addEventListener('message', receive);
      target.postMessage({ source: 'playgarden-host', session, type: 'host-ready', paused: false }, location.origin);
    }));
    expect(readyReply).toEqual({ revision: 'monkey-rally-79abaad3-playgarden-1', levelCount: 8 });
  }
  const statusBefore = await page.locator('.status').textContent();
  const stateBefore = await read(frame);
  // Status-only stale transport probes. No complete message, state setter or
  // injected win: the first identifies the exact disposed window/session; the
  // second comes from the current window but deliberately bears that old token.
  await page.evaluate(({ previous, session }) => {
    window.dispatchEvent(new MessageEvent('message', { origin: location.origin, source: previous,
      data: { source: 'playgarden-monkey-rally', session, type: 'status', message: 'obsolete disposed-frame status' } }));
  }, { previous: oldWindow, session: oldSession });
  await frame.evaluate(session => parent.postMessage({ source: 'playgarden-monkey-rally', session, type: 'status', message: 'obsolete prior-session status' }, location.origin), oldSession);
  await page.waitForTimeout(150);
  expect(await page.locator('.status').textContent()).toBe(statusBefore);
  expect((await read(frame)).queue).toEqual(stateBefore.queue);
  expect((await read(frame)).completed).toEqual(stateBefore.completed);
  await oldWindow.dispose();
  await page.screenshot({ path: info.outputPath('monkey-reentry-lifecycle.png'), fullPage: true });
  const unrelatedAfter = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => !key.includes('monkey-rally') && !key.startsWith('playgarden'))));
  expect(unrelatedAfter).toEqual(unrelatedBefore);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (mobile) for (const node of await frame.locator('[data-direction], #play, #stop, #reset').all()) { const box = await node.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(44); }
  expect(outside).toEqual([]); expect(errors).toEqual([]);
});
