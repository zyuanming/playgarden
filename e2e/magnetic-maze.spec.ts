import { test, expect, type Page } from "@playwright/test";
import { captureErrors, chooseLevel, openGame } from "./helpers";
import { STORAGE_KEY } from "../src/lib/progress";

const title = "磁场迷宫";
const routes = [["A"],["A"],["AC"],["AXA"],["DBC"],["DXDBC"],["CBXBCA"],["EDXDXBE"],["AXABDXD"],["CXCBDCXC"],["CXCBACXCB","CXCBDCXCB"],["EAXAEDXCED"]];
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

for (let start = 0; start < routes.length; start += 4) {
  test("Playable routes " + (start + 1) + "–" + (start + 4), async ({ page, isMobile }) => {
    const errors = captureErrors(page);
    await openGame(page, title);
    for (let i = start; i < start + 4; i++) {
      await chooseLevel(page, i);
      await expect(root(page)).toHaveAttribute("data-board", "magnetic-maze-" + String(i + 1).padStart(2, "0"));
      await expect(root(page)).toHaveAttribute("data-moves", "0");
      const variants = routes[i];
      for (const route of variants) {
        await play(page, isMobile, route);
        await done(page, i, route.length);
        if (variants.length > 1 && route === variants[0]) await tap(page, isMobile, "重来");
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
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  await page.screenshot({ path: info.outputPath("finale.png"), fullPage: true, animations: "disabled" });
  expect(errors).toEqual([]);
});
