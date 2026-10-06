import { test, expect } from "@playwright/test";
test("Project GPL links, original third-party terms and source are readable in both screens", async ({
  page,
}, info) => {
  await page.goto("/");
  const legal = page.getByLabel("项目许可与完整源码");
  await expect(
    legal.getByRole("link", { name: "项目许可 · GPL-3.0-only", exact: true }),
  ).toHaveAttribute("href", "./playgarden-COPYING.txt");
  await expect(
    legal.getByRole("link", { name: "本版本完整源码与构建说明", exact: true }),
  ).toHaveAttribute(
    "href",
    "https://github.com/zyuanming/playgarden/tree/main",
  );
  await legal.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("project-license-catalog.png"),
    fullPage: true,
  });
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("中国象棋");
  await page
    .getByRole("button", { name: "开始玩中国象棋", exact: true })
    .click();
  await expect(page.getByRole("grid")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "完整 BSD-2-Clause 许可", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("项目许可与完整源码")).toBeVisible();
  await page.getByLabel("项目许可与完整源码").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("project-license-xiangqi.png"),
    fullPage: true,
  });
});
