import { test, expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openGame, chooseLevel, captureErrors } from './helpers';
import { pancakeChapters, pancakeLevels } from '../src/games/pancakeLevels';
import { getPancakeHint } from '../src/games/pancakeLogic';
import { PANCAKE_RESUME_KEY } from '../src/games/pancakeStorage';
import { STORAGE_KEY } from '../src/lib/progress';

const certificates = JSON.parse(readFileSync('docs/pancake/campaign.json', 'utf8')).levels as { id: string; solution: number[] }[];
const layer = (page: Page, count: number) => page.locator(`[data-pancake-flip="${count}"]`);
const stack = (page: Page) => page.locator('[data-pancake-slot]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-size'))));
const reversePrefix = (values: number[], count: number) => values.map((_, i) => values[i < count ? count - 1 - i : i]);
// Shell undo tokens are applied by a React effect after the click has returned.
const expectStack = (page: Page, expected: number[]) => expect.poll(() => stack(page)).toEqual(expected);
const confirm = (page: Page) => page.getByRole('button', { name: /^确认翻转/ });
const cancel = (page: Page) => page.getByRole('button', { name: '取消选择', exact: true });
const checkpoints = new Set<number>();
let chapterStart = 0;
for (const chapter of pancakeChapters) {
  for (const offset of [0, Math.floor((chapter.count - 1) / 2), chapter.count - 1]) checkpoints.add(chapterStart + offset);
  chapterStart += chapter.count;
}
function errorsFor(page: Page) {
  const errors = captureErrors(page);
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => errors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`));
  return errors;
}
async function ready(page: Page, index: number) {
  await expect(page.locator('.game-surface .loading')).toHaveCount(0);
  await expect(page.locator('[data-pancake-slot]')).toHaveCount(pancakeLevels[index].stack.length);
  await expect(page.locator('.pancake-heading h3')).toHaveText(pancakeLevels[index].title);
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue(String(index));
}
async function realMove(page: Page, count: number) {
  const before = await stack(page); await layer(page, count).click();
  expect(await stack(page)).toEqual(before);
  await expect(layer(page, count)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('img', { name: `翻转后从上到下：${reversePrefix(before, count).join('、')}` })).toBeVisible();
  await confirm(page).click(); await expectStack(page, reversePrefix(before, count));
}
async function checkControlSizes(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const failures = await page.locator('.game-main button, .game-main select, .game-main summary').evaluateAll(nodes => nodes.flatMap(node => {
    const box = node.getBoundingClientRect();
    return box.width >= 44 && box.height >= 44 && box.left >= 0 && box.right <= innerWidth ? [] : [{ text: node.getAttribute('aria-label') || node.textContent, width: box.width, height: box.height, left: box.left, right: box.right }];
  }));
  expect(failures).toEqual([]);
}
async function checkControlReachability(page: Page) {
  await checkControlSizes(page);
  const controls = page.locator('.game-main button:not(:disabled), .game-main select, .game-main summary');
  for (let i = 0; i < await controls.count(); i++) {
    const control = controls.nth(i);
    await control.scrollIntoViewIfNeeded(); await expect(control).toBeInViewport();
    await control.click({ trial: true });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function enterAfterReload(page: Page, index: number) {
  await page.getByRole('textbox', { name: '搜索游戏' }).fill('煎饼翻排');
  await page.getByRole('button', { name: '开始玩煎饼翻排', exact: true }).click();
  // The shell appears before the lazy-loaded module; never accept an empty list as a restored stack.
  await ready(page, index);
}

for (let start = 0; start < 120; start += 5) test(`Pancake genuine completion ${start + 1}–${start + 5}`, async ({ page }, info) => {
  const errors = errorsFor(page);
  await openGame(page, '煎饼翻排'); await chooseLevel(page, start); await ready(page, start);
  await expect(page.getByLabel('选择关卡', { exact: true }).locator('option')).toHaveCount(120);
  for (let index = start; index < start + 5; index++) {
    const level = pancakeLevels[index], proof = certificates[index];
    expect(proof.id).toBe(level.id); await ready(page, index);
    expect(await stack(page)).toEqual(level.stack);
    await expect(page.locator('[data-pancake-chapter]')).toHaveAttribute('data-pancake-chapter', String(level.chapter));
    await expect(page.locator('[data-pancake-moves]')).toHaveText('0');
    await checkControlSizes(page);
    if (checkpoints.has(index)) {
      await checkControlReachability(page);
      await page.screenshot({ path: info.outputPath(`pancake-${index + 1}-start.png`), fullPage: true, animations: 'disabled' });
    }
    for (const [step, count] of proof.solution.entries()) {
      const before = await stack(page); await layer(page, count).click();
      expect(await stack(page)).toEqual(before);
      await expect(layer(page, count)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('[data-in-range="true"]')).toHaveCount(count);
      await expect(page.getByRole('img', { name: `翻转后从上到下：${reversePrefix(before, count).join('、')}` })).toBeVisible();
      await expect(page.locator('[data-pancake-moves]')).toHaveText(String(step));
      if (checkpoints.has(index) && step === 0) {
        await checkControlSizes(page);
        await page.screenshot({ path: info.outputPath(`pancake-${index + 1}-preview.png`), fullPage: true, animations: 'disabled' });
      }
      await confirm(page).click();
      await expectStack(page, reversePrefix(before, count));
      await expect(page.locator('[data-pancake-moves]')).toHaveText(String(step + 1));
    }
    expect(await stack(page)).toEqual(Array.from({ length: level.stack.length }, (_, i) => i + 1));
    await expect(page.locator('[data-pancake-won]')).toHaveAttribute('data-pancake-won', 'true');
    await expect(page.locator('.status')).toHaveClass(/success/);
    const advance = page.getByRole('button', { name: index < 119 ? '下一关' : '返回大厅', exact: true });
    await expect(advance).toBeFocused();
    const earned = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).completed.pancake as number[], STORAGE_KEY);
    expect(earned.filter(item => item === index)).toHaveLength(1);
    for (let count = 2; count <= level.stack.length; count++) await expect(layer(page, count)).toBeDisabled();
    await expect(confirm(page)).toBeDisabled(); await expect(cancel(page)).toBeDisabled();
    await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
    // The shell still exposes a hint button after success; its token must not unlock the board.
    await page.getByRole('button', { name: '提示', exact: true }).click();
    expect(await stack(page)).toEqual(Array.from({ length: level.stack.length }, (_, i) => i + 1));
    await expect(confirm(page)).toBeDisabled(); await expect(page.locator('.status')).toHaveClass(/success/);
    if (checkpoints.has(index)) {
      await checkControlReachability(page);
      await page.screenshot({ path: info.outputPath(`pancake-${index + 1}-won.png`), fullPage: true, animations: 'disabled' });
    }
    await advance.click();
    if (index < 119) {
      await ready(page, index + 1);
      await expect(page.getByRole('heading', { name: '煎饼翻排', exact: true })).toBeFocused();
    } else await expect(page.getByRole('textbox', { name: '搜索游戏' })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

type KeyRecord = { key: string; modified: boolean; prevented: boolean; keptFocus: boolean };
async function observeKeys(target: Locator) {
  await target.evaluate(node => {
    const records: { key: string; modified: boolean; prevented: boolean; keptFocus: boolean }[] = [];
    (window as unknown as { pancakeKeyLog: typeof records }).pancakeKeyLog = records;
    window.addEventListener('keydown', event => {
      // Read after React's root listener has applied the guard, without changing game state.
      if (event.target === node) records.push({ key: event.key, modified: event.ctrlKey || event.metaKey || event.altKey, prevented: event.defaultPrevented, keptFocus: document.activeElement === node });
    });
  });
}
for (const index of [0, 59, 119]) test(`Pancake ${index + 1} genuine keyboard, modifiers, focus and terminal lock`, async ({ page }, info) => {
  const errors = errorsFor(page), proof = certificates[index];
  await openGame(page, '煎饼翻排'); await chooseLevel(page, index); await ready(page, index);
  const original = await stack(page), count = proof.solution[0], target = layer(page, count);
  await target.focus(); await expect(target).toBeFocused(); await observeKeys(target);
  for (const modifier of ['Control', 'Meta', 'Alt']) for (const key of ['Enter', 'Space', 'ArrowUp', 'ArrowDown', 'Home', 'End']) {
    await target.press(`${modifier}+${key}`);
    await expect(target).toBeFocused(); expect(await stack(page)).toEqual(original);
    await expect(target).toHaveAttribute('aria-pressed', 'false');
    const observed = await page.evaluate(wanted => (window as unknown as { pancakeKeyLog: KeyRecord[] }).pancakeKeyLog.filter(record => record.modified && record.key === wanted).at(-1), key === 'Space' ? ' ' : key);
    expect(observed).toEqual({ key: key === 'Space' ? ' ' : key, modified: true, prevented: ['Enter', 'Space'].includes(key), keptFocus: true });
  }
  await target.press('Home'); await expect(layer(page, 2)).toBeFocused();
  await page.keyboard.press('ArrowUp'); await expect(layer(page, 2)).toBeFocused();
  await page.keyboard.press('End'); await expect(layer(page, original.length)).toBeFocused();
  await page.keyboard.press('ArrowDown'); await expect(layer(page, original.length)).toBeFocused();
  await page.keyboard.press('ArrowUp'); await expect(layer(page, original.length - 1)).toBeFocused();
  await target.focus(); await target.press('Enter');
  expect(await stack(page)).toEqual(original); await expect(target).toHaveAttribute('aria-pressed', 'true');
  for (const button of [confirm(page), cancel(page)]) for (const modifier of ['Control', 'Meta', 'Alt'] as const) {
    await button.focus(); await expect(button).toBeFocused();
    await button.press(`${modifier}+Enter`); await button.press(`${modifier}+Space`);
    await button.click({ modifiers: [modifier] });
    expect(await stack(page)).toEqual(original); await expect(target).toHaveAttribute('aria-pressed', 'true');
    await expect(button).toBeFocused();
  }
  await cancel(page).click(); expect(await stack(page)).toEqual(original); await expect(target).toBeFocused();
  await page.keyboard.press('Space'); await expect(target).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: info.outputPath(`pancake-${index + 1}-keyboard-preview.png`), fullPage: true, animations: 'disabled' });
  await page.keyboard.press('Space'); await expectStack(page, reversePrefix(original, count));
  if (proof.solution.length > 1) await expect(target).toBeFocused();
  for (const next of proof.solution.slice(1)) await realMove(page, next);
  await expect(page.locator('[data-pancake-won]')).toHaveAttribute('data-pancake-won', 'true');
  await expect(page.locator('.status')).toHaveClass(/success/);
  await expect(layer(page, 2)).toBeDisabled(); await expect(confirm(page)).toBeDisabled();
  await page.getByRole('button', { name: '重来', exact: true }).click(); await ready(page, index);
  await expectStack(page, original); await expect(target).toBeEnabled();
  await expect(page.locator('.status')).not.toHaveClass(/success/);
  expect(errors).toEqual([]);
});

// The first two levels take one move. Use the first >=2-move lesson for interruption/undo.
for (const index of [2, 59, 119]) test(`Pancake ${index + 1} pause, current-state hints, undo, reload, restart and switching`, async ({ page }, info) => {
  const errors = errorsFor(page), level = pancakeLevels[index], proof = certificates[index];
  expect(proof.solution.length).toBeGreaterThan(1);
  await openGame(page, '煎饼翻排'); await chooseLevel(page, index); await ready(page, index);
  const original = await stack(page), count = proof.solution[0], target = layer(page, count);
  await target.focus(); await target.press('Enter');
  for (const modifier of ['Control', 'Meta', 'Alt']) {
    await target.press(`${modifier}+Escape`);
    await expect(page.getByRole('button', { name: '暂停', exact: true })).toBeVisible();
    await expect(target).toBeFocused();
  }
  await target.press('Escape'); await expect(target).toBeDisabled(); await expect(confirm(page)).toBeDisabled();
  await expect(page.getByRole('button', { name: '提示', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
  expect(await stack(page)).toEqual(original);
  await page.screenshot({ path: info.outputPath(`pancake-${index + 1}-paused.png`), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  expect(await stack(page)).toEqual(original); await expect(target).toHaveAttribute('aria-pressed', 'true');
  await target.press('Enter'); await expectStack(page, reversePrefix(original, count));
  const current = await stack(page); await expect(target).toBeFocused();
  const hint = getPancakeHint(current); expect(hint.kind).toBe('move');
  await page.getByRole('button', { name: '提示', exact: true }).click();
  expect(await stack(page)).toEqual(current); await expect(page.locator('[data-pancake-moves]')).toHaveText('1');
  await expect(page.locator('[data-pancake-hint]')).toHaveAttribute('data-pancake-hint', 'move');
  if (hint.kind === 'move') {
    await expect(layer(page, hint.count)).toHaveAttribute('aria-pressed', 'true');
    await expect(layer(page, hint.count)).toBeFocused();
    await expect(page.locator('.pancake-message')).toHaveText(hint.reason);
  }
  await page.screenshot({ path: info.outputPath(`pancake-${index + 1}-current-hint.png`), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expectStack(page, original); await expect(confirm(page)).toBeDisabled();
  await realMove(page, count); expect(await stack(page)).toEqual(current);
  await page.reload(); await enterAfterReload(page, index);
  expect(await stack(page)).toEqual(current); await expect(page.locator('[data-pancake-moves]')).toHaveText('1');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), `${PANCAKE_RESUME_KEY}.round.${index}`);
  expect(saved.id).toBe(level.id); expect(saved.history).toEqual([original]);
  await page.getByRole('button', { name: '撤销', exact: true }).click(); await expectStack(page, original);
  await realMove(page, count);
  await page.getByRole('button', { name: '重来', exact: true }).click(); await ready(page, index);
  await expectStack(page, original); await expect(page.locator('[data-pancake-moves]')).toHaveText('0');
  await realMove(page, count);
  const other = index === 119 ? 2 : 119;
  await chooseLevel(page, other); await ready(page, other); await expectStack(page, pancakeLevels[other].stack);
  await chooseLevel(page, index); await ready(page, index); await expectStack(page, current);
  await page.getByRole('button', { name: '撤销', exact: true }).click(); await expectStack(page, original);
  const summary = page.locator('.pancake-notes summary');
  await summary.focus(); await summary.press('Enter'); await expect(page.locator('.pancake-notes details')).toHaveAttribute('open', '');
  await expect(page.getByText(/Tab 进入煎饼堆/)).toBeVisible();
  await summary.press('Enter'); await expect(page.locator('.pancake-notes details')).not.toHaveAttribute('open', '');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await checkControlReachability(page);
  expect(await layer(page, 2).evaluate(node => { const style = getComputedStyle(node); return style.transitionDuration.split(',').every(value => parseFloat(value) === 0) && style.animationDuration.split(',').every(value => parseFloat(value) === 0); })).toBe(true);
  expect(errors).toEqual([]);
});
