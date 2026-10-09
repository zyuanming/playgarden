// SPDX-License-Identifier: GPL-3.0-only
// Integration owner runs this final desktop/mobile invocation once.
// Visual acceptance and Web Audio state checks do not certify acoustic output.
import { test, expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { openGame, chooseLevel, captureErrors } from "./helpers";

const root = (page: Page) => page.locator(".ipn-game");
async function activate(button: Locator, info: TestInfo) {
  if (info.project.name === "mobile") await button.tap();
  else { await button.focus(); await button.press("Enter"); }
}
async function sound(page: Page, enabled: boolean) {
  const toggle = page.getByRole("button", { name: enabled ? "开启声音" : "静音", exact: true });
  if (await toggle.count()) await toggle.click();
}
/** Reads the two publicly displayed position captions; no imported answer data. */
async function visibleDegree(page: Page) {
  const positions = await Promise.all(["first", "second"].map(async (which) => {
    const caption = await page.locator(`[data-ipn-note="${which}"] small`).innerText();
    const match = caption.match(/^音阶位置 ([1-8])$/);
    expect(match).not.toBeNull();
    return Number(match![1]);
  }));
  return Math.abs(positions[1] - positions[0]) + 1;
}
async function answerVisible(page: Page, info: TestInfo) {
  const degree = await visibleDegree(page);
  if (info.project.name === "mobile") await page.locator(`[data-ipn-answer="${degree}"]`).tap();
  else { await root(page).focus(); await page.keyboard.press(String(degree)); }
}
async function completeVisual(page: Page, info: TestInfo) {
  for (let i = Number(await root(page).getAttribute("data-ipn-completed")); i < 3; i++) {
    await answerVisible(page, info);
    await expect(root(page)).toHaveAttribute("data-ipn-completed", String(i + 1));
  }
  await expect(root(page)).toHaveAttribute("data-ipn-won", "true");
  await expect(page.locator(".status")).toHaveClass(/success/);
  await expect(page.getByRole("button", { name: "撤销", exact: true })).toBeDisabled();
  expect(await root(page).locator("button").evaluateAll(buttons => buttons.every(button => (button as HTMLButtonElement).disabled))).toBe(true);
  const text = await page.locator(".ipn-feedback").innerText();
  await root(page).focus();
  await page.keyboard.press("1");
  await page.locator("[data-ipn-answer='1']").dispatchEvent("click");
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(root(page)).toHaveAttribute("data-ipn-completed", "3");
  await expect(page.locator(".ipn-feedback")).toHaveText(text);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test("Interval notes: first and final lessons through visible positions, with optional playback", async ({ page }, info) => {
  const errors = captureErrors(page);
  const consoleErrors: string[] = [];
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await openGame(page, "音程阶梯");
  await sound(page, true);
  await expect(root(page)).toHaveAttribute("data-ipn-completed", "0");
  await expect(root(page)).toHaveAttribute("data-ipn-playback", "idle");
  await expect(page.getByRole("figure", { name: "公开音阶位置图" })).toBeVisible();
  await expect(page.locator(".ipn-scale figcaption")).toContainText("不是五线谱");
  await page.screenshot({ path: info.outputPath("interval-notes-first-start.png"), fullPage: true, animations: "disabled" });

  await activate(page.locator("[data-ipn-answer='8']"), info);
  await expect(page.locator(".ipn-feedback")).toContainText("题目没有前进");
  await expect(root(page)).toHaveAttribute("data-ipn-completed", "0");
  await activate(page.locator("[data-ipn-play]"), info);
  await expect(root(page)).toHaveAttribute("data-ipn-completed", "0");
  // An unavailable audio device is valid: the public diagram is the full path.
  await expect.poll(() => root(page).getAttribute("data-ipn-playback"), { timeout: 5000 }).toMatch(/^(idle|unavailable)$/);
  await expect(root(page)).toHaveAttribute("data-ipn-completed", "0");
  await activate(page.locator("[data-ipn-play]"), info);
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(root(page)).toHaveAttribute("data-ipn-playback", "idle");
  expect(await root(page).locator("button").evaluateAll(buttons => buttons.every(button => (button as HTMLButtonElement).disabled))).toBe(true);
  await root(page).dispatchEvent("keydown", { key: "1" });
  await expect(root(page)).toHaveAttribute("data-ipn-completed", "0");
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  await expect(root(page)).toHaveAttribute("data-ipn-playback", "idle");
  await activate(page.locator("[data-ipn-play]"), info);
  await sound(page, false);
  await expect(root(page)).toHaveAttribute("data-ipn-playback", "idle");
  await expect(page.locator("[data-ipn-play]")).toBeDisabled();
  await expect(page.locator(".ipn-audio-note")).toContainText("看图照常作答");
  await expect(root(page)).toHaveAttribute("data-ipn-completed", "0");

  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(page.locator(".ipn-hinted")).toHaveCount(1);
  await expect(page.locator(".ipn-feedback")).toContainText("共 1 个音名位置，是同度");
  await expect(root(page)).toHaveAttribute("data-ipn-completed", "0");
  await answerVisible(page, info);
  await expect(root(page)).toHaveAttribute("data-ipn-completed", "1");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(root(page)).toHaveAttribute("data-ipn-completed", "0");
  await expect(page.locator("[data-ipn-note='first'] strong")).toHaveText("C4");
  await expect(page.locator("[data-ipn-note='second'] strong")).toHaveText("C4");

  // Reset disposes even an in-progress context; the new round never auto-plays.
  await sound(page, true);
  await activate(page.locator("[data-ipn-play]"), info);
  await page.getByRole("button", { name: "重来", exact: true }).click();
  await expect(root(page)).toHaveAttribute("data-ipn-completed", "0");
  await expect(root(page)).toHaveAttribute("data-ipn-playback", "idle");
  await expect(page.locator(".ipn-hinted")).toHaveCount(0);
  await sound(page, false);

  for (const modifiers of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }, { repeat: true }]) {
    await root(page).dispatchEvent("keydown", { key: "1", ...modifiers });
  }
  await expect(root(page)).toHaveAttribute("data-ipn-completed", "0");
  await answerVisible(page, info);
  await expect(root(page)).toHaveAttribute("data-ipn-completed", "1");
  // A question transition must stop playback and must not start the next pair.
  await sound(page, true);
  await activate(page.locator("[data-ipn-play]"), info);
  await answerVisible(page, info);
  await expect(root(page)).toHaveAttribute("data-ipn-completed", "2");
  await expect(root(page)).toHaveAttribute("data-ipn-playback", "idle");
  await sound(page, false);
  await completeVisual(page, info);
  await page.screenshot({ path: info.outputPath("interval-notes-first-win.png"), fullPage: true, animations: "disabled" });

  await chooseLevel(page, 7);
  await expect(root(page)).toHaveAttribute("data-ipn-completed", "0");
  await expect(root(page)).toHaveAttribute("data-ipn-playback", "idle");
  await expect(page.locator("[data-ipn-play]")).toBeDisabled();
  await page.screenshot({ path: info.outputPath("interval-notes-final-start.png"), fullPage: true, animations: "disabled" });
  await completeVisual(page, info);
  await page.screenshot({ path: info.outputPath("interval-notes-final-win.png"), fullPage: true, animations: "disabled" });
  expect(await root(page).locator("button").evaluateAll(buttons => buttons.every(button => {
    const rect = button.getBoundingClientRect(); return rect.width >= 44 && rect.height >= 44;
  }))).toBe(true);
  const completed = await page.evaluate(() => JSON.parse(localStorage.getItem("playgarden.progress.v2")!).completed["interval-notes"]);
  expect(completed).toEqual(expect.arrayContaining([0, 7]));
  expect(errors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
