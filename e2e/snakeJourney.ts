// SPDX-License-Identifier: GPL-3.0-only
import { expect, type Page } from "@playwright/test";
export async function openSnake(page: Page, url = "/") {
  await page.goto(url);
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("贪吃蛇花园");
  await page
    .getByRole("button", { name: "开始玩贪吃蛇花园", exact: true })
    .click();
  await expect(page.locator(".snake-garden")).toBeVisible();
}
export async function freezeSnake(page: Page) {
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
}
export async function firstFruit(page: Page) {
  await page
    .locator(".snake-overlay")
    .getByRole("button", { name: "开始", exact: true })
    .click();
  await expect(page.locator(".snake-board")).toBeFocused();
  await page.clock.runFor(1200);
  await expect(page.locator(".snake-garden")).toHaveAttribute(
    "data-snake-score",
    "1",
  );
  await expect(page.locator(".snake-garden")).toHaveAttribute(
    "data-snake-length",
    "5",
  );
}
