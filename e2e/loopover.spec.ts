// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { openGame, chooseLevel, captureErrors } from "./helpers";
import { loopoverLevels } from "../src/games/loopoverLevels";
import type { LoopMove } from "../src/vendor/loopoverCore";

const rootOf = (page: Page) => page.locator(".loopover-layout");
const moveKey = (move: LoopMove) => `${move.axis}-${move.index}-${move.delta}`;
const boardOf = async (page: Page) => (await rootOf(page).getAttribute("data-loopover-board"))!.split(",").map(Number);
async function activate(locator: Locator, info: TestInfo) { if (info.project.name === "mobile") await locator.tap(); else await locator.click(); }
/** Expected forward displacement written here, without calling the game core. */
function expectedShift(board: number[], rows: number, cols: number, move: LoopMove) {
  const next = [...board];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    if (move.axis === "row" && row === move.index) next[row * cols + (col + move.delta + cols) % cols] = board[row * cols + col];
    if (move.axis === "column" && col === move.index) next[((row + move.delta + rows) % rows) * cols + col] = board[row * cols + col];
  }
  return next;
}
async function choose(page: Page, move: LoopMove, info: TestInfo) {
  await activate(rootOf(page).locator(`[data-loopover-move="${moveKey(move)}"]`), info);
  await expect(rootOf(page)).toHaveAttribute("data-loopover-selected", moveKey(move));
}
async function checkTouchTargets(page: Page) {
  expect(await rootOf(page).locator("button").evaluateAll(buttons => buttons.every(button => {
    const box = button.getBoundingClientRect(); return box.width >= 44 && box.height >= 44;
  }))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function reenter(page: Page) {
  await page.reload();
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("环移拼盘");
  await page.getByRole("button", { name: /(?:开始玩|继续玩)环移拼盘/ }).click();
  await expect(rootOf(page)).toBeVisible();
}

test("Loopover first, middle and final lessons: real controls, complete cyclic moves and progress", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "环移拼盘");
  for (const index of [0, 8, 17]) {
    const puzzle = loopoverLevels[index];
    await chooseLevel(page, index);
    await page.getByRole("button", { name: "重来", exact: true }).click();
    await expect(rootOf(page)).toHaveAttribute("data-loopover-id", puzzle.id);
    await checkTouchTargets(page);
    await page.screenshot({ path: info.outputPath(`loopover-${index + 1}-start.png`), fullPage: true, animations: "disabled" });
    const solution: LoopMove[] = [...puzzle.scramble].reverse().map(move => ({ ...move, delta: move.delta === 1 ? -1 : 1 }));
    for (const [step, move] of solution.entries()) {
      const before = await boardOf(page);
      if (index === 0 && step === 0) {
        await page.getByRole("button", { name: "提示", exact: true }).click();
        await expect(rootOf(page)).toHaveAttribute("data-loopover-selected", moveKey(move));
        await expect(page.locator(".status")).toContainText("不保证最少");
      } else await choose(page, move, info);
      await expect(rootOf(page)).toHaveAttribute("data-loopover-board", before.join(","));
      const affected = move.axis === "row" ? puzzle.cols : puzzle.rows;
      await expect(rootOf(page).locator('[data-loopover-affected="true"]')).toHaveCount(affected);
      await expect(rootOf(page).locator("[data-loopover-before] b")).toHaveCount(affected);
      const expected = expectedShift(before, puzzle.rows, puzzle.cols, move);
      const line = move.axis === "row" ? expected.slice(move.index * puzzle.cols, (move.index + 1) * puzzle.cols) : Array.from({ length: puzzle.rows }, (_, row) => expected[row * puzzle.cols + move.index]);
      expect(await rootOf(page).locator("[data-loopover-after] b").allTextContents()).toEqual(line.map(value => String(value + 1)));
      if (step === 0) await page.screenshot({ path: info.outputPath(`loopover-${index + 1}-preview.png`), fullPage: true, animations: "disabled" });
      const confirm = rootOf(page).locator("[data-loopover-confirm]");
      if (index === 0 && info.project.name === "desktop") { await confirm.focus(); await confirm.press("Enter"); }
      else await activate(confirm, info);
      await expect(rootOf(page)).toHaveAttribute("data-loopover-board", expected.join(","));
      expect([...await boardOf(page)].sort((a, b) => a - b)).toEqual(Array.from({ length: puzzle.rows * puzzle.cols }, (_, i) => i));
    }
    await expect(rootOf(page)).toHaveAttribute("data-loopover-won", "true");
    await expect(page.locator(".status")).toHaveClass(/success/);
    await expect(rootOf(page).locator("[data-loopover-confirm]")).toBeDisabled();
    expect(await rootOf(page).locator("[data-loopover-move]").evaluateAll(buttons => buttons.every(button => (button as HTMLButtonElement).disabled))).toBe(true);
    await checkTouchTargets(page);
    await page.screenshot({ path: info.outputPath(`loopover-${index + 1}-complete.png`), fullPage: true, animations: "disabled" });
  }
  const completed = await page.evaluate(() => JSON.parse(localStorage.getItem("playgarden.progress.v2")!).completed.loopover);
  expect(completed).toEqual(expect.arrayContaining([0, 8, 17]));
  expect(errors).toEqual([]);
});

test("Loopover preview cancellation, repeat guards, pause, undo, restart, current-state hint and browser restore", async ({ page }, info) => {
  const errors = captureErrors(page), puzzle = loopoverLevels[8];
  await openGame(page, "环移拼盘"); await chooseLevel(page, 8);
  const root = rootOf(page), initial = [...puzzle.initial];
  const move: LoopMove = { axis: "column", index: 0, delta: 1 };
  const arrow = root.locator(`[data-loopover-move="${moveKey(move)}"]`), confirm = root.locator("[data-loopover-confirm]");
  await expect(confirm).toBeDisabled();
  await arrow.focus(); await arrow.press("Control+Enter");
  await expect(root).toHaveAttribute("data-loopover-selected", "");
  expect(await arrow.evaluate(button => button.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true, cancelable: true })))).toBe(false);
  await choose(page, move, info); await activate(arrow, info);
  await expect(root).toHaveAttribute("data-loopover-moves", "0");
  await activate(root.getByRole("button", { name: "取消预览" }), info);
  await expect(root).toHaveAttribute("data-loopover-board", initial.join(","));
  await choose(page, move, info);
  if (info.project.name === "mobile") { await confirm.tap(); await expect(confirm).toBeDisabled(); }
  else await confirm.dblclick();
  await expect(root).toHaveAttribute("data-loopover-moves", "1");
  const after = expectedShift(initial, puzzle.rows, puzzle.cols, move);
  await expect(root).toHaveAttribute("data-loopover-board", after.join(","));
  await choose(page, { axis: "column", index: 2, delta: -1 }, info);
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(root).toHaveAttribute("data-loopover-selected", "");
  await expect(arrow).toBeDisabled(); await expect(confirm).toBeDisabled();
  await expect(root).toHaveAttribute("data-loopover-board", after.join(","));
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  await expect(confirm).toBeDisabled();
  await reenter(page);
  await expect(root).toHaveAttribute("data-loopover-id", puzzle.id);
  await expect(root).toHaveAttribute("data-loopover-board", after.join(","));
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(root).toHaveAttribute("data-loopover-board", initial.join(","));
  await expect(root).toHaveAttribute("data-loopover-moves", "0");
  await choose(page, move, info); await activate(confirm, info);
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(root).toHaveAttribute("data-loopover-selected", "column-0--1");
  await expect(root).toHaveAttribute("data-loopover-board", after.join(","));
  await activate(confirm, info);
  await expect(root).toHaveAttribute("data-loopover-board", initial.join(","));
  // A new hint must continue toward the goal rather than undoing its own previous hint.
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(root).toHaveAttribute("data-loopover-selected", "row-1-1");
  await page.getByRole("button", { name: "重来", exact: true }).click();
  await expect(root).toHaveAttribute("data-loopover-board", initial.join(","));
  await expect(root).toHaveAttribute("data-loopover-moves", "0");
  await expect(root).toHaveAttribute("data-loopover-selected", "");
  await reenter(page); await expect(root).toHaveAttribute("data-loopover-moves", "0");
  await checkTouchTargets(page);
  expect(errors).toEqual([]);
});

test("Loopover malformed or forged saves cannot bypass legal play", async ({ page }, info) => {
  const errors = captureErrors(page), puzzle = loopoverLevels[17];
  await openGame(page, "环移拼盘"); await chooseLevel(page, 17);
  // Only corrupt storage is injected; representative completions above use real controls.
  await page.evaluate(id => localStorage.setItem("playgarden.loopover.v1.round.17", JSON.stringify({ version: 1, id, won: true, board: Array.from({ length: 16 }, (_, i) => i), history: [{ axis: "row", index: 100, delta: 1 }] })), puzzle.id);
  await reenter(page);
  await expect(rootOf(page)).toHaveAttribute("data-loopover-board", puzzle.initial.join(","));
  await expect(rootOf(page)).toHaveAttribute("data-loopover-moves", "0");
  await expect(rootOf(page)).toHaveAttribute("data-loopover-won", "false");
  await expect(page.locator(".status")).not.toHaveClass(/success/);
  await checkTouchTargets(page);
  await page.screenshot({ path: info.outputPath("loopover-safe-restore.png"), fullPage: true, animations: "disabled" });
  expect(errors).toEqual([]);
});
