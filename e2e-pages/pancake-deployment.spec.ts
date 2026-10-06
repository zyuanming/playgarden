import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { pancakeLevels } from '../src/games/pancakeLevels';
import { PANCAKE_RESUME_KEY } from '../src/games/pancakeStorage';
import { STORAGE_KEY } from '../src/lib/progress';

const certificates = JSON.parse(readFileSync('docs/pancake/campaign.json', 'utf8')).levels as { id: string; solution: number[] }[];
const stack = (page: Page) => page.locator('[data-pancake-slot]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-size'))));
const reversePrefix = (values: number[], count: number) => values.map((_, i) => values[i < count ? count - 1 - i : i]);
// Wait for the visible React commit, retaining the full ordered-stack assertion.
const expectStack = (page: Page, expected: number[]) => expect.poll(() => stack(page)).toEqual(expected);

test('Pancake level 120 survives public-path midgame reload and earns real completion', async ({ page, baseURL }, info) => {
  const index = 119, level = pancakeLevels[index], proof = certificates[index], base = new URL(baseURL!);
  const errors: string[] = [], failedNetwork: string[] = [];
  const validatedAssetMimes = new Map<string, string>();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => failedNetwork.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin !== base.origin) return;
    if (response.status() >= 400) failedNetwork.push(`${response.status()} ${url.pathname}`);
    const css = url.pathname.endsWith('.css'), js = url.pathname.endsWith('.js');
    if (!css && !js) return;
    // A 304 has no resource body and may omit Content-Type. Reuse only a MIME
    // already verified on this exact URL's 200 response in this browser session.
    if (response.status() === 304) {
      if (!validatedAssetMimes.has(response.url())) failedNetwork.push(`Unvalidated 304 asset: ${url.pathname}`);
      return;
    }
    const mime = response.headers()['content-type'] || '';
    const valid = css ? mime.includes('text/css') : /(?:text|application)\/javascript/.test(mime);
    if (!valid) failedNetwork.push(`Invalid ${css ? 'CSS' : 'JS'} MIME ${mime}: ${url.pathname}`);
    else if (response.status() === 200) validatedAssetMimes.set(response.url(), mime);
  });
  const response = await page.goto('./'); expect(response?.status()).toBe(200);
  expect(new URL(page.url()).pathname.startsWith(base.pathname)).toBe(true);
  const verifyCommit = async () => {
    if (process.env.GITHUB_SHA) {
      expect(process.env.GITHUB_SHA).toMatch(/^[a-f\d]{40}$/);
      await expect(page.locator('meta[name="playgarden-commit"]')).toHaveAttribute('content', process.env.GITHUB_SHA);
    }
  };
  await verifyCommit();
  const ready = async () => {
    await expect(page.locator('.game-surface .loading')).toHaveCount(0);
    await expect(page.locator('[data-pancake-slot]')).toHaveCount(level.stack.length);
    await expect(page.locator('.pancake-heading h3')).toHaveText(level.title);
    await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue(String(index));
    await expect(page.locator('.module-error')).toHaveCount(0);
  };
  const enter = async () => {
    await page.getByRole('textbox', { name: '搜索游戏' }).fill('煎饼翻排');
    await page.getByRole('button', { name: '开始玩煎饼翻排', exact: true }).click();
    await expect(page.locator('.game-main')).toHaveAttribute('data-game', 'pancake');
  };
  const clickMove = async (count: number) => {
    const before = await stack(page), target = page.locator(`[data-pancake-flip="${count}"]`);
    await target.click(); expect(await stack(page)).toEqual(before);
    await expect(target).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('img', { name: `翻转后从上到下：${reversePrefix(before, count).join('、')}` })).toBeVisible();
    await page.getByRole('button', { name: /^确认翻转/ }).click();
    await expectStack(page, reversePrefix(before, count));
  };
  const accessibleControls = async () => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const failures = await page.locator('.game-main button, .game-main select, .game-main summary').evaluateAll(nodes => nodes.flatMap(node => {
      const box = node.getBoundingClientRect();
      return box.width >= 44 && box.height >= 44 && box.left >= 0 && box.right <= innerWidth ? [] : [{ text: node.getAttribute('aria-label') || node.textContent, width: box.width, height: box.height, left: box.left, right: box.right }];
    }));
    expect(failures).toEqual([]);
    const active = page.locator('.game-main button:not(:disabled), .game-main select, .game-main summary');
    for (let i = 0; i < await active.count(); i++) {
      await active.nth(i).scrollIntoViewIfNeeded(); await expect(active.nth(i)).toBeInViewport();
      await active.nth(i).click({ trial: true });
    }
  };

  await enter(); await page.getByLabel('选择关卡', { exact: true }).selectOption(String(index)); await ready();
  await expect(page.getByLabel('选择关卡', { exact: true }).locator('option')).toHaveCount(120);
  expect(proof.id).toBe(level.id); expect(await stack(page)).toEqual(level.stack);
  await accessibleControls();
  await page.screenshot({ path: info.outputPath('pages-pancake-120-start.png'), fullPage: true, animations: 'disabled' });
  const midpoint = Math.floor(proof.solution.length / 2);
  expect(midpoint).toBeGreaterThan(0); expect(midpoint).toBeLessThan(proof.solution.length);
  for (const count of proof.solution.slice(0, midpoint)) await clickMove(count);
  const current = await stack(page);
  await expect(page.locator('[data-pancake-won]')).toHaveAttribute('data-pancake-won', 'false');
  await expect(page.locator('[data-pancake-moves]')).toHaveText(String(midpoint));
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), `${PANCAKE_RESUME_KEY}.round.${index}`);
  expect(stored.id).toBe(level.id); expect(stored.history).toHaveLength(midpoint); expect(stored.stack).toEqual(current);

  const refreshed = await page.reload(); expect(refreshed?.status()).toBe(200); await verifyCommit();
  await enter(); await ready();
  expect(await stack(page)).toEqual(current); await expect(page.locator('[data-pancake-moves]')).toHaveText(String(midpoint));
  // Prove that the refreshed history is functional through the visible undo and flip controls.
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expectStack(page, stored.history[midpoint - 1]);
  await clickMove(proof.solution[midpoint - 1]); expect(await stack(page)).toEqual(current);
  await accessibleControls();
  await page.screenshot({ path: info.outputPath('pages-pancake-120-resumed.png'), fullPage: true, animations: 'disabled' });
  for (const count of proof.solution.slice(midpoint)) await clickMove(count);

  expect(await stack(page)).toEqual(Array.from({ length: level.stack.length }, (_, i) => i + 1));
  await expect(page.locator('[data-pancake-won]')).toHaveAttribute('data-pancake-won', 'true');
  await expect(page.locator('.status')).toHaveClass(/success/);
  await expect(page.getByRole('button', { name: '返回大厅', exact: true })).toBeFocused();
  const completed = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).completed.pancake as number[], STORAGE_KEY);
  expect(completed.filter(value => value === index)).toHaveLength(1);
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: /^确认翻转/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: '取消选择', exact: true })).toBeDisabled();
  for (let count = 2; count <= level.stack.length; count++) await expect(page.locator(`[data-pancake-flip="${count}"]`)).toBeDisabled();
  await accessibleControls();
  await page.screenshot({ path: info.outputPath('pages-pancake-120-completed.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: '返回大厅', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '搜索游戏' })).toBeVisible();
  expect(errors).toEqual([]); expect(failedNetwork).toEqual([]);
});
