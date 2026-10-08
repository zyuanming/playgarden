import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { FLOOD_NAMES } from "../src/games/floodLogic";
const proof = JSON.parse(readFileSync("docs/flood/campaign.json", "utf8"))
  .levels[99] as { solution: number[] };
test("Flood exact public build earns real level 100 completion and saves", async ({
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
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("染色花园");
  await page
    .getByRole("button", { name: "开始玩染色花园", exact: true })
    .click();
  await page.getByLabel("选择关卡", { exact: true }).selectOption("99");
  const root = page.locator(".flood-layout");
  await expect(root).toHaveAttribute("data-flood-id", "flood-100");
  await page.screenshot({
    path: info.outputPath("flood-public-start.png"),
    fullPage: true,
  });
  for (const c of proof.solution) {
    await page
      .getByRole("button", { name: `选择${FLOOD_NAMES[c]}`, exact: true })
      .click();
    await page.getByRole("button", { name: /^确认换色/ }).click();
  }
  await expect(root).toHaveAttribute("data-flood-won", "true");
  await expect(page.locator(".status")).toHaveClass(/success/);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("playgarden.progress.v2")!).completed
          .flood,
    ),
  ).toContain(99);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("flood-public-completed.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
