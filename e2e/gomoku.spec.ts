import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
const puzzles = JSON.parse(readFileSync("docs/gomoku/corpus.json", "utf8")) as {
  id: string;
  chapter: number;
  moves: number[];
  solution: number;
  solutions: number[];
  objective: string;
  continuation: number[];
}[];
const board = (page: Page) => page.locator(".gomoku-garden");
const point = (page: Page, index: number) =>
  page.locator(`[data-gomoku-point="${index}"]`);
async function activate(locator: Locator, touch: boolean) {
  if (touch) await locator.tap();
  else await locator.click();
}
async function open(page: Page) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("自由五子棋");
  await page
    .getByRole("button", { name: "开始玩自由五子棋", exact: true })
    .click();
  await expect(page.getByRole("grid")).toBeVisible();
}
async function place(page: Page, index: number, touch: boolean) {
  await activate(point(page, index), touch);
  await expect(page.getByRole("button", { name: /^确认落子/ })).toBeEnabled();
  await activate(page.getByRole("button", { name: /^确认落子/ }), touch);
}
async function layout(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const rect = await page.getByRole("grid").boundingBox();
  expect(rect?.width).toBeGreaterThan(170);
  expect(Math.abs(rect!.width - rect!.height)).toBeLessThan(2);
  await expect(page.locator(".module-error")).toHaveCount(0);
}
async function confirmContrast(page: Page) {
  const button = page.getByRole("button", { name: /^确认落子/ });
  const result = await button.evaluate((node) => {
    const s = getComputedStyle(node);
    const luminance = (color: string) => {
      const rgb = color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const a = luminance(s.color),
      b = luminance(s.backgroundColor);
    return {
      ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      height: node.getBoundingClientRect().height,
      width: node.getBoundingClientRect().width,
    };
  });
  expect(result.ratio).toBeGreaterThanOrEqual(4.5);
  expect(result.height).toBeGreaterThanOrEqual(44);
  expect(result.width).toBeGreaterThanOrEqual(44);
}
for (let chapter = 1; chapter <= 4; chapter++)
  test(`Gomoku chapter ${chapter}: every teaching shape through real controls`, async ({
    page,
    isMobile,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page);
    await page.getByRole("button", { name: "棋形练习", exact: true }).click();
    for (const [index, p] of puzzles.entries()) {
      if (p.chapter !== chapter) continue;
      await page
        .getByLabel("选择关卡", { exact: true })
        .selectOption(String(index));
      await expect(board(page)).toHaveAttribute(
        "data-gomoku-moves",
        String(p.moves.length),
      );
      await expect(board(page)).toHaveAttribute("data-gomoku-stage", "ready");
      await layout(page);
      await page.screenshot({
        path: info.outputPath(`gomoku-${p.id}-start.png`),
        fullPage: true,
      });
      await activate(point(page, p.solution), isMobile);
      await expect(board(page)).toHaveAttribute(
        "data-gomoku-moves",
        String(p.moves.length),
      );
      await expect(point(page, p.solution)).toHaveAttribute(
        "aria-selected",
        "true",
      );
      if (index % 6 === 0) {
        await confirmContrast(page);
        const confirmation = page.getByRole("button", { name: /^确认落子/ });
        await confirmation.hover();
        await confirmContrast(page);
        await point(page, p.solution).focus();
        await page.keyboard.press("Tab");
        await expect(confirmation).toBeFocused();
        await confirmContrast(page);
        await page.screenshot({
          path: info.outputPath(`gomoku-${p.id}-preview-confirm-focus.png`),
          fullPage: true,
        });
      }

      await activate(page.getByRole("button", { name: /^确认落子/ }), isMobile);
      if (p.objective === "two") {
        await expect(board(page)).toHaveAttribute(
          "data-gomoku-stage",
          "finish",
        );
        await place(page, p.continuation[2], isMobile);
      }
      await expect(board(page)).toHaveAttribute("data-gomoku-won", "true");
      await expect(page.locator(".status")).toHaveClass(/success/);
      await page.screenshot({
        path: info.outputPath(`gomoku-${p.id}-complete.png`),
        fullPage: true,
      });
      const after = await board(page).getAttribute("data-gomoku-moves");
      await point(page, 224).click({ force: true });
      await expect(board(page)).toHaveAttribute("data-gomoku-moves", after!);
      await expect(
        page.getByRole("button", { name: "撤销", exact: true }),
      ).toBeDisabled();
    }
    expect(errors).toEqual([]);
  });
test("Gomoku local full game, undo, terminal lock and refresh", async ({
  page,
  isMobile,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await page.getByLabel("对手", { exact: true }).selectOption("local");
  await page.getByRole("button", { name: "按设置开新局", exact: true }).click();
  for (const i of [0, 15, 1, 16, 2, 17, 3, 18]) await place(page, i, isMobile);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(board(page)).toHaveAttribute("data-gomoku-moves", "7");
  await place(page, 18, isMobile);
  await place(page, 4, isMobile);
  await expect(board(page)).toHaveAttribute("data-gomoku-winner", "1");
  await expect(page.locator(".game-win-banner")).toHaveCount(0);
  await expect(page.locator(".gomoku-point.winning")).toHaveCount(5);
  await page.screenshot({
    path: info.outputPath("gomoku-local-victory.png"),
    fullPage: true,
  });
  await point(page, 19).click({ force: true });
  await expect(board(page)).toHaveAttribute("data-gomoku-moves", "9");
  await page.reload();
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("自由五子棋");
  await page
    .getByRole("button", { name: "开始玩自由五子棋", exact: true })
    .click();
  await expect(page.getByRole("grid")).toBeVisible();
  await expect(board(page)).toHaveAttribute("data-gomoku-winner", "1");
  await expect(board(page)).toHaveAttribute("data-gomoku-moves", "9");
  await page.getByRole("button", { name: "重来", exact: true }).click();
  await expect(board(page)).toHaveAttribute("data-gomoku-moves", "0");
  await expect(
    page.getByText("当前：两人轮流下。", { exact: false }),
  ).toBeVisible();
  await layout(page);
  expect(errors).toEqual([]);
});
test("Gomoku real module worker, pause, change sides, navigation and saved match", async ({
  page,
  isMobile,
}, info) => {
  const errors: string[] = [];
  const workers: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("worker", (w) => workers.push(w.url()));
  await open(page);
  await place(page, 112, isMobile);
  await expect(board(page)).toHaveAttribute("data-gomoku-moves", "2");
  expect(workers.some((u) => u.includes("gomoku.worker"))).toBe(true);
  await expect(page.getByText(/正在使用简易兼容陪练/)).toHaveCount(0);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(board(page)).toHaveAttribute("data-gomoku-moves", "0");
  await place(page, 111, isMobile);
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  const frozen = await board(page).getAttribute("data-gomoku-moves");
  await expect(
    page.getByRole("heading", { name: "休息一下，也很好。" }),
  ).toBeVisible();
  await page.waitForTimeout(650);
  await expect(board(page)).toHaveAttribute("data-gomoku-moves", frozen!);
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  await expect(board(page)).toHaveAttribute("data-gomoku-moves", "2");
  await page.getByLabel("你的棋子", { exact: true }).selectOption("2");
  await page.getByLabel("陪练节奏", { exact: true }).selectOption("steady");
  await page.getByRole("button", { name: "按设置开新局", exact: true }).click();
  await expect(board(page)).toHaveAttribute("data-gomoku-moves", "2");
  await page
    .getByRole("button", { name: "确认结束这局并开新局", exact: true })
    .click();
  await expect(board(page)).toHaveAttribute("data-gomoku-moves", "1");
  await expect(point(page, 112)).toHaveAttribute("aria-label", /黑棋/);
  await place(page, 113, isMobile);
  await expect(board(page)).toHaveAttribute("data-gomoku-moves", "3");
  await page.getByRole("button", { name: "返回游戏大厅", exact: true }).click();
  await page
    .getByRole("button", { name: "开始玩自由五子棋", exact: true })
    .click();
  await expect(page.getByRole("grid")).toBeVisible();
  await expect(board(page)).toHaveAttribute("data-gomoku-moves", "3");
  await expect(page.getByLabel("你的棋子", { exact: true })).toHaveValue("2");
  await page.screenshot({
    path: info.outputPath("gomoku-worker-resumed.png"),
    fullPage: true,
  });
  await layout(page);
  expect(errors).toEqual([]);
});
test("Gomoku keyboard-only focus, modifiers, narrow board, pause and exercise recovery", async ({
  page,
}, info) => {
  await open(page);
  await page.getByRole("button", { name: "棋形练习", exact: true }).click();
  await page.getByLabel("选择关卡", { exact: true }).selectOption("4");
  await expect(board(page)).toHaveAttribute(
    "data-gomoku-moves",
    String(puzzles[4].moves.length),
  );
  // Tab from the external hint button reaches the one roving grid entry.
  await page.getByRole("button", { name: "提示", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(point(page, 112)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(point(page, 111)).toBeFocused();
  await page.screenshot({
    path: info.outputPath("gomoku-pure-keyboard-focus.png"),
    fullPage: true,
  });
  await page.keyboard.press("Control+Enter");
  await page.keyboard.press("Meta+Space");
  await expect(board(page)).toHaveAttribute(
    "data-gomoku-moves",
    String(puzzles[4].moves.length),
  );
  await page.keyboard.press("Enter");
  await expect(board(page)).toHaveAttribute("data-gomoku-winner", "1");
  await expect(page.locator(".gomoku-point.winning")).toHaveCount(6);
  await page.getByRole("button", { name: "重来", exact: true }).click();
  await expect(board(page)).toHaveAttribute("data-gomoku-stage", "ready");
  await page.setViewportSize({ width: 320, height: 740 });
  await layout(page);
  await page.screenshot({
    path: info.outputPath("gomoku-320px-board.png"),
    fullPage: true,
  });
  await place(page, 224, false);
  await expect(board(page)).toHaveAttribute("data-gomoku-stage", "retry");
  await page
    .getByRole("button", { name: "撤销，再想一手", exact: true })
    .click();
  await expect(board(page)).toHaveAttribute("data-gomoku-stage", "ready");
  await page.getByRole("button", { name: "想法提示", exact: true }).click();
  await expect(board(page)).toHaveAttribute(
    "data-gomoku-moves",
    String(puzzles[4].moves.length),
  );
});
