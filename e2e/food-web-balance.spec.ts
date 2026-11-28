import { expect, test, type Page } from "@playwright/test";
import { captureErrors, chooseLevel, openGame } from "./helpers";
import { STORAGE_KEY } from "../src/lib/progress";

const title = "食物网平衡";
const id = "food-web-balance";
const solutions = [
  ["100"],
  ["320"],
  ["100", "001"],
  ["310", "023"],
  ["301", "233"],
  ["332", "303"],
  ["201", "020"],
  ["120", "103", "231"],
  ["132", "313", "302"],
  ["030", "003", "023"],
  ["330", "313", "213"],
  ["230", "333", "231"],
];
const root = (p: Page) => p.locator(".food-web");
const studio = (p: Page) => p.locator(".fw-studio");
const feedback = (p: Page) => p.locator(".fw-feedback");
const byName = (p: Page, name: string) =>
  p.getByRole("button", { name, exact: true });
const attr = (p: Page, key: string, value: string | number) =>
  expect(root(p)).toHaveAttribute("data-" + key, String(value));
const hit = (p: Page, touch: boolean, name: string) =>
  touch ? byName(p, name).tap() : byName(p, name).click();
const apply = (p: Page, touch: boolean) =>
  touch ? hit(p, touch, "结算本季") : studio(p).press("a");
const completed = (p: Page) =>
  p.evaluate(
    ([key, game]) =>
      JSON.parse(localStorage.getItem(key) ?? "{}").completed?.[game] ?? [],
    [STORAGE_KEY, id],
  );
async function select(p: Page, touch: boolean, code: string) {
  for (let i = 0; i < 3; i++) {
    if (touch) {
      await p.locator('[data-card="' + i + ":" + code[i] + '"]').tap();
    } else {
      for (
        let n = 0;
        n < 4 && (await root(p).getAttribute("data-draft"))?.[i] !== code[i];
        n++
      )
        await studio(p).press(String(i + 1));
    }
  }
  await attr(p, "draft", code);
}
async function play(p: Page, touch: boolean, sequence: string[]) {
  for (const code of sequence) {
    await select(p, touch, code);
    await apply(p, touch);
  }
}
async function wins(p: Page, level: number) {
  await attr(p, "won", "true");
  await expect(p.locator(".status.success")).toHaveText("末季库存全部达标！");
  await expect.poll(() => completed(p)).toContain(level);
}

for (let start = 0; start < 12; start += 4) {
  test(
    "Actual play through levels " + (start + 1) + " to " + (start + 4),
    async ({ page, isMobile }, info) => {
      const errors = captureErrors(page);
      await openGame(page, title);
      for (let i = start; i < start + 4; i++) {
        await chooseLevel(page, i);
        await attr(
          page,
          "level-id",
          "food-web-season-" + String(i + 1).padStart(2, "0"),
        );
        await attr(page, "round", 0);
        if (i === 0) await expect(byName(page, "结算本季")).toBeDisabled();
        if (i === 1 || i === 2) {
          const opening = i === 1 ? "2,2,0,0,0" : "2,0,0,0,0";
          await select(page, isMobile, i === 1 ? "120" : "101");
          await attr(page, "opening", opening);
          await attr(page, "next", "");
          await expect(feedback(page)).toContainText(
            i === 1 ? "缺 叶片 1" : "缺 昆虫 2",
          );
          await apply(page, isMobile);
          await attr(page, "round", 0);
          await attr(page, "stock", opening);
          if (i === 2)
            await studio(page).screenshot({
              path: info.outputPath("cannot-borrow.png"),
              animations: "disabled",
            });
        }
        await play(page, isMobile, solutions[i]);
        await wins(page, i);
        if (i === 0) {
          await hit(page, isMobile, "下一关");
          await attr(page, "level-id", "food-web-season-02");
        }
      }
      expect(errors).toEqual([]);
    },
  );
}

test("A different level 9 route also wins; hints and pause do not spend resources", async ({
  page,
  isMobile,
}) => {
  const errors = captureErrors(page);
  await openGame(page, title);
  await chooseLevel(page, 8);
  await select(page, isMobile, "332");
  await attr(page, "stock", "3,3,0,2,0");
  await hit(page, isMobile, "提示");
  await expect(feedback(page)).toHaveText("这组牌可通向目标；可结算本季。");
  await attr(page, "draft", "332");
  await attr(page, "round", 0);
  await hit(page, isMobile, "暂停");
  await expect(byName(page, "结算本季")).toBeDisabled();
  await hit(page, isMobile, "继续游戏");
  await play(page, isMobile, ["332", "333", "302"]);
  await attr(page, "stock", "0,0,5,1,3");
  await wins(page, 8);
  await page.reload();
  await expect.poll(() => completed(page)).toContain(8);
  expect(errors).toEqual([]);
});

test("Level 12 rejects borrowing, can undo a dead end and shows each true settlement", async ({
  page,
  isMobile,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, title);
  await chooseLevel(page, 11);
  await select(page, isMobile, "233");
  await expect(feedback(page)).toContainText("缺 昆虫 1");
  await apply(page, isMobile);
  await attr(page, "round", 0);
  await attr(page, "opening", "1,4,0,1,0");
  await play(page, isMobile, ["220"]);
  await attr(page, "stock", "0,3,1,2,0");
  await hit(page, isMobile, "提示");
  await expect(feedback(page)).toContainText("剩余 2 季已无法达标");
  await attr(page, "round", 1);
  await hit(page, isMobile, "撤销");
  await attr(page, "opening", "1,4,0,1,0");
  await play(page, isMobile, ["230", "233"]);
  await attr(page, "round", 2);
  await select(page, isMobile, "331");
  await expect(feedback(page)).toContainText("缺 昆虫 1");
  await apply(page, isMobile);
  await attr(page, "round", 2);
  await hit(page, isMobile, "撤销");
  await attr(page, "stock", "0,2,1,3,0");
  await select(page, isMobile, "333");
  await attr(page, "next", "0,0,2,4,1");
  await apply(page, isMobile);
  await attr(page, "stock", "0,0,2,4,1");
  await select(page, isMobile, "231");
  await attr(page, "next", "0,0,1,6,2");
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  expect(overflows).toBe(false);
  await studio(page).screenshot({
    path: info.outputPath("season-three.png"),
    animations: "disabled",
  });
  await apply(page, isMobile);
  await attr(page, "stock", "0,0,1,6,2");
  await wins(page, 11);
  await studio(page).screenshot({
    path: info.outputPath("final.png"),
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});
