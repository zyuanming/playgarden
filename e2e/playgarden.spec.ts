import { test, expect } from "@playwright/test";
import { games } from "../src/lib/registry";
import { lightLevels } from "../src/games/lightLogic";
import { robotLevels, commandLabels } from "../src/games/robotLogic";
import { bridgeLevels } from "../src/games/bridgeLogic";
import { slideLevels } from "../src/games/slideLogic";
import { sudokuLevels } from "../src/games/sudokuLogic";
import { lightsOutLevels } from "../src/games/lightsOutLogic";
import { memoryLevels } from "../src/games/memoryLogic";
import { minesLevels } from "../src/games/minesLogic";
import { hanoiLevels } from "../src/games/hanoiLogic";
import { STORAGE_KEY, LEGACY_STORAGE_KEY } from "../src/lib/progress";

import { openGame, chooseLevel, complete, captureErrors } from "./helpers";

test("catalog search, category, difficulty, favorites and legacy migration", async ({
  page,
}, info) => {
  await page.addInitScript(
    ({ key }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          favorites: ["light"],
          completed: { light: [0], robot: [], bridge: [] },
          muted: true,
        }),
      );
    },
    { key: LEGACY_STORAGE_KEY },
  );
  await page.goto("/");
  await expect(page.locator(".game-card")).toHaveCount(
    Math.min(games.length, 12),
  );
  await page.screenshot({
    path: info.outputPath("catalog.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "我的收藏", exact: true }).click();
  await expect(page.locator(".game-card")).toHaveCount(1);
  await page.getByRole("button", { name: "游戏大厅", exact: true }).click();
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("机器人");
  await expect(page.locator(".game-card")).toHaveCount(1);
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("");
  await page.getByRole("button", { name: "数字推理", exact: true }).click();
  await expect(page.locator(".game-card")).toHaveCount(
    games.filter((g) => g.category === "数字推理").length,
  );
  await page.getByRole("button", { name: "全部", exact: true }).click();
  await page.getByRole("combobox", { name: "筛选难度" }).selectOption("进阶");
  await expect(page.locator(".game-card")).toHaveCount(
    games.filter((g) => g.difficulty === "进阶").length,
  );
  await page
    .getByRole("combobox", { name: "筛选难度" })
    .selectOption("全部难度");
  await page
    .getByRole("button", { name: "开始玩光线实验室", exact: true })
    .click();
  await expect(page.getByLabel("选择关卡", { exact: true })).toHaveValue("1");
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(page.getByText("休息一下，也很好。")).toBeVisible();
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    STORAGE_KEY,
  );
  expect(saved.version).toBe(2);
  expect(saved.completed.light).toEqual([0]);
});

test("all 12 light levels", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "光线实验室");
  for (let level = 0; level < lightLevels.length; level++) {
    await chooseLevel(page, level);
    const config = lightLevels[level];
    for (let i = 0; i < config.mirrors.length; i++)
      if (config.mirrors[i].slash !== config.solution[i])
        await page
          .getByRole("button", { name: new RegExp(`镜子 ${i + 1}，`) })
          .click();
    await complete(page, info, "light", level);
  }
  expect(errors).toEqual([]);
});

test("all 12 robot programs", async ({ page }, info) => {
  test.setTimeout(180000);
  const errors = captureErrors(page);
  await openGame(page, "机器人路线");
  for (let level = 0; level < robotLevels.length; level++) {
    await chooseLevel(page, level);
    const config = robotLevels[level];
    for (const c of config.solution)
      await page
        .getByRole("button", { name: commandLabels[c], exact: true })
        .click();
    await page
      .locator(".repeat-label select")
      .selectOption(String(config.repeat));
    await page.getByRole("button", { name: "运行程序", exact: true }).click();
    await complete(page, info, "robot", level);
    const box = await page.locator(".robot-cell").first().boundingBox();
    expect(Math.abs(box!.width - box!.height)).toBeLessThan(1);
  }
  expect(errors).toEqual([]);
});

test("all 12 bridge routes with actual WebGL", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "积木桥梁");
  await expect(page.locator(".bridge-scene canvas")).toBeVisible();
  for (let level = 0; level < bridgeLevels.length; level++) {
    await chooseLevel(page, level);
    const config = bridgeLevels[level];
    for (let i = 0; i < config.tiles.length; i++) {
      const tile = config.tiles[i],
        turns =
          (config.solution[i] - tile.rotation + 4) %
          (tile.kind === "straight" ? 2 : 4);
      for (let n = 0; n < turns; n++)
        await page
          .getByRole("button", {
            name: `${tile.x + 1} 列 ${tile.y + 1} 行桥块，旋转`,
            exact: true,
          })
          .click();
    }
    await complete(page, info, "bridge", level);
    const box = await page.locator(".bridge-grid button").first().boundingBox();
    expect(Math.abs(box!.width - box!.height)).toBeLessThan(1);
  }
  expect(errors).toEqual([]);
});

test("all 12 sliding puzzles", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "数字滑块");
  for (let level = 0; level < slideLevels.length; level++) {
    await chooseLevel(page, level);
    for (const tile of slideLevels[level].solution)
      await page
        .getByRole("button", { name: new RegExp(`^数字 ${tile}，可滑入空格`) })
        .click();
    await complete(page, info, "slide", level);
  }
  expect(errors).toEqual([]);
});

test("all 12 Sudoku puzzles", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "四格数独");
  for (let level = 0; level < sudokuLevels.length; level++) {
    await chooseLevel(page, level);
    const config = sudokuLevels[level];
    for (let i = 0; i < 16; i++) {
      if (config.givens[i]) continue;
      await page
        .getByRole("button", {
          name: new RegExp(
            `^第 ${Math.floor(i / 4) + 1} 行第 ${(i % 4) + 1} 列，`,
          ),
        })
        .click();
      await page
        .getByRole("button", {
          name: `填入 ${config.solution[i]}`,
          exact: true,
        })
        .click();
    }
    await complete(page, info, "sudoku", level);
  }
  expect(errors).toEqual([]);
});

test("all 12 Lights Out boards", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "熄灯谜阵");
  for (let level = 0; level < lightsOutLevels.length; level++) {
    await chooseLevel(page, level);
    const config = lightsOutLevels[level];
    for (const cell of config.solution)
      await page
        .getByRole("button", {
          name: new RegExp(
            `^第 ${Math.floor(cell / config.size) + 1} 行第 ${(cell % config.size) + 1} 列，`,
          ),
        })
        .click();
    await complete(page, info, "lights-out", level);
  }
  expect(errors).toEqual([]);
});

test("all 12 memory layouts", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "记忆花园");
  for (let level = 0; level < memoryLevels.length; level++) {
    await chooseLevel(page, level);
    const config = memoryLevels[level];
    for (let face = 0; face < config.pairs; face++)
      for (let i = 0; i < config.cards.length; i++)
        if (config.cards[i] === face)
          await page
            .getByRole("button", {
              name: new RegExp(
                `^第 ${Math.floor(i / config.columns) + 1} 行第 ${(i % config.columns) + 1} 列，未翻开的卡片`,
              ),
            })
            .click();
    await complete(page, info, "memory", level);
  }
  expect(errors).toEqual([]);
});

test("all 12 deductively solvable gardens", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "花园侦探");
  for (let level = 0; level < minesLevels.length; level++) {
    await chooseLevel(page, level);
    const config = minesLevels[level];
    for (const cell of config.solution) {
      const button = page.getByRole("button", {
        name: new RegExp(
          `^第 ${Math.floor(cell / config.size) + 1} 行第 ${(cell % config.size) + 1} 列，`,
        ),
      });
      if (!(await button.isDisabled())) await button.click();
    }
    await complete(page, info, "mines", level);
  }
  expect(errors).toEqual([]);
});

test("all 12 Hanoi arrangements", async ({ page }, info) => {
  test.setTimeout(180000);
  const errors = captureErrors(page);
  await openGame(page, "圆盘搬家");
  for (let level = 0; level < hanoiLevels.length; level++) {
    await chooseLevel(page, level);
    for (const move of hanoiLevels[level].solution) {
      await page
        .getByRole("button", { name: new RegExp(`^${move.from + 1} 号柱`) })
        .click();
      await page
        .getByRole("button", { name: new RegExp(`^${move.to + 1} 号柱`) })
        .click();
    }
    await complete(page, info, "hanoi", level);
  }
  expect(errors).toEqual([]);
});
