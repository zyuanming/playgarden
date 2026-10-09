// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Locator } from "@playwright/test";
import { openGame, chooseLevel, captureErrors } from "./helpers";
import { starBattleLevels } from "../src/games/starBattleLogic";

test("star regions: real first and final solutions, notes, pause, undo and restart", async ({ page }, info) => {
  const errors = captureErrors(page);
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const touch = info.project.name === "mobile";
  const activate = async (node: Locator) => touch ? node.tap() : node.click();
  const game = page.locator("[data-star-battle-game]");
  const cell = (index: number) => page.locator(`[data-sb-cell="${index}"]`);
  const shell = (name: string) => page.getByRole("button", { name, exact: true });
  const noOverflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await openGame(page, "星星布阵");
  await expect(game).toHaveAttribute("data-star-battle-won", "false");
  await page.screenshot({ path: info.outputPath("star-battle-first-start.png"), fullPage: true, animations: "disabled" });
  const first = starBattleLevels[0].solution[0];
  if (touch) await cell(first).tap();
  else { await cell(first).focus(); await cell(first).press("Enter"); }
  await expect(cell(first)).toHaveAttribute("data-sb-mark", "1");
  await activate(shell("暂停"));
  await expect(cell(first)).toBeDisabled();
  await expect(shell("放星星")).toBeDisabled();
  await activate(shell("继续游戏"));
  await expect(cell(first)).toHaveAttribute("data-sb-mark", "1");
  await activate(shell("撤销"));
  await expect(cell(first)).toHaveAttribute("data-sb-mark", "0");
  await activate(shell("做排除"));
  await activate(cell(0));
  await expect(cell(0)).toHaveAttribute("data-sb-mark", "2");
  await activate(shell("放星星"));
  await activate(cell(first));
  await activate(shell("提示"));
  await expect(page.locator(".sb-feedback")).toContainText("按当前星星和叉号继续");
  await expect(game).toHaveAttribute("data-star-battle-stars", "1");
  await activate(shell("重来"));
  await expect(game).toHaveAttribute("data-star-battle-stars", "0");
  await expect(cell(0)).toHaveAttribute("data-sb-mark", "0");

  for (const level of [0, starBattleLevels.length - 1]) {
    await chooseLevel(page, level);
    const config = starBattleLevels[level];
    const targets = await page.locator("[data-sb-cell]").evaluateAll((nodes) => nodes.map((node) => { const rect = node.getBoundingClientRect(); return { width: rect.width, height: rect.height }; }));
    for (const target of targets) { expect(target.width).toBeGreaterThanOrEqual(43.9); expect(target.height).toBeGreaterThanOrEqual(43.9); }
    for (const [step, index] of config.solution.entries()) {
      await activate(cell(index));
      if (step === 1) await page.screenshot({ path: info.outputPath(`star-battle-${level + 1}-in-progress.png`), fullPage: true, animations: "disabled" });
    }
    await expect(game).toHaveAttribute("data-star-battle-won", "true");
    await expect(page.locator(".status")).toHaveClass(/success/);
    const stars = await page.locator('[data-sb-mark="1"]').evaluateAll((nodes) => nodes.map((node) => ({ cell: Number(node.getAttribute("data-sb-cell")), region: Number(node.getAttribute("data-sb-region")) })));
    expect(stars).toHaveLength(config.size);
    expect(new Set(stars.map((star) => Math.floor(star.cell / config.size))).size).toBe(config.size);
    expect(new Set(stars.map((star) => star.cell % config.size)).size).toBe(config.size);
    expect(new Set(stars.map((star) => star.region)).size).toBe(config.size);
    for (let a = 0; a < stars.length; a++) for (let b = a + 1; b < stars.length; b++) {
      const dr = Math.abs(Math.floor(stars[a].cell / config.size) - Math.floor(stars[b].cell / config.size));
      const dc = Math.abs(stars[a].cell % config.size - stars[b].cell % config.size);
      expect(Math.max(dr, dc)).toBeGreaterThan(1);
    }
    await expect(shell("撤销")).toBeDisabled();
    await expect(cell(config.solution[0])).toBeDisabled();
    await activate(shell("提示"));
    await expect(game).toHaveAttribute("data-star-battle-won", "true");
    await noOverflow();
    await page.screenshot({ path: info.outputPath(`star-battle-${level + 1}-complete.png`), fullPage: true, animations: "disabled" });
  }
  await activate(shell("重来"));
  await expect(game).toHaveAttribute("data-star-battle-won", "false");
  await expect(game).toHaveAttribute("data-star-battle-stars", "0");
  await expect(cell(0)).toBeEnabled();
  await noOverflow();
  expect(errors).toEqual([]);
});
