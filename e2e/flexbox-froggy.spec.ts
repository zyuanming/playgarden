import { expect, test, type Locator } from '@playwright/test';
import { captureErrors, chooseLevel, openGame } from './helpers';

test('complete original Froggy: physical CSS, first/middle/final, isolation and earned ending', async ({ page }, info) => {
  test.setTimeout(120000);
  const mobile = info.project.name === 'mobile';
  const errors = captureErrors(page), outside: string[] = [];
  const origin = new URL(String(info.project.use.baseURL || 'http://127.0.0.1:4173')).origin;
  page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) outside.push(request.url()); });
  await openGame(page, '弹性盒子青蛙');
  const initialHost = await page.evaluate(() => ({ hash: location.hash, lang: document.documentElement.lang, generic: ['level', 'answers', 'solved', 'colorblind'].map(key => localStorage.getItem(key)) }));
  let frame = page.frameLocator('iframe[title="弹性盒子青蛙完整课程"]');
  const ready = () => expect(page.locator('[data-froggy-ready]')).toHaveAttribute('data-froggy-ready', 'true');
  const activate = async (locator: Locator) => { if (mobile) await locator.tap(); else await locator.click(); };
  const typeCSS = async (text: string) => {
    const editor = frame.getByRole('textbox', { name: 'CSS 声明', exact: true });
    await activate(editor);
    await editor.press('ControlOrMeta+A'); await editor.press('Backspace');
    await editor.pressSequentially(text);
  };
  const completed = () => page.evaluate(() => JSON.parse(localStorage.getItem('playgarden.progress.v2') || '{}').completed?.['flexbox-froggy'] || []);
  const solved = () => expect(frame.locator('#next')).not.toHaveClass(/disabled/, { timeout: 6000 });
  const choose = async (index: number) => { await chooseLevel(page, index); await ready(); frame = page.frameLocator('iframe[title="弹性盒子青蛙完整课程"]'); };
  await ready();
  await expect(page.getByLabel('选择关卡', { exact: true }).locator('option')).toHaveCount(24);
  await expect(frame.locator('#pond .frog')).toHaveCount(1);
  await expect(frame.locator('#instructions')).toContainText('justify-content');

  await typeCSS('justify-content: flex-start;');
  await expect(frame.locator('#result')).toContainText('还没有全部对齐');
  await expect(frame.locator('#next')).toHaveClass(/disabled/);
  expect(await completed()).toEqual([]);
  await typeCSS('background-image: url(https://froggy-invalid.example/never.png); position: fixed; inset: 0; } body { display: none;');
  await expect(frame.locator('#result')).toContainText('还没有全部对齐');
  expect(await frame.locator('#pond').getAttribute('style')).toBe('');
  await expect(frame.locator('#board')).toBeVisible();
  expect(outside).toEqual([]);

  // The original property-reference control inserts CSS through its normal UI.
  await typeCSS('');
  await activate(frame.locator('#instructions code.help').filter({ hasText: /^justify-content$/ }).first());
  await expect(frame.locator('#instructions .tooltip')).toBeVisible();
  await activate(frame.locator('#instructions .tooltip code').filter({ hasText: /^flex-end$/ }));
  await solved();
  await expect.poll(completed).toEqual([0]);
  await page.screenshot({ path: info.outputPath('froggy-first-earned-original-help.png'), fullPage: true });
  await activate(frame.locator('.title'));

  // Equivalent Flexbox, deliberately different from the author's target text.
  await typeCSS('flex-direction: row-reverse; justify-content: flex-start;');
  await solved();
  expect(await completed()).toEqual([0]);
  await activate(frame.locator('#labelSettings'));
  await activate(frame.locator('#colorblind input[value="true"]'));
  await expect(frame.locator('#pond .frog.cb-friendly')).toHaveCount(1);
  await activate(frame.locator('#labelSettings'));

  await choose(16);
  await expect(frame.locator('#pond .frog')).toHaveCount(5);
  await expect(frame.locator('#before')).toContainText('.yellow');
  // A real pending debounce must not solve its old level after navigation.
  await typeCSS('align-self: flex-end; order: 2;');
  await choose(15);
  await page.waitForTimeout(800);
  expect(await completed()).toEqual([0]);
  await choose(16);
  // Saved CSS is rechecked by the original board, then the retry clears it.
  await solved();
  await activate(frame.locator('#retry-game'));
  await expect(frame.locator('#code')).toHaveValue('');
  await expect(frame.locator('#next')).toHaveClass(/disabled/);
  await typeCSS('align-self: flex-end; order: 2;');
  await solved();
  await expect.poll(completed).toEqual([0, 16]);
  await page.screenshot({ path: info.outputPath('froggy-middle-earned-selected-frogs.png'), fullPage: true });

  // Interrupt the original two-second hop before it requests another level.
  await activate(frame.locator('#next'));
  await activate(frame.locator('#pause-game'));
  await expect(frame.locator('#paused-cover')).toBeVisible();
  await page.waitForTimeout(2200);
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue('16');
  await expect(frame.locator('#code')).toBeDisabled();
  await activate(frame.locator('#resume-game'));
  await solved();
  await activate(frame.locator('#next'));
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue('17', { timeout: 5000 });
  await ready();
  await expect(frame.locator('#level-counter .current')).toHaveText('18');
  expect(await completed()).toEqual([0, 16]);

  // Original level menu requests host navigation without awarding that lesson.
  await activate(frame.locator('#level-indicator'));
  await activate(frame.locator('.level-marker[data-level="23"]'));
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue('23');
  await ready();
  await expect(frame.locator('#pond .frog')).toHaveCount(7);
  await typeCSS('flex-flow: column-reverse wrap-reverse;');
  await expect(frame.locator('#next')).toHaveClass(/disabled/);
  await page.getByRole('button', { name: '返回游戏大厅', exact: true }).click();
  await openGame(page, '弹性盒子青蛙'); await ready();
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue('23');
  await expect(frame.locator('#code')).toHaveValue('flex-flow: column-reverse wrap-reverse;');
  await expect(frame.locator('#pond .frog.cb-friendly')).toHaveCount(7);

  await typeCSS('flex-flow: column-reverse wrap-reverse; align-content: space-between; justify-content: center;');
  await solved();
  await expect.poll(completed).toEqual([0, 16, 23]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('playgarden.flexbox-froggy.v1.state') || '{}').earnedEnding)).toBe(false);
  await page.screenshot({ path: info.outputPath('froggy-final-earned-wrapped-layout.png'), fullPage: true });
  await activate(frame.locator('#next'));
  await expect(page.locator('[data-froggy-phase]')).toHaveAttribute('data-froggy-phase', 'ending', { timeout: 5000 });
  await expect(frame.locator('#instructions')).toContainText('你赢了');
  await expect(frame.locator('#share')).toBeVisible();
  await expect(frame.locator('#ending-progress')).toContainText('3 / 24');
  await expect(frame.locator('#editor')).toBeHidden();
  await expect(frame.locator('#pond .frog')).toHaveCount(25);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('playgarden.flexbox-froggy.v1.state') || '{}').earnedEnding)).toBe(true);
  await page.screenshot({ path: info.outputPath('froggy-final-earned-original-ending.png'), fullPage: true });

  await page.reload();
  await openGame(page, '弹性盒子青蛙'); await ready();
  // The shell deliberately reopens the first unfinished course. Viewing it
  // must not erase the separately earned final-course ending milestone.
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue('1');
  await expect(page.locator('[data-froggy-phase]')).toHaveAttribute('data-froggy-phase', 'playing');
  expect(await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('playgarden.flexbox-froggy.v1.state') || '{}');
    return { ending: saved.ending, earnedEnding: saved.earnedEnding };
  })).toEqual({ ending: false, earnedEnding: true });
  expect(await completed()).toEqual([0, 16, 23]);
  await choose(23);
  await expect(page.locator('[data-froggy-phase]')).toHaveAttribute('data-froggy-phase', 'ending');
  await expect(frame.locator('#ending-progress')).toContainText('3 / 24');
  if (mobile) {
    await page.setViewportSize({ width: 320, height: 760 });
    await page.screenshot({ path: info.outputPath('froggy-320px-original-ending.png'), fullPage: true });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await frame.locator('body').evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await choose(0); await solved(); await activate(frame.locator('#next'));
  await page.getByRole('button', { name: '返回游戏大厅', exact: true }).click();
  await page.waitForTimeout(2200);
  expect(page.frames().some(item => item.url().includes('/flexbox-froggy/'))).toBe(false);
  expect(await completed()).toEqual([0, 16, 23]);
  expect(await page.evaluate(() => ({ hash: location.hash, lang: document.documentElement.lang, generic: ['level', 'answers', 'solved', 'colorblind'].map(key => localStorage.getItem(key)) }))).toEqual(initialHost);
  expect(outside).toEqual([]); expect(errors).toEqual([]);
});
