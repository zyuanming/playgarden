import { expect, test, type Page } from "@playwright/test";
import { tidalLevels, type Move } from "../src/games/tidalPostLogic";
import { captureErrors, chooseLevel, openGame } from "./helpers";
const board = (page: Page) => page.locator(".tide-board");
const button = (page: Page, a: string) =>
  page.locator(`[data-tide-action="${a}"]`);
const phase = (page: Page) => page.locator("[data-tide-phase]");
const keys: Record<Move, string> = {
  U: "ArrowUp",
  D: "ArrowDown",
  L: "ArrowLeft",
  R: "ArrowRight",
  W: "w",
};
for (let batch = 0; batch < 3; batch++) {
  test(`Tidal Post completes boards ${1 + batch * 4}–${4 + batch * 4}`, async ({
    page,
    isMobile,
  }, info) => {
    const errors = captureErrors(page);
    await openGame(page, "潮汐邮路");
    const act = (a: Move) =>
      isMobile ? button(page, a).tap() : board(page).press(keys[a]);
    for (let index = batch * 4; index < batch * 4 + 4; index++) {
      await chooseLevel(page, index);
      await expect(page.locator(".tide-game")).toHaveAttribute(
        "data-tide-won",
        "false",
      );
      await expect(phase(page)).toHaveText("0");
      if (index === 0 || index === 5 || index === 11) {
        const fits = await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        );
        expect(fits).toBe(true);
        await page.screenshot({
          path: info.outputPath(`start-${index + 1}.png`),
          fullPage: true,
        });
      }
      for (const a of tidalLevels[index].solution as Iterable<Move>)
        await act(a);
      await expect(page.locator(".tide-game")).toHaveAttribute(
        "data-tide-won",
        "true",
      );
      await expect(page.locator(".status")).toHaveClass(/success/);
      await expect(button(page, "R")).toBeDisabled();
      if (index === 11)
        await page.screenshot({
          path: info.outputPath("last-won.png"),
          fullPage: true,
        });
    }
    expect(errors).toEqual([]);
  });
}
test("Tidal Post rejects a closed gate, gives state-dependent hints, and undoes a dead end", async ({
  page,
  isMobile,
}) => {
  const errors = captureErrors(page);
  await openGame(page, "潮汐邮路");
  await chooseLevel(page, 1);
  const act = (a: Move) =>
    isMobile ? button(page, a).tap() : board(page).press(keys[a]);
  const shell = (name: string) =>
    page.getByRole("button", { name, exact: true }).click();
  await act("R");
  await expect(board(page)).toHaveAttribute("data-tide-position", "1,0");
  await act("R");
  await expect(phase(page)).toHaveText("1");
  await expect(page.locator(".tide-status")).toContainText("潮位不变");
  await shell("提示");
  await expect(button(page, "W")).toHaveAttribute("data-hinted", "true");
  await act("W");
  await expect(phase(page)).toHaveText("2");
  await shell("提示");
  await expect(button(page, "R")).toHaveAttribute("data-hinted", "true");
  await shell("撤销");
  await expect(phase(page)).toHaveText("1");
  await shell("暂停");
  await expect(button(page, "R")).toBeDisabled();
  await shell("继续游戏");
  await expect(button(page, "R")).toBeEnabled();
  await chooseLevel(page, 2);
  for (const a of "DDLUL" as Iterable<Move>) await act(a);
  await expect(phase(page)).toHaveText("2");
  await shell("提示");
  await expect(page.locator(".tide-status")).toContainText("撤销一步");
  await shell("撤销");
  await expect(phase(page)).toHaveText("1");
  await shell("重来");
  await expect(phase(page)).toHaveText("0");
  expect(errors).toEqual([]);
});
