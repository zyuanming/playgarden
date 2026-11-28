import { test, expect, type Page } from "@playwright/test";
import { captureErrors, chooseLevel, openGame } from "./helpers";
import { STORAGE_KEY } from "../src/lib/progress";

const title = "磁场迷宫";
const routes = [["A"],["A"],["AC"],["AXA"],["DBC"],["DXDBC"],["CBXBCA"],["EDXDXBE"],["AXABDXD"],["CXCBDCXC"],["CXCBACXCB","CXCBDCXCB"],["EAXAEDXCED"],
  ["CAXDB"], // 13
  ["EDXDE"], // 14
  ["EXEACDXA","EXFACDXA","FXEACDXA","FXFACDXA"], // 15
  ["CFXFCD"], // 16
  ["BAXABD"], // 17
  ["EDXDE","EDXFE","EFXDE","EFXFE"], // 18
  ["AXDCB"], // 19
  ["DECXCDA"], // 20
  ["DXDFEXE"], // 21
  ["DCBXBCDA"], // 22
  ["EXEDB"], // 23
  ["CEXEDC"], // 24
  ["FDEXEDF"], // 25
  ["DXBCE"], // 26
  ["DFXFCXD"], // 27
  ["AXAEXE"], // 28
  ["FAXACB"], // 29
  ["DCXFAC"], // 30
  ["DAXADCA"], // 31
  ["DBXBDAXCE"], // 32
  ["DEXEDBEXEB","DEXEDBEXFB","DEXEDBFXEB","DEXEDBFXFB"], // 33
  ["GBDXDBGF"], // 34
  ["DXDABXD"], // 35
  ["BXBCAXA"], // 36
  ["EDXDEBC"], // 37
  ["BXBGEXE"], // 38
  ["DXDCXEB"], // 39
  ["BDAXEXF"], // 40
  ["BGEBDXGB"], // 41
  ["CABCAXA"], // 42
  ["DFECXCDA","DFECXCDE"], // 43
  ["FAEXEAFC"], // 44
  ["DCXCFXF"], // 45
  ["DBEAXCBDA"], // 46
  ["BGCFXFCG"], // 47
  ["DXDBCXA"], // 48
  ["ABDXDXAC"], // 49
  ["BXBFAXAFXD"], // 50
  ["CAFDEXAB"], // 51
  ["FXFGDFEC"], // 52
  ["ECDAXADC","ECDAXEDC","ECDEXADC","ECDEXEDC"], // 53
  ["ADBXBDFA"], // 54
  ["ECBXBCED"], // 55
  ["CAXACEDF"], // 56
  ["FAEXEADC"], // 57
  ["CGBEXEBG"], // 58
  ["EFCXCFEG"], // 59
  ["ABXBAEBXB"], // 60
  ["EDBXBDCE"], // 61
  ["CGFDGXGDFG"], // 62
  ["EAXAXDBXB"], // 63
  ["AXCXBAXG"], // 64
  ["ECXCEDGE"], // 65
  ["DGXGECXG"], // 66
  ["EAXCBEDBXB"], // 67
  ["GABDAGEXE","GABDAGEXF","GABDAGFXE","GABDAGFXF"], // 68
  ["GXHXDGEDH","GXHXDGFDH"], // 69
  ["DACEXECADF"], // 70
  ["GBXBEDXDE","GBXBEDXIE","GBXBEIXDE","GBXBEIXIE","HBXBEDXDE","HBXBEDXIE","HBXBEIXDE","HBXBEIXIE"], // 71
  ["CGFBXBCEA"], // 72
  ["BXBFEBXDF"], // 73
  ["BXBFHGCXCI"], // 74
  ["DXDCEXEDH"], // 75
  ["FGXGBDXDB"], // 76
  ["EXDHEXEHBGA"], // 77
  ["CXCFACXCA"], // 78
  ["EBDEXEDBE","EBDEXEDFE","EFDEXEDBE","EFDEXEDFE"], // 79
  ["CHIGXHBFC","CHIGXHBFD"], // 80
  ["FEADCXCDFA"], // 81
  ["GFEGCDXGCD","GFEGCEXGCD"], // 82
  ["HAFXEHFDH"], // 83
  ["BHGEXEGAHXHAXBD"], // 84
  ["DHXHEFBCXCEXB","DHXHEGBCXCEXB"], // 85
  ["CFXADCBHXH"], // 86
  ["FDXDFXBDXD","FDXDGXBDXD","FDXIFXBDXD","FDXIGXBDXD","FIXDFXBDXD","FIXDGXBDXD","FIXIFXBDXD","FIXIGXBDXD","GDXDFXBDXD","GDXDGXBDXD","GDXIFXBDXD","GDXIGXBDXD","GIXDFXBDXD","GIXDGXBDXD","GIXIFXBDXD","GIXIGXBDXD"], // 87
  ["DXDAGEBXBE","DXDAGEBXHE","DXDAGEHXBE","DXDAGEHXHE","DXDBGEBXBE","DXDBGEBXHE","DXDBGEHXBE","DXDBGEHXHE"], // 88
  ["EXGBEACXFA","EXGBFACXFA","IXGBEACXFA","IXGBFACXFA"], // 89
  ["FXFDXDEBIF"], // 90
  ["GDXEGAECXFEC","GDXEGAEDXFEC","GHXEGAECXFEC","GHXEGAEDXFEC"], // 91
  ["FEBXBEFAXA"], // 92
  ["BEXEAXHXFA"], // 93
  ["HBDEAXAEDXG"], // 94
  ["FXFAIXHEIXI"], // 95
  ["DHXHDBCXGB"], // 96
  ["EDXDEXAXDC"], // 97
  ["DFAXAFEDXF","DFAXAFEIXF"], // 98
  ["BGXGBCFXFD","BGXGHCFXFD","HGXGBCFXFD","HGXGHCFXFD"], // 99
  ["DCXCDXBEDXDE","DCXFDXBEDXDE","DFXCDXBEDXDE","DFXFDXBEDXDE"], // 100
];
const root = (p: Page) => p.locator(".magnetic-maze");
const panel = (p: Page) => p.locator(".mm-panel");
const readout = (p: Page) => p.locator(".mm-readout");
const magnet = (p: Page, letter: string) => p.locator('[data-magnet="' + letter + '"]');
const tile = (p: Page, cell: number) => p.locator('[data-cell="' + cell + '"]');
const button = (p: Page, name: string) => p.getByRole("button", { name, exact: true });
const tap = (p: Page, touch: boolean, name: string) => touch ? button(p, name).tap() : button(p, name).click();
async function select(p: Page, touch: boolean, letter: string) {
  if (touch) await magnet(p, letter).tap(); else await panel(p).press(letter);
}
async function play(p: Page, touch: boolean, route: string) {
  for (const move of route) {
    if (move === "X") {
      if (touch) await tap(p, touch, "翻转磁极"); else await panel(p).press("X");
    } else {
      await select(p, touch, move);
      await expect(button(p, "确认滑行")).toBeEnabled();
      if (touch) await tap(p, touch, "确认滑行"); else await panel(p).press("Enter");
    }
  }
}
async function done(p: Page, index: number, length: number) {
  await expect(root(p)).toHaveAttribute("data-won", "true");
  await expect(root(p)).toHaveAttribute("data-moves", String(length));
  await expect(p.locator(".status.success")).toHaveText("小车停在出口，成功通过！");
  await expect.poll(() => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}").completed?.["magnetic-maze"], STORAGE_KEY)).toContain(index);
}

const batchSize = 4;
for (let start = 0; start < routes.length; start += batchSize) {
  const end = Math.min(start + batchSize, routes.length);
  test("Playable routes " + (start + 1) + "–" + end, async ({ page, isMobile }) => {
    const errors = captureErrors(page);
    await openGame(page, title);
    for (let i = start; i < end; i++) {
      await chooseLevel(page, i);
      await expect(root(page)).toHaveAttribute("data-board", "magnetic-maze-" + String(i + 1).padStart(2, "0"));
      await expect(root(page)).toHaveAttribute("data-moves", "0");
      const variants = [10, 14, 99].includes(i) ? routes[i] : routes[i].slice(0, 1);
      for (const [attempt, route] of variants.entries()) {
        await play(page, isMobile, route);
        await done(page, i, route.length);
        if (attempt + 1 < variants.length) await tap(page, isMobile, "重来");
      }
      if (i === 0) {
        await tap(page, isMobile, "下一关");
        await expect(root(page)).toHaveAttribute("data-board", "magnetic-maze-02");
      }
    }
    expect(errors).toEqual([]);
  });
}

test("One magnet repels before flipping and attracts after; previews have no side effects", async ({ page, isMobile }, info) => {
  const errors = captureErrors(page);
  await openGame(page, title);
  await chooseLevel(page, 3);
  await select(page, isMobile, "B");
  await expect(root(page)).toHaveAttribute("data-preview", "axis");
  await expect(button(page, "确认滑行")).toBeDisabled();
  await select(page, isMobile, "A");
  await expect(readout(page)).toContainText("N / N · 同极推开 ←");
  await expect(tile(page, 4)).toHaveAttribute("data-landing", "true");
  await expect(root(page)).toHaveAttribute("data-cart", "5");
  await expect(root(page)).toHaveAttribute("data-moves", "0");
  await page.screenshot({ path: info.outputPath("repel.png"), fullPage: true, animations: "disabled" });
  if (isMobile) await tap(page, isMobile, "取消预览"); else await panel(page).press("Backspace");
  await expect(root(page)).toHaveAttribute("data-preview", "none");
  await expect(root(page)).toHaveAttribute("data-pole", "N");
  await play(page, isMobile, "A");
  await expect(root(page)).toHaveAttribute("data-cart", "4");
  await select(page, isMobile, "C");
  await expect(readout(page)).toContainText("之间有墙或另一块磁铁");
  await select(page, isMobile, "B");
  await expect(root(page)).toHaveAttribute("data-preview", "stalled");
  await expect(button(page, "确认滑行")).toBeDisabled();
  await play(page, isMobile, "X");
  await select(page, isMobile, "A");
  await expect(readout(page)).toContainText("S / N · 异极吸引 →");
  await expect(tile(page, 6)).toHaveAttribute("data-landing", "true");
  await page.screenshot({ path: info.outputPath("attract.png"), fullPage: true, animations: "disabled" });
  await tap(page, isMobile, "暂停");
  await expect(button(page, "确认滑行")).toBeDisabled();
  await expect(button(page, "翻转磁极")).toBeDisabled();
  await expect(magnet(page, "A")).toBeDisabled();
  await tap(page, isMobile, "继续游戏");
  await expect(root(page)).toHaveAttribute("data-preview", "none");
  await play(page, isMobile, "B");
  await expect(root(page)).toHaveAttribute("data-cart", "0");
  await tap(page, isMobile, "提示");
  await expect(readout(page)).toContainText("无通关路线");
  await tap(page, isMobile, "撤销");
  await expect(root(page)).toHaveAttribute("data-cart", "4");
  await expect(root(page)).toHaveAttribute("data-pole", "S");
  await play(page, isMobile, "A");
  await done(page, 3, 3);
  expect(errors).toEqual([]);
});

test("Crossing exit never counts; late save resumes exact pole and undo repairs the dead end", async ({ page, isMobile }, info) => {
  const errors = captureErrors(page);
  await openGame(page, title);
  await chooseLevel(page, 4);
  await select(page, isMobile, "A");
  await expect(readout(page)).toContainText("滑过出口，不算通关");
  await expect(tile(page, 9)).toHaveAttribute("data-path", "true");
  await expect(tile(page, 5)).toHaveAttribute("data-landing", "true");
  await play(page, isMobile, "A");
  await expect(root(page)).toHaveAttribute("data-cart", "5");
  await expect(root(page)).toHaveAttribute("data-won", "false");
  await tap(page, isMobile, "撤销");
  await play(page, isMobile, "DBC");
  await done(page, 4, 3);
  await chooseLevel(page, 11);
  await play(page, isMobile, "EAXAEDX");
  await select(page, isMobile, "D");
  await page.reload();
  await page.getByRole("textbox", { name: "搜索游戏" }).fill(title);
  await tap(page, isMobile, "开始玩" + title);
  await expect(root(page)).toHaveAttribute("data-board", "magnetic-maze-12");
  await expect(root(page)).toHaveAttribute("data-cart", "13");
  await expect(root(page)).toHaveAttribute("data-pole", "S");
  await expect(root(page)).toHaveAttribute("data-moves", "7");
  await expect(root(page)).toHaveAttribute("data-preview", "none");
  await play(page, isMobile, "D");
  await expect(root(page)).toHaveAttribute("data-cart", "10");
  await tap(page, isMobile, "提示");
  await expect(readout(page)).toContainText("无通关路线");
  await tap(page, isMobile, "撤销");
  await expect(root(page)).toHaveAttribute("data-cart", "13");
  await expect(root(page)).toHaveAttribute("data-pole", "S");
  await tap(page, isMobile, "提示");
  await expect(readout(page)).toContainText("最短还需 3 步");
  await expect(magnet(page, "C")).toHaveAttribute("data-hint", "true");
  await play(page, isMobile, "CED");
  await done(page, 11, 10);
  await tap(page, isMobile, "下一关");
  await expect(root(page)).toHaveAttribute("data-board", "magnetic-maze-13");
  await expect(root(page)).toHaveAttribute("data-moves", "0");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  await page.screenshot({ path: info.outputPath("finale.png"), fullPage: true, animations: "disabled" });
  expect(errors).toEqual([]);
});

test("New boards distinguish crossing, screened magnets, and a legal dead end", async ({ page, isMobile }) => {
  const errors = captureErrors(page);
  await openGame(page, title);
  await chooseLevel(page, 12);
  await select(page, isMobile, "C");
  await expect(readout(page)).toContainText("滑过出口，不算通关");
  await expect(tile(page, 12)).toHaveAttribute("data-path", "true");
  await expect(tile(page, 11)).toHaveAttribute("data-landing", "true");
  await play(page, isMobile, "C");
  await expect(root(page)).toHaveAttribute("data-cart", "11");
  await expect(root(page)).toHaveAttribute("data-won", "false");
  await play(page, isMobile, "AXDB");
  await done(page, 12, 5);

  await chooseLevel(page, 13);
  await select(page, isMobile, "A");
  await expect(root(page)).toHaveAttribute("data-preview", "screen");
  await expect(button(page, "确认滑行")).toBeDisabled();
  await expect(root(page)).toHaveAttribute("data-moves", "0");
  await play(page, isMobile, "B");
  await expect(root(page)).toHaveAttribute("data-cart", "23");
  await tap(page, isMobile, "提示");
  await expect(readout(page)).toContainText("无通关路线");
  await expect(root(page)).toHaveAttribute("data-moves", "1");
  await tap(page, isMobile, "撤销");
  await expect(root(page)).toHaveAttribute("data-cart", "18");
  await expect(root(page)).toHaveAttribute("data-pole", "N");
  await play(page, isMobile, "EDXDE");
  await done(page, 13, 5);
  expect(errors).toEqual([]);
});

test("The six-column finale restores the third flip and recovers an alternate dead end", async ({ page, isMobile }, info) => {
  const errors = captureErrors(page);
  await openGame(page, title);
  await chooseLevel(page, 99);
  await play(page, isMobile, "DCXCDXBEDX");
  await select(page, isMobile, "H");
  await page.reload();
  await page.getByRole("textbox", { name: "搜索游戏" }).fill(title);
  await tap(page, isMobile, "开始玩" + title);
  await expect(root(page)).toHaveAttribute("data-board", "magnetic-maze-100");
  await expect(root(page)).toHaveAttribute("data-cart", "30");
  await expect(root(page)).toHaveAttribute("data-pole", "S");
  await expect(root(page)).toHaveAttribute("data-moves", "10");
  await expect(root(page)).toHaveAttribute("data-preview", "none");
  await play(page, isMobile, "H");
  await expect(root(page)).toHaveAttribute("data-cart", "34");
  await tap(page, isMobile, "提示");
  await expect(readout(page)).toContainText("无通关路线");
  await expect(root(page)).toHaveAttribute("data-moves", "11");
  await tap(page, isMobile, "撤销");
  await expect(root(page)).toHaveAttribute("data-cart", "30");
  await expect(root(page)).toHaveAttribute("data-pole", "S");
  await select(page, isMobile, "D");
  await expect(tile(page, 12)).toHaveAttribute("data-landing", "true");
  if (isMobile) {
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const grid = page.locator(".mm-board");
      await expect(grid.locator(".mm-tile")).toHaveCount(36);
      const columns = await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").map(parseFloat));
      expect(columns).toHaveLength(6);
      const magnetWidths = await grid.locator(".mm-magnet").evaluateAll(magnets =>
        magnets.map(el => el.getBoundingClientRect().width));
      expect(Math.min(...magnetWidths)).toBeGreaterThanOrEqual(44);
      expect(Math.max(...magnetWidths)).toBeLessThanOrEqual(Math.max(...columns) + 0.05);
      await page.screenshot({ path: info.outputPath("six-column-" + width + ".png"), fullPage: true, animations: "disabled" });
    }
  }
  await play(page, isMobile, "DE");
  await done(page, 99, 12);
  expect(errors).toEqual([]);
});
