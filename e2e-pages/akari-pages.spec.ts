import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const proof = JSON.parse(readFileSync("docs/akari/campaign.json", "utf8"))
  .levels[35] as { solution: number[] };
test("Akari exact public build completes actual last puzzle and persists progress", async ({
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
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("灯照花园");
  await page
    .getByRole("button", { name: "开始玩灯照花园", exact: true })
    .click();
  await page.getByLabel("选择关卡", { exact: true }).selectOption("35");
  const root = page.locator(".akari-layout");
  await expect(root).toHaveAttribute("data-akari-id", "akari-036");
  await page.screenshot({
    path: info.outputPath("akari-public-start.png"),
    fullPage: true,
  });
  for (const i of proof.solution)
    await root.locator(`button[data-cell="${i}"]`).click();
  await expect(root).toHaveAttribute("data-akari-won", "true");
  await expect(page.locator(".status")).toHaveClass(/success/);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("playgarden.progress.v2")!).completed
          .akari,
    ),
  ).toContain(35);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("akari-public-completed.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
