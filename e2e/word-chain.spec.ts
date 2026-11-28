import { test, expect, type Page } from "@playwright/test";
import { captureErrors, chooseLevel, openGame } from "./helpers";
import { STORAGE_KEY } from "../src/lib/progress";
import { wordChainSave } from "../src/games/wordChainLogic";

const title = "词链拼接";
const success = "词链拼好了，所有词牌都已用完！";
const root = (p: Page) => p.locator(".word-chain");
const readout = (p: Page) => p.locator(".wc-readout");
const card = (p: Page, word: string) => p.locator('[data-word="' + word + '"]');
const button = (p: Page, name: string) => p.getByRole("button", {name, exact: true});
const hit = (p: Page, touch: boolean, name: string) => touch ? button(p, name).tap() : button(p, name).press("Enter");
const play = async (p: Page, touch: boolean, words: readonly string[]) => {
  for (const word of words) {
    if (touch) await card(p, word).tap();
    else await card(p, word).press("Enter");
  }
};
async function done(p: Page, level: number, words: readonly string[]) {
  await expect(root(p)).toHaveAttribute("data-won", "true");
  await expect(root(p)).toHaveAttribute("data-used", String(words.length));
  await expect(p.locator(".status.success")).toHaveText(success);
  await expect.poll(() => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}").completed?.["word-chain"], STORAGE_KEY)).toContain(level);
}

const routes = [
  [["海风", "风车", "车站"]],
  [["火车", "车站", "站台", "台灯", "灯火", "火山"]],
  [["山水", "水花", "花海", "海风", "风雨", "雨水", "水田", "田地"]],
  [["人手", "手工", "工厂", "厂长", "长大", "大人", "人口", "口头", "头发", "发光"]],
  [["海风", "风雨", "雨水", "水花", "花海", "海水", "水果", "果园", "园丁"], ["海水", "水花", "花海", "海风", "风雨", "雨水", "水果", "果园", "园丁"]],
  [["天地", "地面", "面包", "包子", "子女", "女王", "王国", "国家", "家人", "人手", "手工", "工具"]],
  [["人手", "手工", "工厂", "厂长", "长大", "大人", "人名", "名字", "字画", "画家", "家人", "人口", "口水", "水杯"]],
  [["火星", "星火", "火车", "车站", "站台", "台灯", "灯火", "火山", "山地", "地图", "图书"]],
  [["书名", "名字", "字形", "形象", "象棋", "棋盘", "盘点", "点名", "名单", "单车", "车票", "票价", "价格"]],
  [["地下", "下地", "地道", "道路", "路灯", "灯光", "光照", "照明", "明天", "天地", "地图", "图画", "画家"]],
  [["山路", "路上", "上山", "山火", "火山", "山林", "林场", "场地", "地下", "下山", "山谷", "谷物", "物品"], ["山火", "火山", "山路", "路上", "上山", "山林", "林场", "场地", "地下", "下山", "山谷", "谷物", "物品"], ["山火", "火山", "山林", "林场", "场地", "地下", "下山", "山路", "路上", "上山", "山谷", "谷物", "物品"]],
  [["花生", "生长", "长大", "大红", "红花", "花草", "草木", "木头", "头发", "发芽", "芽菜", "菜花", "花灯", "灯火", "火花", "花园"], ["花草", "草木", "木头", "头发", "发芽", "芽菜", "菜花", "花生", "生长", "长大", "大红", "红花", "花灯", "灯火", "火花", "花园"], ["花草", "草木", "木头", "头发", "发芽", "芽菜", "菜花", "花灯", "灯火", "火花", "花生", "生长", "长大", "大红", "红花", "花园"]],
] as const;

for (let start = 0; start < routes.length; start += 4) {
  const end = Math.min(routes.length, start + 4);
  test("Playable words " + (start + 1) + "–" + end, async ({ page, isMobile }) => {
    const errors = captureErrors(page);
    await openGame(page, title);
    for (let i = start; i < end; i++) {
      await chooseLevel(page, i);
      await expect(root(page)).toHaveAttribute("data-board", "word-chain-" + String(i + 1).padStart(2, "0"));
      const variants = routes[i];
      for (const [attempt, words] of variants.entries()) {
        await expect(root(page)).toHaveAttribute("data-used", "0");
        await play(page, isMobile, words);
        await done(page, i, words);
        if (attempt + 1 < variants.length) await hit(page, isMobile, "重来");
      }
    }
    expect(errors).toEqual([]);
  });
}

test("Landing on the end character early never awards completion", async ({ page, isMobile }) => {
  const errors = captureErrors(page);
  await openGame(page, title);
  await chooseLevel(page, 1);
  await play(page, isMobile, ["台灯"]);
  await expect(readout(page)).toContainText("不以“火”开头");
  await expect(root(page)).toHaveAttribute("data-used", "0");
  await play(page, isMobile, ["火山"]);
  await expect(root(page)).toHaveAttribute("data-won", "false");
  await expect(root(page)).toHaveAttribute("data-tail", "山");
  await expect(readout(page)).toContainText("但还剩 5 张牌");
  await hit(page, isMobile, "提示");
  await expect(readout(page)).toContainText("没有完整接法");
  await expect(root(page)).toHaveAttribute("data-used", "1");
  await hit(page, isMobile, "撤销");
  await expect(root(page)).toHaveAttribute("data-tail", "火");
  await expect(card(page, "火山")).toHaveAttribute("data-placement", "ok");
  await hit(page, isMobile, "提示");
  await expect(card(page, "火车")).toHaveAttribute("data-hint", "true");
  await expect(root(page)).toHaveAttribute("data-used", "0");
  await play(page, isMobile, routes[1][0]);
  await done(page, 1, routes[1][0]);
  expect(errors).toEqual([]);
});

test("A matching card cannot jump an earlier stamp", async ({ page, isMobile }) => {
  const errors = captureErrors(page);
  await openGame(page, title);
  await chooseLevel(page, 6);
  await play(page, isMobile, ["人名", "名字", "字画"]);
  await expect(root(page)).toHaveAttribute("data-next-stamp", "手工");
  await expect(card(page, "画家")).toHaveAttribute("data-placement", "stamp");
  await play(page, isMobile, ["画家"]);
  await expect(readout(page)).toContainText("先接印章 1「手工」");
  await expect(root(page)).toHaveAttribute("data-used", "3");
  await expect(root(page)).toHaveAttribute("data-tail", "画");
  await hit(page, isMobile, "提示");
  await expect(readout(page)).toContainText("没有完整接法");
  for (let i = 0; i < 3; i++) await hit(page, isMobile, "撤销");
  await play(page, isMobile, routes[6][0]);
  await done(page, 6, routes[6][0]);
  expect(errors).toEqual([]);
});

test("The finale resumes committed words and recognizes a written-character join across readings", async ({ page, isMobile }, info) => {
  const errors = captureErrors(page);
  await openGame(page, title);
  await chooseLevel(page, 11);
  await expect(page.locator(".wc-card")).toHaveCount(16);
  await play(page, isMobile, ["花灯", "灯火"]);
  await expect(root(page)).toHaveAttribute("data-used", "1");
  await expect(root(page)).toHaveAttribute("data-next-stamp", "花草");
  await expect(readout(page)).toContainText("先接印章 1「花草」");
  await hit(page, isMobile, "撤销");
  const words = routes[11][0];
  await play(page, isMobile, words.slice(0, 5));
  await hit(page, isMobile, "提示");
  await expect(card(page, "花草")).toHaveAttribute("data-hint", "true");
  await expect(root(page)).toHaveAttribute("data-used", "5");
  await page.reload();
  await page.getByRole("textbox", {name: "搜索游戏"}).fill(title);
  await hit(page, isMobile, "开始玩" + title);
  await expect(root(page)).toHaveAttribute("data-board", "word-chain-12");
  await expect(root(page)).toHaveAttribute("data-used", "5");
  await expect(root(page)).toHaveAttribute("data-tail", "花");
  await expect(root(page)).toHaveAttribute("data-next-stamp", "花草");
  await expect(card(page, "花草")).toHaveAttribute("data-hint", "false");
  await play(page, isMobile, words.slice(5, 9));
  await expect(root(page)).toHaveAttribute("data-tail", "发");
  await expect(card(page, "发芽")).toHaveAttribute("data-placement", "ok");
  await expect(root(page)).toHaveAttribute("data-next-stamp", "灯火");
  if (isMobile) {
    for (const width of [360, 390]) {
      await page.setViewportSize({width, height: 844});
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const dimensions = await page.locator(".wc-card").evaluateAll(items => items.map(el => {
        const b = el.getBoundingClientRect();
        return [b.width, b.height];
      }));
      expect(dimensions.every(([w,h]) => w >= 44 && h >= 44)).toBe(true);
      await page.screenshot({path: info.outputPath("word-chain-" + width + ".png"), fullPage: true, animations: "disabled"});
    }
  }
  await play(page, isMobile, words.slice(9));
  await done(page, 11, words);
  const key = wordChainSave + ".round.11";
  await expect.poll(() => page.evaluate(k => JSON.parse(localStorage.getItem(k) ?? "{}").words?.length, key)).toBe(16);
  expect(errors).toEqual([]);
});
