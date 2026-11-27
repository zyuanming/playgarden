import { expect, test, type Locator, type Page } from '@playwright/test';
import { captureErrors, chooseLevel, openGame } from './helpers';
import { debugProofs } from './fixtures/debug-detective-data';
import { STORAGE_KEY } from '../src/lib/progress';

const title = '调试侦探';
const root = (p: Page) => p.locator('.detective');
const pick = (p: Page, i: number) => p.locator('[data-dd-card="' + i + '"]');
const run = (p: Page) => p.locator('[data-dd-run]');
const confirm = (p: Page) => p.locator('[data-dd-confirm]');
const status = (p: Page) => p.locator('.dd-status');
const button = (p: Page, label: string) => p.getByRole('button', { name: label, exact: true });
const use = (loc: Locator, isMobile: boolean) => isMobile ? loc.tap() : loc.press('Space');
const mark = (p: Page, name: string, n: number) => expect(root(p)).toHaveAttribute('data-dd-' + name, String(n));
async function input(p: Page, bits: string, touch: boolean) {
  const before = await root(p).getAttribute('data-dd-input');
  for (let i = 0; i < 3; i++)
    if (before?.[i] !== bits[i]) await use(p.locator('[data-dd-switch="' + i + '"]'), touch);
  await expect(root(p)).toHaveAttribute('data-dd-input', bits);
}
async function probe(p: Page, bits: string, touch: boolean) {
  await input(p, bits, touch);
  await use(run(p), touch);
  await expect(p.locator('[data-dd-record="' + bits + '"]')).toBeVisible();
}
const complete = async (p: Page, index: number) => {
  await expect(root(p)).toHaveAttribute('data-dd-won', 'true');
  await expect(p.locator('.status.success')).toContainText('全部 8 种输入');
  await expect.poll(() => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}').completed?.['debug-detective'], STORAGE_KEY)).toContain(index);
};
for (let index = 0; index < 12; index += 4) {
  test('Investigates cases ' + (index + 1) + '–' + (index + 4), async ({ page, isMobile }, info) => {
    const errors = captureErrors(page);
    await openGame(page, title);
    for (let i = index; i < index + 4; i++) {
      const [route, counts, card, firstHints] = debugProofs[i];
      await chooseLevel(page, i);
      await expect(root(page)).toHaveAttribute('data-dd-id', 'debug-detective-' + String(i + 1).padStart(2, '0'));
      await expect(page.locator('[data-dd-expected]')).toHaveCount(0);
      await mark(page, 'probes', 0);
      await use(pick(page, card), isMobile);
      await expect(confirm(page)).toBeDisabled();
      await expect(page.locator('[data-dd-preview]')).toContainText('先记录');
      await use(button(page, '提示'), isMobile);
      await expect.poll(() => root(page).getAttribute('data-dd-hint')).toMatch(new RegExp('^(' + firstHints.join('|') + ')$'));
      await expect(root(page)).toHaveAttribute('data-dd-input', '000');
      await mark(page, 'probes', 0);
      if ([0, 6, 11].includes(i)) {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const sizes = await page.locator('.dd-panel button').evaluateAll(ns =>
          ns.map(n => { const r = n.getBoundingClientRect(); return [r.width, r.height]; })
        );
        expect(Math.min(...sizes.flat())).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: info.outputPath('start-' + (i + 1) + '.png'), fullPage: true, animations: 'disabled' });
      }
      for (const [j, bits] of route.entries()) {
        await probe(page, bits, isMobile);
        await mark(page, 'possible', counts[j]);
        await mark(page, 'left', route.length - j - 1);
        await expect(page.locator('[data-dd-expected]')).toHaveCount(j + 1);
        if (counts[j] !== 1) await expect(confirm(page)).toBeDisabled();
      }
      await expect(pick(page, card)).toHaveAttribute('data-viable', 'true');
      await expect(page.locator('[data-dd-card][data-viable="true"]')).toHaveCount(1);
      await use(confirm(page), isMobile);
      await complete(page, i);
      if (i === 0) {
        await use(button(page, '下一关'), isMobile);
        await expect(root(page)).toHaveAttribute('data-dd-id', 'debug-detective-02');
      }
    }
    expect(errors).toEqual([]);
  });
}

test('A weak opening is refundable, preview and trace are read-only, and the final case resumes', async ({ page, isMobile }, info) => {
  const errors = captureErrors(page);
  await openGame(page, title);
  await chooseLevel(page, 11);
  await probe(page, '111', isMobile);
  await mark(page, 'possible', 5);
  await mark(page, 'left', 2);
  await expect(run(page)).toBeDisabled();
  await use(button(page, '提示'), isMobile);
  await expect(status(page)).toContainText('不能保证区分所有方案');
  await expect(root(page)).toHaveAttribute('data-dd-hint', '');
  await mark(page, 'probes', 1);
  await use(button(page, '撤销'), isMobile);
  await mark(page, 'left', 3);
  await mark(page, 'possible', 9);
  await expect(page.locator('[data-dd-expected]')).toHaveCount(0);
  await probe(page, '000', isMobile);
  await expect(page.locator('[data-dd-expected="00"]')).toHaveCount(1);
  await expect(page.locator('[data-dd-actual="00"]')).toHaveCount(1);
  await mark(page, 'possible', 5);
  await use(button(page, '查看 000 的执行轨迹'), isMobile);
  await expect(page.locator('[data-dd-trace]')).toContainText('000 → 001 → 001 → 001 → 011 → 010');
  await use(pick(page, 0), isMobile);
  await expect(page.locator('[data-dd-preview] li')).toHaveCount(1);
  await mark(page, 'left', 2);
  await expect(confirm(page)).toBeDisabled();
  await use(button(page, '暂停'), isMobile);
  await expect(page.locator('[data-dd-switch="0"]')).toBeDisabled();
  await use(button(page, '继续游戏'), isMobile);
  await openGame(page, title);
  await expect(root(page)).toHaveAttribute('data-dd-id', 'debug-detective-12');
  await expect(root(page)).toHaveAttribute('data-dd-pick', '0');
  await mark(page, 'probes', 1);
  await expect(status(page)).toContainText('已恢复');
  await use(button(page, '提示'), isMobile);
  await expect(status(page)).toContainText('建议测试 ABC');
  await expect(root(page)).toHaveAttribute('data-dd-input', '000');
  await mark(page, 'left', 2);
  await probe(page, '110', isMobile);
  const row = page.locator('[data-dd-record="110"]');
  await expect(row.locator('[data-dd-expected]')).toHaveAttribute('data-dd-expected', '10');
  await expect(row.locator('[data-dd-actual]')).toHaveAttribute('data-dd-actual', '11');
  await mark(page, 'possible', 2);
  await probe(page, '001', isMobile);
  await mark(page, 'possible', 1);
  await expect(confirm(page)).toBeDisabled();
  await use(pick(page, 1), isMobile);
  await expect(page.locator('[data-dd-preview] li')).toHaveCount(3);
  await page.screenshot({ path: info.outputPath('final-evidence.png'), fullPage: true, animations: 'disabled' });
  await use(confirm(page), isMobile);
  await complete(page, 11);
  await use(button(page, '重来'), isMobile);
  await mark(page, 'left', 3);
  await expect(page.locator('[data-dd-record]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
