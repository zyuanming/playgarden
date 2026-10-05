import { test, expect } from '@playwright/test';
import { openGame, captureErrors } from './helpers';
import { lightLevels } from '../src/games/lightLogic';
import { STORAGE_KEY } from '../src/lib/progress';

// Exercise a freshly earned current save, not old-format compatibility.
test('current save survives reload and shared pause/reset controls work', async ({ page }) => {
  const errors = captureErrors(page);
  await openGame(page, '光线实验室');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await expect(page.getByText('休息一下，也很好。')).toBeVisible();
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('休息一下，也很好。')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('休息一下，也很好。')).toHaveCount(0);
  const level = lightLevels[0];
  for (let i = 0; i < level.mirrors.length; i++) {
    if (level.mirrors[i].slash !== level.solution[i]) {
      await page.getByRole('button', { name: new RegExp(`镜子 ${i + 1}，`) }).click();
    }
  }
  await expect(page.locator('.status')).toHaveClass(/success/);
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  await expect.poll(async () => (await saved()).completed.light).toContain(0);
  expect((await saved()).version).toBe(2);
  await page.getByRole('button', { name: '重来', exact: true }).click();
  await expect(page.locator('.status')).not.toHaveClass(/success/);
  for (let i = 0; i < level.mirrors.length; i++) {
    await expect(page.getByRole('button', { name: `镜子 ${i + 1}，${level.mirrors[i].slash ? '斜杠' : '反斜杠'}，点击旋转`, exact: true })).toBeEnabled();
  }
  await page.reload();
  expect((await saved()).completed.light).toContain(0);
  await page.getByRole('textbox', { name: '搜索游戏' }).fill('光线实验室');
  await page.getByRole('button', { name: '开始玩光线实验室', exact: true }).click();
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue('1');
  expect(errors).toEqual([]);
});
