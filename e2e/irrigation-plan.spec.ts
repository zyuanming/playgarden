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

const useShell = (p: Page, name: string, touch: boolean) => {
  const button = p.getByRole("button", { name, exact: true });
  return touch ? button.tap() : button.click();
};
const attr = (p: Page, field: string, value: string) =>
  expect(root(p)).toHaveAttribute("data-irrigation-" + field, value);
const tank = (p: Page, i: number) => p.locator('[data-irrigation-tank="' + i + '"]');
async function draft(p: Page, touch: boolean, level: number, pattern: string) {
  for (const [i, n] of [...pattern].entries()) {
    const before = await root(p).getAttribute("data-irrigation-plan");
    if (before?.[i] !== n) await set(p, touch, level, i, Number(n));
  }
  await attr(p, "plan", pattern);
}
async function complete(p: Page, index: number) {
  await attr(p, "won", "true");
  await expect(p.locator(".status.success")).toContainText("水箱也没有超额");
  await expect.poll(() => save(p)).toContain(index);
}

for (let first = 12; first < 100; first += 8) {
  const end = Math.min(first + 8, 100);
  test("Irrigation new layouts " + (first + 1) + "–" + end, async ({ page, isMobile }, info) => {
    const errors = captureErrors(page);
    await openGame(page, "灌溉规划");
    for (let index = first; index < end; index++) {
      await chooseLevel(page, index);
      const layout = irrigationLevels[index];
      await attr(page, "id", "irrigation-plan-" + String(index + 1).padStart(3, "0"));
      await attr(page, "plan", "0".repeat(layout.valves.length));
      if ([12, 40, 61, 99].includes(index)) {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const sizes = await panel(page).locator("button").evaluateAll(ns =>
          ns.map(n => { const r = n.getBoundingClientRect(); return Math.min(r.width, r.height); })
        );
        expect(Math.min(...sizes)).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: info.outputPath("start-new-" + (index + 1) + ".png"), fullPage: true, animations: "disabled" });
      }
      await draft(page, isMobile, index, layout.solution.join(""));
      await complete(page, index);
    }
    expect(errors).toEqual([]);
  });
}

test("Irrigation keeps old completions and continues 12 to 13 before reloading", async ({ page, isMobile }) => {
  const errors = captureErrors(page);
  await page.goto("/");
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({
    version: 2, completed: { "irrigation-plan": Array.from({ length: 11 }, (_, i) => i) },
  })), STORAGE_KEY);
  await openGame(page, "灌溉规划");
  await attr(page, "id", "irrigation-plan-012");
  await expect(page.getByLabel("选择关卡", { exact: true }).locator("option")).toHaveCount(100);
  await draft(page, isMobile, 11, "2022021");
  await complete(page, 11);
  await useShell(page, "下一关", isMobile);
  await attr(page, "id", "irrigation-plan-013");
  await expect(page.locator(".status")).not.toHaveClass(/success/);
  await expect(page.locator(".status")).not.toContainText("水箱也没有超额");
  await draft(page, isMobile, 12, "20221");
  await complete(page, 12);
  await openGame(page, "灌溉规划");
  await attr(page, "id", "irrigation-plan-014");
  expect(await save(page)).toEqual(Array.from({ length: 13 }, (_, i) => i));
  expect(errors).toEqual([]);
});

test("Both valid arrangements of irrigation level 62 are accepted", async ({ page, isMobile }) => {
  const errors = captureErrors(page);
  await openGame(page, "灌溉规划");
  await chooseLevel(page, 61);
  for (const answer of ["1100222", "1110122"]) {
    await draft(page, isMobile, 61, answer);
    await complete(page, 61);
    await useShell(page, "重来", isMobile);
    await attr(page, "plan", "0000000");
    await attr(page, "won", "false");
  }
  expect(errors).toEqual([]);
});

test("Three exact-dose plans all use 17 units but only independent caps 8 and 9 win", async ({ page, isMobile }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "灌溉规划");
  await chooseLevel(page, 99);
  const strong = ".irrigation-status";
  await draft(page, isMobile, 99, "2200221");
  await attr(page, "exact", "true");
  await attr(page, "cap", "false");
  await attr(page, "won", "false");
  await expect(tank(page, 0)).toContainText("9 / 8");
  await expect(tank(page, 1)).toContainText("8 / 9");
  await expect(tank(page, 0)).toHaveAttribute("data-over", "true");
  await expect(page.locator(strong)).toContainText("水箱超额");
  await page.screenshot({ path: info.outputPath("exact-tank-I-over.png"), fullPage: true, animations: "disabled" });
  await useShell(page, "重来", isMobile);
  await draft(page, isMobile, 99, "0212221");
  await attr(page, "exact", "true");
  await attr(page, "won", "false");
  await expect(tank(page, 0)).toContainText("6 / 8");
  await expect(tank(page, 1)).toContainText("11 / 9");
  await expect(tank(page, 1)).toHaveAttribute("data-over", "true");
  await useShell(page, "提示", isMobile);
  await expect(mode(page, 2, 2)).toHaveAttribute("data-hinted", "true");
  await attr(page, "plan", "0212221");
  await page.screenshot({ path: info.outputPath("exact-tank-II-hint.png"), fullPage: true, animations: "disabled" });
  await set(page, isMobile, 99, 2, 2);
  await attr(page, "plan", "0222221");
  await useShell(page, "撤销", isMobile);
  await attr(page, "plan", "0212221");
  await expect(mode(page, 2, 2)).toHaveAttribute("data-hinted", "false");
  await set(page, isMobile, 99, 2, 2);
  // Keyboard cycling requires 2→0→1; undo above is one actual edit, not a compound shortcut.
  await set(page, isMobile, 99, 5, 1);
  await attr(page, "plan", "0222211");
  await attr(page, "exact", "true");
  await attr(page, "cap", "true");
  await expect(tank(page, 0)).toContainText("8 / 8");
  await expect(tank(page, 1)).toContainText("9 / 9");
  await complete(page, 99);
  await chooseLevel(page, 98);
  await attr(page, "won", "false");
  await expect(page.locator("[data-hinted=true]")).toHaveCount(0);
  await expect(page.locator(".status")).not.toContainText("水箱也没有超额");
  expect(errors).toEqual([]);
});
