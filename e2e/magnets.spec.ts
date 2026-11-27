import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openGame, chooseLevel, captureErrors } from "./helpers";
import { magnetsLevels } from "../src/games/magnetsLevels";
import {
  MAGNETS_SAVE,
  initialMagnets,
  oppositePole,
} from "../src/games/magnetsLogic";
const proofs = JSON.parse(readFileSync("docs/magnets/campaign.json", "utf8"))
  .levels as { id: string; solution: number[] }[];
test("Magnets existing move, conflict, neutral, and recovery behavior", async ({
  page,
}, info) => {
  test.setTimeout(360000);
  const errors = captureErrors(page);
  await openGame(page, "磁极拼图");
  const root = page.locator(".magnets-layout"),
    cell = (i: number) => root.locator(`button[data-cell="${i}"]`),
    pole = (v: number) => root.locator(`button[data-pole="${v}"]`);
  const p = magnetsLevels[0],
    fresh = initialMagnets(p),
    [a, b] = p.dominoes[0],
    right = proofs[0].solution[0];
  await pole(1).click();
  await cell(b).focus();
  await cell(b).press("Control+Enter");
  await expect(root).toHaveAttribute("data-magnets-state", fresh.join(","));
  await cell(b).press("Enter");
  await expect(cell(b)).toHaveAttribute("data-value", "1");
  await expect(cell(a)).toHaveAttribute("data-value", "2");
  await pole(-1).click();
  await cell(a).click();
  await expect(root).toHaveAttribute("data-magnets-state", fresh.join(","));
  await pole(right).click();
  await cell(a).click();
  const one = await root.getAttribute("data-magnets-state");
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(cell(a)).toBeDisabled();
  await expect(pole(1)).toBeDisabled();
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  await expect(root).toHaveAttribute("data-magnets-state", one!);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(root).toHaveAttribute("data-magnets-state", fresh.join(","));
  await pole((right + 1) % 3).click();
  await cell(a).click();
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(root.getByRole("status")).toContainText("不相容");
  await page.screenshot({
    path: info.outputPath("magnets-incompatible.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "重来", exact: true }).click();
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(root.locator(".hint")).toHaveCount(2);
  await expect(root).toHaveAttribute("data-magnets-state", fresh.join(","));
  await pole(right).click();
  await cell(a).click();
  await page.reload();
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("磁极拼图");
  await page
    .getByRole("button", { name: /开始玩磁极拼图|继续玩磁极拼图/ })
    .click();
  await expect(root).toHaveAttribute("data-magnets-state", one!);
  await page.getByRole("button", { name: "重来", exact: true }).click();
  await cell(0).focus();
  await cell(0).press("ArrowRight");
  await expect(cell(1)).toBeFocused();
  // Construct a real adjacent equal-pole mistake across two different dominoes.
  const owner = (i: number) => p.dominoes.findIndex((d) => d.includes(i));
  let pair: number[] = [];
  for (let i = 0; i < p.width * p.height && !pair.length; i++)
    for (const j of [
      (i % p.width) + 1 < p.width ? i + 1 : -1,
      i + p.width < p.width * p.height ? i + p.width : -1,
    ])
      if (j >= 0 && owner(i) !== owner(j)) {
        pair = [i, j];
        break;
      }
  await pole(1).click();
  for (const i of pair) await cell(i).click();
  for (const i of pair) await expect(cell(i)).toHaveClass(/conflict/);
  await page.screenshot({
    path: info.outputPath("magnets-adjacent-same-poles.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "重来", exact: true }).click();

  await playBoard(page, 0, fresh, info.project.name === "mobile");
  expect(errors).toEqual([]);
});

const layout = (page: Page) => page.locator(".magnets-layout");
const cell = (page: Page, i: number) =>
  layout(page).locator(`button[data-cell="${i}"]`);
const pole = (page: Page, v: number) =>
  layout(page).locator(`button[data-pole="${v}"]`);
const click = (touch: boolean, target: ReturnType<Page["locator"]>) =>
  touch ? target.tap() : target.click();
const paint = (page: Page, touch: boolean, i: number) =>
  touch ? cell(page, i).tap() : cell(page, i).press("Enter");
const prefs = "playgarden.progress.v2";
async function playBoard(
  page: Page,
  index: number,
  state: number[],
  touch: boolean,
) {
  const p = magnetsLevels[index],
    proof = proofs[index];
  expect(proof.id).toBe(p.id);
  for (const tool of [0, 1, 2]) {
    const targets = proof.solution.flatMap((value, d) => {
      if (state[d] !== -1) return [];
      const half = d % 2,
        v = half ? oppositePole(value) : value;
      return v === tool ? [p.dominoes[d][half]] : [];
    });
    if (targets.length) await click(touch, pole(page, tool));
    for (const i of targets) await paint(page, touch, i);
  }
  await expect(layout(page)).toHaveAttribute("data-magnets-won", "true");
  await expect(layout(page)).toHaveAttribute(
    "data-magnets-state",
    proof.solution.join(","),
  );
  await expect(page.locator(".status")).toHaveClass(/success/);
  await expect(cell(page, 0)).toBeDisabled();
}
for (let batch = 0; batch < 8; batch++) {
  const start = 36 + batch * 8;
  test(`Magnets append ${start + 1}–${start + 8}`, async ({
    page,
    isMobile,
  }, info) => {
    const errors = captureErrors(page);
    await openGame(page, "磁极拼图");
    for (let i = start; i < start + 8; i++) {
      await chooseLevel(page, i);
      await expect(layout(page)).toHaveAttribute(
        "data-magnets-id",
        magnetsLevels[i].id,
      );
      await expect(layout(page)).toHaveAttribute("data-magnets-won", "false");
      await expect(layout(page).locator(".magnets-heading > span")).toHaveText(
        `${i + 1} / 100`,
      );
      const capture = [36, 52, 68, 84, 99].includes(i);
      if (capture) {
        if (isMobile) {
          const singleLine = await layout(page)
            .locator(".magnets-palette button > span")
            .evaluateAll(
              (labels) =>
                labels.length === 4 &&
                labels.every((label) => {
                  const range = document.createRange();
                  range.selectNodeContents(label);
                  const glyphs = range.getClientRects();
                  const button = label.parentElement!.getBoundingClientRect();
                  return (
                    glyphs.length === 1 &&
                    glyphs[0].left >= button.left &&
                    glyphs[0].right <= button.right
                  );
                }),
            );
          expect(singleLine).toBe(true);
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: info.outputPath(`magnets-${i + 1}-start.png`),
          fullPage: true,
        });
      }
      await playBoard(page, i, initialMagnets(magnetsLevels[i]), isMobile);
      if (capture)
        await page.screenshot({
          path: info.outputPath(`magnets-${i + 1}-won.png`),
          fullPage: true,
        });
    }
    await expect
      .poll(() =>
        page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)!).completed.magnets,
          prefs,
        ),
      )
      .toEqual(Array.from({ length: 8 }, (_, i) => start + i));
    expect(errors).toEqual([]);
  });
}

test("Magnets preserves a partial save from board 36 and hints without auto-placement", async ({
  page,
  isMobile,
}, info) => {
  const errors = captureErrors(page);
  const old = 35,
    oldStart = initialMagnets(magnetsLevels[old]),
    partial = oldStart.slice();
  partial[0] = proofs[old].solution[0];
  await page.addInitScript(
    ([key, save]) => {
      if (localStorage.getItem(`${key}.selected`) === null) {
        localStorage.setItem(`${key}.selected`, "35");
        localStorage.setItem(`${key}.round.35`, save);
      }
    },
    [
      MAGNETS_SAVE,
      JSON.stringify({ id: "magnets-036", history: [oldStart, partial] }),
    ],
  );
  await openGame(page, "磁极拼图");
  await expect(layout(page)).toHaveAttribute("data-magnets-id", "magnets-036");
  await expect(layout(page)).toHaveAttribute(
    "data-magnets-state",
    partial.join(","),
  );
  await playBoard(page, old, partial, isMobile);
  await click(
    isMobile,
    page.getByRole("button", { name: "下一关", exact: true }),
  );
  await expect(layout(page)).toHaveAttribute("data-magnets-id", "magnets-037");
  const first = initialMagnets(magnetsLevels[36]);
  const hintAction = page.getByRole("button", { name: "提示", exact: true });
  await click(isMobile, hintAction);
  await expect(layout(page).locator(".hint")).toHaveCount(2);
  await expect(layout(page)).toHaveAttribute(
    "data-magnets-state",
    first.join(","),
  );
  const n = Number(
    await layout(page)
      .locator("button.hint")
      .first()
      .getAttribute("data-domino"),
  );
  const predicted = proofs[36].solution[n];
  await expect(pole(page, predicted)).toHaveAttribute("aria-pressed", "true");
  await paint(page, isMobile, magnetsLevels[36].dominoes[n][0]);
  first[n] = predicted;
  await expect(layout(page)).toHaveAttribute(
    "data-magnets-state",
    first.join(","),
  );
  await page.reload();
  await openGame(page, "磁极拼图");
  await expect(layout(page)).toHaveAttribute("data-magnets-id", "magnets-037");
  await expect(layout(page)).toHaveAttribute(
    "data-magnets-state",
    first.join(","),
  );
  await chooseLevel(page, 80);
  const blank = initialMagnets(magnetsLevels[80]).join(",");
  await hintAction.evaluate((button) => {
    performance.clearMarks("magnets-hint-start");
    performance.clearMarks("magnets-hint-render");
    const board = document.querySelector(".magnets-layout")!;
    button.addEventListener(
      "click",
      () => performance.mark("magnets-hint-start"),
      { capture: true, once: true },
    );
    const observer = new MutationObserver(() => {
      if (board.querySelectorAll(".hint").length === 2) {
        performance.mark("magnets-hint-render");
        observer.disconnect();
      }
    });
    observer.observe(board, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  });
  await click(isMobile, hintAction);
  await expect(layout(page).locator(".hint")).toHaveCount(2);
  const ms = await page.evaluate(() => {
    const start =
      performance.getEntriesByName("magnets-hint-start")[0].startTime;
    const end = performance.getEntriesByName("magnets-hint-render")[0]
      .startTime;
    return end - start;
  });
  expect(ms).toBeGreaterThanOrEqual(0);
  expect(ms).toBeLessThan(1500);
  await info.attach("board-81-blank-hint-ms", {
    body: JSON.stringify(ms),
    contentType: "application/json",
  });
  console.log(`Level 81 hint, ${info.project.name}: ${ms.toFixed(1)} ms`);
  await expect(layout(page)).toHaveAttribute("data-magnets-state", blank);
  await page.screenshot({
    path: info.outputPath("magnets-81-hint.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
