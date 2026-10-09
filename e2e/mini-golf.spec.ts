// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Locator } from "@playwright/test";
import { openGame, chooseLevel, captureErrors } from "./helpers";
import { miniGolfLevels } from "../src/games/miniGolfLogic";
test("Putting first/final geometric captures, pause and active-shot undo", async ({
  page,
}, info) => {
  const errors = captureErrors(page),
    act = async (l: Locator) =>
      info.project.name === "mobile" ? l.tap() : l.click();
  await openGame(page, "草地推杆");
  const root = page.locator("[data-mini-golf-game]"),
    shot = root.getByRole("button", { name: "推杆", exact: true }),
    angle = root.getByRole("spinbutton", { name: "推杆角度" }),
    power = root.getByRole("spinbutton", { name: "推杆力度" });
  const initial = await root.getAttribute("data-golf-ball");
  await angle.fill("180");
  await power.fill("65");
  await act(shot);
  await expect(root).toHaveAttribute("data-mini-golf-phase", "rolling");
  await act(page.getByRole("button", { name: "暂停", exact: true }));
  const frozen = await root.getAttribute("data-golf-ball");
  await page.waitForTimeout(160);
  await expect(root).toHaveAttribute("data-golf-ball", frozen!);
  await act(page.getByRole("button", { name: "继续游戏", exact: true }));
  await act(page.getByRole("button", { name: "撤销", exact: true }));
  await expect(root).toHaveAttribute("data-golf-ball", initial!);
  await expect(root).toHaveAttribute("data-mini-golf-strokes", "0");
  await act(page.getByRole("button", { name: "重来", exact: true }));
  await act(page.getByRole("button", { name: "提示", exact: true }));
  await expect(root.locator(".mg-message")).toContainText("入杯路线");
  await expect(root).toHaveAttribute("data-mini-golf-strokes", "0");
  for (const index of [0, 7]) {
    await chooseLevel(page, index);
    await page.screenshot({
      path: info.outputPath(`golf-course-${index}-start.png`),
      fullPage: true,
    });
    await angle.fill(index === 0 ? "0" : "20");
    await power.fill(index === 0 ? "60" : "70");
    await act(shot);
    await expect(root).toHaveAttribute("data-mini-golf-won", "true", {
      timeout: 15000,
    });
    await expect(page.locator(".status")).toHaveClass(/success/);
    const ball = JSON.parse((await root.getAttribute("data-golf-ball"))!);
    expect(
      Math.hypot(
        ball.x - miniGolfLevels[index].hole.x,
        ball.y - miniGolfLevels[index].hole.y,
      ),
    ).toBeLessThanOrEqual(12);
    await expect(shot).toBeDisabled();
    await expect(angle).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "撤销", exact: true }),
    ).toBeDisabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`golf-course-${index}-complete.png`),
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
