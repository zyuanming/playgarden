import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openGame, chooseLevel, captureErrors } from './helpers';
import { samegameLevels } from '../src/games/samegameLevels';
import { removeSameGameGroup } from '../src/games/samegameLogic';
import { SAMEGAME_RESUME_KEY } from '../src/games/samegameStorage';
import { STORAGE_KEY } from '../src/lib/progress';
const certificates = JSON.parse(readFileSync('docs/samegame/campaign.json', 'utf8')).levels as { id: string; solution: number[]; openingOutcomes: { index: number; outcome: string }[] }[];
const cell = (page: Page, index: number) => page.locator(`[data-samegame-cell="${index}"]`);
const board = (page: Page) => page.locator('[data-samegame-cell]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-value'))));
const checkpoints = new Set([0,9,19,20,29,39,40,49,59,60,69,79,80,89,99]);
for (let start = 0; start < 100; start += 5) test(`Same Game genuine completion ${start + 1}–${start + 5}`, async ({ page }, info) => {
  const errors = captureErrors(page); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await openGame(page, '花簇消除'); await chooseLevel(page, start);
  await expect(page.getByLabel('选择关卡', { exact: true }).locator('option')).toHaveCount(100);
  for (let index = start; index < start + 5; index++) {
    const level = samegameLevels[index], proof = certificates.find(item => item.id === level.id)!;
    await expect(page.locator('[data-samegame-chapter]')).toHaveAttribute('data-samegame-chapter', String(level.chapter));
    expect(await board(page)).toEqual(level.board);
    if (checkpoints.has(index)) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('[data-samegame-cell]').evaluateAll(nodes => nodes.every(node => { const box = node.getBoundingClientRect(); return box.width >= 44 && box.height >= 44 && box.left >= 0 && box.right <= innerWidth; }))).toBe(true);
      await page.screenshot({ path: info.outputPath(`samegame-${index + 1}-start.png`), fullPage: true, animations: 'disabled' });
    }
    for (const [step, move] of proof.solution.entries()) {
      const current = await board(page); await cell(page, move).click(); expect(await board(page)).toEqual(current);
      await expect(cell(page, move)).toHaveAttribute('aria-pressed', 'true');
      if (checkpoints.has(index) && step === 0) await page.screenshot({ path: info.outputPath(`samegame-${index + 1}-preview.png`), fullPage: true, animations: 'disabled' });
      await page.getByRole('button', { name: /^确认消除/ }).click();
      expect(await board(page)).toEqual(removeSameGameGroup(current, level.width, level.height, move));
    }
    await expect(page.locator('[data-samegame-won]')).toHaveAttribute('data-samegame-won', 'true');
    await expect(page.locator('.status')).toHaveClass(/success/);
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).completed.samegame, STORAGE_KEY)).toContain(index);
    await expect(cell(page, 0)).toBeDisabled();
    if (checkpoints.has(index)) await page.screenshot({ path: info.outputPath(`samegame-${index + 1}-won.png`), fullPage: true, animations: 'disabled' });
    if (index < 99) { await page.getByRole('button', { name: '下一关', exact: true }).click(); await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue(String(index + 1)); await expect(page.getByRole('heading', { name: '花簇消除', exact: true })).toBeFocused(); }
    else { await expect(page.getByRole('button', { name: '返回大厅', exact: true })).toBeFocused(); await page.getByRole('button', { name: '返回大厅', exact: true }).click(); }
  }
  expect(errors).toEqual([]);
});
for (const index of [0, 49, 99]) test(`Same Game ${index + 1} keyboard, pause, undo, hints, and reload`, async ({ page }, info) => {
  const errors = captureErrors(page), level = samegameLevels[index], move = certificates[index].solution[0];
  await openGame(page, '花簇消除'); await chooseLevel(page, index); const initial = await board(page), target = cell(page, move);
  await target.focus(); await expect(target).toBeFocused();
  for (const modifier of ['Control', 'Meta', 'Alt']) for (const key of ['Enter', 'Space', 'ArrowRight']) {
    await target.press(`${modifier}+${key}`); await expect(target).toBeFocused(); expect(await board(page)).toEqual(initial); await expect(target).toHaveAttribute('aria-pressed', 'false');
  }
  await target.press('Enter'); await expect(target).toHaveAttribute('aria-pressed', 'true'); expect(await board(page)).toEqual(initial);
  await page.getByRole('button', { name: '取消选择' }).click(); expect(await board(page)).toEqual(initial);
  await target.press('Space'); await expect(target).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '暂停', exact: true }).click(); await expect(target).toBeDisabled();
  await page.screenshot({ path: info.outputPath(`samegame-${index + 1}-paused.png`), fullPage: true });
  await page.getByRole('button', { name: '继续游戏', exact: true }).click(); expect(await board(page)).toEqual(initial);
  await target.press('Enter'); const current = await board(page); expect(current).not.toEqual(initial); await expect(target).toBeFocused();
  await page.getByRole('button', { name: '撤销', exact: true }).click(); expect(await board(page)).toEqual(initial);
  await page.getByRole('button', { name: '提示', exact: true }).click(); expect(await board(page)).toEqual(initial);
  await expect(page.locator('[data-samegame-hint]')).toHaveAttribute('data-samegame-hint', 'move');
  await page.screenshot({ path: info.outputPath(`samegame-${index + 1}-hint.png`), fullPage: true });
  await page.getByRole('button', { name: /^确认消除/ }).click(); const hintedBoard = await board(page); expect(hintedBoard).not.toEqual(initial);
  await page.reload(); await page.getByRole('textbox', { name: '搜索游戏' }).fill('花簇消除'); await page.getByRole('button', { name: '开始玩花簇消除', exact: true }).click();
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue(String(index)); expect(await board(page)).toEqual(hintedBoard);
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), `${SAMEGAME_RESUME_KEY}.round.${index}`); expect(stored.id).toBe(level.id);
  await page.getByRole('button', { name: '撤销', exact: true }).click(); expect(await board(page)).toEqual(initial);
  await target.click(); await target.click(); await page.getByRole('button', { name: '重来', exact: true }).click(); expect(await board(page)).toEqual(initial);
  const trap = certificates[index].openingOutcomes.find(outcome => outcome.outcome === 'losing');
  if (trap) {
    await cell(page, trap.index).click(); await page.getByRole('button', { name: /^确认消除/ }).click();
    const trapped = await board(page); await page.getByRole('button', { name: '提示', exact: true }).click();
    await expect(page.locator('[data-samegame-hint]')).toHaveAttribute('data-samegame-hint', 'dead-end'); expect(await board(page)).toEqual(trapped);
    await page.screenshot({ path: info.outputPath(`samegame-${index + 1}-trap-repair.png`), fullPage: true });
    await page.getByRole('button', { name: '撤销', exact: true }).click(); expect(await board(page)).toEqual(initial);
  }
  await chooseLevel(page, index === 99 ? 0 : 99); expect(await board(page)).toEqual(samegameLevels[index === 99 ? 0 : 99].board);
  expect(errors).toEqual([]);
});
