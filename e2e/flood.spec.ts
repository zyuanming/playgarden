import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openGame, chooseLevel, captureErrors } from "./helpers";
import { floodLevels } from "../src/games/floodLevels";
import { FLOOD_NAMES, FLOOD_RESUME_KEY } from "../src/games/floodLogic";
const proofs = JSON.parse(readFileSync("docs/flood/campaign.json", "utf8"))
  .levels as { id: string; solution: number[] }[];
test("Flood real 100-level journey, preview, keyboard, pause, undo, save and endgame", async ({
  page,
}, info) => {
  test.setTimeout(600000);
  const errors = captureErrors(page);
  await openGame(page, "染色花园");
  const root = page.locator(".flood-layout");
  const color = (c: number) =>
    page.getByRole("button", { name: `选择${FLOOD_NAMES[c]}`, exact: true });
  const confirm = () => page.getByRole("button", { name: /^确认换色/ });
  const first = proofs[0].solution[0],
    initial = floodLevels[0].board.join("");
  await color(first).focus();
  await color(first).press("Control+Enter");
  await expect(root).toHaveAttribute("data-flood-board", initial);
  await expect(confirm()).toBeDisabled();
  await color(first).press("Enter");
  await expect(root).toHaveAttribute("data-flood-board", initial);
  await page.getByRole("button", { name: "取消预览", exact: true }).click();
  await expect(confirm()).toBeDisabled();
  await color(first).click();
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(confirm()).toBeDisabled();
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  await confirm().click();
  await expect(root).toHaveAttribute("data-flood-moves", "1");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(root).toHaveAttribute("data-flood-board", initial);
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(confirm()).toBeEnabled();
  await expect(root).toHaveAttribute("data-flood-board", initial);
  await page.getByRole("button", { name: "重来", exact: true }).click();
  await expect(confirm()).toBeDisabled();
  for (let i = 0; i < 100; i++) {
    const p = floodLevels[i],
      proof = proofs[i];
    expect(proof.id).toBe(p.id);
    await expect(root).toHaveAttribute("data-flood-id", p.id);
    await expect(root).toHaveAttribute("data-flood-board", p.board.join(""));
    const capture = [0, 49, 99].includes(i);
    if (capture) {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(`flood-${i + 1}-start.png`),
        fullPage: true,
      });
    }
    for (const [step, c] of proof.solution.entries()) {
      const before = await root.getAttribute("data-flood-board");
      if (info.project.name === "mobile") await color(c).tap();
      else {
        await color(c).focus();
        await color(c).press("Enter");
      }
      await expect(root).toHaveAttribute("data-flood-board", before!);
      if (capture && step === 0)
        await page.screenshot({
          path: info.outputPath(`flood-${i + 1}-preview.png`),
          fullPage: true,
        });
      if (info.project.name === "mobile") await confirm().tap();
      else {
        await confirm().focus();
        await confirm().press("Enter");
      }
      await expect(root).toHaveAttribute("data-flood-moves", String(step + 1));
      if (i === 99 && step === 1) {
        const saved = await root.getAttribute("data-flood-board");
        await page.reload();
        await page.getByRole("textbox", { name: "搜索游戏" }).fill("染色花园");
        await page
          .getByRole("button", { name: "开始玩染色花园", exact: true })
          .click();
        await expect(root).toHaveAttribute("data-flood-board", saved!);
        await expect(page.getByLabel("选择关卡", { exact: true })).toHaveValue(
          "99",
        );
      }
    }
    await expect(root).toHaveAttribute("data-flood-won", "true");
    await expect(page.locator(".status")).toHaveClass(/success/);
    await expect(confirm()).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "撤销", exact: true }),
    ).toBeDisabled();
    if (capture)
      await page.screenshot({
        path: info.outputPath(`flood-${i + 1}-won.png`),
        fullPage: true,
      });
    if (i < 99)
      await page.getByRole("button", { name: "下一关", exact: true }).click();
  }
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).moves.length,
      `${FLOOD_RESUME_KEY}.round.99`,
    ),
  ).toBe(proofs[99].solution.length);
  await chooseLevel(page, 0);
  await page.getByRole("button", { name: "重来", exact: true }).click();
  await expect(root).toHaveAttribute("data-flood-board", initial);
  await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("flood-320.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
