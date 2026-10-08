// SPDX-License-Identifier: GPL-3.0-only
// UNRUN by the module author. One targeted invocation should run the existing
// desktop and mobile projects. This is a small real-control journey, not a sweep.
import { expect, test, type Locator } from '@playwright/test';
import { captureErrors, chooseLevel, openGame } from './helpers';

test('small FreeCell deal: legal targets, parking, recovery and honest completion', async ({ page }, info) => {
  const errors = captureErrors(page);
  const activate = async (target: Locator) => info.project.name === 'mobile' ? target.tap() : target.click();
  const game = page.locator('[data-freecell-game]');
  const place = (key: string) => page.locator(`[data-freecell-place="${key}"]`);
  const moves = async (count: number) => expect(game).toHaveAttribute('data-freecell-moves', String(count));
  const move = async (from: string, to: string) => {
    await activate(place(from));
    await expect(place(to)).toHaveAttribute('data-freecell-legal', 'true');
    await activate(place(to));
  };
  await openGame(page, '空位纸牌');
  await expect(game).toHaveAttribute('data-freecell-id', 'first-four-suits');
  await expect(page.locator('[data-freecell-deck]')).toContainText('12');
  await expect(place('column-0')).toHaveAccessibleName(/顶牌黑桃 A/);
  await expect(place('column-0')).toHaveAttribute('data-freecell-card', 'S1');
  const dimensions = await page.locator('[data-freecell-place], [data-freecell-cancel]').evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect(); return { width: rect.width, height: rect.height };
  }));
  for (const size of dimensions) { expect(size.width).toBeGreaterThanOrEqual(44); expect(size.height).toBeGreaterThanOrEqual(44); }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('freecell-first-start.png'), fullPage: true, animations: 'disabled' });

  if (info.project.name === 'mobile') await activate(place('column-0'));
  else { await place('column-0').focus(); await place('column-0').press('Space'); }
  await expect(place('foundation-0')).toHaveAttribute('data-freecell-legal', 'true');
  await expect(place('foundation-1')).toHaveAttribute('data-freecell-legal', 'false');
  await activate(place('foundation-1')); // Wrong suit cannot enter the foundation.
  await moves(0);
  await expect(page.locator('[data-freecell-message]')).toContainText('自己的花色');
  await activate(place('column-1')); // Same rank is not descending-by-one.
  await moves(0);
  await expect(page.locator('[data-freecell-message]')).toContainText('红黑交替');
  await activate(place('column-0')); // Clicking the selected source cancels.
  await expect(game).toHaveAttribute('data-freecell-selected', '');
  await activate(place('column-0'));
  await activate(page.locator('[data-freecell-cancel]'));
  await expect(game).toHaveAttribute('data-freecell-selected', '');

  await move('column-0', 'cell-0');
  await move('cell-0', 'cell-1'); // Free-cell-to-free-cell transfer is legal.
  await moves(2);
  await expect(place('cell-1')).toHaveAttribute('data-freecell-card', 'S1');
  await activate(page.getByRole('button', { name: '撤销', exact: true }));
  await moves(1);
  await expect(place('cell-0')).toHaveAttribute('data-freecell-card', 'S1');
  await expect(place('cell-1')).toHaveAttribute('data-freecell-card', '');
  await activate(place('cell-0'));
  await activate(page.getByRole('button', { name: '提示', exact: true }));
  await expect(page.locator('[data-freecell-message]')).toContainText('不保证');
  await expect(game).toHaveAttribute('data-freecell-selected', 'cell-0');
  await activate(page.getByRole('button', { name: '暂停', exact: true }));
  await expect(place('cell-0')).toBeDisabled();
  await expect(place('foundation-0')).toBeDisabled();
  await expect(page.locator('[data-freecell-cancel]')).toBeDisabled();
  await moves(1);
  await activate(page.getByRole('button', { name: '继续游戏', exact: true }));

  await openGame(page, '空位纸牌'); // Real reload restores a replayed move and draft.
  await moves(1);
  await expect(game).toHaveAttribute('data-freecell-selected', 'cell-0');
  await expect(place('cell-0')).toHaveAttribute('data-freecell-card', 'S1');
  await activate(place('foundation-0'));
  await expect(place('foundation-0')).toHaveAttribute('data-freecell-rank', '1');
  await activate(page.getByRole('button', { name: '重来', exact: true }));
  await moves(0);
  await expect(game).toHaveAttribute('data-freecell-selected', '');
  await expect(place('column-0')).toHaveAttribute('data-freecell-card', 'S1');

  // Every card reaches home through an ordinary source and target control.
  // This fixed 12-card teaching route contains no solver or victory injection.
  await move('column-0', 'cell-0');
  await move('cell-0', 'cell-1');
  await move('cell-1', 'foundation-0');
  for (const [from, to] of [
    ['column-1', 'foundation-1'], ['column-2', 'foundation-2'], ['column-3', 'foundation-3'],
    ['column-0', 'foundation-1'], ['column-1', 'foundation-0'], ['column-2', 'foundation-3'], ['column-3', 'foundation-2'],
    ['column-0', 'foundation-0'], ['column-1', 'foundation-1'], ['column-2', 'foundation-2'], ['column-3', 'foundation-3'],
  ]) await move(from, to);
  await moves(14);
  await expect(game).toHaveAttribute('data-freecell-won', 'true');
  await expect(page.locator('.status')).toHaveClass(/success/);
  await expect(place('column-0')).toBeDisabled();
  await page.screenshot({ path: info.outputPath('freecell-first-complete.png'), fullPage: true, animations: 'disabled' });

  // One distinct shape checks the occupied free cell, empty column and save rejection.
  await chooseLevel(page, 4);
  await expect(place('cell-0')).toHaveAttribute('data-freecell-card', 'S4');
  await expect(place('column-4')).toHaveAttribute('data-freecell-card', '');
  await activate(place('cell-0'));
  await activate(place('foundation-0')); // Cannot skip A, 2 and 3.
  await moves(0);
  await expect(page.locator('[data-freecell-message]')).toContainText('不能跳过');
  await activate(page.locator('[data-freecell-cancel]'));
  await move('column-0', 'column-4');
  await expect(place('column-4')).toHaveAttribute('data-freecell-card', 'H2');
  await activate(place('column-1')); // C1 may legally stack on the red H2.
  await expect(place('column-4')).toHaveAttribute('data-freecell-legal', 'true');
  await activate(place('column-4'));
  await moves(2);
  await activate(page.getByRole('button', { name: '撤销', exact: true }));
  await moves(1);
  await expect(place('column-4')).toHaveAttribute('data-freecell-card', 'H2');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('playgarden.freecell-garden.v1.round.4'))).not.toBeNull();
  await page.evaluate(() => {
    const key = 'playgarden.freecell-garden.v1.round.4';
    const saved = JSON.parse(localStorage.getItem(key)!);
    saved.moves = [{ from: { kind: 'column', index: 99 }, to: { kind: 'foundation', index: 0 } }];
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await openGame(page, '空位纸牌');
  await moves(0);
  await expect(place('cell-0')).toHaveAttribute('data-freecell-card', 'S4');
  await expect(place('column-0')).toHaveAttribute('data-freecell-card', 'H2');
  await expect(place('column-4')).toHaveAttribute('data-freecell-card', '');

  await chooseLevel(page, 11);
  await expect(page.locator('[data-freecell-deck]')).toContainText('24');
  await expect(page.locator('[data-freecell-place^="column-"]')).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('freecell-six-column-layout.png'), fullPage: true, animations: 'disabled' });
  expect(errors).toEqual([]);
});
