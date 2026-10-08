import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openGame, chooseLevel, captureErrors } from "./helpers";
import { akariLevels } from "../src/games/akariLevels";
const proofs = JSON.parse(readFileSync("docs/akari/campaign.json", "utf8"))
  .levels as { id: string; solution: number[] }[];
test("Akari real 36-level journey with keyboard, touch, interruption, conflict and storage", async ({
  page,
}, info) => {
  test.setTimeout(240000);
  const errors = captureErrors(page);
  await openGame(page, "灯照花园");
  const root = page.locator(".akari-layout");
  const cell = (i: number) => root.locator(`button[data-cell="${i}"]`);
  const first = proofs[0].solution[0];
  await cell(first).focus();
  await expect(cell(first)).toBeFocused();
  await cell(first).press("Control+Enter");
  await expect(root).toHaveAttribute("data-akari-state", "0".repeat(16));
  await cell(first).press("Enter");
  const one = await root.getAttribute("data-akari-state");
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(cell(first)).toBeDisabled();
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  await expect(root).toHaveAttribute("data-akari-state", one!);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(root).toHaveAttribute("data-akari-state", "0".repeat(16));
  await page
    .getByRole("button", { name: "× 标记 / 清除", exact: true })
    .click();
  await cell(first).click();
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(root.getByRole("status")).toContainText("不相容");
  await page.getByRole("button", { name: "重来", exact: true }).click();
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(root.locator(".hint")).toHaveCount(1);
  await expect(root).toHaveAttribute("data-akari-state", "0".repeat(16));
  await cell(first).click();
  await page.reload();
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("灯照花园");
  await page
    .getByRole("button", { name: /开始玩灯照花园|继续玩灯照花园/ })
    .click();
  await expect(root).toHaveAttribute("data-akari-state", one!);
  await page.getByRole("button", { name: "重来", exact: true }).click();
  for (let index = 0; index < 36; index++) {
    if (index) await chooseLevel(page, index);
    const p = akariLevels[index];
    await expect(root).toHaveAttribute("data-akari-id", p.id);
    const capture = [0, 17, 35].includes(index);
    if (capture) {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(`akari-${index + 1}-start.png`),
        fullPage: true,
      });
    }
    for (const [step, i] of proofs[index].solution.entries()) {
      if (info.project.name === "mobile") await cell(i).tap();
      else {
        await cell(i).focus();
        await cell(i).press("Enter");
      }
      if (capture && step === 0)
        await page.screenshot({
          path: info.outputPath(`akari-${index + 1}-mid.png`),
          fullPage: true,
        });
    }
    await expect(root).toHaveAttribute("data-akari-won", "true");
    await expect(page.locator(".status")).toHaveClass(/success/);
    await expect(cell(proofs[index].solution[0])).toBeDisabled();
    if (capture)
      await page.screenshot({
        path: info.outputPath(`akari-${index + 1}-completed.png`),
        fullPage: true,
      });
  }
  const completed = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("playgarden.progress.v2")!).completed
        .akari,
  );
  expect(completed).toHaveLength(36);
  expect(errors).toEqual([]);
});
