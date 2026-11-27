import { expect, test, type Page } from "@playwright/test";
import { angleLevels } from "../src/games/angleRingLogic";
import { STORAGE_KEY } from "../src/lib/progress";
import { captureErrors, chooseLevel, openGame } from "./helpers";

const panel = (page: Page) => page.locator(".angular-panel");
const dial = (page: Page) => page.locator("[data-angle-current]");
const piece = (page: Page, id: number) =>
  page.locator(`[data-angle-piece="${id}"]`);
const frame = (page: Page, id: number) =>
  page.locator(`[data-angle-frame="${id}"]`);
const play = (page: Page, touch: boolean, id: number) =>
  touch ? piece(page, id).tap() : panel(page).press(String(id));
const angle = (page: Page, value: string) =>
  expect(dial(page)).toHaveAttribute("data-angle-current", value);

for (let batch = 0; batch < angleLevels.length / 4; batch++) {
  test(`Angle Ring completes boards ${1 + batch * 4}–${4 + batch * 4}`, async ({
    page,
    isMobile,
  }, info) => {
    const errors = captureErrors(page);
    await openGame(page, "角度拼环");
    for (let index = batch * 4; index < batch * 4 + 4; index++) {
      await chooseLevel(page, index);
      await expect(page.locator(".angular-game")).toHaveAttribute(
        "data-angle-won",
        "false",
      );
      await angle(page, "0");
      await expect(page.locator(".status")).not.toContainText(
        "所有拼环都拼好了",
      );
      await expect(
        page.getByRole("button", { name: "下一关", exact: true }),
      ).toHaveCount(0);
      if ([0, 5, 11, 12, 65, 99].includes(index)) {
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: info.outputPath(`start-${index + 1}.png`),
          fullPage: true,
        });
      }
      const puzzle = angleLevels[index];
      for (let f = 0; f < puzzle.solution.length; f++) {
        if (f > 0) {
          if (isMobile) await frame(page, f + 1).tap();
          else await panel(page).press("ArrowRight");
          await expect(frame(page, f + 1)).toHaveAttribute(
            "aria-pressed",
            "true",
          );
        }
        for (const id of puzzle.solution[f]) await play(page, isMobile, id + 1);
        await angle(page, String(puzzle.frames[f].span));
      }
      await expect(page.locator(".angular-game")).toHaveAttribute(
        "data-angle-won",
        "true",
      );
      await expect(page.locator(".status")).toHaveClass(/success/);
      await expect(piece(page, 1)).toBeDisabled();
      await expect
        .poll(() =>
          page.evaluate(
            (key) =>
              JSON.parse(localStorage.getItem(key) ?? "{}").completed?.[
                "angle-ring"
              ],
            STORAGE_KEY,
          ),
        )
        .toContain(index);
      if (index === 11 || index === 99) {
        await page.screenshot({
          path: info.outputPath("last-won.png"),
          fullPage: true,
        });
        await page.reload();
        await expect
          .poll(() =>
            page.evaluate(
              (key) =>
                JSON.parse(localStorage.getItem(key) ?? "{}").completed?.[
                  "angle-ring"
                ],
              STORAGE_KEY,
            ),
          )
          .toContain(index);
      }
    }
    expect(errors).toEqual([]);
  });
}

test("Angle Ring rejects wrong seams and crossed pins, hints from the current layout, and supports Undo", async ({
  page,
  isMobile,
}) => {
  const errors = captureErrors(page);
  await openGame(page, "角度拼环");
  await chooseLevel(page, 1);
  const act = (id: number) => play(page, isMobile, id);
  const shell = (name: string) =>
    page.getByRole("button", { name, exact: true }).click();
  const status = page.locator(".angular-status");
  await act(2);
  await angle(page, "0");
  await expect(status).toContainText("接缝对不上");
  await act(1);
  await angle(page, "30");
  await act(3);
  await angle(page, "30");
  await expect(status).toContainText("不能跨过定位钉");
  await shell("提示");
  await expect(status).toContainText("撤销一步");
  await shell("撤销");
  await angle(page, "0");
  await expect(piece(page, 1)).toBeEnabled();
  await shell("提示");
  await expect(piece(page, 4)).toHaveAttribute("data-hinted", "true");
  await angle(page, "0");
  await act(4);
  await act(2);
  await angle(page, "105");
  await expect(status).toContainText("刚好落在定位钉上");
  await shell("暂停");
  await expect(piece(page, 3)).toBeDisabled();
  await shell("继续游戏");
  await expect(piece(page, 3)).toBeEnabled();
  await shell("重来");
  await angle(page, "0");
  await chooseLevel(page, 4);
  await act(4);
  await frame(page, 2).click();
  await expect(piece(page, 4)).toBeDisabled();
  await shell("撤销");
  await expect(frame(page, 1)).toHaveAttribute("aria-pressed", "true");
  await expect(piece(page, 4)).toBeEnabled();
  await angle(page, "0");
  expect(errors).toEqual([]);
});

const shellButton = (page: Page, name: string, touch: boolean) => {
  const button = page.getByRole("button", { name, exact: true });
  return touch ? button.tap() : button.click();
};
const positions = (page: Page) => page.locator('.angular-pieces [aria-disabled="true"]').count();
const activate = async (page: Page, touch: boolean, f: number) => {
  if (touch) await frame(page, f).tap();
  else await panel(page).press("ArrowRight");
  await expect(frame(page, f)).toHaveAttribute("aria-pressed", "true");
};
async function path(page: Page, touch: boolean, ...sequence: number[]) {
  for (const id of sequence) await play(page, touch, id);
}
async function cleared(page: Page) {
  await expect(page.locator(".angular-game")).toHaveAttribute("data-angle-won", "true");
  await expect(page.locator(".status")).toHaveClass(/success/);
}

test("Completes old level 12, advances to new level 13 and retains both completions", async ({ page, isMobile }) => {
  const errors = captureErrors(page);
  await openGame(page, "角度拼环");
  await chooseLevel(page, 11);
  await path(page, isMobile, 8, 2, 1);
  await activate(page, isMobile, 2);
  await path(page, isMobile, 5, 7, 9);
  await activate(page, isMobile, 3);
  await path(page, isMobile, 6, 4, 3);
  await cleared(page);
  await shellButton(page, "下一关", isMobile);
  await expect(page.locator(".game-main")).toHaveAttribute("data-level", "12");
  await angle(page, "0");
  await path(page, isMobile, 3, 4, 2, 1);
  await cleared(page);
  await page.reload();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}").completed?.["angle-ring"], STORAGE_KEY))
    .toEqual(expect.arrayContaining([11, 12]));
  expect(errors).toEqual([]);
});

test("Level 66 also accepts the alternate frame-two order", async ({ page, isMobile }) => {
  const errors = captureErrors(page);
  await openGame(page, "角度拼环");
  await chooseLevel(page, 65);
  await path(page, isMobile, 5, 2, 4, 8);
  await angle(page, "225");
  await activate(page, isMobile, 2);
  await path(page, isMobile, 1, 6, 7, 3);
  await angle(page, "270");
  await cleared(page);
  expect(errors).toEqual([]);
});

test("Level 100 shows a pin crossing and a separate legal dead end; two undos recover", async ({ page, isMobile }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "角度拼环");
  await chooseLevel(page, 99);
  const status = page.locator(".angular-status");
  await path(page, isMobile, 8);
  await angle(page, "30");
  await path(page, isMobile, 9);
  await angle(page, "30");
  await expect(status).toContainText("30° → 120°");
  await expect(status).toContainText("90° 留下 ▲ 接缝");
  await expect(piece(page, 9)).toBeEnabled();
  expect(await positions(page)).toBe(1);
  await page.screenshot({ path: info.outputPath("pin-cross.png"), fullPage: true });
  await shellButton(page, "撤销", isMobile);
  await angle(page, "0");
  await path(page, isMobile, 9, 3, 5, 1);
  await angle(page, "210");
  await expect(frame(page, 1)).toContainText("已完成");
  await shellButton(page, "提示", isMobile);
  await expect(status).toContainText("这条路拼不完");
  expect(await positions(page)).toBe(4);
  await page.screenshot({ path: info.outputPath("closed-but-dead.png"), fullPage: true });
  await shellButton(page, "撤销", isMobile);
  await shellButton(page, "撤销", isMobile);
  await angle(page, "120");
  await shellButton(page, "提示", isMobile);
  await expect(piece(page, 7)).toHaveAttribute("data-hinted", "true");
  expect(await positions(page)).toBe(2);
  await path(page, isMobile, 7);
  await activate(page, isMobile, 2);
  await path(page, isMobile, 2, 8, 4);
  await activate(page, isMobile, 3);
  await path(page, isMobile, 6, 5, 1);
  await cleared(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  await page.screenshot({ path: info.outputPath("level-100-cleared.png"), fullPage: true });
  expect(errors).toEqual([]);
});
