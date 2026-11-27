import { expect, test, type Page } from "@playwright/test";
import { captureErrors, chooseLevel, openGame } from "./helpers";
import { STORAGE_KEY } from "../src/lib/progress";

const title = "参数花园";
const solutions = ["90/E/1","0/S/2","0/E/3","180/S/2","180/N/3","270/N/2","180/E/3","270/SE/2","180/SW/3","180/E/3","270/S2/3","90/N/3"];
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

for (let start = 0; start < solutions.length; start += 4) {
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
      await recipe(page, isMobile, solutions[i]);
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
