import { expect, test, type Page, type Frame, type CDPSession } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openGame, chooseLevel, captureErrors } from './helpers';
type Actor = { x: number; y: number; vx: number; vy: number; wasHuman: boolean; opened: boolean };
type Reading = { phase: string; paused: boolean; level: number; lives: number; ammo: number; hasKey: boolean; hasGun: boolean; availableLevel: number; frames: number; elapsed: number; hint: string; player: (Actor & { form: string; grounded: boolean; wasZombie: boolean }) | null; objects: Record<string, Actor[]>; inputs: Record<string, boolean>; summary: { level: number; stars: number; health: { collected: number }; zombies: { healed: number; available: number } } | null };
type Input = 'left' | 'right' | 'action' | 'fire';
const read = (frame: Frame) => frame.evaluate(() => (window as unknown as { __healRead: () => Reading }).__healRead());

test('six-stage original: earned first, middle and final routes with touch and lifecycle', async ({ page }, info) => {
  test.setTimeout(360000);
  const mobile = info.project.name === 'mobile', errors = captureErrors(page), outside: string[] = [];
  const allowedOrigin = new URL(String(info.project.use.baseURL || 'http://127.0.0.1:4173')).origin;
  page.on('request', request => { const url = request.url(); if (/^https?:/.test(url) && new URL(url).origin !== allowedOrigin) outside.push(url); });
  await openGame(page, '治愈所有人');
  await expect(page.getByLabel('选择关卡', { exact: true }).locator('option')).toHaveCount(6);
  let frame: Frame;
  await expect(page.locator('[data-heal-ready]')).toHaveAttribute('data-heal-ready', 'true');
  frame = page.frames().find(f => f.url().includes('/heal-em-all/index.html'))!;
  // The existing CI webServer runs Vite dev with React StrictMode. These real
  // remounts exercise effect replay and disposal without changing game state.
  const oldSession = new URL(frame.url()).searchParams.get('session')!;
  const oldWindow = await page.locator('iframe[title="治愈所有人完整六关"]').evaluateHandle(node => (node as HTMLIFrameElement).contentWindow);
  const activate = async (node: ReturnType<Page['getByRole']>) => { if (mobile) await node.tap(); else await node.click(); };
  for (let cycle = 0; cycle < 3; cycle++) {
    await activate(page.getByRole('button', { name: 'Playgarden 首页', exact: true }));
    await expect(page.locator('iframe[title="治愈所有人完整六关"]')).toHaveCount(0);
    await activate(page.getByRole('button', { name: '开始玩治愈所有人', exact: true }));
    await expect(page.locator('iframe[title="治愈所有人完整六关"]')).toHaveCount(1);
  }
  await expect(page.locator('[data-heal-ready]')).toHaveAttribute('data-heal-ready', 'true');
  frame = page.frames().find(f => f.url().includes('/heal-em-all/index.html'))!;
  expect(new URL(frame.url()).searchParams.get('session')).not.toBe(oldSession);
  expect((await read(frame)).phase).toBe('title');
  // A listener installed after the original ready notification can request a
  // fresh reply repeatedly. This is a protocol probe, not a gameplay setter.
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await page.evaluate(() => new Promise<{ revision: string; levelCount: number }>((resolve, reject) => {
      const node = document.querySelector<HTMLIFrameElement>('iframe[title="治愈所有人完整六关"]')!;
      const target = node.contentWindow!, session = new URL(node.src).searchParams.get('session');
      const timer = setTimeout(() => { window.removeEventListener('message', receive); reject(new Error('Late Heal ready handshake timed out')); }, 3000);
      function receive(event: MessageEvent) {
        if (event.source !== target || event.origin !== location.origin || event.data?.source !== 'playgarden-heal-em-all' || event.data.session !== session || event.data.type !== 'ready') return;
        clearTimeout(timer); window.removeEventListener('message', receive);
        resolve({ revision: event.data.revision, levelCount: event.data.levelCount });
      }
      window.addEventListener('message', receive);
      target.postMessage({ source: 'playgarden-host', session, type: 'host-ready', paused: false }, location.origin);
    }));
    expect(reply).toEqual({ revision: 'heal-em-all-66950cda-playgarden-1', levelCount: 6 });
  }
  const statusBefore = await page.locator('.status').textContent(), stateBefore = await read(frame);
  // Both stale-window and stale-session status messages must be ignored. No
  // completion message is sent and no player, progress or clock is modified.
  await page.evaluate(({ previous, session }) => {
    window.dispatchEvent(new MessageEvent('message', { origin: location.origin, source: previous,
      data: { source: 'playgarden-heal-em-all', session, type: 'status', message: 'obsolete disposed-frame status' } }));
  }, { previous: oldWindow, session: new URL(frame.url()).searchParams.get('session')! });
  await frame.evaluate(session => parent.postMessage({ source: 'playgarden-heal-em-all', session, type: 'status', message: 'obsolete prior-session status' }, location.origin), oldSession);
  await page.waitForTimeout(150);
  expect(await page.locator('.status').textContent()).toBe(statusBefore);
  expect((await read(frame)).phase).toBe(stateBefore.phase);
  expect((await read(frame)).availableLevel).toBe(stateBefore.availableLevel);
  await oldWindow.dispose();
  const cdp: CDPSession | null = mobile ? await page.context().newCDPSession(page) : null;
  const keys: Record<Input, string> = { left: 'ArrowLeft', right: 'ArrowRight', action: 'ArrowUp', fire: 'Space' };
  let pressed: Input[] = [];
  let touchCenters: Record<Input, { x: number; y: number; id: number }>;
  async function setInputs(next: Input[]) {
    if (mobile) {
      // Measure before a gesture starts. Releasing Jump must not release the
      // steering finger for several layout/scroll round trips during ascent.
      if (!pressed.length && next.length) {
        await frame.locator('.controls').scrollIntoViewIfNeeded();
        const entries = await Promise.all((Object.keys(keys) as Input[]).map(async (input, i) => {
          const box = (await frame.locator(`[data-input="${input}"]`).boundingBox())!;
          return [input, { x: box.x + box.width / 2, y: box.y + box.height / 2, id: i + 1 }] as const;
        }));
        touchCenters = Object.fromEntries(entries) as typeof touchCenters;
      }
      if (pressed.length) await cdp!.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      if (next.length) await cdp!.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: next.map(input => touchCenters[input]) });
    } else {
      for (const input of pressed) if (!next.includes(input)) await page.keyboard.up(keys[input]);
      for (const input of next) if (!pressed.includes(input)) await page.keyboard.down(keys[input]);
    }
    pressed = next;
  }
  async function waitFor(predicate: (s: Reading) => boolean, label: string, timeout = 4500) {
    const deadline = Date.now() + timeout;
    let state = await read(frame);
    while (!predicate(state) && Date.now() < deadline) { await page.waitForTimeout(20); state = await read(frame); if (state.phase === 'gameover' && !predicate(state)) throw Error(label + ': actual game over'); }
    expect(predicate(state), label + ': ' + JSON.stringify({ phase: state.phase, player: state.player, lives: state.lives })).toBe(true);
    return state;
  }
  async function ground(y: number) { return waitFor(s => !!s.player && Math.abs(s.player.y - y) < 4 && s.player.grounded, `ground y=${y}`); }
  async function move(x: number, shoot = false) {
    const initial = (await read(frame)).player!;
    if (Math.abs(initial.x - x) < 5) return;
    const direction: Input = initial.x < x ? 'right' : 'left';
    const deadline = Date.now() + Math.abs(x - initial.x) / 300 * 1000 + 1800;
    let hoppedOverGuard = false;
    let s = await read(frame);
    while (s.player && (direction === 'right' ? s.player.x < x : s.player.x > x) && Date.now() < deadline) {
      const p = s.player, enemyAhead = s.objects.Zombie.some(z => Math.abs(z.y - p.y) < 30 && Math.abs(z.x - p.x) < 430 && (direction === 'right' ? z.x > p.x : z.x < p.x));
      expect(p.form, 'positive route must remain human').toBe('human');
      // The final gun is guarded by a solid moving zombie. Before acquiring
      // ammunition, pushing into that body cannot work: jump over it using
      // the real controls, then land on the original gun pickup.
      const unarmedGuard = shoot && !s.hasGun && p.grounded && s.objects.Zombie.some(z => Math.abs(z.y - p.y) < 15 && Math.abs(z.x - p.x) < 145 && (direction === 'right' ? z.x > p.x : z.x < p.x));
      if (unarmedGuard) {
        await setInputs([direction, 'action']); await page.waitForTimeout(120); await setInputs([direction]);
        hoppedOverGuard = true;
        s = await read(frame); continue;
      }
      const next: Input[] = shoot && s.hasGun && enemyAhead ? [direction, 'fire'] : [direction];
      if (next.join() !== pressed.join()) await setInputs(next);
      await page.waitForTimeout(20); s = await read(frame);
    }
    await setInputs([]);
    expect(!!s.player && (direction === 'right' ? s.player.x >= x : s.player.x <= x), `walk ${direction} to ${x}: ${JSON.stringify(s.player)}`).toBe(true);
    if (hoppedOverGuard) await ground(initial.y);
  }
  async function jump(direction: 'left' | 'right', targetY: number) {
    await setInputs([direction, 'action']); await page.waitForTimeout(120); await setInputs([direction]);
    await ground(targetY); await setInputs([]);
  }
  async function healNearby() {
    let state = await read(frame);
    if (!state.hasGun || state.ammo === 0 || !state.player) return;
    const p = state.player;
    const enemy = state.objects.Zombie.filter(z => Math.abs(z.y - p.y) < 30 && Math.abs(z.x - p.x) < 440).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    if (!enemy) return;
    const direction: Input = enemy.x < p.x ? 'left' : 'right';
    await setInputs([direction]); await page.waitForTimeout(35); await setInputs(['fire']); await page.waitForTimeout(600); await setInputs([]);
  }
  function platformAt(level: number, x: number, y: number) {
    // Read the authored collision map only to choose a safe place to step off
    // a moving enemy's head. This never changes a tile, actor or game clock.
    const xml = readFileSync(`public/heal-em-all/data/level${level}.tmx`, 'utf8');
    const width = Number(xml.match(/<map[^>]* width="(\d+)"/)![1]);
    const layer = xml.match(/<layer name="collision"[\s\S]*?<data>([\s\S]*?)<\/data>/)![1];
    const tiles = [...layer.matchAll(/<tile gid="(\d+)"\s*\/>/g)].map(m => Number(m[1]));
    const row = Math.round((y + 50) / 70), cell = Math.floor(x / 70);
    expect(tiles[row * width + cell], 'authored drop target has a supporting tile').toBeGreaterThan(0);
    let left = cell, right = cell;
    while (left > 0 && tiles[row * width + left - 1]) left--;
    while (right + 1 < width && tiles[row * width + right + 1]) right++;
    return { left: left * 70 + 45, right: (right + 1) * 70 - 45 };
  }
  async function drop(x: number, y: number) {
    await move(x);
    let state = await read(frame);
    const bounds = platformAt(state.level, x, y), deadline = Date.now() + 6000;
    while (!(state.player && Math.abs(state.player.y - y) < 4 && state.player.grounded) && Date.now() < deadline) {
      const p = state.player;
      if (!p || state.phase === 'gameover' || p.form !== 'human') throw Error('Actual death or infection while dropping onto the authored platform');
      // Original characters are solid. Waiting motionless on a zombie is not
      // a landing: it repeatedly damages the player. Step toward the platform
      // interior using normal input, then heal it from the same floor height.
      if (p.grounded && state.objects.Zombie.some(z => Math.abs(p.y - (z.y - 100)) < 6 && Math.abs(z.y - y) < 20 && Math.abs(z.x - p.x) < 65)) {
        const direction = p.x > (bounds.left + bounds.right) / 2 ? -1 : 1;
        await move(Math.max(bounds.left, Math.min(bounds.right, p.x + direction * 115)), true);
      }
      await page.waitForTimeout(20); state = await read(frame);
    }
    expect(!!state.player && Math.abs(state.player.y - y) < 4 && state.player.grounded, 'physical landing after clearing an enemy').toBe(true);
    await healNearby();
  }
  async function cross(launchX: number, direction: 'left' | 'right', dropX: number) {
    await healNearby(); await move(launchX, true); await jump(direction, 1280); await drop(dropX, 1490);
  }
  async function exitDoor() {
    const door = (await read(frame)).objects.Door[0];
    await move(door.x, true); await setInputs(['action']);
    await waitFor(s => s.phase === 'summary', 'physical door exit'); await setInputs([]);
  }
  async function selectFixtureLevel(index: number) {
    // Selection-only saved-progress fixture, explicitly approved for targeted
    // first/middle/final coverage. It cannot place the player or grant a win.
    await page.evaluate(() => { localStorage.setItem('playgarden.heal-em-all.v1.available', '6'); localStorage.setItem('playgarden.heal-unrelated', 'keep'); });
    await chooseLevel(page, index);
    await expect(page.locator('[data-heal-ready]')).toHaveAttribute('data-heal-ready', 'true');
    frame = page.frames().find(f => f.url().includes('/heal-em-all/index.html'))!;
    await waitFor(s => s.phase === 'playing', 'selected unlocked stage');
    for (let i = 0; i < 20; i++) {
      if ((await read(frame)).objects.Key[0]?.x > 6500) return;
      await frame.getByRole('button', { name: '重试本关', exact: true }).click();
      await page.waitForTimeout(50);
    }
    throw Error('Authored right-key/left-door placement did not appear after 20 visible restarts.');
  }

  await frame.getByRole('button', { name: '开始冒险', exact: true }).click();
  await expect(frame.getByRole('button', { name: '开始第 2 关', exact: true })).toBeDisabled();
  await frame.getByRole('button', { name: '开始第 1 关', exact: true }).click();
  await ground(650); await move(260); await jump('right', 440); await move(680); await jump('right', 230); await move(1050);
  expect((await read(frame)).hasGun).toBe(true); expect((await read(frame)).ammo).toBe(3);
  await page.screenshot({ path: info.outputPath('heal-first-gun-desktop-or-touch.png'), fullPage: true });
  await frame.getByRole('button', { name: '暂停冒险', exact: true }).click();
  const frozen = (await read(frame)).player;
  await page.waitForTimeout(300); expect((await read(frame)).player).toEqual(frozen);
  await expect(frame.getByRole('button', { name: '向左移动', exact: true })).toBeDisabled();
  await frame.getByRole('button', { name: '继续冒险', exact: true }).first().click();
  if (!mobile) await frame.locator('canvas').focus();
  await drop(1250, 650); await healNearby();
  await waitFor(s => s.objects.Human.length === 1, 'physically healed first zombie');
  await move(1050); expect((await read(frame)).hasKey).toBe(true);
  await drop(1365, 860); await drop(1290, 1070); await move(1050);
  expect((await read(frame)).lives).toBeGreaterThanOrEqual(3);
  await move(1100); await jump('right', 860); await move(1380); await jump('right', 650); await exitDoor();
  let state = await read(frame);
  expect(state.summary).toMatchObject({ level: 1, stars: 3, zombies: { healed: 1, available: 1 }, health: { collected: 1 } });
  expect(state.availableLevel).toBe(2);
  await page.screenshot({ path: info.outputPath('heal-first-earned-three-star-summary.png'), fullPage: true });

  await frame.getByRole('button', { name: '前往下一关', exact: true }).click();
  await expect(page.locator('.game-main')).toHaveAttribute('data-level', '1');
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue('1');
  await expect(page.locator('[data-heal-ready]')).toHaveAttribute('data-heal-ready', 'true');
  frame = page.frames().find(f => f.url().includes('/heal-em-all/index.html'))!;
  await waitFor(s => s.phase === 'playing' && s.level === 2, 'internal Next keeps shell and iframe level aligned');
  await chooseLevel(page, 0);
  await expect(page.locator('[data-heal-ready]')).toHaveAttribute('data-heal-ready', 'true');
  frame = page.frames().find(f => f.url().includes('/heal-em-all/index.html'))!;
  await frame.getByRole('button', { name: '开始冒险', exact: true }).click();
  await frame.getByRole('button', { name: '开始第 1 关', exact: true }).click();

  // Repeated physical falls exercise infection, falling to recover humanity,
  // terminal death and retry. No life/form/position state is written.
  await ground(650); await setInputs(['left']);
  await waitFor(s => s.player?.form === 'zombie', 'three falls trigger infection form', 20000);
  await waitFor(s => s.hint === '跳出地图，恢复人类形态', 'localized infection hint', 6500);
  await page.screenshot({ path: info.outputPath('heal-first-earned-infection-form.png'), fullPage: true });
  await waitFor(s => !!s.player?.wasZombie && s.player.form === 'human', 'fall restores human form', 18000);
  await waitFor(s => s.phase === 'gameover', 'second exhaustion is terminal death', 20000);
  await setInputs([]);
  await expect(frame.getByRole('button', { name: '重试本关', exact: true })).toBeVisible();
  await frame.getByRole('button', { name: '重试本关', exact: true }).click();
  await ground(650); expect((await read(frame)).lives).toBe(3); expect((await read(frame)).player?.wasZombie).toBe(false);

  await selectFixtureLevel(3); await ground(1490);
  await drop(3250, 1700); await drop(2960, 1910); await move(2625); expect((await read(frame)).hasGun).toBe(true);
  await move(2780); await jump('right', 1700); await move(3060); await jump('right', 1490);
  for (const [launch, landing] of [[3550, 4050], [4250, 4900], [5020, 5600], [5860, 6500]]) await cross(launch, 'right', landing);
  await move(6615); expect((await read(frame)).hasKey).toBe(true);
  await page.screenshot({ path: info.outputPath('heal-middle-earned-key.png'), fullPage: true });
  for (const [launch, landing] of [[6600, 6000], [5760, 5170], [4920, 4380], [4150, 3640], [3520, 2940], [2680, 2100]]) await cross(launch, 'left', landing);
  await move(1800, true); await setInputs(['left', 'action']); await page.waitForTimeout(120); await setInputs(['left']);
  await waitFor(s => !!s.player && s.player.x <= 1400, 'same-height long gap'); await setInputs([]); await ground(1490); await healNearby();
  await cross(1140, 'left', 500); await exitDoor();
  expect((await read(frame)).summary?.level).toBe(4);
  await page.screenshot({ path: info.outputPath('heal-middle-earned-exit.png'), fullPage: true });

  await selectFixtureLevel(5); await ground(1490);
  for (const [launch, y] of [[3480, 1280], [3830, 1070], [4320, 860], [4600, 650]]) { await move(launch); await jump('right', y); }
  await move(5040, true); expect((await read(frame)).hasGun).toBe(true); await healNearby();
  await page.screenshot({ path: info.outputPath('heal-final-earned-guarded-gun.png'), fullPage: true });
  await drop(4770, 860); await drop(4870, 1070); await move(5200, true); await drop(5310, 1280); await drop(5600, 1490);
  await cross(5860, 'right', 6500); await move(6615); expect((await read(frame)).hasKey).toBe(true);
  for (const [launch, landing] of [[6600, 6000], [5760, 5170], [4920, 4380], [4080, 3640], [3520, 2940], [2680, 2100]]) await cross(launch, 'left', landing);
  await move(1800, true); await setInputs(['left', 'action']); await page.waitForTimeout(120); await setInputs(['left']);
  await waitFor(s => !!s.player && s.player.x <= 1400, 'final same-height long gap'); await setInputs([]); await ground(1490); await healNearby();
  await cross(1140, 'left', 500); await exitDoor();
  state = await read(frame); expect(state.summary?.level).toBe(6); expect(state.availableLevel).toBe(7);
  await frame.getByRole('button', { name: '查看旅程结局', exact: true }).click();
  await expect(frame.getByLabel('完整旅程结局', { exact: true })).toBeVisible();
  expect((await read(frame)).phase).toBe('ending');
  await page.screenshot({ path: info.outputPath('heal-final-earned-ending.png'), fullPage: true });
  await page.getByRole('button', { name: '返回游戏大厅', exact: true }).click();
  expect(page.frames().some(f => f.url().includes('/heal-em-all/'))).toBe(false);
  await openGame(page, '治愈所有人'); await chooseLevel(page, 5);
  await expect(page.locator('[data-heal-ready]')).toHaveAttribute('data-heal-ready', 'true');
  frame = page.frames().find(f => f.url().includes('/heal-em-all/index.html'))!;
  await waitFor(s => s.phase === 'playing', 'reentry');
  expect((await read(frame)).hasKey).toBe(false);
  if (mobile) {
    await page.setViewportSize({ width: 320, height: 760 });
    await frame.getByRole('button', { name: '暂停冒险', exact: true }).click();
    await page.screenshot({ path: info.outputPath('heal-320px-touch-controls.png'), fullPage: true });
  } else {
    await frame.locator('canvas').focus(); await setInputs(['right']);
    await page.getByRole('button', { name: '提示', exact: true }).focus();
    await waitFor(s => s.paused && Object.values(s.inputs).every(v => !v), 'blur cancels held input');
    await page.keyboard.up('ArrowRight'); pressed = [];
  }
  await page.getByRole('button', { name: '返回游戏大厅', exact: true }).click();
  // Change the real host pause while data is still loading. The selected,
  // already-earned stage must initialize with no autonomous gameplay elapsed.
  let releasePausedLoad: (() => void) | undefined;
  const pausedLoad = new Promise<void>(resolve => { releasePausedLoad = resolve; });
  await page.route('**/heal-em-all/data/level6.tmx', async route => { await pausedLoad; await route.continue().catch(() => {}); });
  await openGame(page, '治愈所有人'); await chooseLevel(page, 5);
  await expect(page.locator('[data-heal-ready]')).toHaveAttribute('data-heal-ready', 'false');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  releasePausedLoad!();
  await expect(page.locator('[data-heal-ready]')).toHaveAttribute('data-heal-ready', 'true');
  frame = page.frames().find(f => f.url().includes('/heal-em-all/index.html'))!;
  const loadedPaused = await waitFor(s => s.phase === 'playing' && s.paused, 'host pause received before initial stage');
  expect(loadedPaused.elapsed).toBe(0);
  await page.waitForTimeout(200);
  expect((await read(frame)).elapsed).toBe(0);
  expect((await read(frame)).player).toEqual(loadedPaused.player);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await waitFor(s => !s.paused && s.elapsed > 0, 'host resumes the initialized stage');
  await page.unroute('**/heal-em-all/data/level6.tmx');
  await page.getByRole('button', { name: '返回游戏大厅', exact: true }).click();
  // Delay one real local data request, then leave while the iframe is loading.
  let releaseLoad: (() => void) | undefined;
  const delayedLoad = new Promise<void>(resolve => { releaseLoad = resolve; });
  await page.route('**/heal-em-all/data/level6.tmx', async route => { await delayedLoad; await route.continue().catch(() => {}); });
  await openGame(page, '治愈所有人');
  await page.getByRole('button', { name: '返回游戏大厅', exact: true }).click();
  releaseLoad!(); await page.waitForTimeout(150); await page.unroute('**/heal-em-all/data/level6.tmx');
  expect(page.frames().some(f => f.url().includes('/heal-em-all/'))).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('playgarden.heal-unrelated'))).toBe('keep');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]); expect(outside).toEqual([]);
});
