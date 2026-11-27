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

for (let batch = 0; batch < 3; batch++) {
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
      if ([0, 5, 11].includes(index)) {
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
      if (index === 11) {
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
