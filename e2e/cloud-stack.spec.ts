// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Locator } from "@playwright/test";
import { openGame, chooseLevel, captureErrors } from "./helpers";
import { cloudStackLevels } from "../src/games/cloudStackLogic";
test("Real-time tower first/final supported floors, pause and restart", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors = captureErrors(page),
    act = async (l: Locator) =>
      info.project.name === "mobile" ? l.tap() : l.click();
  await openGame(page, "云端叠楼");
  const root = page.locator("[data-cloud-stack-game]");
  const button = root.locator(".clstack-drop");
  await expect(
    page.getByRole("button", { name: "撤销", exact: true }),
  ).toBeDisabled();
  await act(button);
  await expect(root).toHaveAttribute("data-stack-phase", "moving");
  await act(page.getByRole("button", { name: "暂停", exact: true }));
  const frozen = await root.getAttribute("data-stack-x");
  await page.waitForTimeout(160);
  await expect(root).toHaveAttribute("data-stack-x", frozen!);
  await expect(button).toBeDisabled();
  await act(page.getByRole("button", { name: "继续游戏", exact: true }));
  await act(page.getByRole("button", { name: "重来", exact: true }));
  await expect(root).toHaveAttribute("data-stack-height", "0");
  await expect(root).toHaveAttribute("data-stack-phase", "ready");
  // Two deliberately early drops leave the next slab without support.
  await chooseLevel(page, 7);
  await act(button);
  await act(button);
  await act(button);
  await expect(root).toHaveAttribute("data-stack-phase", "lost");
  await expect(page.locator(".status")).not.toHaveClass(/success/);
  await act(page.getByRole("button", { name: "重来", exact: true }));
  await expect(root).toHaveAttribute("data-stack-phase", "ready");
  for (const index of [0, 7]) {
    await chooseLevel(page, index);
    await page.screenshot({
      path: info.outputPath(`stack-${index}-start.png`),
      fullPage: true,
    });
    await act(page.getByRole("button", { name: "提示", exact: true }));
    await expect(root.locator(".clstack-message")).toContainText("支撑");
    if (info.project.name === "desktop") {
      await root.focus();
      await root.press("Space");
    } else await act(button);
    for (let floor = 0; floor < cloudStackLevels[index].target; floor++) {
      await button.scrollIntoViewIfNeeded();
      await page.waitForFunction(
        () => {
          const g = document.querySelector("[data-cloud-stack-game]")!;
          const top = JSON.parse(g.getAttribute("data-stack-top")!);
          return Math.abs(Number(g.getAttribute("data-stack-x")) - top.x) < 4;
        },
        undefined,
        { timeout: 15000 },
      );
      await act(button);
      await expect(root).toHaveAttribute(
        "data-stack-height",
        String(floor + 1),
      );
    }
    await expect(root).toHaveAttribute("data-stack-phase", "won");
    await expect(page.locator(".status")).toHaveClass(/success/);
    const top = JSON.parse((await root.getAttribute("data-stack-top"))!);
    expect(top.width).toBeGreaterThanOrEqual(8);
    await expect(button).toBeDisabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`stack-${index}-complete.png`),
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
