// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Locator } from "@playwright/test";
import { openGame, chooseLevel, captureErrors } from "./helpers";
import { cipherLettersLevels } from "../src/games/cipherLettersLogic";
test("Substitution map first/final decoding and wrong-map repair", async ({
  page,
}, info) => {
  const errors = captureErrors(page),
    act = async (l: Locator) =>
      info.project.name === "mobile" ? l.tap() : l.click();
  await openGame(page, "密码花信");
  const root = page.locator("[data-cipher-game]");
  const key = (k: string) => root.locator(`[data-cipher-key="${k}"]`),
    value = (v: string) => root.locator(`[data-cipher-value="${v}"]`);
  const first = cipherLettersLevels[0];
  await page.screenshot({
    path: info.outputPath("cipher-first-start.png"),
    fullPage: true,
  });
  await act(key(first.encrypted[0]));
  await act(value("A"));
  let map = JSON.parse((await root.getAttribute("data-cipher-map"))!);
  expect(map[first.encrypted[0]]).toBe("A");
  await expect(root).toHaveAttribute("data-cipher-won", "false");
  await act(key(first.encrypted[1]));
  await act(value("A"));
  map = JSON.parse((await root.getAttribute("data-cipher-map"))!);
  expect(map[first.encrypted[1]]).toBeUndefined();
  await expect(root.locator(".ciph-message")).toContainText("已被");
  await act(page.getByRole("button", { name: "暂停", exact: true }));
  await expect(value("W")).toBeDisabled();
  await act(page.getByRole("button", { name: "继续游戏", exact: true }));
  await act(page.getByRole("button", { name: "撤销", exact: true }));
  await expect(root).toHaveAttribute("data-cipher-map", "{}");
  await act(key(first.encrypted[0]));
  await act(value("A"));
  await act(page.getByRole("button", { name: "提示", exact: true }));
  await expect(root.locator(".ciph-message")).toContainText("代表 W");
  await act(page.getByRole("button", { name: "清除映射", exact: true }));
  await expect(root).toHaveAttribute("data-cipher-map", "{}");
  await act(page.getByRole("button", { name: "重来", exact: true }));
  for (const index of [0, 7]) {
    await chooseLevel(page, index);
    const p = cipherLettersLevels[index],
      mapping = new Map<string, string>();
    [...p.phrase].forEach((c, i) => {
      if (c !== " ") mapping.set(p.encrypted[i], c);
    });
    await page.screenshot({
      path: info.outputPath(`cipher-${index}-start.png`),
      fullPage: true,
    });
    for (const [code, plain] of mapping) {
      await act(key(code));
      if (info.project.name === "desktop") {
        await root.getByRole("group", { name: "真实字母键盘，A至Z" }).focus();
        await page.keyboard.press(plain.toLowerCase());
      } else await act(value(plain));
    }
    await expect(root).toHaveAttribute("data-cipher-won", "true");
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
      path: info.outputPath(`cipher-${index}-complete.png`),
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
