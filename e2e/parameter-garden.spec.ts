import { expect, test, type Page } from "@playwright/test";
import { captureErrors, chooseLevel, openGame } from "./helpers";
import { STORAGE_KEY } from "../src/lib/progress";

const title = "参数花园";
const solutions = ["90/E/1","0/S/2","0/E/3","180/S/2","180/N/3","270/N/2","180/E/3","270/SE/2","180/SW/3","180/E/3","270/S2/3","90/N/3"];
const extraSolutions = [
  ["270/S/2",[[0,2],[2,1]]], // 13
  ["180/E/3",[[0,0],[5,1]]], // 14
  ["90/S/2",[[2,0],[1,1]]], // 15
  ["90/S/3",[[5,1],[1,4]]], // 16
  ["90/N/3",[[0,0],[3,1]]], // 17
  ["180/S/2",[[0,2],[4,1]]], // 18
  ["270/N/3",[[1,0],[4,3]]], // 19
  ["180/E/2",[[2,2],[0,1]]], // 20
  ["0/N/2",[[5,1],[2,2]]], // 21
  ["270/S/2",[[2,2],[2,1]]], // 22
  ["180/E/3",[[3,0],[8,1]]], // 23
  ["270/N/2",[[2,0],[2,2]]], // 24
  ["0/N/2",[[2,2],[1,1]]], // 25
  ["90/S/2",[[2,2],[0,2]]], // 26
  ["270/S/3",[[1,3],[7,1]]], // 27
  ["270/S/2",[[6,1],[0,0]]], // 28
  ["90/W/3",[[2,3],[3,4]]], // 29
  ["0/S/2",[[2,1],[1,1]]], // 30
  ["270/N/2",[[1,0],[0,0]]], // 31
  ["180/SW/2",[[2,2],[2,1]]], // 32
  ["90/N/3",[[6,0],[0,4]]], // 33
  ["270/E/3",[[5,1],[0,0]]], // 34
  ["90/N/3",[[10,0],[1,2]]], // 35
  ["90/SW/2",[[1,0],[1,0]]], // 36
  ["90/E/2",[[1,0],[5,1]]], // 37
  ["90/E/3",[[5,1],[1,4]]], // 38
  ["0/NW/3",[[10,0],[0,0]]], // 39
  ["270/S/2",[[0,0],[5,1]]], // 40
  ["0/SW/2",[[4,0],[0,1]]], // 41
  ["0/S/2",[[4,0],[6,1]]], // 42
  ["0/E/3",[[4,2],[3,1]]], // 43
  ["270/SE/3",[[2,0],[1,0]]], // 44
  ["180/S/3",[[4,0],[7,0]]], // 45
  ["270/NW/2",[[1,0],[2,1]]], // 46
  ["0/E/3",[[4,5],[0,0]]], // 47
  ["0/S/2",[[0,2],[3,1]]], // 48
  ["90/S2/3",[[4,0],[5,0]]], // 49
  ["0/W2/3",[[1,0],[2,2]]], // 50
  ["90/S2/3",[[7,0],[4,0]]], // 51
  ["0/W2/3",[[8,1],[7,0]]], // 52
  ["270/E2/2",[[1,0],[2,0]]], // 53
  ["270/N2/2",[[0,1],[2,0]]], // 54
  ["0/W2/3",[[8,1],[5,0]]], // 55
  ["90/W2/3",[[2,2],[8,0]]], // 56
  ["0/E2/2",[[5,0],[3,1]]], // 57
  ["0/N2/3",[[13,0],[2,2]]], // 58
  ["270/N2/3",[[2,0],[1,0]]], // 59
  ["0/S2/3",[[2,0],[2,0]]], // 60
  ["90/N2/3",[[2,2],[4,0]]], // 61
  ["270/E2/2",[[1,1],[7,0]]], // 62
  ["0/E2/3",[[4,0],[5,1]]], // 63
  ["270/N2/3",[[7,0],[5,0]]], // 64
  ["270/W2/3",[[2,0],[5,1]]], // 65
  ["90/S2/2",[[2,0],[2,0]]], // 66
  ["270/NE/3",[[8,1],[4,0],[1,0]]], // 67
  ["90/S/2",[[2,1],[2,2],[5,1]]], // 68
  ["270/NE/2",[[4,0],[2,2],[1,1]]], // 69
  ["90/S/2",[[0,0],[2,2],[0,1]]], // 70
  ["0/N/2",[[7,1],[2,2],[1,1]]], // 71
  ["270/W/3",[[0,0],[6,2],[6,0]]], // 72
  ["180/E2/2",[[6,0],[0,0],[4,0]]], // 73
  ["180/NE/2",[[3,1],[1,2],[3,0]]], // 74
  ["270/NW/2",[[1,1],[3,2],[4,0]]], // 75
  ["0/E2/3",[[1,0],[3,0],[7,0]]], // 76
  ["270/W/3",[[1,4],[6,0],[10,2]]], // 77
  ["0/W2/3",[[4,0],[5,0],[9,0]]], // 78
  ["180/W/3",[[1,4],[6,2],[7,0]]], // 79
  ["270/E2/2",[[2,0],[0,0],[3,0]]], // 80
  ["270/E/3",[[0,4],[5,0],[2,3]]], // 81
  ["180/S/3",[[1,0],[8,0],[9,0]]], // 82
  ["90/NW/3",[[1,4],[6,0],[10,0]]], // 83
  ["270/SE/2",[[2,0],[1,1],[2,1]]], // 84
  ["270/E/3",[[6,0],[1,2],[8,1]]], // 85
  ["0/S/3",[[7,0],[2,4],[10,0]]], // 86
  ["270/E/3",[[6,2],[6,0],[0,4]]], // 87
  ["180/NW/2",[[1,2],[0,0],[3,0]]], // 88
  ["180/N/2",[[1,2],[0,1],[3,1]]], // 89
  ["0/E/3",[[0,4],[7,0],[1,0]]], // 90
  ["90/S/3",[[1,2],[7,3],[10,0]]], // 91
  ["0/S2/2",[[1,1],[6,0],[0,0]]], // 92
  ["270/N/3",[[4,2],[0,4],[1,0]]], // 93
  ["180/N/3",[[0,4],[6,2],[5,3]]], // 94
  ["0/NW/2",[[1,2],[3,1],[1,2]]], // 95
  ["0/W/3",[[2,3],[6,0],[1,4]]], // 96
  ["270/SW/2",[[3,1],[0,0],[3,1]]], // 97
  ["90/E/3",[[5,1],[4,0],[4,2]]], // 98
  ["180/N/3",[[6,2],[1,2],[6,0]]], // 99
  ["270/W2/3",[[7,1],[2,2],[7,0]]], // 100
] as const;
const root = (p: Page) => p.locator(".parameter-garden");
const studio = (p: Page) => p.locator(".pg-studio");
const status = (p: Page) => p.locator(".pg-message");
const plate = (p: Page, i: number) => p.locator('[data-plate="' + i + '"]');
const button = (p: Page, name: string) => p.getByRole("button", { name, exact: true });
const tap = (p: Page, touch: boolean, name: string) => touch ? button(p, name).tap() : button(p, name).click();
const check = (p: Page, key: string, value: string) => expect(root(p)).toHaveAttribute("data-" + key, value);
const completion = (p: Page) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}").completed?.["parameter-garden"] ?? [], STORAGE_KEY);
const apply = (p: Page, touch: boolean) => touch ? tap(p, touch, "应用配方") : studio(p).press("A");
async function recipe(p: Page, touch: boolean, value: string) {
  const desired = value.split("/");
  for (const [idx, field] of ["turn", "step", "copies"].entries()) {
    const key = ["R", "D", "C"][idx];
    for (let press = 0; press < 12; press++) {
      if ((await root(p).getAttribute("data-draft"))?.split("/")[idx] === desired[idx]) break;
      if (touch) await p.locator('[data-next="' + field + '"]').tap(); else await studio(p).press(key);
    }
  }
  await check(p, "draft", value);
}
async function finish(p: Page, index: number) {
  await check(p, "won", "true");
  await expect(p.locator(".status.success")).toHaveText("同一套配方匹配了全部印盘！");
  await expect.poll(() => completion(p)).toContain(index);
}

for (let start = 0; start < solutions.length + extraSolutions.length; start += 4) {
  test("All plates agree on levels " + (start + 1) + " through " + (start + 4), async ({ page, isMobile }) => {
    const errors = captureErrors(page);
    await openGame(page, title);
    for (let i = start; i < start + 4; i++) {
      await chooseLevel(page, i);
      await check(page, "level-id", "parameter-garden-" + String(i + 1).padStart(2, "0"));
      await check(page, "applied", "0");
      await expect(button(page, "应用配方")).toBeDisabled();
      if (i === 0) {
        await expect(page.locator('[data-control="step"]')).toHaveAttribute("data-fixed", "true");
        await expect(page.locator('[data-control="copies"] button')).toHaveCount(0);
        if (!isMobile) await studio(page).press("D");
        await check(page, "draft", "0/E/1");
      }
      const extra = extraSolutions[i - solutions.length];
      await recipe(page, isMobile, extra?.[0] ?? solutions[i]);
      if (extra) {
        const [clipped, overlap] = extra[1][0];
        await check(page, "matched", String(extra[1].length));
        await expect(page.locator("[data-clipped]")).toHaveAttribute("data-clipped", String(clipped));
        await expect(page.locator("[data-overlap]")).toHaveAttribute("data-overlap", String(overlap));
        expect(await completion(page)).not.toContain(i);
      }
      await check(page, "won", "false");
      await check(page, "applied", "0");
      if (i === 3) {
        await expect(page.locator("[data-clipped]")).toHaveAttribute("data-clipped", "3");
        await expect(page.locator("[data-overlap]")).toHaveAttribute("data-overlap", "1");
      }
      await apply(page, isMobile);
      await finish(page, i);
      if (i === 0) {
        await tap(page, isMobile, "下一关");
        await check(page, "level-id", "parameter-garden-02");
        await check(page, "draft", "0/E/2");
      }
    }
    expect(errors).toEqual([]);
  });
}

test("Two plates share an applied recipe, and switching, hinting, pause and undo behave independently", async ({ page, isMobile }, info) => {
  const errors = captureErrors(page);
  await openGame(page, title);
  await chooseLevel(page, 4);
  await recipe(page, isMobile, "180/N/2");
  await expect(plate(page, 1)).toHaveAttribute("data-match", "true");
  await expect(plate(page, 2)).toHaveAttribute("data-match", "false");
  await check(page, "committed", "0/E/2");
  await check(page, "won", "false");
  await tap(page, isMobile, "提示");
  await check(page, "plate-active", "2");
  await check(page, "draft", "180/N/2");
  await expect(status(page)).toContainText(/印盘 2：第 \d 行第 \d 列[缺多]/);
  if (isMobile) await plate(page, 1).tap(); else await studio(page).press("[");
  await check(page, "plate-active", "1");
  await check(page, "draft", "180/N/2");
  await apply(page, isMobile);
  await check(page, "applied", "1");
  await check(page, "won", "false");
  await recipe(page, isMobile, "0/N/3");
  await expect(plate(page, 1)).toHaveAttribute("data-match", "false");
  await expect(plate(page, 2)).toHaveAttribute("data-match", "true");
  await apply(page, isMobile);
  await tap(page, isMobile, "撤销");
  await check(page, "draft", "180/N/2");
  await check(page, "committed", "180/N/2");
  await expect(plate(page, 1)).toHaveAttribute("data-match", "true");
  await expect(plate(page, 2)).toHaveAttribute("data-match", "false");
  await tap(page, isMobile, "暂停");
  await expect(page.locator('[data-next="turn"]')).toBeDisabled();
  await expect(plate(page, 2)).toBeDisabled();
  await tap(page, isMobile, "继续游戏");
  await tap(page, isMobile, "重来");
  await check(page, "applied", "0");
  await check(page, "draft", "0/E/2");
  await recipe(page, isMobile, "180/N/3");
  await tap(page, isMobile, "提示");
  await expect(status(page)).toHaveText("预览已全部吻合。按「应用配方」提交。");
  await check(page, "won", "false");
  await apply(page, isMobile);
  await finish(page, 4);
  await page.screenshot({ path: info.outputPath("two-plates.png"), fullPage: true, animations: "disabled" });
  expect(errors).toEqual([]);
});

test("Every pair on level 12 admits a wrong joint recipe; all three plus apply are required", async ({ page, isMobile }, info) => {
  const errors = captureErrors(page);
  await openGame(page, title);
  await chooseLevel(page, 11);
  for (const [value, failed] of [["270/N/3",1], ["270/N/2",2], ["90/N2/2",3]] as const) {
    await recipe(page, isMobile, value);
    await check(page, "matched", "2");
    for (const i of [1,2,3]) await expect(plate(page, i)).toHaveAttribute("data-match", String(i !== failed));
    await apply(page, isMobile);
    await check(page, "won", "false");
    expect(await completion(page)).not.toContain(11);
  }
  await tap(page, isMobile, "提示");
  await check(page, "plate-active", "3");
  await expect(status(page)).toContainText("印盘 3：");
  await expect(page.getByRole("group", { name: "已应用结果", exact: true }).locator('[data-state="missing"], [data-state="extra"]').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  await page.screenshot({ path: info.outputPath("two-of-three.png"), fullPage: true, animations: "disabled" });
  await recipe(page, isMobile, "90/N/3");
  await check(page, "matched", "3");
  await check(page, "committed", "90/N2/2");
  await check(page, "won", "false");
  await apply(page, isMobile);
  await finish(page, 11);
  await page.screenshot({ path: info.outputPath("all-three.png"), fullPage: true, animations: "disabled" });
  await page.reload();
  await expect.poll(() => completion(page)).toContain(11);
  expect(errors).toEqual([]);
});

async function showPlate(page: Page, touch: boolean, target: number, first: number) {
  if (touch) await plate(page, target).tap();
  else for (let i = first; i < target; i++) await studio(page).press("]");
  await check(page, "plate-active", String(target));
}

test("An old level 12 completion survives and advances into the new chapter", async ({ page, isMobile }) => {
  const errors = captureErrors(page);
  await page.addInitScript(key => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
      version: 2, completed: {"parameter-garden": [11]}, lastPlayed: "parameter-garden",
    }));
  }, STORAGE_KEY);
  await openGame(page, title);
  expect(await completion(page)).toContain(11);
  await chooseLevel(page, 11);
  await recipe(page, isMobile, "90/N/3");
  await apply(page, isMobile);
  await finish(page, 11);
  await tap(page, isMobile, "下一关");
  await check(page, "level-id", "parameter-garden-13");
  await recipe(page, isMobile, "180/N/2");
  await check(page, "matched", "1");
  await expect(plate(page, 1)).toHaveAttribute("data-match", "true");
  await tap(page, isMobile, "提示");
  await check(page, "plate-active", "2");
  await check(page, "applied", "0");
  await expect(status(page)).toContainText("印盘 2：第 5 行第 3 列缺一格印迹");
  await expect(page.getByRole("group", { name: "草稿预览", exact: true })
    .getByRole("img", { name: "第 3 行第 2 列，多印", exact: true })).toBeVisible();
  await recipe(page, isMobile, "270/S/2");
  await apply(page, isMobile);
  await finish(page, 12);
  await page.reload();
  await expect.poll(() => completion(page)).toEqual([11,12]);
  expect(errors).toEqual([]);
});

test("Two-cell stride clips different marks on separate plates", async ({ page, isMobile }) => {
  const errors = captureErrors(page);
  await openGame(page, title);
  await chooseLevel(page, 48);
  await recipe(page, isMobile, "90/S2/3");
  await expect(page.locator("[data-clipped]")).toHaveAttribute("data-clipped", "4");
  await showPlate(page, isMobile, 2, 1);
  await expect(page.locator("[data-clipped]")).toHaveAttribute("data-clipped", "5");
  await check(page, "won", "false");
  await apply(page, isMobile);
  await finish(page, 48);
  expect(errors).toEqual([]);
});

test("Each pair in the finale has a distractor; hints locate the discrepant cell", async ({ page, isMobile }, info) => {
  const errors = captureErrors(page);
  await openGame(page, title);
  await chooseLevel(page, 99);
  const cases = [
    ["270/W/3",3,4,1,"多印","多"],
    ["270/W2/2",2,3,2,"缺印","缺"],
    ["90/W2/3",1,1,1,"缺印","缺"],
  ] as const;
  for (const [idx,[value, mismatch,row,col,cell,diff]] of cases.entries()) {
    await recipe(page, isMobile, value);
    await check(page, "matched", "2");
    for (const i of [1,2,3]) await expect(plate(page,i)).toHaveAttribute("data-match",String(i!==mismatch));
    await tap(page, isMobile, "提示");
    await check(page, "applied", String(idx));
    await check(page, "plate-active", String(mismatch));
    const coord = "第 " + row + " 行第 " + col + " 列";
    await expect(status(page)).toContainText("印盘 " + mismatch + "：" + coord + diff + "一格印迹");
    await expect(page.getByRole("group", { name: "草稿预览", exact: true })
      .getByRole("img", { name: coord + "，" + cell, exact: false })).toBeVisible();
    if (idx === 0 && isMobile) {
      for (const width of [360,390]) {
        await page.setViewportSize({width,height:844});
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await page.screenshot({path:info.outputPath("parameter-garden-" + width + ".png"),fullPage:true,animations:"disabled"});
      }
    }
    await apply(page, isMobile);
    await check(page, "won", "false");
    expect(await completion(page)).not.toContain(99);
  }
  await tap(page, isMobile, "撤销");
  await check(page, "committed", "270/W2/2");
  await check(page, "matched", "2");
  await showPlate(page, isMobile, 3, 1);
  await recipe(page, isMobile, "270/W2/3");
  await tap(page, isMobile, "提示");
  await expect(status(page)).toHaveText("预览已全部吻合。按「应用配方」提交。");
  await check(page, "applied", "2");
  await check(page, "won", "false");
  await apply(page, isMobile);
  await finish(page,99);
  expect(errors).toEqual([]);
});
