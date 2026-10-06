import { test, expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { blackboxLevels } from '../src/games/blackboxLevels';
import { BLACKBOX_RESUME_KEY } from '../src/games/blackboxStorage';
import { STORAGE_KEY } from '../src/lib/progress';

type Certificate = { id: string; probeTrace: { port: number; result: number }[] };
const certificates = JSON.parse(readFileSync('docs/blackbox/campaign.json', 'utf8')).levels as Certificate[];
const marks = (page: Page) => page.locator('[data-blackbox-cell]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-mark'))));
const results = (page: Page) => page.locator('[data-blackbox-port]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-result')));
const activate = (control: Locator, touch: boolean) => touch ? control.tap() : control.click();

test('Blackbox level 84 proves public base/assets and resumes real evidence before earning completion', async ({ page, baseURL, isMobile }, info) => {
  const index = 83, level = blackboxLevels[index], proof = certificates[index], base = new URL(baseURL!);
  const errors: string[] = [], failedNetwork: string[] = [], loadedAssets = new Set<string>();
  const validatedAssetMimes = new Map<string, string>();
  await page.addInitScript(() => {
    (window as unknown as { blackboxCspViolations: string[] }).blackboxCspViolations = [];
    document.addEventListener('securitypolicyviolation', event => {
      (window as unknown as { blackboxCspViolations: string[] }).blackboxCspViolations.push(`${event.violatedDirective}: ${event.blockedURI}`);
    });
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => failedNetwork.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', response => {
    const url = new URL(response.url()); if (url.origin !== base.origin) return;
    if (response.status() >= 400) failedNetwork.push(`${response.status()} ${url.pathname}`);
    const extension = url.pathname.match(/\.(css|js|svg|webp)$/)?.[1]; if (!extension) return;
    loadedAssets.add(url.pathname);
    if (!url.pathname.startsWith(base.pathname)) failedNetwork.push(`Asset outside public base: ${url.pathname}`);
    // Revalidation has no body and may omit Content-Type. Only an independently
    // validated 200 response from this exact URL authorizes reusing its MIME.
    if (response.status() === 304) {
      if (!validatedAssetMimes.has(response.url())) failedNetwork.push(`Unvalidated 304 asset: ${url.pathname}`);
      return;
    }
    const mime = response.headers()['content-type'] || '';
    const valid = extension === 'css' ? mime.includes('text/css') : extension === 'js' ? /(?:text|application)\/javascript/.test(mime) : extension === 'svg' ? mime.includes('image/svg+xml') : mime.includes('image/webp');
    if (!valid) failedNetwork.push(`Invalid ${extension} MIME ${mime}: ${url.pathname}`);
    else if (response.status() === 200) validatedAssetMimes.set(response.url(), mime);
  });
  const response = await page.goto('./'); expect(response?.status()).toBe(200);
  expect(response?.headers()['content-type']).toContain('text/html'); expect(new URL(page.url()).pathname).toBe(base.pathname);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /width=device-width/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Playgarden/);
  const verifyCommit = async () => {
    if (process.env.GITHUB_SHA) {
      expect(process.env.GITHUB_SHA).toMatch(/^[a-f\d]{40}$/);
      await expect(page.locator('meta[name="playgarden-commit"]')).toHaveAttribute('content', process.env.GITHUB_SHA);
    }
  };
  await verifyCommit();
  const decodeImage = async (url: string, mime: string) => {
    const resolved = new URL(url, page.url()); expect(resolved.origin).toBe(base.origin); expect(resolved.pathname.startsWith(base.pathname)).toBe(true);
    const fetched = await page.request.get(resolved.href); expect(fetched.status()).toBe(200); expect(fetched.headers()['content-type']).toContain(mime);
    await page.evaluate(async source => { const image = new Image(); image.src = source; await image.decode(); if (!image.naturalWidth || !image.naturalHeight) throw new Error('Image has no decoded pixels'); }, resolved.href);
  };
  const icon = await page.locator('link[rel="icon"]').getAttribute('href'); expect(icon).toBeTruthy(); await decodeImage(icon!, 'image/svg+xml');
  await page.getByRole('textbox', { name: '搜索游戏' }).fill('星雾探测');
  const artwork = page.getByRole('button', { name: '开始玩星雾探测', exact: true });
  const background = await artwork.evaluate(node => getComputedStyle(node).backgroundImage), imageURL = background.match(/url\(["']?(.+?)["']?\)/)?.[1];
  expect(imageURL).toBeTruthy(); await decodeImage(imageURL!, 'image/webp');
  await page.screenshot({ path: info.outputPath('pages-blackbox-discovery.png'), fullPage: true, animations: 'disabled' });
  const ready = async () => {
    await expect(page.locator('.game-surface .loading')).toHaveCount(0);
    await expect(page.locator('[data-blackbox-cell]')).toHaveCount(level.size ** 2);
    await expect(page.locator('[data-blackbox-port]')).toHaveCount(level.size * 4);
    await expect(page.getByRole('heading', { name: level.title, exact: true })).toBeVisible();
    await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue(String(index)); await expect(page.locator('.module-error')).toHaveCount(0);
  };
  const enter = async () => {
    await page.getByRole('textbox', { name: '搜索游戏' }).fill('星雾探测');
    await activate(page.getByRole('button', { name: '开始玩星雾探测', exact: true }), isMobile);
    await expect(page.locator('.game-main')).toHaveAttribute('data-game', 'blackbox');
  };
  const accessibleControls = async () => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const failures = await page.locator('.game-main button, .game-main select, .game-main summary, .game-main a[href]').evaluateAll(nodes => nodes.flatMap(node => {
      const box = node.getBoundingClientRect(); if (!box.width && !box.height) return [];
      return box.width >= 44 && box.height >= 44 && box.left >= 0 && box.right <= innerWidth ? [] : [{ text: node.getAttribute('aria-label') || node.textContent, width: box.width, height: box.height, left: box.left, right: box.right }];
    })); expect(failures).toEqual([]);
    const active = page.locator('.game-main button:not(:disabled), .game-main select, .game-main summary, .game-main a[href]');
    for (let i = 0; i < await active.count(); i++) {
      const target = active.nth(i); if (!await target.isVisible()) continue;
      await target.scrollIntoViewIfNeeded(); await expect(target).toBeInViewport(); await target.click({ trial: true });
    }
  };
  const fire = async (step: number) => {
    const probe = proof.probeTrace[step], target = page.locator(`[data-blackbox-port="${probe.port}"]`), previous = await marks(page);
    await activate(target, isMobile); await expect(target).toHaveAttribute('data-result', String(probe.result));
    if (probe.result >= 0) await expect(page.locator(`[data-blackbox-port="${probe.result}"]`)).toHaveAttribute('data-result', String(probe.port));
    await expect(page.locator('[data-blackbox-shots]')).toHaveAttribute('data-blackbox-shots', String(step + 1)); expect(await marks(page)).toEqual(previous);
  };

  await enter(); await page.getByLabel('选择关卡', { exact: true }).selectOption(String(index)); await ready();
  expect(proof.id).toBe(level.id); await expect(page.getByLabel('选择关卡', { exact: true }).locator('option')).toHaveCount(84);
  expect(await marks(page)).toEqual(Array(level.size ** 2).fill(0)); await accessibleControls();
  await page.screenshot({ path: info.outputPath('pages-blackbox-84-start.png'), fullPage: true, animations: 'disabled' });
  const midpoint = Math.floor(proof.probeTrace.length / 2); expect(midpoint).toBeGreaterThan(0); expect(midpoint).toBeLessThan(proof.probeTrace.length);
  for (let step = 0; step < midpoint; step++) await fire(step);
  const firstAtom = level.atoms[0]; await activate(page.locator(`[data-blackbox-cell="${firstAtom}"]`), isMobile);
  const current = await marks(page), measured = await results(page);
  await expect(page.locator('[data-blackbox-won]')).toHaveAttribute('data-blackbox-won', 'false');
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), `${BLACKBOX_RESUME_KEY}.round.${index}`);
  expect(stored.id).toBe(level.id); expect(stored.submitted).toBe(false); expect(stored.marks).toEqual(current);
  expect(stored.history).toEqual([{ cell: firstAtom, before: 0, after: 1 }]); expect(stored.probes).toEqual(proof.probeTrace.slice(0, midpoint).map(({ port, result }) => ({ port, result })));
  expect(await page.evaluate(() => (window as unknown as { blackboxCspViolations: string[] }).blackboxCspViolations)).toEqual([]);

  const refreshed = await page.reload(); expect(refreshed?.status()).toBe(200); await verifyCommit(); await enter(); await ready();
  // Only compare restored arrays after the real lazy board exists.
  expect(await marks(page)).toEqual(current); expect(await results(page)).toEqual(measured);
  await expect(page.locator('[data-blackbox-shots]')).toHaveAttribute('data-blackbox-shots', String(midpoint));
  await activate(page.getByRole('button', { name: '撤销', exact: true }), isMobile);
  await expect.poll(() => marks(page)).toEqual(Array(level.size ** 2).fill(0)); expect(await results(page)).toEqual(measured);
  await activate(page.locator(`[data-blackbox-cell="${firstAtom}"]`), isMobile); expect(await marks(page)).toEqual(current);
  await accessibleControls(); await page.screenshot({ path: info.outputPath('pages-blackbox-84-resumed.png'), fullPage: true, animations: 'disabled' });
  for (let step = midpoint; step < proof.probeTrace.length; step++) await fire(step);
  for (const atom of level.atoms.slice(1)) await activate(page.locator(`[data-blackbox-cell="${atom}"]`), isMobile);
  const verify = page.locator('[data-blackbox-verify]'); await expect(verify).toBeEnabled(); await activate(verify, isMobile);
  await expect(page.locator('[data-blackbox-won]')).toHaveAttribute('data-blackbox-won', 'true'); await expect(page.locator('.status')).toHaveClass(/success/);
  await expect(page.getByRole('button', { name: '返回大厅', exact: true })).toBeFocused();
  const expected = Array.from({ length: level.size ** 2 }, (_, i) => level.atoms.includes(i) ? 1 : 0); expect(await marks(page)).toEqual(expected);
  const earnedOnce = async () => expect.poll(() => page.evaluate(({ key, index }) => (JSON.parse(localStorage.getItem(key)!).completed.blackbox as number[]).filter(value => value === index).length, { key: STORAGE_KEY, index })).toBe(1);
  await earnedOnce(); await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled(); await expect(verify).toBeDisabled();
  await expect(page.locator('[data-blackbox-cell]:not(:disabled), [data-blackbox-port]:not(:disabled), [data-blackbox-tool]:not(:disabled)')).toHaveCount(0);
  await activate(page.getByRole('button', { name: '提示', exact: true }), isMobile); expect(await marks(page)).toEqual(expected); await earnedOnce();
  await accessibleControls(); await page.screenshot({ path: info.outputPath('pages-blackbox-84-completed.png'), fullPage: true, animations: 'disabled' });
  await activate(page.getByRole('button', { name: '返回大厅', exact: true }), isMobile); await expect(page.getByRole('textbox', { name: '搜索游戏' })).toBeVisible();
  expect([...loadedAssets].some(path => path.endsWith('.js'))).toBe(true); expect([...loadedAssets].some(path => path.endsWith('.css'))).toBe(true);
  expect([...loadedAssets].every(path => path.startsWith(base.pathname))).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { blackboxCspViolations: string[] }).blackboxCspViolations)).toEqual([]);
  expect(errors).toEqual([]); expect(failedNetwork).toEqual([]);
});
