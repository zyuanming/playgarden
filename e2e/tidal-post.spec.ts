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

const game = (p: Page) => p.locator(".tide-game");
const tideText = (p: Page) => p.locator(".tide-status");
const tool = (p: Page, name: string) => p.getByRole("button", { name, exact: true });
const clickOrTap = (p: Page, name: string, touch: boolean) => touch ? tool(p, name).tap() : tool(p, name).click();
const act = (p: Page, a: Move, touch: boolean) => touch ? button(p, a).tap() : board(p).press(keys[a]);
async function follow(p: Page, route: string, touch: boolean) {
  for (const a of route as Iterable<Move>) await act(p, a, touch);
}
const completion = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem("playgarden.progress.v2") ?? "{}").completed?.["tidal-post"]);
async function delivered(p: Page, level: number) {
  await expect(game(p)).toHaveAttribute("data-tide-won", "true");
  await expect(p.locator(".status.success")).toContainText("邮件已送达");
  await expect.poll(() => completion(p)).toContain(level);
}
for (let first = 12; first < 100; first += 6) {
  const end = Math.min(100, first + 6);
  test("Tidal Post new routes " + (first + 1) + "–" + end, async ({ page, isMobile }, info) => {
    const errors = captureErrors(page);
    await openGame(page, "潮汐邮路");
    for (let index = first; index < end; index++) {
      await chooseLevel(page, index);
      const data = tidalLevels[index];
      await expect(game(page)).toHaveAttribute("data-tide-id", "tidal-post-" + (index + 1));
      await expect(game(page)).toHaveAttribute("data-tide-steps", "0");
      await expect(phase(page)).toHaveText("0");
      if ([12, 28, 44, 80, 99].includes(index)) {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const targets = await page.locator(".tide-controls button").evaluateAll(nodes =>
          nodes.map(n => { const r = n.getBoundingClientRect(); return Math.min(r.width, r.height); })
        );
        expect(Math.min(...targets)).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: info.outputPath("campaign-" + (index + 1) + ".png"), fullPage: true });
      }
      await follow(page, data.solution, isMobile);
      await expect(game(page)).toHaveAttribute("data-tide-steps", String(data.solution.length));
      await delivered(page, index);
    }
    expect(errors).toEqual([]);
  });
}

test("Legacy completions still open level 12 and carry through level 13 and reload", async ({ page, isMobile }) => {
  const errors = captureErrors(page);
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("playgarden.progress.v2",
    JSON.stringify({ version: 2, completed: { "tidal-post": [0,1,2,3,4,5,6,7,8,9,10] } })));
  await openGame(page, "潮汐邮路");
  await expect(game(page)).toHaveAttribute("data-tide-id", "tidal-post-12");
  await expect(page.getByLabel("选择关卡", { exact: true }).locator("option")).toHaveCount(100);
  await follow(page, "URRRRDDWDLLLLURRDWRR", isMobile);
  await delivered(page, 11);
  await clickOrTap(page, "下一关", isMobile);
  await expect(game(page)).toHaveAttribute("data-tide-id", "tidal-post-13");
  await expect(page.locator(".status")).not.toContainText("邮件已送达");
  await follow(page, "LDUDRDDLL", isMobile);
  await delivered(page, 12);
  await openGame(page, "潮汐邮路");
  await expect(game(page)).toHaveAttribute("data-tide-id", "tidal-post-14");
  expect(await completion(page)).toEqual(Array.from({ length: 13 }, (_, i) => i));
  expect(errors).toEqual([]);
});

test("Level 29 needs two waits at one dock before advancing through gate 1", async ({ page, isMobile }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "潮汐邮路");
  await chooseLevel(page, 28);
  await follow(page, "RDUDURR", isMobile);
  const position = "3,0";
  await expect(board(page)).toHaveAttribute("data-tide-position", position);
  await expect(phase(page)).toHaveText("1");
  await act(page, "R", isMobile);
  await expect(board(page)).toHaveAttribute("data-tide-position", position);
  await expect(phase(page)).toHaveText("1");
  for (const [index, current] of ["1", "2"].entries()) {
    await clickOrTap(page, "提示", isMobile);
    await expect(button(page, "W")).toHaveAttribute("data-hinted", "true");
    await expect(board(page)).toHaveAttribute("data-tide-position", position);
    await expect(phase(page)).toHaveText(current);
    if (index === 1) await page.screenshot({ path: info.outputPath("double-wait.png"), fullPage: true });
    await act(page, "W", isMobile);
  }
  await expect(phase(page)).toHaveText("0");
  await clickOrTap(page, "提示", isMobile);
  await expect(button(page, "R")).toHaveAttribute("data-hinted", "true");
  await follow(page, "RD", isMobile);
  await delivered(page, 28);
  expect(errors).toEqual([]);
});

test("Level 100 early arrival without stamps is not delivery; undo recovers the current hint", async ({ page, isMobile }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "潮汐邮路");
  await chooseLevel(page, 99);
  await follow(page, "UUDDURRDR", isMobile);
  await expect(board(page)).toHaveAttribute("data-tide-position", "4,2");
  await expect(phase(page)).toHaveText("0");
  await expect(tideText(page)).toContainText("尚未送达");
  await expect(game(page)).toHaveAttribute("data-tide-won", "false");
  await clickOrTap(page, "提示", isMobile);
  await expect(tideText(page)).toContainText("没有可达邮站的路线");
  await clickOrTap(page, "撤销", isMobile);
  await expect(board(page)).toHaveAttribute("data-tide-position", "3,2");
  await expect(phase(page)).toHaveText("2");
  await clickOrTap(page, "提示", isMobile);
  await expect(button(page, "D")).toHaveAttribute("data-hinted", "true");
  await expect(board(page)).toHaveAttribute("data-tide-position", "3,2");
  await page.screenshot({ path: info.outputPath("last-recovered.png"), fullPage: true });
  await follow(page, tidalLevels[99].solution.slice(8), isMobile);
  await delivered(page, 99);
  await expect(game(page)).toHaveAttribute("data-tide-steps", "33");
  expect(errors).toEqual([]);
});
