import { test, expect } from "@playwright/test";
import { openGame, chooseLevel, complete, captureErrors } from "./helpers";
import {
  untangleLevels,
  createUntangleState,
  untangleHint,
  moveGardenNode,
  isUntangleSolved,
} from "../src/games/untangleLogic";
import { minimumNetworkLevels } from "../src/games/minimumNetworkLogic";
import {
  hitoriCertificates,
  nurikabeCertificates,
} from "../tests/fixtures/islandEliminationCertificates";
test("all integer-grid untangling gardens", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "花径解结");
  await expect(page.locator('[data-graph-game="untangle"]')).toBeVisible();
  await page.screenshot({
    path: info.outputPath("untangle-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < untangleLevels.length; level++) {
    await chooseLevel(page, level);
    const config = untangleLevels[level];
    let state = createUntangleState(config);
    for (
      let step = 0;
      step < 2 * config.labels.length && !isUntangleSolved(config, state);
      step++
    ) {
      const hint = untangleHint(config, state);
      expect(hint.kind).toBe("move");
      if (hint.kind !== "move") throw Error("Missing certified move");
      if (level === 0 && step === 0)
        await page.getByRole("button", { name: "提示", exact: true }).click();
      await page.locator(`[data-garden-node="${hint.node}"]`).click();
      if (level === 0 && step === 0) {
        await expect(
          page.locator(`[data-garden-spot="${hint.spot}"]`),
        ).toHaveAttribute("data-hint-destination", "true");
        await page.screenshot({
          path: info.outputPath("untangle-hint-after-selection.png"),
          fullPage: true,
          animations: "disabled",
        });
      }
      await page.locator(`[data-garden-spot="${hint.spot}"]`).click();
      state = moveGardenNode(config, state, hint.node, hint.spot);
    }
    expect(isUntangleSolved(config, state)).toBe(true);
    await complete(page, info, "untangle", level);
  }
  expect(errors).toEqual([]);
});
test("all minimum-cost station networks", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "最小连接网");
  await expect(
    page.locator('[data-graph-game="minimum-network"]'),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("minimum-network-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < minimumNetworkLevels.length; level++) {
    await chooseLevel(page, level);
    for (const edge of minimumNetworkLevels[level].certificate)
      await page.locator(`[data-network-edge="${edge}"]`).click();
    await complete(page, info, "minimum-network", level);
  }
  expect(errors).toEqual([]);
});
for (const [title, id, certificates] of [
  ["数字留白", "hitori", hitoriCertificates],
  ["群岛海图", "nurikabe", nurikabeCertificates],
] as const)
  test(`all unique ${id} layouts`, async ({ page }, info) => {
    const errors = captureErrors(page);
    await openGame(page, title);
    await expect(page.locator(`[data-island-game="${id}"]`)).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`${id}-start.png`),
      fullPage: true,
      animations: "disabled",
    });
    for (let level = 0; level < certificates.length; level++) {
      await chooseLevel(page, level);
      if (level === 11) {
        for (const value of [1, 0]) {
          await page
            .getByRole("button", {
              name:
                id === "hitori"
                  ? value
                    ? "黑格画笔"
                    : "白格画笔"
                  : value
                    ? "海水画笔"
                    : "岛屿画笔",
              exact: true,
            })
            .click();
          for (const [index, target] of certificates[level].board.entries()) {
            const cell = page.locator(`[data-${id}-cell="${index}"]`);
            if (
              target !== value ||
              (await cell.getAttribute("data-fixed")) === "true"
            )
              continue;
            await cell.click();
            await expect(cell).toHaveAttribute("data-value", String(value));
          }
        }
      } else
        for (const [index, value] of certificates[level].board.entries()) {
          const cell = page.locator(`[data-${id}-cell="${index}"]`);
          if ((await cell.getAttribute("data-fixed")) === "true") continue;
          for (
            let cycle = 0;
            cycle < 3 &&
            (await cell.getAttribute("data-value")) !== String(value);
            cycle++
          )
            await cell.click();
          await expect(cell).toHaveAttribute("data-value", String(value));
        }
      await complete(page, info, id, level);
    }
    expect(errors).toEqual([]);
  });
