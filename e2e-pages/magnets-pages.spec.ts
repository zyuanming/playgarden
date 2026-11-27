import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const proofs = JSON.parse(readFileSync("docs/magnets/campaign.json", "utf8"))
  .levels as { id: string; solution: number[]; dominoes: number[][] }[];
const last = proofs.length - 1;
const proof = proofs[last];
test("Magnets exact public build completes last puzzle with actual controls and saves progress", async ({
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
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("磁极拼图");
  await page
    .getByRole("button", { name: "开始玩磁极拼图", exact: true })
    .click();
  await page.getByLabel("选择关卡", { exact: true }).selectOption(String(last));
  const root = page.locator(".magnets-layout");
  await expect(root).toHaveAttribute("data-magnets-id", proof.id);
  await page.screenshot({
    path: info.outputPath("magnets-public-start.png"),
    fullPage: true,
  });
  for (const [d, value] of proof.solution.entries()) {
    await root.locator(`button[data-pole="${value}"]`).click();
    await root.locator(`button[data-cell="${proof.dominoes[d][0]}"]`).click();
  }
  await expect(root).toHaveAttribute("data-magnets-won", "true");
  await expect(page.locator(".status")).toHaveClass(/success/);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("playgarden.progress.v2")!).completed
          .magnets,
    ),
  ).toContain(last);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("magnets-public-completed.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
