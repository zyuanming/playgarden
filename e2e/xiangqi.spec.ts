import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
const puzzles = JSON.parse(
  readFileSync("docs/xiangqi/corpus.json", "utf8"),
) as {
  id: string;
  chapter: number;
  fen: string;
  solutions: string[];
  objective: string;
}[];
const root = (page: Page) => page.locator(".xiangqi-garden");
const square = (page: Page, s: string) =>
  page.locator(`[data-xiangqi-square="${s}"]`);
async function activate(el: Locator, touch: boolean) {
  if (touch) await el.tap();
  else await el.click();
}
async function enter(page: Page) {
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("中国象棋");
  await page
    .getByRole("button", { name: "开始玩中国象棋", exact: true })
    .click();
  await expect(page.getByRole("grid")).toBeVisible();
}
async function open(page: Page) {
  await page.goto("/");
  await enter(page);
}
async function select(page: Page, move: string, touch = false) {
  await activate(square(page, move.slice(0, 2)), touch);
  await activate(square(page, move.slice(2)), touch);
  await expect(
    page.getByRole("button", { name: "确认走棋", exact: true }),
  ).toBeEnabled();
}
async function play(page: Page, move: string, touch = false) {
  await select(page, move, touch);
  await activate(
    page.getByRole("button", { name: "确认走棋", exact: true }),
    touch,
  );
}
async function layout(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const b = await page.getByRole("grid").boundingBox();
  expect(b?.width).toBeGreaterThan(170);
  expect(Math.abs(b!.width / b!.height - 0.9)).toBeLessThan(0.01);
  await expect(page.locator(".module-error")).toHaveCount(0);
}
async function contrast(page: Page) {
  const x = await page
    .getByRole("button", { name: "确认走棋", exact: true })
    .evaluate((el) => {
      const s = getComputedStyle(el),
        lum = (c: string) => {
          const v = c
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number)
            .map((x) => x / 255)
            .map((x) =>
              x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4,
            );
          return v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722;
        };
      const a = lum(s.color),
        b = lum(s.backgroundColor),
        r = el.getBoundingClientRect();
      return {
        ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        h: r.height,
        w: r.width,
      };
    });
  expect(x.ratio).toBeGreaterThanOrEqual(4.5);
  expect(x.h).toBeGreaterThanOrEqual(44);
  expect(x.w).toBeGreaterThanOrEqual(44);
}
for (let chapter = 1; chapter <= 3; chapter++)
  test(`Xiangqi chapter ${chapter}: all genuine teaching moves`, async ({
    page,
    isMobile,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page);
    await page.getByRole("button", { name: "棋形练习", exact: true }).click();
    for (const [i, p] of puzzles.entries()) {
      if (p.chapter !== chapter) continue;
      await page
        .getByLabel("选择关卡", { exact: true })
        .selectOption(String(i));
      await expect(root(page)).toHaveAttribute("data-xiangqi-stage", "ready");
      await layout(page);
      await page.screenshot({
        path: info.outputPath(`xiangqi-${p.id}-start.png`),
        fullPage: true,
      });
      await select(page, p.solutions[0], isMobile);
      await expect(root(page)).toHaveAttribute("data-xiangqi-moves", "0");
      if (i === [0, 6, 9][chapter - 1]) {
        await contrast(page);
        await page
          .getByRole("button", { name: "确认走棋", exact: true })
          .hover();
        await contrast(page);
        await square(page, p.solutions[0].slice(2)).focus();
        await page.keyboard.press("Tab");
        await expect(
          page.getByRole("button", { name: "确认走棋", exact: true }),
        ).toBeFocused();
        await contrast(page);
        await page.screenshot({
          path: info.outputPath(`xiangqi-${p.id}-confirm-focus.png`),
          fullPage: true,
        });
      }
      await activate(
        page.getByRole("button", { name: "确认走棋", exact: true }),
        isMobile,
      );
      await expect(root(page)).toHaveAttribute("data-xiangqi-stage", "success");
      await expect(page.getByLabel("通关操作")).toBeVisible();
      await page.screenshot({
        path: info.outputPath(`xiangqi-${p.id}-success.png`),
        fullPage: true,
      });
    }
    expect(errors).toEqual([]);
  });
test("Xiangqi complete local play, keyboard, flip, zoom, pauses, saved history and no false progress", async ({
  page,
  isMobile,
}, info) => {
  await open(page);
  await expect(
    page.getByText("9 路 × 10 行 · 休闲对局", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("15 × 15 · 完整对局", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("对手", { exact: true }).selectOption("local");
  await page.getByRole("button", { name: "按设置开新局", exact: true }).click();
  await square(page, "a3").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp");
  await expect(square(page, "a4")).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "确认走棋", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "继续游戏", exact: true }),
  ).toHaveCount(0);
  await select(page, "a3a4", isMobile);
  await contrast(page);
  await page.getByRole("button", { name: "确认走棋", exact: true }).click();
  await play(page, "a6a5", isMobile);
  await expect(root(page)).toHaveAttribute("data-xiangqi-moves", "2");
  await page.getByRole("button", { name: "翻转棋盘", exact: true }).click();
  await expect(square(page, "a4")).toHaveAttribute("aria-label", /红方兵/);
  await page.screenshot({
    path: info.outputPath("xiangqi-local-flipped.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "放大棋盘", exact: true }).click();
  await layout(page);
  await page.screenshot({
    path: info.outputPath("xiangqi-local-zoom.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "适合屏幕", exact: true }).click();
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "继续游戏", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  await expect(root(page)).toHaveAttribute("data-xiangqi-moves", "2");
  await page.reload();
  await enter(page);
  await expect(root(page)).toHaveAttribute("data-xiangqi-moves", "2");
  await expect(square(page, "a4")).toHaveAttribute("aria-label", /红方兵/);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(root(page)).toHaveAttribute("data-xiangqi-moves", "1");
  await expect(square(page, "a6")).toHaveAttribute("aria-label", /黑方卒/);
  await page.getByRole("button", { name: "自由对弈", exact: true }).click();
  await expect(root(page)).toHaveAttribute("data-xiangqi-moves", "1");
  await expect(page.getByLabel("通关操作")).toHaveCount(0);
  await page.getByRole("button", { name: "返回游戏大厅", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "搜索游戏" })).toBeVisible();
  await page.goto("about:blank");
  await page.goBack();
  await expect(page.getByRole("textbox", { name: "搜索游戏" })).toBeVisible();
  await enter(page);
  await expect(root(page)).toHaveAttribute("data-xiangqi-moves", "1");
  await expect(page.locator(".module-error")).toHaveCount(0);
});
test("Xiangqi real local worker responds legally and black-side opening undo never traps the game", async ({
  page,
  isMobile,
}, info) => {
  const workerURLs: string[] = [];
  page.on("worker", (w) => workerURLs.push(w.url()));
  await open(page);
  await play(page, "a3a4", isMobile);
  await expect(root(page)).toHaveAttribute("data-xiangqi-moves", "2");
  await expect(page.getByText(/正在使用简易兼容陪练/)).toHaveCount(0);
  expect(workerURLs.some((u) => u.includes("xiangqi.worker"))).toBe(true);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(root(page)).toHaveAttribute("data-xiangqi-moves", "0");
  await page.getByLabel("你的棋子", { exact: true }).selectOption("b");
  await page.getByRole("button", { name: "按设置开新局", exact: true }).click();
  await expect(root(page)).toHaveAttribute("data-xiangqi-moves", "1");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(root(page)).toHaveAttribute("data-xiangqi-moves", "1");
  await expect(root(page)).toHaveAttribute("data-xiangqi-turn", "b");
  await page.screenshot({
    path: info.outputPath("xiangqi-human-black.png"),
    fullPage: true,
  });
});
test("Xiangqi interrupted pending AI, late responses and restarts remain harmless", async ({
  page,
}, info) => {
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-02T00:00:00Z"));
  await page.addInitScript(() => {
    const all: unknown[] = [];
    (window as unknown as { xqWorkers: unknown[] }).xqWorkers = all;
    class WorkerMock {
      request: unknown;
      terminated = false;
      onmessage: ((e: { data: unknown }) => void) | null = null;
      constructor() {
        all.push(this);
      }
      postMessage(r: unknown) {
        this.request = r;
      }
      terminate() {
        this.terminated = true;
      }
    }
    window.Worker = WorkerMock as unknown as typeof Worker;
  });
  await open(page);
  await play(page, "a3a4");
  await page.clock.runFor(300);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { xqWorkers: unknown[] }).xqWorkers.length,
      ),
    )
    .toBe(1);
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { xqWorkers: { terminated: boolean }[] })
          .xqWorkers[0].terminated,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    const w = (
      window as unknown as {
        xqWorkers: {
          request: object;
          onmessage: (e: { data: object }) => void;
        }[];
      }
    ).xqWorkers[0];
    w.onmessage({ data: { ...w.request, move: "a6a5" } });
  });
  await expect(root(page)).toHaveAttribute("data-xiangqi-moves", "1");
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  await page.clock.runFor(300);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { xqWorkers: unknown[] }).xqWorkers.length,
      ),
    )
    .toBe(2);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(root(page)).toHaveAttribute("data-xiangqi-moves", "0");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { xqWorkers: { terminated: boolean }[] })
          .xqWorkers[1].terminated,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("xiangqi-cancelled-clean.png"),
    fullPage: true,
  });
});
test("Xiangqi narrow 320px board, storage refusal and a legal unsuccessful exercise", async ({
  page,
  isMobile,
}, info) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("storage denied");
    };
  });
  await open(page);
  await layout(page);
  await expect(page.getByText(/当前浏览器无法保存棋谱/)).toBeVisible();
  await page.getByRole("button", { name: "放大棋盘", exact: true }).click();
  await square(page, "a3").focus();
  for (let n = 0; n < 8; n++) await page.keyboard.press("ArrowRight");
  await expect(square(page, "i3")).toBeFocused();
  const scroll = await page.locator(".xiangqi-board-scroll").boundingBox();
  const focused = await square(page, "i3").boundingBox();
  expect(focused!.x).toBeGreaterThanOrEqual(scroll!.x - 1);
  expect(focused!.x + focused!.width).toBeLessThanOrEqual(
    scroll!.x + scroll!.width + 1,
  );
  await page.screenshot({
    path: info.outputPath("xiangqi-320-zoom-keyboard.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "适合屏幕", exact: true }).click();
  await page.getByRole("button", { name: "棋形练习", exact: true }).click();
  await play(page, "a0a1", isMobile);
  await expect(root(page)).toHaveAttribute("data-xiangqi-stage", "retry");
  await page.screenshot({
    path: info.outputPath("xiangqi-320-retry-save-denied.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "撤销，再想一手", exact: true })
    .click();
  await play(page, "a0a6", isMobile);
  await expect(root(page)).toHaveAttribute("data-xiangqi-stage", "success");
  await layout(page);
});
