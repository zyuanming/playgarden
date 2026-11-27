import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { captureErrors, chooseLevel, openGame } from "./helpers";
const proofs = JSON.parse(readFileSync("docs/akari/campaign.json", "utf8"))
  .levels as { id: string; solution: number[]; size: number }[];
const root = (page: Page) => page.locator(".akari-layout");
const cell = (page: Page, i: number) =>
  root(page).locator(`button[data-cell="${i}"]`);
const pick = (page: Page) => page.getByLabel("选择关卡", { exact: true });
const play = async (button: Locator, touch: boolean) => {
  if (touch) await button.tap();
  else await button.press("Enter");
};
const won = async (page: Page) => {
  await expect(root(page)).toHaveAttribute("data-akari-won", "true");
  await expect(page.locator(".status")).toHaveClass(/success/);
};
for (let start = 36; start < 100; start += 8) {
  test(`Akari expansion plays ${start + 1}–${start + 8}`, async ({
    page,
    isMobile,
  }, info) => {
    const errors = captureErrors(page);
    await openGame(page, "灯照花园");
    await expect(pick(page).locator("option")).toHaveCount(100);
    for (let i = start; i < start + 8; i++) {
      const p = proofs[i];
      await chooseLevel(page, i);
      await expect(root(page)).toHaveAttribute("data-akari-id", p.id);
      const capture = [36, 52, 68, 84, 99].includes(i);
      if (capture) {
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: info.outputPath(`level-${i + 1}-start.png`),
          fullPage: true,
        });
      }
      for (const j of p.solution) await play(cell(page, j), isMobile);
      await won(page);
      await expect(cell(page, p.solution[0])).toBeDisabled();
      if (capture)
        await page.screenshot({
          path: info.outputPath(`level-${i + 1}-won.png`),
          fullPage: true,
        });
    }
    const done = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("playgarden.progress.v2") ?? "{}")
          .completed?.akari,
    );
    expect(done).toEqual(Array.from({ length: 8 }, (_, i) => start + i));
    expect(errors).toEqual([]);
  });
}
test("Akari restores the pre-expansion final round and takes 下一关 into the first new chapter", async ({
  page,
  isMobile,
}, info) => {
  const errors = captureErrors(page);
  await page.goto("/");
  // From the released akari-036, independent of the expanded generated data.
  const empty = Array<number>(49).fill(0),
    partial = [...empty];
  partial[2] = 1;
  await page.evaluate(
    ({ empty, partial }) => {
      localStorage.setItem("playgarden.akari.v1.selected", "35");
      localStorage.setItem(
        "playgarden.akari.v1.round.35",
        JSON.stringify({ id: "akari-036", history: [empty, partial] }),
      );
    },
    { empty, partial },
  );
  const enter = async () => {
    await page.getByRole("textbox", { name: "搜索游戏" }).fill("灯照花园");
    const launch = page.getByRole("button", {
      name: /开始玩灯照花园|继续玩灯照花园/,
    });
    if (isMobile) await launch.tap();
    else await launch.click();
  };
  await enter();
  await expect(root(page)).toHaveAttribute("data-akari-id", "akari-036");
  await expect(root(page)).toHaveAttribute(
    "data-akari-state",
    partial.join(""),
  );
  await page.screenshot({
    path: info.outputPath("legacy-36.png"),
    fullPage: true,
  });
  for (const j of [13, 19, 31, 36, 41, 42]) await play(cell(page, j), isMobile);
  await won(page);
  const advance = page.getByRole("button", { name: "下一关", exact: true });
  if (isMobile) await advance.tap();
  else await advance.click();
  await expect(root(page)).toHaveAttribute("data-akari-id", "akari-037");
  await expect(pick(page)).toHaveValue("36");
  const hint = page.getByRole("button", { name: "提示", exact: true });
  if (isMobile) await hint.tap();
  else await hint.click();
  await expect(root(page).locator(".hint")).toHaveCount(1);
  await expect(root(page)).toHaveAttribute("data-akari-state", "0".repeat(36));
  await play(cell(page, proofs[36].solution[0]), isMobile);
  const before = await root(page).getAttribute("data-akari-state");
  await page.reload();
  await enter();
  await expect(root(page)).toHaveAttribute("data-akari-id", "akari-037");
  await expect(root(page)).toHaveAttribute("data-akari-state", before!);
  expect(errors).toEqual([]);
});
