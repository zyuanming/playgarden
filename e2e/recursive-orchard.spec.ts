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
for (let batch = 0; batch < 3; batch++) {
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
      const capture = [0, 5, 11].includes(i);
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
