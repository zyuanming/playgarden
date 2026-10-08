import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const proof = JSON.parse(readFileSync("docs/galaxies/campaign.json", "utf8"))
  .levels[35] as { solution: number[] };
test("Galaxies exact public build completes last puzzle with actual controls and saves progress", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const response = await page.goto("./");
  expect(response?.status()).toBe(200);
  if (process.env.GITHUB_SHA)
    await expect(
      page.locator('meta[name="playgarden-commit"]'),
    ).toHaveAttribute("content", process.env.GITHUB_SHA);
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("星系分区");
  await page
    .getByRole("button", { name: "开始玩星系分区", exact: true })
    .click();
  await page.getByLabel("选择关卡", { exact: true }).selectOption("35");
  const root = page.locator(".galaxies-layout");
  await expect(root).toHaveAttribute("data-galaxies-id", "galaxies-036");
  await page.screenshot({
    path: info.outputPath("galaxies-public-start.png"),
    fullPage: true,
  });
  for (const [i, g] of proof.solution.entries())
    if (
      (await root
        .locator(`button[data-cell="${i}"]`)
        .getAttribute("data-fixed")) === "false"
    ) {
      await root.locator(`button[data-star="${g}"]`).click();
      await root.locator(`button[data-cell="${i}"]`).click();
    }
  await expect(root).toHaveAttribute("data-galaxies-won", "true");
  await expect(page.locator(".status")).toHaveClass(/success/);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("playgarden.progress.v2")!).completed
          .galaxies,
    ),
  ).toContain(35);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("galaxies-public-completed.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
