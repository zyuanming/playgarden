// SPDX-License-Identifier: GPL-3.0-only
// UNRUN: Integration owner runs one final targeted desktop/mobile invocation.
import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { openGame, chooseLevel, captureErrors } from "./helpers";

const rootOf = (page: Page) => page.locator(".wl-game");
async function submitWord(page: Page, word: string, info: TestInfo, fromBook = false) {
  const root = rootOf(page), before = await root.getAttribute("data-word-ladder-current");
  const input = root.getByRole("textbox", { name: "下一块踏脚石" });
  if (fromBook) {
    const card = root.locator(`[data-word-ladder-book="${word}"]`);
    if (info.project.name === "mobile") await card.tap(); else await card.click();
    await expect(input).toHaveValue(word);
    await expect(root).toHaveAttribute("data-word-ladder-current", before!);
  } else await input.fill(word);
  if (info.project.name === "mobile") await root.getByRole("button", { name: "走到这个词" }).tap();
  else await input.press("Enter");
}
async function playableLayout(page: Page) {
  expect(await rootOf(page).locator("button, input").evaluateAll(elements => elements.every(element => {
    const box = element.getBoundingClientRect(); return box.width >= 44 && box.height >= 44;
  }))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function reenter(page: Page) {
  await page.reload();
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("变词小径");
  await page.getByRole("button", { name: /(?:开始玩|继续玩)变词小径/ }).click();
  await expect(rootOf(page)).toBeVisible();
}

test("Word ladder: real spelling, alternate route, error guards, pause, undo and replay restore", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "变词小径");
  const root = rootOf(page), input = root.getByRole("textbox", { name: "下一块踏脚石" });
  await expect(root).toHaveAttribute("data-word-ladder-current", "CAT");
  await expect(root.locator("[data-word-ladder-book]")).toHaveCount(6);
  await playableLayout(page);
  await page.screenshot({ path: info.outputPath("word-ladder-start.png"), fullPage: true, animations: "disabled" });

  // Independent invalid spellings use actual input; none may append a step.
  for (const [word, message] of [["CAT", "还是同一个词"], ["DOG", "这次换了 3 个字母"], ["CAR", "不在本关词本"], ["CATS", "请输入 3 个英文字母"]]) {
    await submitWord(page, word, info);
    await expect(root.locator("#wl-message")).toContainText(message);
    await expect(root).toHaveAttribute("data-word-ladder-current", "CAT");
    await expect(root).toHaveAttribute("data-word-ladder-steps", "0");
  }
  await submitWord(page, "BAT", info, true);
  await expect(root).toHaveAttribute("data-word-ladder-current", "BAT");
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(input).toHaveValue("CAT");
  await expect(root).toHaveAttribute("data-word-ladder-steps", "1");
  await expect(root.locator("#wl-message")).toContainText("最少还要 4 步");
  await submitWord(page, "CAT", info); // Revisiting words is genuinely legal.
  await expect(root).toHaveAttribute("data-word-ladder-steps", "2");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(root).toHaveAttribute("data-word-ladder-current", "BAT");
  await expect(root).toHaveAttribute("data-word-ladder-steps", "1");

  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(input).toBeDisabled();
  expect(await root.locator("button").evaluateAll(buttons => buttons.every(button => (button as HTMLButtonElement).disabled))).toBe(true);
  await expect(root).toHaveAttribute("data-word-ladder-current", "BAT");
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  await reenter(page);
  await expect(root).toHaveAttribute("data-word-ladder-current", "BAT");
  await expect(root).toHaveAttribute("data-word-ladder-steps", "1");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(root).toHaveAttribute("data-word-ladder-current", "CAT");
  await expect(root).toHaveAttribute("data-word-ladder-steps", "0");

  for (const word of ["COT", "DOT", "DOG"]) await submitWord(page, word, info);
  await expect(root).toHaveAttribute("data-word-ladder-won", "true");
  await expect(root).toHaveAttribute("data-word-ladder-steps", "3");
  await expect(page.locator(".status")).toHaveClass(/success/);
  await expect(input).toBeDisabled();
  await page.getByRole("button", { name: "重来", exact: true }).click();
  await expect(root).toHaveAttribute("data-word-ladder-current", "CAT");
  await expect(root).toHaveAttribute("data-word-ladder-steps", "0");
  for (const word of ["COT", "COG", "DOG"]) await submitWord(page, word, info, true);
  await expect(root).toHaveAttribute("data-word-ladder-won", "true");
  await expect(root).toHaveAttribute("data-word-ladder-steps", "3");
  await page.screenshot({ path: info.outputPath("word-ladder-alternative.png"), fullPage: true, animations: "disabled" });

  // Two representative four-letter lessons, not a campaign sweep or solver.
  for (const example of [
    { index: 7, target: "SAND", route: ["DISH", "DASH", "CASH", "CASE", "CANE", "SANE", "SAND"] },
    { index: 11, target: "WOLF", route: ["COAT", "COAL", "COOL", "WOOL", "WOOD", "GOOD", "GOLD", "GOLF", "WOLF"] },
  ]) {
    await chooseLevel(page, example.index);
    for (const word of example.route) await submitWord(page, word, info, true);
    await expect(root).toHaveAttribute("data-word-ladder-current", example.target);
    await expect(root).toHaveAttribute("data-word-ladder-won", "true");
    await expect(root).toHaveAttribute("data-word-ladder-steps", String(example.route.length));
    await playableLayout(page);
  }
  await page.screenshot({ path: info.outputPath("word-ladder-forest-complete.png"), fullPage: true, animations: "disabled" });
  const completed = await page.evaluate(() => JSON.parse(localStorage.getItem("playgarden.progress.v2")!).completed["word-ladder"]);
  expect(completed).toEqual(expect.arrayContaining([0, 7, 11]));
  expect(errors).toEqual([]);
});
