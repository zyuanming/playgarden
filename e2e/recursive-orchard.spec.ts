import { expect, test, type Page } from "@playwright/test";
import { chooseLevel, openGame, captureErrors } from "./helpers";
import { treeLevels, notation } from "../src/games/recursiveOrchardLogic";
import { STORAGE_KEY } from "../src/lib/progress";

const root = (page: Page) => page.locator(".orchard-game");
const panel = (page: Page) => page.locator(".orchard-panel");
const current = (page: Page) => page.locator('[data-orchard-tree="current"]');
const card = (page: Page, number: number) =>
  page.locator(`[data-orchard-card="${number}"]`);
const act = (page: Page, touch: boolean, number: number) =>
  touch ? card(page, number).tap() : panel(page).press(String(number));
const shell = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).click();
for (let batch = 0; batch < treeLevels.length / 4; batch++) {
  test(`Orchard completes boards ${1 + batch * 4}–${4 + batch * 4}`, async ({
    page,
    isMobile,
  }, info) => {
    const errors = captureErrors(page);
    await openGame(page, "递归树园");
    for (let i = batch * 4; i < batch * 4 + 4; i++) {
      const l = treeLevels[i];
      await chooseLevel(page, i);
      await expect(root(page)).toHaveAttribute("data-orchard-id", l.id);
      await expect(current(page)).toHaveText(notation(l.start));
      const capture = [0, 5, 11, 12, 59, 91, 99].includes(i);
      if (capture) {
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: info.outputPath(`start-${i + 1}.png`),
          fullPage: true,
        });
      }
      for (const n of l.solution) await act(page, isMobile, n);
      await expect(root(page)).toHaveAttribute("data-orchard-won", "true");
      await expect(current(page)).toHaveText(notation(l.target));
      await expect(page.locator(".status")).toHaveClass(/success/);
      await expect(card(page, 1)).toBeDisabled();
      await expect
        .poll(() =>
          page.evaluate(
            (key) =>
              JSON.parse(localStorage.getItem(key) ?? "{}").completed?.[
                "recursive-orchard"
              ],
            STORAGE_KEY,
          ),
        )
        .toContain(i);
      if (i === 11) {
        expect(
          await page.locator(".orchard-drawing").evaluateAll((boxes) =>
            boxes.every((box) => {
              const bounded = box.getBoundingClientRect();
              const leaves = Array.from(
                box.querySelectorAll(".orchard-node:not(.orchard-junction)"),
              );
              return (
                leaves.length === 10 &&
                leaves.every((leaf) => {
                  const r = leaf.getBoundingClientRect();
                  return (
                    r.left >= bounded.left &&
                    r.right <= bounded.right &&
                    r.width >= 12
                  );
                })
              );
            }),
          ),
        ).toBe(true);
        await page.screenshot({
          path: info.outputPath("won-12.png"),
          fullPage: true,
        });
        await page.reload();
        await expect
          .poll(() =>
            page.evaluate(
              (key) =>
                JSON.parse(localStorage.getItem(key) ?? "{}").completed?.[
                  "recursive-orchard"
                ],
              STORAGE_KEY,
            ),
          )
          .toContain(i);
      }
    }
    expect(errors).toEqual([]);
  });
}
test("Orchard guards turns, ordered branches, and parallel old-bud growth", async ({
  page,
  isMobile,
}) => {
  const errors = captureErrors(page);
  await openGame(page, "递归树园");
  const play = (n: number) => act(page, isMobile, n);
  const status = page.locator(".orchard-status");
  const used = (n: number) =>
    expect(root(page)).toHaveAttribute("data-orchard-used", String(n));
  await play(3);
  await used(0);
  await expect(status).toContainText("没有这张卡能影响的芽");
  await chooseLevel(page, 1);
  await panel(page).press("Control+1");
  await used(0);
  await play(1);
  await expect(current(page)).toHaveText("(AB)");
  await shell(page, "提示");
  await expect(status).toContainText("撤销一步再试");
  await play(3);
  await play(4);
  await expect(current(page)).toHaveText("(XY)");
  await expect(root(page)).toHaveAttribute("data-orchard-won", "false");
  await expect(card(page, 2)).toBeDisabled();
  await shell(page, "撤销");
  await used(2);
  await shell(page, "重来");
  await used(0);
  await shell(page, "提示");
  await expect(card(page, 2)).toHaveAttribute("data-hinted", "true");
  await expect(current(page)).toHaveText("A");
  await shell(page, "暂停");
  await expect(card(page, 2)).toBeDisabled();
  await shell(page, "继续游戏");
  await expect(card(page, 2)).toBeEnabled();
  await chooseLevel(page, 2);
  await play(1);
  await play(4);
  await expect(card(page, 3)).toHaveAttribute("data-orchard-count", "2");
  await play(3);
  await expect(root(page)).toHaveAttribute("data-orchard-won", "true");
  await chooseLevel(page, 3);
  for (let j = 0; j < 3; j++) await play(1);
  await used(3);
  const before = await current(page).textContent();
  await play(1);
  await expect(status).toContainText("超过 12 个末端");
  await used(3);
  await expect(current(page)).toHaveText(before!);
  await chooseLevel(page, 11);
  await play(2);
  await expect(current(page)).toHaveText("(BB)");
  await expect(card(page, 1)).toHaveAttribute("data-orchard-count", "2");
  await play(1);
  await expect(current(page)).toHaveText("((AX)(AX))");
  await used(2);
  await shell(page, "撤销");
  await expect(current(page)).toHaveText("(BB)");
  await used(1);
  expect(errors).toEqual([]);
});

const target = (page: Page) => page.locator('[data-orchard-tree="target"]');
const used = (page: Page, n: number) => expect(root(page)).toHaveAttribute("data-orchard-used", String(n));
const control = (page: Page, touch: boolean, name: string) => {
  const b = page.getByRole("button", { name, exact: true });
  return touch ? b.tap() : b.click();
};
const complete = async (page: Page) => {
  await expect(root(page)).toHaveAttribute("data-orchard-won", "true");
  await expect(page.locator(".status")).toHaveClass(/success/);
};
async function sequence(page: Page, touch: boolean, moves: number[]) {
  for (const n of moves) await act(page, touch, n);
}
async function drawing(page: Page, name: "current" | "target", count: number, svgHeight: number) {
  const box = page.locator(".orchard-diagram").filter({
    has: page.locator('[data-orchard-tree="' + name + '"]'),
  }).locator(".orchard-drawing");
  await expect(box.locator("svg")).toHaveAttribute("height", String(svgHeight));
  const leaves = box.locator(".orchard-node:not(.orchard-junction)");
  await expect(leaves).toHaveCount(count);
  expect(await box.evaluate(b => {
    const bounds = b.getBoundingClientRect();
    return [...b.querySelectorAll(".orchard-node:not(.orchard-junction)")].every(n => {
      const r = n.getBoundingClientRect();
      return r.left >= bounds.left && r.right <= bounds.right && r.top >= bounds.top &&
        r.bottom <= bounds.bottom && r.width >= 12;
    });
  })).toBe(true);
}

test("Original 12 legitimately advances to 13 and both completions survive refresh", async ({ page, isMobile }) => {
  const errors = captureErrors(page);
  await openGame(page, "递归树园");
  await chooseLevel(page, 11);
  await sequence(page, isMobile, [2, 1, 3, 2, 3, 4, 5]);
  await complete(page);
  await control(page, isMobile, "下一关");
  await expect(root(page)).toHaveAttribute("data-orchard-id", "recursive-orchard-013");
  await used(page, 0);
  await sequence(page, isMobile, [3, 3, 4, 2]);
  await complete(page);
  await page.reload();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}").completed?.["recursive-orchard"], STORAGE_KEY))
    .toEqual(expect.arrayContaining([11, 12]));
  expect(errors).toEqual([]);
});

test("Level 60 accepts both alternate six-move orders", async ({ page, isMobile }) => {
  const errors = captureErrors(page);
  await openGame(page, "递归树园");
  await chooseLevel(page, 59);
  for (const moves of [[6, 2, 2, 6, 1, 4], [6, 2, 2, 6, 4, 1]]) {
    await used(page, 0);
    await sequence(page, isMobile, moves);
    await complete(page);
    await used(page, 6);
    await control(page, isMobile, "重来");
  }
  expect(errors).toEqual([]);
});

test("Level 100 protects the cap without consuming turns; one card converts all eight B buds", async ({ page, isMobile }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "递归树园");
  await chooseLevel(page, 99);
  const status = page.locator(".orchard-status");
  await act(page, isMobile, 2);
  await used(page, 1);
  const stranded = (await current(page).textContent())!;
  await control(page, isMobile, "提示");
  await used(page, 1);
  await expect(current(page)).toHaveText(stranded);
  await expect(status).toContainText("撤销一步再试");
  await control(page, isMobile, "撤销");
  await used(page, 0);
  await expect(current(page)).toHaveText("((AB)A)");
  await sequence(page, isMobile, [1, 4, 3, 1, 5, 5]);
  await used(page, 6);
  await expect(card(page, 4)).toHaveAttribute("data-orchard-count", "8");
  const full = (await current(page).textContent())!;
  expect(full.replace(/[^ABXY]/g, "").length).toBe(14);
  for (const n of [1, 5]) {
    await expect(card(page, n)).toContainText("超过末端上限");
    await act(page, isMobile, n);
    await expect(status).toContainText("超过 14 个末端");
    await used(page, 6);
    await expect(current(page)).toHaveText(full);
  }
  await control(page, isMobile, "提示");
  await expect(card(page, 4)).toHaveAttribute("data-hinted", "true");
  await used(page, 6);
  await page.screenshot({ path: info.outputPath("cap-and-hint.png"), fullPage: true });
  await act(page, isMobile, 4);
  await used(page, 7);
  await complete(page);
  await expect(current(page)).toHaveText((await target(page).textContent())!);
  expect(errors).toEqual([]);
});

test("Deep trees on 92 and 100 retain readable leaf bounds and a reachable undo", async ({ page, isMobile }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "递归树园");
  await chooseLevel(page, 91);
  const endCount = notation(treeLevels[91].target).replace(/[^ABXY]/g, "").length;
  await drawing(page, "target", endCount, 249);
  await page.screenshot({ path: info.outputPath("deep-target-92.png"), fullPage: true });
  await chooseLevel(page, 99);
  await sequence(page, isMobile, [1, 1, 1, 1, 1, 1, 1]);
  await used(page, 7);
  await expect(root(page)).toHaveAttribute("data-orchard-won", "false");
  await drawing(page, "current", 10, 276);
  await expect(card(page, 1)).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  await page.screenshot({ path: info.outputPath("deep-diversion.png"), fullPage: true });
  await control(page, isMobile, "撤销");
  await used(page, 6);
  await expect(card(page, 1)).toBeEnabled();
  expect(errors).toEqual([]);
});
