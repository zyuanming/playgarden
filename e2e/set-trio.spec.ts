// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Locator, type Page } from '@playwright/test';
import { openGame, chooseLevel, captureErrors } from './helpers';

type VisibleCard = { id: number; attributes: number[] };
// Deliberately independent of the game engine: read the displayed cards and
// express the all-same/all-different rule directly, then partition the board.
function partition(cards: VisibleCard[]): number[][] | null {
  if (!cards.length) return [];
  const a = cards[0];
  for (let b = 1; b < cards.length; b++) for (let c = b + 1; c < cards.length; c++) {
    const chosen = [a, cards[b], cards[c]];
    const legal = [0, 1, 2, 3].every((attribute) => {
      const [x, y, z] = chosen.map((card) => card.attributes[attribute]);
      return (x === y && y === z) || (x !== y && y !== z && x !== z);
    });
    if (!legal) continue;
    const rest = cards.filter((_, i) => i !== 0 && i !== b && i !== c);
    const tail = partition(rest);
    if (tail) return [chosen.map((card) => card.id), ...tail];
  }
  return null;
}
async function visibleCards(page: Page): Promise<VisibleCard[]> {
  return page.locator('[data-set-trio-card]').evaluateAll((cards) => cards.map((card) => ({
    id: Number(card.getAttribute('data-set-trio-card')),
    attributes: card.getAttribute('data-set-trio-code')!.split('').map(Number),
  })));
}
test('three-card relations: first, middle and final lessons with recoverable controls', async ({ page }, info) => {
  const errors = captureErrors(page);
  const touch = info.project.name === 'mobile';
  const activate = async (locator: Locator) => { if (touch) await locator.tap(); else await locator.click(); };
  const game = page.locator('[data-set-trio-game]');
  const card = (id: number) => page.locator(`[data-set-trio-card="${id}"]`);
  const confirm = page.locator('[data-set-trio-confirm]');
  const clear = page.locator('[data-set-trio-clear]');
  async function pick(ids: number[]) { for (const id of ids) await activate(card(id)); }
  async function finishCurrent() {
    const plan = partition(await visibleCards(page));
    expect(plan).not.toBeNull();
    for (const trio of plan!) {
      await pick(trio);
      await expect(page.locator('[data-set-trio-preview]')).toHaveAttribute('data-set-trio-preview', 'valid');
      await activate(confirm);
    }
    await expect(game).toHaveAttribute('data-set-trio-won', 'true');
    await expect(page.locator('.status')).toHaveClass(/success/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await openGame(page, '三卡共鸣');
  await expect(card(0)).toHaveAccessibleName(/朱红.*圆形.*1 个.*实心/);
  await expect(confirm).toBeDisabled();
  const targets = await page.locator('[data-set-trio-card], .trio-actions button').evaluateAll((nodes) => nodes.map((node) => {
    const r = node.getBoundingClientRect(); return { width: r.width, height: r.height };
  }));
  for (const target of targets) { expect(target.width).toBeGreaterThanOrEqual(44); expect(target.height).toBeGreaterThanOrEqual(44); }
  await page.screenshot({ path: info.outputPath('set-trio-first-start.png'), fullPage: true, animations: 'disabled' });
  if (touch) await activate(card(0));
  else {
    await card(0).focus();
    await card(0).press('Space');
    await card(0).press('ArrowRight');
    await expect(card(1)).toBeFocused();
  }
  await pick([1, 2]);
  await expect(game).toHaveAttribute('data-set-trio-selected', '0,1,2');
  await expect(page.locator('[data-set-trio-preview]')).toHaveAttribute('data-set-trio-preview', 'invalid');
  await activate(confirm);
  await expect(game).toHaveAttribute('data-set-trio-groups', '0');
  await expect(page.locator('[data-set-trio-card]')).toHaveCount(6);
  await activate(page.getByRole('button', { name: '提示', exact: true }));
  await expect(game).toHaveAttribute('data-set-trio-selected', '0,1,2');
  await expect(page.locator('[data-set-trio-hinted="true"]')).toHaveCount(3);
  await activate(page.getByRole('button', { name: '暂停', exact: true }));
  await expect(confirm).toBeDisabled();
  await expect(card(0)).toBeDisabled();
  await expect(game).toHaveAttribute('data-set-trio-selected', '0,1,2');
  await activate(page.getByRole('button', { name: '继续游戏', exact: true }));
  await activate(clear);
  await pick([0, 2, 4]);
  await expect(page.locator('[data-set-trio-card]')).toHaveCount(6); // Preview never removes cards.
  await activate(confirm);
  await expect(game).toHaveAttribute('data-set-trio-groups', '1');
  await activate(page.getByRole('button', { name: '撤销', exact: true }));
  await expect(game).toHaveAttribute('data-set-trio-groups', '0');
  await expect(game).toHaveAttribute('data-set-trio-selected', '0,2,4');
  await activate(confirm);
  await activate(card(1));
  // Return through the actual app, restoring both a legal removal and a draft.
  await openGame(page, '三卡共鸣');
  await expect(game).toHaveAttribute('data-set-trio-groups', '1');
  await expect(game).toHaveAttribute('data-set-trio-selected', '1');
  await expect(page.locator('[data-set-trio-card]')).toHaveCount(3);
  await activate(page.getByRole('button', { name: '重来', exact: true }));
  await expect(game).toHaveAttribute('data-set-trio-groups', '0');
  await expect(game).toHaveAttribute('data-set-trio-selected', '');
  await expect(page.locator('[data-set-trio-card]')).toHaveCount(6);
  await finishCurrent();
  await page.screenshot({ path: info.outputPath('set-trio-first-complete.png'), fullPage: true, animations: 'disabled' });
  // A valid alternative to the authored number-based partition is accepted.
  await chooseLevel(page, 1);
  await pick([0, 1, 2]);
  await activate(confirm);
  await expect(game).toHaveAttribute('data-set-trio-groups', '1');
  await expect(page.locator('[data-set-trio-card]')).toHaveCount(6);
  await chooseLevel(page, 8);
  await finishCurrent();
  await page.screenshot({ path: info.outputPath('set-trio-middle-complete.png'), fullPage: true, animations: 'disabled' });
  await chooseLevel(page, 17);
  await page.screenshot({ path: info.outputPath('set-trio-final-start.png'), fullPage: true, animations: 'disabled' });
  await finishCurrent();
  await page.screenshot({ path: info.outputPath('set-trio-final-complete.png'), fullPage: true, animations: 'disabled' });
  // Invalid saved removals must not be trusted, even with a genuine board id.
  await chooseLevel(page, 4);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('playgarden.set-trio.v1.round.4'))).not.toBeNull();
  await page.evaluate(() => {
    const key = 'playgarden.set-trio.v1.round.4';
    const save = JSON.parse(localStorage.getItem(key)!);
    save.actions = [[0, 0, 1]];
    save.selected = [99];
    localStorage.setItem(key, JSON.stringify(save));
  });
  await openGame(page, '三卡共鸣');
  await expect(game).toHaveAttribute('data-set-trio-id', 'outline-arrives');
  await expect(game).toHaveAttribute('data-set-trio-groups', '0');
  await expect(game).toHaveAttribute('data-set-trio-selected', '');
  await expect(page.locator('[data-set-trio-card]')).toHaveCount(6);
  expect(errors).toEqual([]);
});
