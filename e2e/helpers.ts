import { expect, type Page, type TestInfo } from "@playwright/test";
export async function openGame(page: Page, title: string) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "搜索游戏" }).fill(title);
  await page
    .getByRole("button", { name: `开始玩${title}`, exact: true })
    .click();
  await expect(page.locator(".game-surface")).toBeVisible();
}
export async function chooseLevel(page: Page, level: number) {
  await page
    .getByLabel("选择关卡", { exact: true })
    .selectOption(String(level));
  await expect(page.locator(".game-main")).toHaveAttribute(
    "data-level",
    String(level),
  );
}
export async function complete(
  page: Page,
  info: TestInfo,
  game: string,
  level: number,
) {
  await expect(page.locator(".status")).toHaveClass(/success/, {
    timeout: 30000,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if ([0, 5, 11].includes(level))
    await page.screenshot({
      path: info.outputPath(`${game}-${level + 1}.png`),
      fullPage: true,
      animations: "disabled",
    });
}
export function captureErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}
