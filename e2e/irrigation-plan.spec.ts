import { expect, test, type Page } from "@playwright/test";
import { captureErrors, openGame, chooseLevel } from "./helpers";
import { irrigationLevels } from "../src/games/irrigationPlanLogic";
import { STORAGE_KEY } from "../src/lib/progress";

const root = (p: Page) => p.locator(".irrigation-game");
const panel = (p: Page) => p.locator(".irrigation-panel");
const mode = (p: Page, valve: number, n: number) =>
  root(p).locator(`[data-irrigation-valve="${valve}"][data-mode="${n}"]`);
const shell = (p: Page, name: string) =>
  p.getByRole("button", { name, exact: true }).click();
async function set(
  p: Page,
  touch: boolean,
  level: number,
  valve: number,
  value: number,
) {
  if (touch) {
    await mode(p, valve, value).tap();
    return;
  }
  const state = await root(p).getAttribute("data-irrigation-plan");
  const n = irrigationLevels[level].valves[valve].modes.length;
  for (let step = 0; step < (value - Number(state![valve]) + n) % n; step++)
    await panel(p).press(String(valve + 1));
}
const save = (p: Page) =>
  p.evaluate(
    (key) =>
      JSON.parse(localStorage.getItem(key) ?? "{}").completed?.[
        "irrigation-plan"
      ],
    STORAGE_KEY,
  );
for (let batch = 0; batch < 3; batch++) {
  test(`Irrigation completes boards ${1 + batch * 4}–${4 + batch * 4}`, async ({
    page,
    isMobile,
  }, info) => {
    const errors = captureErrors(page);
    await openGame(page, "灌溉规划");
    for (let index = batch * 4; index < batch * 4 + 4; index++) {
      const p = irrigationLevels[index];
      await chooseLevel(page, index);
      await expect(root(page)).toHaveAttribute("data-irrigation-id", p.id);
      await expect(root(page)).toHaveAttribute(
        "data-irrigation-plan",
        "0".repeat(p.valves.length),
      );
      if ([0, 5, 11].includes(index)) {
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: info.outputPath(`start-${index + 1}.png`),
          fullPage: true,
        });
      }
      for (const [i, v] of p.solution.entries())
        if (v > 0) await set(page, isMobile, index, i, v);
      await expect(root(page)).toHaveAttribute(
        "data-irrigation-plan",
        p.solution.join(""),
      );
      await expect(root(page)).toHaveAttribute("data-irrigation-won", "true");
      await expect(page.locator(".status")).toHaveClass(/success/);
      await expect(mode(page, 0, 0)).toBeDisabled();
      await expect.poll(() => save(page)).toContain(index);
      if (index === 11) {
        await page.screenshot({
          path: info.outputPath("won-12.png"),
          fullPage: true,
        });
        await page.reload();
        await expect.poll(() => save(page)).toContain(index);
      }
    }
    expect(errors).toEqual([]);
  });
}
test("Irrigation requires exact doses and independent tank budgets, allows undo and a non-mutating off hint", async ({
  page,
  isMobile,
}) => {
  const errors = captureErrors(page);
  await openGame(page, "灌溉规划");
  await chooseLevel(page, 1);
  await set(page, isMobile, 1, 0, 1);
  await set(page, isMobile, 1, 1, 2);
  const status = page.locator(".irrigation-status");
  await expect(root(page)).toHaveAttribute("data-irrigation-plan", "12");
  await expect(root(page)).toHaveAttribute("data-irrigation-exact", "true");
  await expect(root(page)).toHaveAttribute("data-irrigation-cap", "false");
  await expect(root(page)).toHaveAttribute("data-irrigation-won", "false");
  await expect(status).toContainText("有水箱超额");
  await expect(page.locator('[data-irrigation-tank="0"]')).toContainText(
    "5 / 4",
  );
  await set(page, isMobile, 1, 0, 2);
  await expect(page.locator('[data-irrigation-plot="1"]')).toHaveAttribute(
    "data-fill",
    "over",
  );
  await expect(page.locator('[data-irrigation-plot="1"]')).toHaveAttribute(
    "data-dose",
    "2",
  );
  await set(page, isMobile, 1, 1, 1);
  await expect(root(page)).toHaveAttribute("data-irrigation-won", "true");
  await chooseLevel(page, 5);
  for (const [i, v] of [..."02011"].entries())
    if (v !== "0") await set(page, isMobile, 5, i, Number(v));
  await expect(root(page)).toHaveAttribute("data-irrigation-plan", "02011");
  await expect(root(page)).toHaveAttribute("data-irrigation-exact", "true");
  await expect(page.locator('[data-irrigation-tank="0"]')).toContainText(
    "2 / 5",
  );
  await expect(page.locator('[data-irrigation-tank="1"]')).toContainText(
    "7 / 4",
  );
  await expect(root(page)).toHaveAttribute("data-irrigation-won", "false");
  await shell(page, "撤销");
  await expect(root(page)).toHaveAttribute("data-irrigation-plan", "02010");
  await shell(page, "重来");
  await expect(root(page)).toHaveAttribute("data-irrigation-plan", "00000");
  await panel(page).press("Control+2");
  await expect(root(page)).toHaveAttribute("data-irrigation-plan", "00000");
  await set(page, isMobile, 5, 0, 1);
  await set(page, isMobile, 5, 1, 2);
  await shell(page, "提示");
  await expect(mode(page, 1, 0)).toHaveAttribute("data-hinted", "true");
  await expect(root(page)).toHaveAttribute("data-irrigation-plan", "12000");
  await shell(page, "暂停");
  await expect(mode(page, 1, 0)).toBeDisabled();
  await shell(page, "继续游戏");
  await set(page, isMobile, 5, 1, 0);
  await set(page, isMobile, 5, 3, 2);
  await set(page, isMobile, 5, 4, 2);
  await expect(root(page)).toHaveAttribute("data-irrigation-won", "true");
  expect(errors).toEqual([]);
});
