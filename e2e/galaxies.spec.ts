import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openGame, chooseLevel, captureErrors } from "./helpers";
import { galaxiesLevels } from "../src/games/galaxiesLevels";
import {
  GALAXIES_SAVE,
  initialGalaxies,
  opposite,
} from "../src/games/galaxiesLogic";
const proofs = JSON.parse(readFileSync("docs/galaxies/campaign.json", "utf8"))
  .levels as { id: string; solution: number[] }[];
test("Galaxies existing move, error, pause and resume behavior", async ({
  page,
}, info) => {
  test.setTimeout(360000);
  const errors = captureErrors(page);
  await openGame(page, "星系分区");
  const root = page.locator(".galaxies-layout"),
    cell = (i: number) => root.locator(`button[data-cell="${i}"]`),
    star = (g: number) => root.locator(`button[data-star="${g}"]`);
  const p = galaxiesLevels[0],
    s = initialGalaxies(p),
    i = s.indexOf(-1),
    g = proofs[0].solution[i];
  await star(g).click();
  await cell(i).focus();
  await expect(cell(i)).toBeFocused();
  await cell(i).press("Control+Enter");
  await expect(root).toHaveAttribute("data-galaxies-state", s.join(","));
  await expect(cell(i)).toBeFocused();
  await cell(i).press("Enter");
  await cell(i).click();
  await expect(root).toHaveAttribute("data-galaxies-state", s.join(","));
  await cell(i).click();
  await star(-1).click();
  await cell(i).click();
  await expect(root).toHaveAttribute("data-galaxies-state", s.join(","));
  await star(g).click();
  await cell(i).click();
  const one = await root.getAttribute("data-galaxies-state");
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(cell(i)).toBeDisabled();
  await expect(star(g)).toBeDisabled();
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  await expect(root).toHaveAttribute("data-galaxies-state", one!);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(root).toHaveAttribute("data-galaxies-state", s.join(","));
  await star((g + 1) % p.centers.length).click();
  await cell(i).click();
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(root.getByRole("status")).toContainText("不相容");
  await page.screenshot({
    path: info.outputPath("galaxies-incompatible-assignment.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "重来", exact: true }).click();
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(root.locator(".hint")).toHaveCount(1);
  await expect(root).toHaveAttribute("data-galaxies-state", s.join(","));
  await star(g).click();
  await cell(i).click();
  await page.reload();
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("星系分区");
  await page
    .getByRole("button", { name: /开始玩星系分区|继续玩星系分区/ })
    .click();
  await expect(root).toHaveAttribute("data-galaxies-state", one!);
  await page.getByRole("button", { name: "重来", exact: true }).click();
  // Arrow navigation and a fixed core click select a star without changing clues.
  await cell(0).focus();
  await cell(0).press("ArrowRight");
  await expect(cell(1)).toBeFocused();
  const fixed = s.findIndex((v) => v >= 0);
  await cell(fixed).click();
  await expect(star(s[fixed])).toHaveAttribute("aria-pressed", "true");
  await expect(root).toHaveAttribute("data-galaxies-state", s.join(","));
  const outside = s.findIndex(
    (v, j) => v < 0 && p.centers.some((_, h) => opposite(p, h, j) < 0),
  );
  const bad = p.centers.findIndex((_, h) => opposite(p, h, outside) < 0);
  expect(outside).toBeGreaterThanOrEqual(0);
  await star(bad).click();
  await cell(outside).click();
  await expect(cell(outside)).toHaveClass(/conflict/);
  await page.screenshot({
    path: info.outputPath("galaxies-outside-rotation.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "重来", exact: true }).click();

  await playBoard(page, 0, startFor(0), info.project.name === "mobile");
  await expect(root).toHaveAttribute("data-galaxies-won", "true");
  expect(errors).toEqual([]);
});

const game = (page: Page) => page.locator(".galaxies-layout");
const star = (page: Page, g: number) =>
  game(page).locator(`button[data-star="${g}"]`);
const cell = (page: Page, i: number) =>
  game(page).locator(`button[data-cell="${i}"]`);
const startFor = (index: number) => initialGalaxies(galaxiesLevels[index]);
const click = (touch: boolean, target: ReturnType<Page["locator"]>) =>
  touch ? target.tap() : target.click();
const assign = (page: Page, i: number, touch: boolean) =>
  touch ? cell(page, i).tap() : cell(page, i).press("Enter");
async function playBoard(
  page: Page,
  index: number,
  state: number[],
  touch: boolean,
) {
  const proof = proofs[index];
  expect(proof.id).toBe(galaxiesLevels[index].id);
  for (let g = 0; g < galaxiesLevels[index].centers.length; g++) {
    const cells = proof.solution.flatMap((owner, i) =>
      owner === g && state[i] < 0 ? [i] : [],
    );
    if (!cells.length) continue;
    await click(touch, star(page, g));
    for (const i of cells) await assign(page, i, touch);
  }
  await expect(game(page)).toHaveAttribute("data-galaxies-won", "true");
  await expect(game(page)).toHaveAttribute(
    "data-galaxies-state",
    proof.solution.join(","),
  );
  await expect(page.locator(".status")).toHaveClass(/success/);
  await expect(cell(page, 0)).toBeDisabled();
}

for (let batch = 0; batch < 8; batch++) {
  const first = 36 + 8 * batch;
  test(`Galaxies append ${first + 1}–${first + 8}`, async ({
    page,
    isMobile,
  }, info) => {
    const errors = captureErrors(page);
    await openGame(page, "星系分区");
    for (let index = first; index < first + 8; index++) {
      await chooseLevel(page, index);
      const root = game(page);
      await expect(root).toHaveAttribute(
        "data-galaxies-id",
        galaxiesLevels[index].id,
      );
      await expect(root.locator(".galaxies-heading > span")).toHaveText(
        `${index + 1} / 100`,
      );
      await expect(root).toHaveAttribute("data-galaxies-won", "false");
      const capture = [36, 52, 68, 84, 99].includes(index);
      if (capture) {
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: info.outputPath(`galaxies-${index + 1}-start.png`),
          fullPage: true,
        });
      }
      await playBoard(page, index, startFor(index), isMobile);
      if (capture) {
        await page.screenshot({
          path: info.outputPath(`galaxies-${index + 1}-completed.png`),
          fullPage: true,
        });
      }
    }
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("playgarden.progress.v2")!)
              .completed.galaxies,
        ),
      )
      .toEqual(Array.from({ length: 8 }, (_, i) => first + i));
    expect(errors).toEqual([]);
  });
}

test("Galaxies resumes the unchanged old level 36 and continues to new level 37", async ({
  page,
  isMobile,
}) => {
  const errors = captureErrors(page);
  const old = 35,
    initial = startFor(old),
    partial = initial.slice();
  const first = initial.indexOf(-1);
  partial[first] = proofs[old].solution[first];
  await page.addInitScript(
    ([key, raw]) => {
      if (localStorage.getItem(`${key}.selected`) === null) {
        localStorage.setItem(`${key}.selected`, "35");
        localStorage.setItem(`${key}.round.35`, raw);
      }
    },
    [
      GALAXIES_SAVE,
      JSON.stringify({ id: "galaxies-036", history: [initial, partial] }),
    ],
  );
  await openGame(page, "星系分区");
  await expect(game(page)).toHaveAttribute("data-galaxies-id", "galaxies-036");
  await expect(game(page)).toHaveAttribute(
    "data-galaxies-state",
    partial.join(","),
  );
  await playBoard(page, old, partial, isMobile);
  await click(
    isMobile,
    page.getByRole("button", { name: "下一关", exact: true }),
  );
  await expect(game(page)).toHaveAttribute("data-galaxies-id", "galaxies-037");
  const fresh = startFor(36);
  await expect(game(page)).toHaveAttribute(
    "data-galaxies-state",
    fresh.join(","),
  );
  await click(
    isMobile,
    page.getByRole("button", { name: "提示", exact: true }),
  );
  const hint = game(page).locator(".hint");
  await expect(hint).toHaveCount(1);
  await expect(game(page)).toHaveAttribute(
    "data-galaxies-state",
    fresh.join(","),
  );
  const index = Number(await hint.getAttribute("data-cell"));
  await expect(star(page, proofs[36].solution[index])).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await assign(page, index, isMobile);
  const next = fresh.slice();
  next[index] = proofs[36].solution[index];
  await expect(game(page)).toHaveAttribute(
    "data-galaxies-state",
    next.join(","),
  );
  await page.reload();
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("星系分区");
  await page
    .getByRole("button", { name: "开始玩星系分区", exact: true })
    .click();
  await expect(game(page)).toHaveAttribute("data-galaxies-id", "galaxies-037");
  await expect(game(page)).toHaveAttribute(
    "data-galaxies-state",
    next.join(","),
  );
  expect(errors).toEqual([]);
});
