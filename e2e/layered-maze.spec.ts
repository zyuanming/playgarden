import { test, expect, type Page } from '@playwright/test';
import { captureErrors, chooseLevel, openGame } from './helpers';
import { routes } from './fixtures/layered-maze-routes';
import { STORAGE_KEY } from '../src/lib/progress';

const title = '层梯迷宫';
const root = (p: Page) => p.locator('.layered-maze');
const board = (p: Page) => p.locator('.maze-panel');
const dir = (p: Page, a: string) => p.locator('[data-maze-move="' + a + '"]');
const cross = (p: Page) => p.locator('[data-maze-cross]');
const status = (p: Page) => p.locator('.maze-message');
const cell = (p: Page, n: number) => p.locator('[data-maze-cell="' + n + '"]');
const arrow: Record<string, string> = { N: 'ArrowUp', E: 'ArrowRight', S: 'ArrowDown', W: 'ArrowLeft' };
const btn = (p: Page, name: string) => p.getByRole('button', { name, exact: true });
const tap = (p: Page, name: string, touch: boolean) => touch ? btn(p, name).tap() : btn(p, name).click();
async function play(p: Page, touch: boolean, moves: string) {
  for (const a of moves)
    if (touch) await (arrow[a] ? dir(p, a) : p.locator('[data-maze-cross="' + (Number(a) - 1) + '"]')).tap();
    else await board(p).press(arrow[a] ?? a);
}
const save = (p: Page) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}').completed?.['layered-maze'], STORAGE_KEY);
const pos = (p: Page, n: number) => expect(root(p)).toHaveAttribute('data-pos', String(n));
const moveCount = (p: Page, n: number) => expect(p.locator('.maze-counters span')).toHaveText(n + ' 步');
const complete = async (p: Page, index: number) => {
  await expect(root(p)).toHaveAttribute('data-won', 'true');
  await expect(p.locator('.status.success')).toHaveText('邮戳集齐，成功走出迷宫！');
  await expect.poll(() => save(p)).toContain(index);
};
for (let group = 0; group < 3; group++) {
  test('Proves floors and stamps in levels ' + (group * 4 + 1) + ' to ' + (group * 4 + 4), async ({ page, isMobile }, info) => {
    const errors = captureErrors(page);
    await openGame(page, title);
    for (let index = group * 4; index < group * 4 + 4; index++) {
      await chooseLevel(page, index);
      await expect(root(page)).toHaveAttribute('data-maze-id', 'layered-maze-' + String(index + 1).padStart(2, '0'));
      await moveCount(page, 0);
      if ([0, 6, 11].includes(index)) {
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
        await page.screenshot({ path: info.outputPath('start-' + (index + 1) + '.png'), fullPage: true, animations: 'disabled' });
      }
      await play(page, isMobile, routes[index]);
      await moveCount(page, routes[index].length);
      await complete(page, index);
      await expect(cross(page)).toBeDisabled();
      if (index === 0) {
        await tap(page, '下一关', isMobile);
        await expect(root(page)).toHaveAttribute('data-maze-id', 'layered-maze-02');
      }
      if (index === 11)
        await page.screenshot({ path: info.outputPath('win-12.png'), fullPage: true, animations: 'disabled' });
    }
    expect(errors).toEqual([]);
  });
}
test('Spent stairs close on both floors but stay walkable; stamps, preview, dead ends and undo', async ({ page, isMobile }, info) => {
  const errors = captureErrors(page);
  await openGame(page, title);
  await chooseLevel(page, 1);
  await play(page, isMobile, 'E');
  await pos(page, 6);
  await expect(status(page)).toContainText('还没集齐');
  await expect(root(page)).toHaveAttribute('data-won', 'false');
  await play(page, isMobile, 'WNW1');
  await pos(page, 12);
  await expect(cross(page)).toBeDisabled();
  if (!isMobile) { await play(page, false, '1'); await pos(page, 12); }
  await expect(cell(page, 12)).toHaveAttribute('data-spent', 'true');
  await tap(page, '预览1 层', isMobile);
  await expect(cell(page, 0)).toHaveAttribute('data-spent', 'true');
  await expect(status(page)).toContainText('角色没有移动');
  await expect(dir(page, 'E')).toBeDisabled();
  await tap(page, '回到所在楼层', isMobile);
  await pos(page, 12);
  await play(page, isMobile, 'ESES2');
  await pos(page, 10);
  await expect(root(page)).toHaveAttribute('data-spent', '3');
  await tap(page, '提示', isMobile);
  await expect(status(page)).toContainText('已无通关路线');
  await page.screenshot({ path: info.outputPath('dead.png'), fullPage: true, animations: 'disabled' });
  await tap(page, '撤销', isMobile);
  await pos(page, 22);
  await expect(root(page)).toHaveAttribute('data-spent', '1');
  await expect(cross(page)).toBeEnabled();
  await tap(page, '提示', isMobile);
  await expect(status(page)).toContainText('还需 4 步');
  await expect(dir(page, 'E')).toHaveAttribute('data-hinted', 'true');
  await pos(page, 22);
  await play(page, isMobile, 'E');
  await expect(root(page)).toHaveAttribute('data-stamps', '1');
  await tap(page, '撤销', isMobile);
  await expect(root(page)).toHaveAttribute('data-stamps', '0');
  await expect(cell(page, 23)).toHaveAttribute('data-stamp', 'true');
  await play(page, isMobile, 'EW2N');
  await complete(page, 1);
  expect(errors).toEqual([]);
});

test('Reloads the exact late attempt, keeps pause isolated, and resets intentionally', async ({ page, isMobile }) => {
  const errors = captureErrors(page);
  await openGame(page, title);
  await chooseLevel(page, 11);
  await play(page, isMobile, 'SEE3NE1');
  const before = await root(page).getAttribute('data-pos');
  await expect(root(page)).toHaveAttribute('data-spent', '5');
  await tap(page, '暂停', isMobile);
  await expect(dir(page, 'N')).toBeDisabled();
  await expect(status(page)).toHaveText('已暂停。');
  await tap(page, '继续游戏', isMobile);
  await page.reload();
  await page.getByRole('textbox', { name: '搜索游戏' }).fill(title);
  await btn(page, '开始玩' + title).click();
  await expect(root(page)).toHaveAttribute('data-maze-id', 'layered-maze-12');
  await expect(root(page)).toHaveAttribute('data-pos', before!);
  await expect(root(page)).toHaveAttribute('data-spent', '5');
  await moveCount(page, 7);
  await tap(page, '提示', isMobile);
  await expect(status(page)).toContainText('已无通关路线');
  await tap(page, '撤销', isMobile);
  await expect(root(page)).toHaveAttribute('data-spent', '4');
  await tap(page, '提示', isMobile);
  await expect(status(page)).toContainText('还需 20 步');
  await moveCount(page, 6);
  await tap(page, '重来', isMobile);
  await pos(page, 6);
  await moveCount(page, 0);
  await expect(root(page)).toHaveAttribute('data-spent', '0');
  await play(page, isMobile, routes[11]);
  await complete(page, 11);
  await tap(page, '返回大厅', isMobile);
  await expect(page.getByRole('textbox', { name: '搜索游戏' })).toBeVisible();
  expect(errors).toEqual([]);
});
