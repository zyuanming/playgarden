import { expect, test, type Locator, type Page } from "@playwright/test";
import { captureErrors, chooseLevel, openGame } from "./helpers";
import { STORAGE_KEY } from "../src/lib/progress";

const title = "回收分拣";
const game = "recycling-workshop";
const paths = [
  "A",
  "B",
  "AB",
  "B",
  "ABC",
  "ADE",
  "CEF",
  "ABIJ",
  "CFGI",
  "ABCDIJ",
  "CDEFGH",
  "ABCIJ",
];
const root = (p: Page) => p.locator(".rw-game");
const joint = (p: Page, id: string) => p.locator('[data-joint="' + id + '"]');
const named = (p: Page, name: string) =>
  p.getByRole("button", { name, exact: true });
const hit = (l: Locator, touch: boolean) =>
  touch ? l.tap() : l.press("Space");
const attr = (p: Page, k: string, v: string) =>
  expect(root(p)).toHaveAttribute("data-" + k, v);
const completed = (p: Page) =>
  p.evaluate(
    ([key, id]) =>
      JSON.parse(localStorage.getItem(key) ?? "{}").completed?.[id] ?? [],
    [STORAGE_KEY, game],
  );
const apply = (p: Page, touch: boolean) => hit(named(p, "确认拆开"), touch);
async function prepare(p: Page, touch: boolean, id: string) {
  const order = await root(p).getAttribute("data-order");
  const tools = await root(p).getAttribute("data-tools");
  const bins = await root(p).getAttribute("data-bins");
  await expect(joint(p, id)).toHaveAttribute("data-state", "available");
  await hit(joint(p, id), touch);
  await attr(p, "selected", id);
  await attr(p, "order", order!);
  await attr(p, "bins", bins!);
  await attr(p, "tools", tools!);
  return order!;
}
async function open(p: Page, touch: boolean, ids: string) {
  for (const id of ids) {
    const before = await prepare(p, touch, id);
    await apply(p, touch);
    await attr(p, "order", before + id);
    await attr(p, "selected", "");
    await expect(joint(p, id)).toHaveAttribute("data-state", "opened");
  }
}
async function win(p: Page, level: number) {
  await attr(p, "won", "true");
  await expect(p.locator(".status.success")).toHaveText("三种材料都达到目标！");
  await expect.poll(() => completed(p)).toContain(level);
}

for (let start = 0; start < 12; start += 4) {
  test(
    "Disassemble workshop boards " + (start + 1) + "–" + (start + 4),
    async ({ page, isMobile }) => {
      const errors = captureErrors(page);
      await openGame(page, title);
      for (let i = start; i < start + 4; i++) {
        await chooseLevel(page, i);
        await attr(
          page,
          "level-id",
          game + "-" + String(i + 1).padStart(2, "0"),
        );
        await attr(page, "order", "");
        await expect(named(page, "确认拆开")).toBeDisabled();
        if (i === 1) {
          await attr(page, "bins", "2,0,0");
          await attr(page, "tools", "0,1");
          await expect(joint(page, "A")).toHaveAttribute(
            "data-state",
            "sorted",
          );
          await expect(joint(page, "A")).toBeDisabled();
        }
        if (i === 2) {
          await expect(joint(page, "B")).toHaveAttribute(
            "data-state",
            "sealed",
          );
          await expect(joint(page, "B")).toBeDisabled();
          await hit(joint(page, "A"), isMobile);
          await attr(page, "gain", "1,0,0");
        }
        await open(page, isMobile, paths[i]);
        await win(page, i);
        if (i === 1) await attr(page, "tools", "0,0");
        if (i === 0) {
          await hit(named(page, "下一关"), isMobile);
          await attr(page, "level-id", "recycling-workshop-02");
        }
      }
      expect(errors).toEqual([]);
    },
  );
}

test("Level 4: preview, tool exhaustion, read-only hint, undo, pause, and reset", async ({
  page,
  isMobile,
}) => {
  const errors = captureErrors(page);
  await openGame(page, title);
  await chooseLevel(page, 3);
  await prepare(page, isMobile, "A");
  await attr(page, "gain", "1,0,0");
  await hit(named(page, "提示"), isMobile);
  await expect(page.locator(".rw-message")).toContainText("接头 B");
  await attr(page, "selected", "A");
  await attr(page, "order", "");
  await hit(named(page, "暂停"), isMobile);
  await expect(named(page, "确认拆开")).toBeDisabled();
  await hit(named(page, "继续游戏"), isMobile);
  await apply(page, isMobile);
  await attr(page, "tools", "0,0");
  await attr(page, "bins", "1,0,0");
  await expect(joint(page, "B")).toHaveAttribute("data-state", "empty");
  await expect(joint(page, "B")).toBeDisabled();
  await hit(named(page, "提示"), isMobile);
  await expect(page.locator(".rw-message")).toContainText("已无法达成配额");
  await attr(page, "order", "A");
  await hit(named(page, "撤销"), isMobile);
  await attr(page, "tools", "1,0");
  await attr(page, "bins", "0,0,0");
  await open(page, isMobile, "A");
  await hit(named(page, "重来"), isMobile);
  await attr(page, "order", "");
  await attr(page, "tools", "1,0");
  await open(page, isMobile, "B");
  await win(page, 3);
  expect(errors).toEqual([]);
});

test("Level 9: different material yields both meet the quotas", async ({
  page,
  isMobile,
}) => {
  const errors = captureErrors(page);
  await openGame(page, title);
  await chooseLevel(page, 8);
  await open(page, isMobile, "CFGI");
  await attr(page, "bins", "2,2,2");
  await win(page, 8);
  await hit(named(page, "重来"), isMobile);
  await open(page, isMobile, "FGIJ");
  await attr(page, "bins", "2,3,3");
  await win(page, 8);
  await page.reload();
  await expect.poll(() => completed(page)).toContain(8);
  expect(errors).toEqual([]);
});

test("Level 12: two traps, exact stocks, and two valid orders", async ({
  page,
  isMobile,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, title);
  await chooseLevel(page, 11);
  const studio = page.getByRole("region", { name: "回收操作台" });
  await attr(page, "tools", "3,2");
  for (const id of ["D", "F"]) {
    await open(page, isMobile, id);
    await attr(page, "tools", "2,2");
    await hit(named(page, "提示"), isMobile);
    await expect(page.locator(".rw-message")).toContainText("已无法达成配额");
    await attr(page, "order", id);
    await hit(named(page, "撤销"), isMobile);
    await attr(page, "order", "");
    await attr(page, "tools", "3,2");
    await attr(page, "bins", "0,0,0");
  }
  for (const [id, bins, tools] of [
    ["A", "0,1,0", "2,2"],
    ["B", "1,1,0", "1,2"],
    ["C", "2,1,1", "1,1"],
    ["I", "3,1,1", "0,1"],
    ["J", "4,1,2", "0,0"],
  ]) {
    await prepare(page, isMobile, id);
    if (id === "I") {
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(await page.evaluate(() => innerWidth));
      expect(
        await studio
          .locator("button")
          .evaluateAll((bs) =>
            bs.every((b) => b.getBoundingClientRect().height >= 44),
          ),
      ).toBe(true);
      await studio.screenshot({
        path: info.outputPath("branch-preview.png"),
        animations: "disabled",
      });
    }
    await apply(page, isMobile);
    await attr(page, "bins", bins);
    await attr(page, "tools", tools);
  }
  await win(page, 11);
  await studio.screenshot({
    path: info.outputPath("all-quotas.png"),
    animations: "disabled",
  });
  await hit(named(page, "重来"), isMobile);
  await open(page, isMobile, "IABJC");
  await attr(page, "bins", "4,1,2");
  await win(page, 11);
  expect(errors).toEqual([]);
});
