// SPDX-License-Identifier: GPL-3.0-only
import { test, expect } from '@playwright/test';
import { openGame, chooseLevel, captureErrors } from './helpers';
import { readFileSync } from 'node:fs';
const levels: { mask: number; solution: number[] }[] = JSON.parse(readFileSync(new URL('../src/games/domineeringLevels.json', import.meta.url), 'utf8'));

test('Domineering: first, middle and final positions, real inputs and round controls', async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, '横竖争地');
  const root = page.locator('.domineering-garden');
  const cell = (i: number) => root.locator(`[data-cell="${i}"]`);
  async function click(i: number) { if (info.project.name === 'mobile') await cell(i).tap(); else { await cell(i).focus(); await cell(i).press('Enter'); } }
  async function place(i: number) { await click(i); await root.getByRole('button', { name: '放下竖牌', exact: true }).click(); }
  const initial = String(levels[0].mask);
  await expect(root).toHaveAttribute('data-domineering-mask', initial);
  await click(15);
  await expect(root.locator('.dg-message')).toContainText('不能作为上端');
  await expect(root).toHaveAttribute('data-domineering-mask', initial);
  await page.getByRole('button', { name: '提示', exact: true }).click();
  await expect(root.locator('.dg-message')).toContainText('精确搜索');
  await expect(root).toHaveAttribute('data-domineering-mask', initial);
  await click(levels[0].solution[0]);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await expect(root.getByRole('button', { name: '放下竖牌', exact: true })).toBeDisabled();
  await expect(cell(0)).toBeDisabled();
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await expect(root).toHaveAttribute('data-domineering-mask', initial);
  await page.screenshot({ path: info.outputPath('domineering-start.png'), fullPage: true });
  // A legal but losing opening must remain recoverable, without marking a win.
  await place(4);
  await expect(root).toHaveAttribute('data-domineering-result', 'lost');
  await expect(page.locator('.status')).not.toHaveClass(/success/);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(root).toHaveAttribute('data-domineering-mask', initial);
  await expect(root).toHaveAttribute('data-domineering-result', 'playing');
  // A nonterminal mid-campaign round can be undone completely.
  await chooseLevel(page, 49);
  await place(levels[49].solution[0]);
  await expect(root).toHaveAttribute('data-domineering-rounds', '1');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(root).toHaveAttribute('data-domineering-mask', String(levels[49].mask));
  await expect(root).toHaveAttribute('data-domineering-rounds', '0');
  for (const index of [0, 49, 99]) {
    await chooseLevel(page, index);
    for (let j = 0; j < levels[index].solution.length; j += 2) await place(levels[index].solution[j]);
    await expect(root).toHaveAttribute('data-domineering-result', 'won');
    await expect(page.locator('.status')).toHaveClass(/success/);
    const mask = await root.getAttribute('data-domineering-mask');
    await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
    await expect(root).toHaveAttribute('data-domineering-mask', mask!);
    await expect(cell(0)).toBeDisabled();
    expect(await cell(0).evaluate(el => { const r = el.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`domineering-${index + 1}.png`), fullPage: true });
    await page.getByRole('button', { name: '重来', exact: true }).click();
    await expect(root).toHaveAttribute('data-domineering-result', 'playing');
    await expect(root).toHaveAttribute('data-domineering-mask', String(levels[index].mask));
  }
  expect(errors).toEqual([]);
});
