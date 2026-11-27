import { test, expect, type Locator } from "@playwright/test";
import { blackboxLevels } from "../src/games/blackboxLevels";
import { captureErrors, chooseLevel } from "./helpers";

test("Star Observatory restores a pre-expansion round and completes the new first and last levels", async ({ page, isMobile }, info) => {
  const errors = captureErrors(page);
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  const activate = (target: Locator) => isMobile ? target.tap() : target.click();
  const pick = page.getByLabel("选择关卡", { exact: true });
  const cell = (index: number) => page.locator(`[data-blackbox-cell="${index}"]`);
  const port = (index: number) => page.locator(`[data-blackbox-port="${index}"]`);
  const shots = page.locator("[data-blackbox-shots]");
  const key = "playgarden.blackbox.v1";
  const legacyMarks = Array.from({ length: 25 }, (_, i) => i === 0 ? 1 : 0);
  // Fixed round from the last published 84-level release, not derived from the new corpus.
  await page.goto("/");
  await page.evaluate(({ key, legacyMarks }) => {
    localStorage.setItem(`${key}.selected`, "83");
    localStorage.setItem(`${key}.round.83`, JSON.stringify({
      version: 1, id: "blackbox-084", marks: legacyMarks,
      history: [{ cell: 0, before: 0, after: 1 }],
      probes: [{ port: 0, result: -1 }], submitted: false,
    }));
  }, { key, legacyMarks });

  const enter = async () => {
    await page.getByRole("textbox", { name: "搜索游戏" }).fill("星雾探测");
    await activate(page.getByRole("button", { name: "开始玩星雾探测", exact: true }));
  };
  const ready = async (index: number) => {
    await expect(pick).toHaveValue(String(index));
    await expect(page.getByRole("heading", { name: blackboxLevels[index].title, exact: true })).toBeVisible();
    await expect(page.locator("[data-blackbox-cell]")).toHaveCount(25);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  };
  const verify = page.locator("[data-blackbox-verify]");
  const win = async (index: number, atoms: number[]) => {
    for (const i of atoms) await activate(cell(i));
    await expect(verify).toBeEnabled();
    await activate(verify);
    await expect(page.locator("[data-blackbox-won]")).toHaveAttribute("data-blackbox-won", "true");
    await expect.poll(() => page.evaluate(i => {
      const saved = JSON.parse(localStorage.getItem("playgarden.progress.v2") ?? "{}");
      return (saved.completed?.blackbox ?? []).filter((x: number) => x === i).length;
    }, index)).toBe(1);
  };
  await enter();
  await ready(83);
  await expect(pick.locator("option")).toHaveCount(100);
  await expect(cell(0)).toHaveAttribute("data-mark", "1");
  await expect(port(0)).toHaveAttribute("data-result", "-1");
  await expect(shots).toHaveAttribute("data-blackbox-shots", "1");
  await page.screenshot({ path: info.outputPath("84-legacy-restored.png"), fullPage: true });
  await win(83, [2, 16, 24]);
  await activate(page.getByRole("button", { name: "下一关", exact: true }));
  await ready(84);

  await activate(port(0));
  await expect(port(0)).toHaveAttribute("data-result", "-1");
  await activate(page.getByRole("button", { name: "提示", exact: true }));
  await expect(page.locator("[data-blackbox-hint]")).toBeVisible();
  await expect(shots).toHaveAttribute("data-blackbox-shots", "1");
  await expect(cell(0)).toHaveAttribute("data-mark", "0");
  await activate(cell(0));
  await page.reload();
  await enter();
  await ready(84);
  await expect(cell(0)).toHaveAttribute("data-mark", "1");
  await expect(port(0)).toHaveAttribute("data-result", "-1");
  await page.screenshot({ path: info.outputPath("85-new-round-restored.png"), fullPage: true });
  await win(84, [3, 9, 19]);
  await chooseLevel(page, 99);
  await ready(99);
  await win(99, blackboxLevels[99].atoms);
  const exit = page.getByRole("button", { name: "返回大厅", exact: true });
  await expect(exit).toBeFocused();
  await page.screenshot({ path: info.outputPath("100-completed.png"), fullPage: true });
  await activate(exit);
  await expect(page.getByRole("textbox", { name: "搜索游戏" })).toBeVisible();
  expect(errors).toEqual([]);
});
