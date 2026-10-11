// SPDX-License-Identifier: GPL-3.0-only
import { expect, test, type Locator } from '@playwright/test';
import { captureErrors, chooseLevel, openGame } from './helpers';

test('32 original Diner puzzles: editor matching, alternatives, native transitions and ending', async ({ page }, info) => {
  test.setTimeout(120000);
  const mobile = info.project.name === 'mobile';
  const errors = captureErrors(page), outside: string[] = [];
  const origin = new URL(String(info.project.use.baseURL || 'http://127.0.0.1:4173')).origin;
  page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) outside.push(request.url()); });
  await openGame(page, 'CSS 选择器餐厅');
  const initialHost = await page.evaluate(() => ({ hash: location.hash, language: document.documentElement.lang, generic: ['currentLevel', 'progress'].map(key => localStorage.getItem(key)) }));
  const frame = page.frameLocator('iframe[title="CSS 选择器餐厅完整课程"]');
  const ready = () => expect(page.locator('[data-diner-ready]')).toHaveAttribute('data-diner-ready', 'true');
  const playable = () => expect(frame.getByRole('textbox', { name: 'CSS 选择器', exact: true })).toBeEnabled();
  const activate = async (locator: Locator) => { if (mobile) await locator.tap(); else await locator.click(); };
  const input = frame.getByRole('textbox', { name: 'CSS 选择器', exact: true });
  const typeSelector = async (text: string) => {
    await playable(); await activate(input); await input.press('ControlOrMeta+A'); await input.press('Backspace');
    await input.pressSequentially(text);
  };
  const run = async (text: string) => { await typeSelector(text); await activate(frame.getByRole('button', { name: '运行选择器', exact: true })); };
  const completed = () => page.evaluate(() => JSON.parse(localStorage.getItem('playgarden.progress.v2') || '{}').completed?.['css-diner'] || []);
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('playgarden.css-diner.v1.state') || '{}'));
  const choose = async (index: number) => { await chooseLevel(page, index); await ready(); };
  const screenshot = async (name: string) => { await page.screenshot({ path: info.outputPath(name), fullPage: true }); };
  const pauseHost = async () => {
    await activate(page.getByRole('button', { name: '暂停', exact: true }));
    await expect(page.locator('.pause-overlay')).toBeVisible();
  };
  const resumeHost = async () => {
    await activate(page.getByRole('button', { name: '继续游戏', exact: true }));
    await expect(page.locator('.pause-overlay')).toHaveCount(0);
  };
  await ready(); await playable();
  await expect(page.getByLabel('选择关卡', { exact: true }).locator('option')).toHaveCount(32);
  await expect(frame.locator('.table plate')).toHaveCount(2);
  await expect(frame.locator('.order')).toHaveText('选中所有盘子');
  await activate(frame.locator('.table plate').first());
  await expect(frame.locator('.helper')).toContainText('<plate');
  await activate(frame.locator('#original-help summary'));
  await expect(frame.locator('#original-help-content')).toContainText('Select elements by their type');
  await activate(frame.locator('#original-help summary'));
  await screenshot('diner-first-original-board.png');

  await run('bento');
  await activate(frame.locator('#pause-game'));
  await expect(frame.locator('#result')).toContainText('还不对');
  expect(await completed()).toEqual([]);
  await page.waitForTimeout(650);
  await expect(page.locator('[data-diner-phase]')).toHaveAttribute('data-diner-phase', 'incorrect');
  await expect(input).toBeDisabled();
  await activate(frame.locator('#resume-game')); await playable();
  await run('[for*=]');
  await expect(frame.locator('#result')).toContainText('还不对');
  expect(await completed()).toEqual([]);
  // A genuinely equivalent selector, deliberately different from authored "plate".
  await run('plate:nth-child(n)');
  // Cross the real host/iframe pause boundary immediately after real input.
  // An accepted check must reach shared history after resume even if its
  // completion message was delivered while the host was already paused.
  await pauseHost();
  await expect.poll(async () => (await saved()).guessHistory?.[0]?.correct).toBe(true);
  await page.waitForTimeout(1150);
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue('0');
  await resumeHost();
  await expect.poll(completed).toEqual([0]);
  await activate(frame.locator('#pause-game'));
  await expect(frame.locator('#paused-cover')).toBeVisible();
  await expect(input).toBeDisabled();
  await page.waitForTimeout(1150);
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue('0');
  await screenshot('diner-first-earned-paused-transition.png');
  await activate(frame.locator('#resume-game'));
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue('1');
  await ready(); await playable();

  // Numeric native navigation uses the editor and never grants completion.
  await run('17');
  await pauseHost(); await resumeHost();
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue('16');
  await ready(); await playable();
  expect(await completed()).toEqual([0]);
  await expect(frame.locator('.table .small')).toHaveCount(3);
  // Same count as the target, but one different DOM element. Must fail.
  await expect(frame.locator('.table .strobe')).toHaveCount(2);
  await expect(frame.locator('.table plate:nth-child(1) apple, .table plate:nth-child(3) orange.small')).toHaveCount(2);
  await run('plate:nth-child(1) apple, plate:nth-child(3) orange.small');
  await expect(frame.locator('#result')).toContainText('还不对');
  expect(await completed()).toEqual([0]);
  await playable();
  await typeSelector('.small:last');
  await activate(frame.locator('#retry-game'));
  await playable(); await expect(input).toHaveValue('');
  await screenshot('diner-middle-original-board-and-editor.png');
  await run('.small:last-child');
  await expect.poll(completed).toEqual([0, 16]);
  await activate(frame.locator('#pause-game'));
  await screenshot('diner-middle-earned-paused-transition.png');
  await activate(frame.locator('#resume-game'));
  // Pause across the native next-level timer and repeat resume/pause. Neither
  // in-flight navigation nor completion may be discarded or applied twice.
  await pauseHost();
  await page.waitForTimeout(1150);
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue('16');
  await resumeHost(); await pauseHost(); await resumeHost();
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue('17');
  await ready(); await playable();

  // Native free choice opens the actual final board without pre-solving anything.
  await activate(frame.locator('.level-menu-toggle-wrapper'));
  await activate(frame.locator('.levels button[data-level="31"]'));
  await pauseHost(); await resumeHost();
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue('31');
  await ready(); await playable();
  await expect(frame.locator('.table bento')).toHaveCount(3);
  await typeSelector('[for^="Rob"]');
  await page.getByRole('button', { name: '返回游戏大厅', exact: true }).click();
  await openGame(page, 'CSS 选择器餐厅'); await ready(); await choose(31); await playable();
  await expect(input).toHaveValue('[for^="Rob"]');
  expect(await completed()).toEqual([0, 16]);
  expect((await saved()).earnedEnding).toBe(false);
  await screenshot('diner-final-original-attribute-board.png');
  await run('[for*="obb"]');
  await expect.poll(completed).toEqual([0, 16, 31]);
  await expect(page.locator('[data-diner-phase]')).toHaveAttribute('data-diner-phase', 'ending');
  await expect(frame.locator('.winner')).toContainText('You did it! You rock at CSS.');
  await expect(frame.locator('#ending-progress')).toContainText('3 / 32');
  await expect(frame.locator('.editor')).toBeHidden();
  expect((await saved()).earnedEnding).toBe(true);
  await screenshot('diner-final-earned-original-ending.png');

  await page.reload(); await openGame(page, 'CSS 选择器餐厅'); await ready();
  expect((await saved()).earnedEnding).toBe(true);
  expect(await completed()).toEqual([0, 16, 31]);
  await choose(31);
  await expect(page.locator('[data-diner-phase]')).toHaveAttribute('data-diner-phase', 'ending');
  await expect(frame.locator('#ending-progress')).toContainText('3 / 32');
  await expect(frame.locator('.level-text')).toHaveText('第 32 / 32 关');
  await expect(frame.locator('.order')).toHaveText('选中名字中包含 obb 的餐点');
  await expect(frame.locator('.display-help .selector-name')).toHaveText('属性包含匹配');
  await expect(frame.locator('.display-help .syntax')).toHaveText('[attribute*="value"]');
  await expect(frame.locator('.display-help .hint')).toContainText('包含指定文本');
  await expect(frame.locator('.levels button[data-level="31"]')).toHaveClass(/current/);
  await expect(frame.locator('.levels button[data-level="31"]')).toHaveAttribute('aria-current', 'step');
  await activate(frame.locator('#original-help summary'));
  await expect(frame.locator('#original-help-content')).toContainText('contains specific characters anywhere');
  await expect(frame.locator('#original-help-content')).toContainText('thumbnails');
  await screenshot('diner-restored-ending-native-help.png');
  await activate(frame.locator('#original-help summary'));
  await activate(frame.locator('#retry-final')); await playable();
  await expect(input).toHaveValue('');
  // A historical earned ending must not replace an active final-puzzle retry.
  await typeSelector('[for^="Rob"]');
  expect((await saved()).earnedEnding).toBe(true);
  expect((await saved()).finalEnding).toBe(false);
  await page.getByRole('button', { name: '返回游戏大厅', exact: true }).click();
  await openGame(page, 'CSS 选择器餐厅'); await ready(); await choose(31); await playable();
  await expect(page.locator('[data-diner-phase]')).toHaveAttribute('data-diner-phase', 'playing');
  await expect(frame.locator('#ending')).toBeHidden();
  await expect(input).toHaveValue('[for^="Rob"]');
  expect((await saved()).earnedEnding).toBe(true);
  expect((await saved()).finalEnding).toBe(false);
  expect(await completed()).toEqual([0, 16, 31]);
  await screenshot('diner-earned-ending-active-retry-restored.png');
  await activate(frame.locator('#retry-game')); await playable();
  if (mobile) {
    await page.setViewportSize({ width: 320, height: 760 });
    await screenshot('diner-320px-final-board-editor.png');
    await activate(input); await input.pressSequentially('[for*=');
    await expect(input).toHaveValue('[for*=');
    await activate(frame.locator('#retry-game')); await playable();
    await screenshot('diner-320px-reset-editor.png');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await frame.locator('body').evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // Return to the ending through another real selector submission, never by
  // changing stored flags or invoking the engine from the test.
  await run('[for*="obb"]');
  await expect(page.locator('[data-diner-phase]')).toHaveAttribute('data-diner-phase', 'ending');
  expect((await saved()).finalEnding).toBe(true);

  // Exit with a real pending native transition, then reenter rapidly.
  await choose(0); await playable(); await run('plate');
  await pauseHost();
  await page.getByRole('button', { name: '返回游戏大厅', exact: true }).click();
  await openGame(page, 'CSS 选择器餐厅'); await ready(); await choose(15); await playable();
  await page.waitForTimeout(1150);
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue('15');
  expect(await completed()).toEqual([0, 16, 31]);
  expect(page.frames().filter(item => item.url().includes('/css-diner/'))).toHaveLength(1);
  await choose(31);
  await expect(page.locator('[data-diner-phase]')).toHaveAttribute('data-diner-phase', 'ending');

  // Original full reset is explicitly confirmed and clears only this game's own records.
  await activate(frame.locator('.level-menu-toggle-wrapper'));
  await activate(frame.locator('.reset-progress'));
  await expect(frame.locator('#reset-confirm')).toContainText('大厅已经获得的历史通关记录会保留');
  await activate(frame.locator('#reset-no'));
  expect((await saved()).earnedEnding).toBe(true);
  await activate(frame.locator('.reset-progress'));
  await activate(frame.locator('#reset-yes'));
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue('0');
  await ready(); await playable();
  expect((await saved()).guessHistory).toEqual({});
  expect((await saved()).earnedEnding).toBe(false);
  expect(await completed()).toEqual([0, 16, 31]);
  await screenshot('diner-reset-own-progress.png');
  await page.getByRole('button', { name: '返回游戏大厅', exact: true }).click();
  await page.waitForTimeout(350);
  expect(page.frames().some(item => item.url().includes('/css-diner/'))).toBe(false);
  expect(await page.evaluate(() => ({ hash: location.hash, language: document.documentElement.lang, generic: ['currentLevel', 'progress'].map(key => localStorage.getItem(key)) }))).toEqual(initialHost);
  expect(outside).toEqual([]); expect(errors).toEqual([]);
});
