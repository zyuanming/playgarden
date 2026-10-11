// SPDX-License-Identifier: GPL-3.0-only
import { expect, test, type Frame, type Page, type CDPSession } from '@playwright/test';
import { captureErrors, chooseLevel, openGame } from './helpers';

type Point = { x: number; y: number };
type Body = Point & { id: number; vx: number; vy: number; material: number };
type Reading = {
  level: number; phase: string; paused: boolean; hostPaused: boolean; localPaused: boolean; blurPaused: boolean; ticks: number;
  player: Body; clock: { milliseconds: number; pending: number; epoch: number }; input: { held: string[]; dragging: boolean };
  triggers: (Body & { active: boolean; capturedId: number | null })[]; doors: (Body & { open: boolean; pending: boolean })[];
  debris: (Body & { age: number; lifetime: number | null; captured: boolean })[];
  emitters: (Point & { firing: boolean; time: number })[]; walls: Point[][];
  emitted: number; expired: number; annihilated: number; text: string;
};
const read = (frame: Frame) => frame.evaluate(() => (window as unknown as { __hgcRead: () => Reading }).__hgcRead());
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

// Navigation reads the original wall polygons, then guides real joystick input.
// It cannot mutate the game, perform a physics step, inject keys, or earn a win.
function navigator(walls: Point[][]) {
  const size = 117, spacing = 2, origin = -116, cache = new Map<string, boolean>();
  function clear(p: Point, margin = 3.8) {
    const key = `${p.x}:${p.y}:${margin}`;
    if (cache.has(key)) return cache.get(key)!;
    let blocked = false;
    for (const poly of walls) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
        const length = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
        const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / length)) : 0;
        if (distance(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }) < margin) blocked = true;
      }
      if (inside) blocked = true;
      if (blocked) break;
    }
    cache.set(key, !blocked); return !blocked;
  }
  const point = (id: number) => ({ x: origin + (id % size) * spacing, y: origin + Math.floor(id / size) * spacing });
  function nearest(p: Point) {
    let best = 0, score = Infinity;
    for (let iy = Math.max(0, Math.round((p.y - origin) / spacing) - 4); iy <= Math.min(size - 1, Math.round((p.y - origin) / spacing) + 4); iy++) {
      for (let ix = Math.max(0, Math.round((p.x - origin) / spacing) - 4); ix <= Math.min(size - 1, Math.round((p.x - origin) / spacing) + 4); ix++) {
        const id = iy * size + ix, candidate = point(id), d = distance(candidate, p);
        if (d < score && clear(candidate)) { best = id; score = d; }
      }
    }
    if (!Number.isFinite(score)) throw new Error(`No clear navigation cell near ${JSON.stringify(p)}`);
    return best;
  }
  function visible(a: Point, b: Point) {
    const steps = Math.max(1, Math.ceil(distance(a, b)));
    for (let i = 1; i <= steps; i++) if (!clear({ x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps })) return false;
    return true;
  }
  return function route(from: Point, to: Point): Point[] {
    if (visible(from, to)) return [to];
    const start = nearest(from), end = nearest(to), open = new Set([start]), previous = new Map<number, number>(), scores = new Map([[start, 0]]);
    while (open.size) {
      let current = -1, estimate = Infinity;
      for (const id of open) { const f = scores.get(id)! + distance(point(id), point(end)); if (f < estimate) { current = id; estimate = f; } }
      if (current === end) {
        const result = [to]; let id = end;
        while (id !== start) { result.unshift(point(id)); id = previous.get(id)!; }
        const smooth: Point[] = []; let anchor = from;
        for (let i = 0; i < result.length;) { let farthest = i; while (farthest + 1 < result.length && visible(anchor, result[farthest + 1])) farthest++; smooth.push(result[farthest]); anchor = result[farthest]; i = farthest + 1; }
        return smooth;
      }
      open.delete(current);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const x = current % size + dx, y = Math.floor(current / size) + dy;
        if (x < 0 || x >= size || y < 0 || y >= size) continue;
        const id = y * size + x, p = point(id);
        if (!clear(p) || !visible(point(current), p)) continue;
        const nextScore = scores.get(current)! + Math.hypot(dx, dy) * spacing;
        if (nextScore < (scores.get(id) ?? Infinity)) { scores.set(id, nextScore); previous.set(id, current); open.add(id); }
      }
    }
    throw new Error(`Original geometry has no route from ${JSON.stringify(from)} to ${JSON.stringify(to)}`);
  };
}

// This is ordinary pointer/touch dispatch. All frame.evaluate calls below are
// read-only observations; there is no solver endpoint or state-setting shortcut.
class Joystick {
  center: Point | null = null;
  scale = 1;
  constructor(private page: Page, private frame: Frame, private touch: CDPSession | null) {}
  async begin() {
    const canvas = this.frame.getByLabel('零重力清运画布');
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox(); if (!box) throw new Error('Canvas is not visible');
    this.center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }; this.scale = box.width / 640;
    if (this.touch) await this.touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...this.center, id: 1 }] });
    else { await this.page.mouse.move(this.center.x, this.center.y); await this.page.mouse.down(); }
  }
  async set(x: number, y: number) {
    if (!this.center) await this.begin();
    const length = Math.hypot(x, y), max = Math.max(1, Math.abs(x), Math.abs(y)); x /= max; y /= max;
    const angle = Math.atan2(y, x), dead = length < .01 ? 0 : 20;
    const p = { x: this.center!.x + (x * 100 + Math.cos(angle) * dead) * this.scale, y: this.center!.y + (y * 100 + Math.sin(angle) * dead) * this.scale };
    if (this.touch) await this.touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...p, id: 1 }] });
    else await this.page.mouse.move(p.x, p.y);
  }
  async release() {
    if (!this.center) return;
    if (this.touch) await this.touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await this.page.mouse.up();
    this.center = null;
  }
}

test('four authored physics stages: earned first, middle and final captures, isolation and touch', async ({ page, context }, info) => {
  test.setTimeout(300000);
  const mobile = info.project.name === 'mobile', errors = captureErrors(page), external: string[] = [];
  const origin = new URL(String(info.project.use.baseURL || 'http://127.0.0.1:4173')).origin;
  page.on('request', r => { if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== origin) external.push(r.url()); });
  const cdp = mobile ? await context.newCDPSession(page) : null;
  await openGame(page, '反物质清运站');
  await expect(page.getByLabel('选择关卡', { exact: true }).locator('option')).toHaveCount(4);
  await expect(page.locator('iframe[title="反物质清运站原作四关"]')).toHaveAttribute('sandbox', 'allow-scripts');
  const earned = () => page.evaluate(() => JSON.parse(localStorage.getItem('playgarden.progress.v2') || '{}').completed?.['hyperspace-garbage-collection'] || []);
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('playgarden.hyperspace-garbage-collection.v1.state') || '{}'));
  async function acquire(retiredUrl?: string) {
    let candidate: Frame | undefined;
    await expect.poll(async () => {
      candidate = page.frames().find(f => f.url().includes('/hyperspace-garbage-collection/index.html') && f.url() !== retiredUrl);
      if (!candidate) return false;
      try { return (await read(candidate)).phase === 'briefing'; } catch { return false; }
    }, { timeout: 20000 }).toBe(true);
    await expect(page.locator('[data-hgc-ready]')).toHaveAttribute('data-hgc-ready', 'true');
    if (!candidate) throw new Error('Ready opaque game frame is missing');
    const frame = candidate, joystick = new Joystick(page, frame, cdp);
    return { frame, joystick, route: navigator((await read(frame)).walls) };
  }
  let { frame, joystick, route } = await acquire();
  const activate = async (name: string) => { const button = frame.getByRole('button', { name, exact: true }); if (mobile) await button.tap(); else await button.click(); };
  async function start() { await activate('开始清运'); await expect.poll(async () => (await read(frame)).phase).toBe('playing'); }
  async function advance(steps = 4) {
    const s = await read(frame);
    if (s.phase !== 'playing') return;
    await frame.waitForFunction(t => { const s = (window as unknown as { __hgcRead: () => Reading }).__hgcRead(); return s.phase !== 'playing' || s.ticks >= t; }, s.ticks + steps, { timeout: 3000 });
  }
  async function drive(target: Point, feed: Point = { x: 0, y: 0 }, speed = 42) {
    const s = await read(frame), p = s.player;
    let vx = (target.x - p.x) * 5 + feed.x, vy = (target.y - p.y) * 5 + feed.y;
    const ratio = Math.max(1, Math.hypot(vx, vy) / speed); vx /= ratio; vy /= ratio;
    await joystick.set(((vx - p.vx) * 8 + 2 * p.vx) / 113.18, ((vy - p.vy) * 8 + 2 * p.vy) / 113.18);
    await advance();
  }
  async function go(target: Point, tolerance = 1.7) {
    const stop = Date.now() + 16000;
    let path = route((await read(frame)).player, target);
    while (Date.now() < stop) {
      const s = await read(frame); if (s.phase !== 'playing') break;
      if (distance(s.player, target) < tolerance && Math.hypot(s.player.vx, s.player.vy) < 9) { await joystick.set(0, 0); return; }
      while (path.length > 1 && distance(s.player, path[0]) < 3) path.shift();
      await drive(path[0]);
    }
    const s = await read(frame);
    if (s.phase === 'playing') expect(distance(s.player, target), `Physical navigation to ${JSON.stringify(target)}; observed ${JSON.stringify(s.player)}`).toBeLessThan(tolerance + 1);
    await joystick.release();
  }
  async function switchTo(material: number) {
    await joystick.release();
    if ((await read(frame)).player.material === material) return;
    if (mobile) await frame.locator('#material-btn').tap(); else { await frame.getByLabel('零重力清运画布').focus(); await page.keyboard.press('Space'); }
    expect((await read(frame)).player.material).toBe(material);
  }
  async function capture(index: number, originPoint: Point, staging: Point, budget = 65000) {
    await switchTo((await read(frame)).triggers[index].material);
    await go(staging);
    const until = Date.now() + budget;
    let chosen = -1, targetPath: Point[] = [], routeAt = 0;
    while (Date.now() < until) {
      const s = await read(frame), trigger = s.triggers[index];
      if (trigger.active) { await joystick.release(); expect(trigger.capturedId).not.toBeNull(); return; }
      let debris = s.debris.find(d => d.id === chosen && !d.captured);
      if (!debris) {
        // Wait near the real emitter for a fresh body. Never manufacture one.
        debris = s.debris.filter(d => d.material === trigger.material && !d.captured && d.age < .85 && distance(d, originPoint) < 22).sort((a, b) => distance(a, s.player) - distance(b, s.player))[0];
        if (!debris) { await drive(staging); continue; }
        chosen = debris.id; targetPath = route(debris, trigger); routeAt = 0;
      }
      while (routeAt < targetPath.length - 1 && distance(debris, targetPath[routeAt]) < 5) routeAt++;
      const waypoint = targetPath[routeAt], length = Math.max(.001, distance(debris, waypoint));
      const ux = (waypoint.x - debris.x) / length, uy = (waypoint.y - debris.y) / length;
      const rx = s.player.x - debris.x, ry = s.player.y - debris.y;
      const behind = rx * ux + ry * uy, lateral = Math.abs(rx * uy - ry * ux);
      const pushing = behind < -1 && behind > -8 && lateral < 2.8;
      const destination = pushing ? { x: debris.x + ux * 5, y: debris.y + uy * 5 } : { x: debris.x - ux * 4.8 + debris.vx * .08, y: debris.y - uy * 4.8 + debris.vy * .08 };
      await drive(destination, pushing ? { x: ux * 22, y: uy * 22 } : { x: debris.vx * .65, y: debris.vy * .65 }, 48);
    }
    await joystick.release();
    const s = await read(frame);
    expect(s.triggers[index].active, `Capture was not earned by physical input; final observation ${JSON.stringify(s)}`).toBe(true);
  }
  async function enterDoor() {
    const s = await read(frame); expect(s.doors[0].open).toBe(true);
    await go(s.doors[0], 1.2); await joystick.release();
    await expect.poll(async () => (await read(frame)).phase, { timeout: 5000 }).toBe(s.level === 3 ? 'ending' : 'won');
  }
  async function select(level: number) { await joystick.release(); await chooseLevel(page, level); ({ frame, joystick, route } = await acquire(frame.url())); await start(); }
  expect(await earned()).toEqual([]); await start();

  // A real keyboard or touch advance, then host pause freezes physics, emitter
  // delays, instruction timers and particle lifetime. No wall-clock sleeps.
  if (mobile) { await joystick.set(.6, 0); await advance(12); await joystick.release(); }
  else { await frame.getByLabel('零重力清运画布').focus(); await page.keyboard.down('ArrowRight'); await advance(12); await page.keyboard.up('ArrowRight'); }
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await expect.poll(async () => (await read(frame)).hostPaused).toBe(true);
  const frozen = await read(frame);
  await page.evaluate(() => new Promise<void>(resolve => { let frames = 0; const observe = () => ++frames === 24 ? resolve() : requestAnimationFrame(observe); requestAnimationFrame(observe); }));
  expect((await read(frame)).clock).toEqual(frozen.clock); expect((await read(frame)).player).toEqual(frozen.player);
  expect((await read(frame)).debris).toEqual(frozen.debris); expect((await read(frame)).input).toEqual({ held: [], dragging: false });
  await expect(frame.locator('#pause-btn')).toBeDisabled();
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await expect.poll(async () => (await read(frame)).paused).toBe(false);
  await activate('重试本关'); expect((await read(frame)).player.material).toBe(4);
  expect((await read(frame)).triggers.every(t => !t.active)).toBe(true); expect(await earned()).toEqual([]);

  // Negative: let finite-lived debris be emitted and genuinely expire while
  // remaining at the initial corridor. Expiration cannot complete a trigger.
  await expect.poll(async () => (await read(frame)).expired, { timeout: 12000 }).toBeGreaterThan(0);
  expect((await read(frame)).triggers.every(t => !t.active)).toBe(true); expect(await earned()).toEqual([]);
  await go({ x: 5, y: -35 });
  await capture(0, { x: -2, y: -42 }, { x: 5, y: -35 }); await enterDoor();
  await expect.poll(earned).toEqual([0]);
  await expect(frame.getByRole('button', { name: '下一关', exact: true })).toBeEnabled();
  expect((await read(frame)).paused).toBe(false); // Shell victory focus must not freeze won navigation.
  await page.screenshot({ path: info.outputPath('hgc-first-earned.png'), fullPage: true });
  await activate('下一关'); ({ frame, joystick, route } = await acquire(frame.url())); expect((await read(frame)).level).toBe(1); await start();
  expect((await read(frame)).player.material).toBe(4); expect((await read(frame)).triggers[0].material).toBe(2);
  await switchTo(2); await switchTo(4); expect(await earned()).toEqual([0]);

  // The mobile journey additionally exercises quota failure after a genuinely
  // earned first-stage record already exists on disk. Only the storage API is
  // fault-injected; all subsequent captures and the ending still require play.
  if (mobile) {
    await page.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        if (key === 'playgarden.hyperspace-garbage-collection.v1.state') throw new DOMException('Test quota exhaustion', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    await page.reload();
    await openGame(page, '反物质清运站');
    ({ frame, joystick, route } = await acquire(frame.url()));
    expect((await saved()).completed).toEqual([0]);
  }
  // Middle authored level: redirect each crossing stream using matching matter.
  await select(2);
  await capture(1, { x: 20, y: -20 }, { x: 23, y: -28 });
  await capture(0, { x: -20, y: -20 }, { x: -23, y: -28 });
  await enterDoor(); await expect.poll(earned).toEqual([0, 2]);
  await expect(page.locator('[data-hgc-earned]')).toHaveAttribute('data-hgc-earned', '2');
  await page.screenshot({ path: info.outputPath('hgc-middle-two-captures.png'), fullPage: true });
  await activate('下一关'); ({ frame, joystick, route } = await acquire(frame.url())); await start(); expect((await read(frame)).level).toBe(3);

  // Final original map: navigate its bends, shepherd both real emitter bodies,
  // pass the real door delay, and keep the original "the end" scene visible.
  await capture(0, { x: -37, y: -9 }, { x: -38, y: -17 }, 90000);
  await capture(1, { x: 40, y: -36 }, { x: 37, y: -30 });
  await enterDoor(); await expect.poll(earned).toEqual([0, 2, 3]);
  expect((await read(frame)).text).toBe('the end');
  await expect(page.locator('[data-hgc-earned]')).toHaveAttribute('data-hgc-earned', '3');
  expect((await saved()).earnedEnding).toBe(!mobile);
  await expect(frame.locator('#finish')).toHaveClass(/original-ending/);
  await frame.locator('#finish').scrollIntoViewIfNeeded();
  const finishBox = await frame.locator('#finish').boundingBox();
  expect(finishBox).not.toBeNull(); expect(finishBox!.y).toBeGreaterThanOrEqual(0); expect(finishBox!.y + finishBox!.height).toBeLessThanOrEqual((await page.viewportSize())!.height + 1);
  await page.screenshot({ path: info.outputPath('hgc-original-ending.png'), fullPage: true });

  // Retry invalidates the old door callback; select/reenter preserves earned
  // records while restarting the original physical scene from its true start.
  await activate('再玩本关'); expect((await read(frame)).phase).toBe('playing');
  expect((await read(frame)).text).not.toBe('the end'); expect((await read(frame)).player.material).toBe(4);
  expect((await read(frame)).triggers.every(t => !t.active)).toBe(true);
  await advance(30); expect((await read(frame)).phase).toBe('playing'); expect(await earned()).toEqual([0, 2, 3]);
  await joystick.release(); await page.getByRole('button', { name: '返回游戏大厅', exact: true }).click();
  await page.getByRole('button', { name: '开始玩反物质清运站', exact: true }).click(); ({ frame, joystick, route } = await acquire(frame.url()));
  expect((await saved()).completed).toEqual(mobile ? [0] : [0, 2, 3]); expect((await saved()).earnedEnding).toBe(!mobile);
  await expect(page.locator('[data-hgc-earned]')).toHaveAttribute('data-hgc-earned', '3');
  await start(); await activate('暂停');
  await frame.locator('#pause-btn').scrollIntoViewIfNeeded();
  const pauseBox = await frame.locator('#pause-btn').boundingBox();
  expect(pauseBox!.y).toBeGreaterThanOrEqual(0); expect(pauseBox!.y + pauseBox!.height).toBeLessThanOrEqual((await page.viewportSize())!.height + 1);
  const again = await read(frame);
  await page.evaluate(() => new Promise<void>(resolve => { let n = 0; function f() { if (++n >= 12) resolve(); else requestAnimationFrame(f); } requestAnimationFrame(f); }));
  expect((await read(frame)).clock).toEqual(again.clock);
  await page.screenshot({ path: info.outputPath('hgc-touch-controls-paused.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload(); await openGame(page, '反物质清运站');
  ({ frame, joystick, route } = await acquire(frame.url()));
  await expect(page.locator('[data-hgc-earned]')).toHaveAttribute('data-hgc-earned', mobile ? '1' : '3');
  expect(errors).toEqual([]); expect(external).toEqual([]);
});
