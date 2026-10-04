import { test, expect, type Page, type Locator } from "@playwright/test";
import { openGame, chooseLevel, complete, captureErrors } from "./helpers";
import { codeCluesLevels } from "../src/games/codeCluesLevels";
import { energyDispatchLevels } from "../src/games/energyDispatchLevels";
import { rollingFacesLevels } from "../src/games/rollingFacesLevels";
import { shapeMosaicLevels } from "../src/games/shapeMosaicLevels";
import {
  mosaicChangeOrientation,
  type MosaicPiece,
} from "../src/games/shapeMosaicLogic";
async function keyboardTo(page: Page, target: Locator) {
  for (let n = 0; n < 70; n++) {
    if (await target.evaluate((e) => e === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw Error("Target not reachable by Tab");
}
function orientationActions(piece: MosaicPiece, target: number) {
  const queue = [{ o: 0, actions: [] as boolean[] }],
    seen = new Set([0]);
  for (const n of queue) {
    if (n.o === target) return n.actions;
    for (const flip of piece.reflect ? [false, true] : [false]) {
      const o = mosaicChangeOrientation(piece, n.o, flip);
      if (!seen.has(o)) {
        seen.add(o);
        queue.push({ o, actions: [...n.actions, flip] });
      }
    }
  }
  throw Error("Unreachable orientation");
}
test("all feedback-code investigations and visible latest evidence", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "码符侦探");
  await page.screenshot({
    path: info.outputPath("code-clues-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  // Repeated non-winning guesses intentionally fill the history before its scroll assertion.
  for (let i = 0; i < 12; i++)
    await page.locator("[data-code-clues-submit]").click();
  const history = page.locator(".cc-history");
  await expect
    .poll(() => history.evaluate((e) => e.scrollTop))
    .toBeGreaterThan(0);
  expect(
    await history.evaluate(
      (e) => Math.abs(e.scrollHeight - e.clientHeight - e.scrollTop) < 3,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("code-clues-history.png"),
    fullPage: true,
    animations: "disabled",
  });
  await chooseLevel(page, 11);
  const codeHintStart = Date.now();
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(page.locator("[data-code-clues-hint]")).toBeVisible({
    timeout: 10000,
  });
  info.annotations.push({
    type: "largest-authored-code-hint-ms",
    description: String(Date.now() - codeHintStart),
  });
  for (let level = 0; level < 12; level++) {
    await chooseLevel(page, level);
    if (level === 0)
      await page.getByRole("button", { name: "重来", exact: true }).click();
    for (const guess of codeCluesLevels[level].certificate.guesses) {
      for (let slot = 0; slot < guess.length; slot++)
        await page
          .locator(`[data-code-clues-slot="${slot}"]`)
          .selectOption(String(guess[slot]));
      await page.locator("[data-code-clues-submit]").click();
    }
    expect(
      await page
        .locator("[data-code-clues-slot]")
        .evaluateAll((ns) =>
          ns.every((n) => getComputedStyle(n).opacity === "1"),
        ),
    ).toBe(true);
    await complete(page, info, "code-clues", level);
  }
  expect(errors).toEqual([]);
});
test("all energy schedules with continuous keyboard periods", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "储能调度");
  await page.screenshot({
    path: info.outputPath("energy-dispatch-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < 12; level++) {
    await chooseLevel(page, level);
    const config = energyDispatchLevels[level];
    if (level === 0)
      await page.locator('[data-energy-dispatch-generator="0"]').focus();
    for (const [i, action] of config.certificate.actions.entries()) {
      const gen = page.locator(
          `[data-energy-dispatch-generator="${action.generator}"]`,
        ),
        battery = page.locator(
          `[data-energy-dispatch-battery="${action.battery}"]`,
        ),
        commit = page.locator("[data-energy-dispatch-commit]");
      if (level === 0) {
        await keyboardTo(page, gen);
        await page.keyboard.press("Enter");
        await keyboardTo(page, battery);
        await page.keyboard.press("Enter");
        await keyboardTo(page, commit);
        await page.keyboard.press("Enter");
        if (i < config.periods.length - 1)
          await expect(
            page.locator('[data-energy-dispatch-generator="0"]'),
          ).toBeFocused();
      } else {
        await gen.click();
        await battery.click();
        await commit.click();
      }
    }
    expect(
      await page
        .locator(
          "[data-energy-dispatch-generator],[data-energy-dispatch-battery]",
        )
        .evaluateAll((ns) =>
          ns.every((n) => getComputedStyle(n).opacity === "1"),
        ),
    ).toBe(true);
    await complete(page, info, "energy-dispatch", level);
  }
  expect(errors).toEqual([]);
});
test("all oriented cube journeys with actual WebGL", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "滚面旅程");
  await expect(page.locator("canvas")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("rolling-faces-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < 12; level++) {
    await chooseLevel(page, level);
    for (const d of rollingFacesLevels[level].certificate.moves)
      await page.locator(`[data-roll-direction="${d}"]`).click();
    await expect(page.locator("[data-rolling-faces-game]")).toHaveAttribute(
      "data-rolling-won",
      "true",
    );
    await complete(page, info, "rolling-faces", level);
  }
  expect(errors).toEqual([]);
});
test("all exact-cover mosaics with readable shape descriptions", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "拼片镶嵌");
  const selectedLabel = await page.locator(".sm-selected strong").boundingBox();
  expect(selectedLabel!.height).toBeLessThan(50);
  const geometryText = await page
    .locator(".sm-shape-description")
    .boundingBox();
  const previewBox = await page.locator(".sm-selected").boundingBox();
  expect(geometryText!.y).toBeGreaterThanOrEqual(
    previewBox!.y + previewBox!.height,
  );
  await page.screenshot({
    path: info.outputPath("shape-mosaic-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  await chooseLevel(page, 11);
  const mosaicHintStart = Date.now();
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(page.locator(".sm-message")).not.toHaveText(
    "选一片，调整朝向，再在棋盘上点选星标锚点。",
  );
  info.annotations.push({
    type: "largest-authored-mosaic-hint-ms",
    description: String(Date.now() - mosaicHintStart),
  });
  for (let level = 0; level < 12; level++) {
    await chooseLevel(page, level);
    const config = shapeMosaicLevels[level];
    for (const p of config.certificate.placements) {
      await page.locator(`[data-mosaic-piece="${p.piece}"]`).click();
      for (const flip of orientationActions(
        config.pieces[p.piece],
        p.orientation,
      ))
        await page
          .locator(flip ? "[data-mosaic-flip]" : "[data-mosaic-rotate]")
          .click();
      await expect(
        page.locator("[data-mosaic-shape-description]"),
      ).toContainText("星标原点");
      await page.locator(`[data-mosaic-cell="${p.x},${p.y}"]`).click();
    }
    await expect(page.locator("[data-shape-mosaic-game]")).toHaveAttribute(
      "data-mosaic-won",
      "true",
    );
    await page.locator('[data-mosaic-piece="0"]').click();
    await expect(page.locator("[data-mosaic-shape-description]")).toContainText(
      "A 当前占格",
    );
    await complete(page, info, "shape-mosaic", level);
  }
  expect(errors).toEqual([]);
});
