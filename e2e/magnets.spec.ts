import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openGame, chooseLevel, captureErrors } from "./helpers";
import { magnetsLevels } from "../src/games/magnetsLevels";
import { initialMagnets, oppositePole } from "../src/games/magnetsLogic";
const proofs = JSON.parse(readFileSync("docs/magnets/campaign.json", "utf8"))
  .levels as { solution: number[] }[];
test("Magnets actual36 keyboard and touch journey, conflicts, unknown versus neutral and recovery", async ({
  page,
}, info) => {
  test.setTimeout(360000);
  const errors = captureErrors(page);
  await openGame(page, "磁极拼图");
  const root = page.locator(".magnets-layout"),
    cell = (i: number) => root.locator(`button[data-cell="${i}"]`),
    pole = (v: number) => root.locator(`button[data-pole="${v}"]`);
  const p = magnetsLevels[0],
    fresh = initialMagnets(p),
    [a, b] = p.dominoes[0],
    right = proofs[0].solution[0];
  await pole(1).click();
  await cell(b).focus();
  await cell(b).press("Control+Enter");
  await expect(root).toHaveAttribute("data-magnets-state", fresh.join(","));
  await cell(b).press("Enter");
  await expect(cell(b)).toHaveAttribute("data-value", "1");
  await expect(cell(a)).toHaveAttribute("data-value", "2");
  await pole(-1).click();
  await cell(a).click();
  await expect(root).toHaveAttribute("data-magnets-state", fresh.join(","));
  await pole(right).click();
  await cell(a).click();
  const one = await root.getAttribute("data-magnets-state");
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(cell(a)).toBeDisabled();
  await expect(pole(1)).toBeDisabled();
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  await expect(root).toHaveAttribute("data-magnets-state", one!);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(root).toHaveAttribute("data-magnets-state", fresh.join(","));
  await pole((right + 1) % 3).click();
  await cell(a).click();
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(root.getByRole("status")).toContainText("不相容");
  await page.screenshot({
    path: info.outputPath("magnets-incompatible.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "重来", exact: true }).click();
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(root.locator(".hint")).toHaveCount(2);
  await expect(root).toHaveAttribute("data-magnets-state", fresh.join(","));
  await pole(right).click();
  await cell(a).click();
  await page.reload();
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("磁极拼图");
  await page
    .getByRole("button", { name: /开始玩磁极拼图|继续玩磁极拼图/ })
    .click();
  await expect(root).toHaveAttribute("data-magnets-state", one!);
  await page.getByRole("button", { name: "重来", exact: true }).click();
  await cell(0).focus();
  await cell(0).press("ArrowRight");
  await expect(cell(1)).toBeFocused();
  // Construct a real adjacent equal-pole mistake across two different dominoes.
  const owner = (i: number) => p.dominoes.findIndex((d) => d.includes(i));
  let pair: number[] = [];
  for (let i = 0; i < p.width * p.height && !pair.length; i++)
    for (const j of [
      (i % p.width) + 1 < p.width ? i + 1 : -1,
      i + p.width < p.width * p.height ? i + p.width : -1,
    ])
      if (j >= 0 && owner(i) !== owner(j)) {
        pair = [i, j];
        break;
      }
  await pole(1).click();
  for (const i of pair) await cell(i).click();
  for (const i of pair) await expect(cell(i)).toHaveClass(/conflict/);
  await page.screenshot({
    path: info.outputPath("magnets-adjacent-same-poles.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "重来", exact: true }).click();
  for (let index = 0; index < 36; index++) {
    if (index) await chooseLevel(page, index);
    const puzzle = magnetsLevels[index],
      capture = [0, 17, 35].includes(index);
    await expect(root).toHaveAttribute("data-magnets-id", puzzle.id);
    if (capture) {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(`magnets-${index + 1}-start.png`),
        fullPage: true,
      });
    }
    for (const [d, value] of proofs[index].solution.entries()) {
      // Use second halves for alternating dominoes, verifying reversed clicks.
      const half = d % 2,
        i = puzzle.dominoes[d][half],
        v = half ? oppositePole(value) : value;
      if (info.project.name === "mobile") {
        await pole(v).tap();
        await cell(i).tap();
      } else {
        await pole(v).click();
        await cell(i).focus();
        await cell(i).press("Enter");
      }
      if (capture && d + 1 === Math.ceil(puzzle.dominoes.length / 2))
        await page.screenshot({
          path: info.outputPath(`magnets-${index + 1}-mid.png`),
          fullPage: true,
        });
    }
    await expect(root).toHaveAttribute("data-magnets-won", "true");
    await expect(page.locator(".status")).toHaveClass(/success/);
    await expect(cell(0)).toBeDisabled();
    if (capture)
      await page.screenshot({
        path: info.outputPath(`magnets-${index + 1}-completed.png`),
        fullPage: true,
      });
  }
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("playgarden.progress.v2")!).completed
          .magnets,
    ),
  ).toEqual(Array.from({ length: 36 }, (_, i) => i));
  expect(errors).toEqual([]);
});
