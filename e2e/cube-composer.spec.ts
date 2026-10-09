// One targeted input journey, run once by the existing desktop and mobile projects.
// These five original scenarios are hand-derived; no solver, state injection or campaign sweep.
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { captureErrors, chooseLevel, openGame } from "./helpers";

type Wall = string[][];
const Y = "Yellow", R = "Red", C = "Cyan", O = "Orange", B = "Brown";
const first: Wall = [[Y,Y,R],[Y,R],[R],[R],[Y,R],[Y,Y,R]];
const firstTarget: Wall = [[R,R,R],[R,R],[R],[R],[R,R],[R,R,R]];
const brick: Wall = [[C,O],[C,C,O],[O,O],[C,C,O],[C,O]];
const brickTarget: Wall = [[C],[C,O],[C],[C,O],[C]];
const binary = (values: number[]): Wall => values.map(n => [1,2,4].map(bit => n & bit ? B : O));
const root = (page: Page) => page.locator(".cube-composer");
const addButton = (page: Page, id: string) => root(page).locator(`[data-cube-add="${id}"]`);
const toolbar = (page: Page, name: string) => page.locator(".game-toolbar").getByRole("button", { name, exact: true });
async function activate(button: Locator, mobile: boolean) { if (mobile) await button.tap(); else await button.click(); }
async function add(page: Page, id: string, mobile: boolean) { await activate(addButton(page, id), mobile); }
async function expectWall(page: Page, wall: Wall, program: string[], won = false) {
  await expect(root(page)).toHaveAttribute("data-cube-program", program.join(","));
  await expect(root(page)).toHaveAttribute("data-cube-result", JSON.stringify(wall));
  await expect(root(page)).toHaveAttribute("data-cube-won", String(won));
  await expect(root(page).locator("[data-cube-program-function]")).toHaveCount(program.length);
}
async function expectShown(page: Page, wall: Wall, step: number) {
  await expect(root(page)).toHaveAttribute("data-cube-shown", JSON.stringify(wall));
  await expect(root(page)).toHaveAttribute("data-cube-step", String(step));
  await expect(root(page).locator('[data-cube-wall="current"] [data-cube-column]')).toHaveCount(wall.length);
  for (let i = 0; i < wall.length; i++) {
    await expect(root(page).locator(`[data-cube-wall="current"] [data-cube-column="${i}"]`)).toHaveAttribute("data-cube-stack", wall[i].join(","));
  }
}
async function checkLayout(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await root(page).locator("button").evaluateAll(buttons => buttons.flatMap(button => {
    const r = button.getBoundingClientRect();
    return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth + .5 ? [] : [{ text: button.textContent, width: r.width, height: r.height, left: r.left, right: r.right }];
  }))).toEqual([]);
}
async function reenter(page: Page) {
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("方块函数工坊");
  await page.getByRole("button", { name: /^(开始玩|继续玩)方块函数工坊$/ }).click();
  await expect(root(page)).toBeVisible();
}
async function start(page: Page, index: number, id: string, mobile: boolean) {
  await chooseLevel(page, index);
  await activate(toolbar(page, "重来"), mobile);
  await expect(root(page)).toHaveAttribute("data-cube-id", id);
  await expect(root(page)).toHaveAttribute("data-cube-program", "");
}
async function wonScreenshot(page: Page, info: TestInfo, id: string) {
  await expect(page.locator(".status")).toHaveClass(/success/);
  await checkLayout(page);
  await page.screenshot({ path: info.outputPath(`cube-composer-${id}-earned.png`), fullPage: true, animations: "disabled" });
}

test("Cube Composer original campaign: earned transformations, recovery and touch controls", async ({ page, isMobile }, info) => {
  test.setTimeout(180000);
  const errors = captureErrors(page);
  await openGame(page, "方块函数工坊");
  await expect(page.getByLabel("选择关卡", { exact: true }).locator("option")).toHaveCount(25);
  await expectWall(page, first, []);
  await expectShown(page, first, 0);
  await checkLayout(page);
  await page.screenshot({ path: info.outputPath("cube-composer-first-start.png"), fullPage: true, animations: "disabled" });

  // An incorrect program remains incorrect, even though all remaining colors are red.
  await add(page, "rejectY", isMobile);
  await expectWall(page, [[R],[R],[R],[R],[R],[R]], ["rejectY"]);
  await expect(addButton(page, "rejectY")).toBeDisabled();
  await expect(page.locator(".game-win-banner")).toHaveCount(0);
  await activate(toolbar(page, "撤销"), isMobile);
  await expectWall(page, first, []);
  await expect(addButton(page, "rejectY")).toBeEnabled();

  await add(page, "stackY", isMobile);
  const raised = first.map(column => [...column, Y]);
  await expectWall(page, raised, ["stackY"]);
  await activate(root(page).locator('[data-cube-remove="stackY"]'), isMobile);
  await expectWall(page, first, []);
  await activate(toolbar(page, "撤销"), isMobile);
  await expectWall(page, raised, ["stackY"]);
  await activate(root(page).locator("[data-cube-clear]"), isMobile);
  await expectWall(page, first, []);
  await activate(toolbar(page, "撤销"), isMobile);
  await expectWall(page, raised, ["stackY"]);

  await activate(toolbar(page, "提示"), isMobile);
  await expect(page.locator(".status")).toContainText("不改变程序");
  await expectWall(page, raised, ["stackY"]);
  await activate(toolbar(page, "暂停"), isMobile);
  await expect(page.locator(".pause-overlay")).toBeVisible();
  await expect(addButton(page, "replaceYbyR")).toBeDisabled();
  await expect(root(page).locator('[data-cube-remove="stackY"]')).toBeDisabled();
  await expect(root(page).locator("[data-cube-clear]")).toBeDisabled();
  await expect(root(page).locator('[data-cube-view-step="0"]')).toBeDisabled();
  await expectWall(page, raised, ["stackY"]);
  await activate(page.locator(".pause-overlay").getByRole("button", { name: "继续游戏" }), isMobile);
  await activate(toolbar(page, "重来"), isMobile);
  await expectWall(page, first, []);
  if (isMobile) await add(page, "replaceYbyR", true);
  else { await addButton(page, "replaceYbyR").focus(); await addButton(page, "replaceYbyR").press("Enter"); }
  await expectWall(page, firstTarget, ["replaceYbyR"], true);
  await wonScreenshot(page, info, "0.1");

  // Original 2.1 checks ordered, adjacent equal-column grouping.
  await start(page, 8, "2.1", isMobile);
  await add(page, "stackEqualColumns", isMobile);
  await expectWall(page, [[B],[O,O],[Y,Y,Y],[O,O],[B]], ["stackEqualColumns"]);
  await add(page, "replaceYbyB", isMobile);
  await expectWall(page, [[B],[O,O],[B,B,B],[O,O],[B]], ["stackEqualColumns","replaceYbyB"], true);
  await wonScreenshot(page, info, "2.1");

  // Original 3.1 checks non-overlapping OO patterns and real button reordering.
  await start(page, 13, "3.1", isMobile);
  await add(page, "mapOOtoC", isMobile);
  const wrongFirst = [[C,O],[C,C,O],[C],[C,C,O],[C,O]];
  await expectWall(page, wrongFirst, ["mapOOtoC"]);
  await add(page, "mapCtoO", isMobile);
  const wrongFinal = [[O,O],[O,O,O],[O],[O,O,O],[O,O]];
  await expectWall(page, wrongFinal, ["mapOOtoC","mapCtoO"]);
  await expect(page.locator(".game-win-banner")).toHaveCount(0);
  await activate(root(page).locator('[data-cube-view-step="0"]'), isMobile);
  await expectShown(page, brick, 0);
  await activate(root(page).locator('[data-cube-view-step="1"]'), isMobile);
  await expectShown(page, wrongFirst, 1);
  await expectWall(page, wrongFinal, ["mapOOtoC","mapCtoO"]);
  await page.reload();
  await reenter(page);
  await expect(root(page)).toHaveAttribute("data-cube-id", "3.1");
  await expectWall(page, wrongFinal, ["mapOOtoC","mapCtoO"]);
  await activate(root(page).locator('[data-cube-earlier="mapCtoO"]'), isMobile);
  await expectWall(page, brickTarget, ["mapCtoO","mapOOtoC"], true);
  await expectShown(page, brickTarget, 2);
  await wonScreenshot(page, info, "3.1");

  // Original 4.1 makes stable partition ordering observable rather than sorting by color.
  await start(page, 16, "4.1", isMobile);
  await add(page, "partitionContainsR", isMobile);
  await expectWall(page, [[C,C],[C,C],[C,R],[R,R],[C,R]], ["partitionContainsR"], true);
  await wonScreenshot(page, info, "4.1");

  // Original final level: -1 wraps zero to seven. No solver or solved-state injection.
  await start(page, 24, "5.4", isMobile);
  await expectWall(page, binary([0,1,2,3,4,5,6,7]), []);
  await add(page, "mapSub1", isMobile);
  await expectWall(page, binary([7,0,1,2,3,4,5,6]), ["mapSub1"]);
  await expectShown(page, binary([7,0,1,2,3,4,5,6]), 1);
  await add(page, "mapPow2", isMobile);
  await expectWall(page, binary([1,0,1,4,1,0,1,4]), ["mapSub1","mapPow2"]);
  await add(page, "mapAdd1", isMobile);
  await expectWall(page, binary([2,1,2,5,2,1,2,5]), ["mapSub1","mapPow2","mapAdd1"]);
  await add(page, "mapMul2", isMobile);
  const finalProgram = ["mapSub1","mapPow2","mapAdd1","mapMul2"], finalWall = binary([4,2,4,2,4,2,4,2]);
  await expectWall(page, finalWall, finalProgram, true);
  await wonScreenshot(page, info, "5.4");
  await expect(page.getByLabel("选择关卡", { exact: true }).locator('option[value="24"]')).toContainText("已完成");
  const stored = await page.evaluate(() => localStorage.getItem("playgarden.cube-composer.v1.round.24"));
  expect(JSON.parse(stored!).program).toEqual(finalProgram);
  expect(JSON.parse(stored!)).not.toHaveProperty("won");
  expect(JSON.parse(stored!)).not.toHaveProperty("wall");

  // Final completion exits cleanly; per-level saved programs survive lobby and reload.
  await activate(page.locator(".game-win-banner").getByRole("button", { name: "返回大厅" }), isMobile);
  await expect(root(page)).toHaveCount(0);
  await reenter(page);
  await chooseLevel(page, 24);
  await expectWall(page, finalWall, finalProgram, true);
  await page.reload();
  await reenter(page);
  await chooseLevel(page, 24);
  await expectWall(page, finalWall, finalProgram, true);
  await chooseLevel(page, 13);
  await expectWall(page, brickTarget, ["mapCtoO","mapOOtoC"], true);
  await chooseLevel(page, 0);
  await expectWall(page, firstTarget, ["replaceYbyR"], true);
  if (isMobile) {
    await page.setViewportSize({ width: 320, height: 780 });
    await checkLayout(page);
    await page.screenshot({ path: info.outputPath("cube-composer-320px.png"), fullPage: true, animations: "disabled" });
  }
  expect(errors).toEqual([]);
});
