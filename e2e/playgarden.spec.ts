import { test, expect } from "@playwright/test";
import { lightLevels } from "../src/games/lightLogic";
import { robotLevels, commandLabels } from "../src/games/robotLogic";
import { bridgeLevels } from "../src/games/bridgeLogic";
test("catalog and all nine game levels work with persistent progress", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "玩出一点新发现。" }),
  ).toBeVisible();
  await expect(page.locator(".game-card")).toHaveCount(3);
  await page.screenshot({
    path: testInfo.outputPath("catalog.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "收藏光线实验室", exact: true })
    .click();
  await page.getByRole("button", { name: "我的收藏", exact: true }).click();
  await expect(page.locator(".game-card")).toHaveCount(1);
  await page.getByRole("button", { name: "游戏大厅", exact: true }).click();
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("机器人");
  await expect(page.locator(".game-card")).toHaveCount(1);
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("");
  await page.getByRole("combobox", { name: "筛选难度" }).selectOption("中级");
  await expect(page.locator(".game-card")).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "筛选难度" })
    .selectOption("全部难度");
  await page
    .getByRole("button", { name: "开始玩光线实验室", exact: true })
    .click();
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("向右走的光");
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(page.getByText("休息一下，也很好。")).toBeVisible();
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  for (let level = 0; level < lightLevels.length; level++) {
    const l = lightLevels[level];
    for (let i = 0; i < l.mirrors.length; i++) {
      if (l.mirrors[i].slash !== l.solution[i])
        await page
          .getByRole("button", { name: new RegExp(`镜子 ${i + 1}`) })
          .click();
    }
    await expect(page.getByRole("status")).toContainText("光线到达目标");
    await page.screenshot({
      path: testInfo.outputPath(`light-${level + 1}.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", {
        name: level < 2 ? "下一关" : "返回大厅",
        exact: true,
      })
      .click();
  }
  await page
    .getByRole("button", { name: "开始玩机器人路线", exact: true })
    .click();
  for (let level = 0; level < robotLevels.length; level++) {
    const l = robotLevels[level];
    for (const c of l.solution)
      await page
        .getByRole("button", { name: commandLabels[c], exact: true })
        .click();
    await page.locator(".repeat-label select").selectOption(String(l.repeat));
    await page.getByRole("button", { name: "运行程序", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("到达终点", {
      timeout: 12000,
    });
    await page.screenshot({
      path: testInfo.outputPath(`robot-${level + 1}.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", {
        name: level < 2 ? "下一关" : "返回大厅",
        exact: true,
      })
      .click();
  }
  await page
    .getByRole("button", { name: "开始玩积木桥梁", exact: true })
    .click();
  await expect(page.locator(".bridge-scene canvas")).toBeVisible();
  const tileBox = await page
    .locator(".bridge-grid button")
    .first()
    .boundingBox();
  expect(tileBox).not.toBeNull();
  expect(Math.abs(tileBox!.width - tileBox!.height)).toBeLessThan(1);
  for (let level = 0; level < bridgeLevels.length; level++) {
    const l = bridgeLevels[level];
    for (let i = 0; i < l.tiles.length; i++) {
      const t = l.tiles[i];
      for (
        let n = 0;
        n < (l.solution[i] - t.rotation + 4) % (t.kind === "straight" ? 2 : 4);
        n++
      )
        await page
          .getByRole("button", {
            name: `${t.x + 1} 列 ${t.y + 1} 行桥块，旋转`,
            exact: true,
          })
          .click();
    }
    await expect(page.getByRole("status")).toContainText("桥梁连通了");
    await page.screenshot({
      path: testInfo.outputPath(`bridge-${level + 1}.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", {
        name: level < 2 ? "下一关" : "返回大厅",
        exact: true,
      })
      .click();
  }
  await page.reload();
  await expect(page.locator(".card-progress .done")).toHaveCount(9);
  await expect(
    page.getByRole("button", { name: "取消收藏光线实验室", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
