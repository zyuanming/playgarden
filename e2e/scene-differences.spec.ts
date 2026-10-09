// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Locator } from "@playwright/test";
import { openGame, chooseLevel, captureErrors } from "./helpers";
test("Picture comparison first/final, real differences, mistake and recovery", async ({
  page,
}, info) => {
  const errors = captureErrors(page),
    act = async (l: Locator) =>
      info.project.name === "mobile" ? l.tap() : l.click();
  await openGame(page, "找不同花园");
  const root = page.locator("[data-scene-differences-game]");
  const area = (i: number, side = 1) =>
    root.locator(`[data-scene-side="${side}"][data-scene-area="${i}"]`);
  await page.screenshot({
    path: info.outputPath("scene-first-start.png"),
    fullPage: true,
  });
  await act(area(1));
  await expect(root).toHaveAttribute("data-scene-found", "");
  await expect(root.locator(".sd-message")).toContainText("相同");
  if (info.project.name === "desktop") {
    await area(0).focus();
    await area(0).press("Enter");
  } else await act(area(0));
  await expect(root).toHaveAttribute("data-scene-found", "0");
  await act(page.getByRole("button", { name: "暂停", exact: true }));
  await expect(area(2)).toBeDisabled();
  await act(page.getByRole("button", { name: "继续游戏", exact: true }));
  await act(page.getByRole("button", { name: "撤销", exact: true }));
  await expect(root).toHaveAttribute("data-scene-found", "");
  await act(page.getByRole("button", { name: "提示", exact: true }));
  await expect(root.locator(".sd-hinted")).toHaveCount(2);
  await expect(root).toHaveAttribute("data-scene-found", "");
  await act(area(0));
  await act(page.getByRole("button", { name: "重来", exact: true }));
  await expect(root).toHaveAttribute("data-scene-found", "");
  for (const index of [0, 7]) {
    await chooseLevel(page, index);
    await page.screenshot({
      path: info.outputPath(`scene-${index}-start.png`),
      fullPage: true,
    });
    const differences: number[] = [];
    for (let i = 0; i < 9; i++) {
      const a = JSON.parse((await area(i, 0).getAttribute("data-scene-item"))!),
        b = JSON.parse((await area(i, 1).getAttribute("data-scene-item"))!);
      if (["kind", "color", "count", "mirror"].some((k) => a[k] !== b[k]))
        differences.push(i);
    }
    expect(differences).toHaveLength(5);
    for (const i of differences) await act(area(i));
    await expect(root).toHaveAttribute("data-scene-won", "true");
    await expect(page.locator(".status")).toHaveClass(/success/);
    await expect(
      page.getByRole("button", { name: "撤销", exact: true }),
    ).toBeDisabled();
    await expect(root.locator("button:enabled")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`scene-${index}-complete.png`),
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
