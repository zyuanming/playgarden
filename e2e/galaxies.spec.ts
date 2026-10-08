import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openGame, chooseLevel, captureErrors } from "./helpers";
import { galaxiesLevels } from "../src/games/galaxiesLevels";
import { initialGalaxies, opposite } from "../src/games/galaxiesLogic";
const proofs = JSON.parse(readFileSync("docs/galaxies/campaign.json", "utf8"))
  .levels as { id: string; solution: number[] }[];
test("Galaxies actual 36-level keyboard and touch journey, errors, pause and resume", async ({
  page,
}, info) => {
  test.setTimeout(360000);
  const errors = captureErrors(page);
  await openGame(page, "星系分区");
  const root = page.locator(".galaxies-layout"),
    cell = (i: number) => root.locator(`button[data-cell="${i}"]`),
    star = (g: number) => root.locator(`button[data-star="${g}"]`);
  const p = galaxiesLevels[0],
    s = initialGalaxies(p),
    i = s.indexOf(-1),
    g = proofs[0].solution[i];
  await star(g).click();
  await cell(i).focus();
  await expect(cell(i)).toBeFocused();
  await cell(i).press("Control+Enter");
  await expect(root).toHaveAttribute("data-galaxies-state", s.join(","));
  await expect(cell(i)).toBeFocused();
  await cell(i).press("Enter");
  await cell(i).click();
  await expect(root).toHaveAttribute("data-galaxies-state", s.join(","));
  await cell(i).click();
  await star(-1).click();
  await cell(i).click();
  await expect(root).toHaveAttribute("data-galaxies-state", s.join(","));
  await star(g).click();
  await cell(i).click();
  const one = await root.getAttribute("data-galaxies-state");
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(cell(i)).toBeDisabled();
  await expect(star(g)).toBeDisabled();
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  await expect(root).toHaveAttribute("data-galaxies-state", one!);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(root).toHaveAttribute("data-galaxies-state", s.join(","));
  await star((g + 1) % p.centers.length).click();
  await cell(i).click();
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(root.getByRole("status")).toContainText("不相容");
  await page.screenshot({
    path: info.outputPath("galaxies-incompatible-assignment.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "重来", exact: true }).click();
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(root.locator(".hint")).toHaveCount(1);
  await expect(root).toHaveAttribute("data-galaxies-state", s.join(","));
  await star(g).click();
  await cell(i).click();
  await page.reload();
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("星系分区");
  await page
    .getByRole("button", { name: /开始玩星系分区|继续玩星系分区/ })
    .click();
  await expect(root).toHaveAttribute("data-galaxies-state", one!);
  await page.getByRole("button", { name: "重来", exact: true }).click();
  // Arrow navigation and a fixed core click select a star without changing clues.
  await cell(0).focus();
  await cell(0).press("ArrowRight");
  await expect(cell(1)).toBeFocused();
  const fixed = s.findIndex((v) => v >= 0);
  await cell(fixed).click();
  await expect(star(s[fixed])).toHaveAttribute("aria-pressed", "true");
  await expect(root).toHaveAttribute("data-galaxies-state", s.join(","));
  const outside = s.findIndex(
    (v, j) => v < 0 && p.centers.some((_, h) => opposite(p, h, j) < 0),
  );
  const bad = p.centers.findIndex((_, h) => opposite(p, h, outside) < 0);
  expect(outside).toBeGreaterThanOrEqual(0);
  await star(bad).click();
  await cell(outside).click();
  await expect(cell(outside)).toHaveClass(/conflict/);
  await page.screenshot({
    path: info.outputPath("galaxies-outside-rotation.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "重来", exact: true }).click();
  for (let index = 0; index < 36; index++) {
    if (index) await chooseLevel(page, index);
    const level = galaxiesLevels[index],
      start = initialGalaxies(level);
    await expect(root).toHaveAttribute("data-galaxies-id", level.id);
    const capture = [0, 17, 35].includes(index);
    if (capture) {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(`galaxies-${index + 1}-start.png`),
        fullPage: true,
      });
    }
    let step = 0;
    for (const [j, owner] of proofs[index].solution.entries())
      if (start[j] < 0) {
        if (info.project.name === "mobile") {
          await star(owner).tap();
          await cell(j).tap();
        } else {
          await star(owner).click();
          await cell(j).focus();
          await cell(j).press("Enter");
        }
        if (
          capture &&
          ++step === Math.ceil(start.filter((v) => v < 0).length / 2)
        )
          await page.screenshot({
            path: info.outputPath(`galaxies-${index + 1}-mid.png`),
            fullPage: true,
          });
      }
    await expect(root).toHaveAttribute("data-galaxies-won", "true");
    await expect(page.locator(".status")).toHaveClass(/success/);
    await expect(cell(0)).toBeDisabled();
    if (capture)
      await page.screenshot({
        path: info.outputPath(`galaxies-${index + 1}-completed.png`),
        fullPage: true,
      });
  }
  const completed = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("playgarden.progress.v2")!).completed
        .galaxies,
  );
  expect(completed).toEqual(Array.from({ length: 36 }, (_, i) => i));
  expect(errors).toEqual([]);
});
