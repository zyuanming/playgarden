// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Locator } from "@playwright/test";
import { openGame, chooseLevel, captureErrors } from "./helpers";
import { soloChessLevels } from "../src/games/soloChessLogic";

test("solo chess: capture-only first and final wins, real geometry, pause, undo, reset", async ({ page }, info) => {
  const errors = captureErrors(page);
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const touch = info.project.name === "mobile";
  const activate = async (node: Locator) => touch ? node.tap() : node.click();
  const cell = (index: number) => page.locator(`[data-sc-cell="${index}"]`);
  const game = page.locator("[data-solo-chess-game]");
  const shell = (name: string) => page.getByRole("button", { name, exact: true });
  const noOverflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await openGame(page, "棋子独奏");
  await expect(game).toHaveAttribute("data-solo-chess-count", "3");
  await page.screenshot({ path: info.outputPath("solo-chess-first-start.png"), fullPage: true, animations: "disabled" });
  if (touch) await cell(15).tap();
  else { await cell(15).focus(); await cell(15).press("Enter"); }
  await activate(cell(0)); // An empty square must never become a legal move.
  await expect(game).toHaveAttribute("data-solo-chess-count", "3");
  await expect(game).toHaveAttribute("data-solo-chess-captures", "0");
  await expect(page.locator(".schess-feedback")).toContainText("不能走到空格");
  await activate(cell(1)); // Bishop D4 cannot capture rook B1.
  await expect(game).toHaveAttribute("data-solo-chess-count", "3");
  await expect(game).toHaveAttribute("data-solo-chess-captures", "0");
  await activate(cell(15));
  await activate(shell("暂停"));
  await expect(cell(5)).toBeDisabled();
  await expect(game).toHaveAttribute("data-solo-chess-count", "3");
  await activate(shell("继续游戏"));
  await expect(cell(15)).toHaveAttribute("data-sc-selected", "true");
  await activate(cell(5));
  await expect(game).toHaveAttribute("data-solo-chess-count", "2");
  await expect(cell(5)).toHaveAttribute("data-sc-piece", "B");
  await expect(cell(15)).toHaveAttribute("data-sc-piece", "");
  await activate(shell("撤销"));
  await expect(game).toHaveAttribute("data-solo-chess-count", "3");
  await expect(cell(15)).toHaveAttribute("data-sc-piece", "B");
  await expect(cell(5)).toHaveAttribute("data-sc-piece", "K");
  await activate(shell("提示"));
  await expect(page.locator(".schess-feedback")).toContainText("从当前棋盘继续");
  await expect(page.locator('[data-sc-selected="true"]')).toHaveCount(1);
  await expect(game).toHaveAttribute("data-solo-chess-count", "3");
  await activate(shell("重来"));
  await expect(game).toHaveAttribute("data-solo-chess-captures", "0");
  await expect(page.locator('[data-sc-selected="true"]')).toHaveCount(0);

  for (const level of [0, soloChessLevels.length - 1]) {
    await chooseLevel(page, level);
    const config = soloChessLevels[level], initialCount = config.start.filter(Boolean).length;
    const boxes = await page.locator("[data-sc-cell]").evaluateAll((nodes) => nodes.map((node) => { const rect = node.getBoundingClientRect(); return { width: rect.width, height: rect.height }; }));
    for (const box of boxes) { expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44); }
    for (const [step, move] of config.solution.entries()) {
      const board = await page.locator("[data-sc-cell]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-sc-piece") ?? ""));
      const kind = board[move.fromCell], n = config.size;
      expect(kind).not.toBe(""); expect(board[move.toCell]).not.toBe("");
      const row = Math.floor(move.fromCell / n), col = move.fromCell % n;
      const dr = Math.floor(move.toCell / n) - row, dc = move.toCell % n - col;
      if (kind === "N") expect([Math.abs(dr), Math.abs(dc)].sort()).toEqual([1, 2]);
      else if (kind === "K") expect(Math.max(Math.abs(dr), Math.abs(dc))).toBe(1);
      else {
        if (kind === "R") expect((dr === 0) !== (dc === 0)).toBe(true);
        else { expect(Math.abs(dr)).toBe(Math.abs(dc)); expect(dr).not.toBe(0); }
        for (let r = row + Math.sign(dr), c = col + Math.sign(dc); r !== Math.floor(move.toCell / n) || c !== move.toCell % n; r += Math.sign(dr), c += Math.sign(dc)) expect(board[r * n + c]).toBe("");
      }
      await activate(cell(move.fromCell));
      await expect(cell(move.toCell)).toHaveAttribute("data-sc-target", "true");
      await activate(cell(move.toCell));
      await expect(cell(move.fromCell)).toHaveAttribute("data-sc-piece", "");
      await expect(cell(move.toCell)).toHaveAttribute("data-sc-piece", kind);
      await expect(game).toHaveAttribute("data-solo-chess-count", String(initialCount - step - 1));
      if (step === 0) await page.screenshot({ path: info.outputPath(`solo-chess-${level + 1}-in-progress.png`), fullPage: true, animations: "disabled" });
    }
    await expect(game).toHaveAttribute("data-solo-chess-won", "true");
    await expect(game).toHaveAttribute("data-solo-chess-count", "1");
    await expect(page.locator(".status")).toHaveClass(/success/);
    await expect(shell("撤销")).toBeDisabled();
    await expect(cell(0)).toBeDisabled();
    await activate(shell("提示"));
    await expect(game).toHaveAttribute("data-solo-chess-won", "true");
    await expect(game).toHaveAttribute("data-solo-chess-captures", String(initialCount - 1));
    await noOverflow();
    await page.screenshot({ path: info.outputPath(`solo-chess-${level + 1}-complete.png`), fullPage: true, animations: "disabled" });
  }
  await activate(shell("重来"));
  await expect(game).toHaveAttribute("data-solo-chess-won", "false");
  await expect(game).toHaveAttribute("data-solo-chess-captures", "0");
  await expect(cell(0)).toBeEnabled();
  await noOverflow();
  expect(errors).toEqual([]);
});
