import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { openGame, chooseLevel, complete, captureErrors } from "./helpers";
import { pipeCapacityLevels } from "../src/games/pipeCapacityLevels";
import { railwayTimetableLevels } from "../src/games/railwayTimetableLevels";
import { functionFactoryLevels } from "../src/games/functionFactoryLevels";
import { compressionPostLevels } from "../src/games/compressionPostLevels";
import { postPacketKey } from "../src/games/compressionPostLogic";
async function readableDiagram(page: Page, selector: string) {
  const sizes = await page.locator(`${selector} text`).evaluateAll((nodes) =>
    nodes.map((node) => {
      const matrix = (node as SVGTextElement).getScreenCTM();
      return (
        parseFloat(getComputedStyle(node).fontSize) *
        (matrix ? Math.hypot(matrix.a, matrix.b) : 0)
      );
    }),
  );
  expect(sizes.length).toBeGreaterThan(0);
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11.9);
}
async function panDiagram(
  page: Page,
  info: TestInfo,
  selector: string,
  id: string,
) {
  const viewport = page.locator(selector);
  if (await viewport.evaluate((n) => n.scrollWidth > n.clientWidth)) {
    await viewport.focus();
    for (let i = 0; i < 20; i++) await page.keyboard.press("ArrowRight");
    await expect
      .poll(() => viewport.evaluate((n) => n.scrollLeft))
      .toBeGreaterThan(0);
    await page.screenshot({
      path: info.outputPath(`${id}-diagram-right.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
}
test("all exact branching flow and minimum-cost assignments", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "管道配流");
  await readableDiagram(page, ".pc-map");
  await page.screenshot({
    path: info.outputPath("pipe-capacity-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < 12; level++) {
    await chooseLevel(page, level);
    for (const [edge, value] of pipeCapacityLevels[
      level
    ].certificate.flows.entries()) {
      await page.locator(`[data-pipe-edge="${edge}"]`).click();
      await page.locator(`[data-pipe-value="${value}"]`).click();
    }
    await expect(page.locator("[data-pipe-won]")).toHaveAttribute(
      "data-pipe-won",
      "true",
    );
    await readableDiagram(page, ".pc-map");
    if (level === 11)
      await panDiagram(page, info, ".pc-map-wrap", "pipe-capacity");
    await complete(page, info, "pipe-capacity", level);
  }
  expect(errors).toEqual([]);
});
test("all simultaneous railway schedules with collision-safe controls", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "列车时刻");
  await readableDiagram(page, ".rt-map");
  await page.screenshot({
    path: info.outputPath("railway-timetable-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < 12; level++) {
    await chooseLevel(page, level);
    for (const action of railwayTimetableLevels[level].certificate.actions) {
      for (const [index, value] of action.switches.entries())
        await page.locator(`[data-rail-switch="${index}:${value}"]`).click();
      for (const [index, hold] of action.holds.entries()) {
        const button = page.locator(`[data-rail-hold="${index}"]`);
        if ((await button.getAttribute("aria-pressed")) !== String(hold))
          await button.click();
      }
      await page.locator("[data-rail-commit]").click();
    }
    await expect(page.locator("[data-rail-won]")).toHaveAttribute(
      "data-rail-won",
      "true",
    );
    await readableDiagram(page, ".rt-map");
    if (level === 11)
      await panDiagram(page, info, ".rt-map-viewport", "railway-timetable");
    await complete(page, info, "railway-timetable", level);
  }
  expect(errors).toEqual([]);
});
test("all genuinely reused function definitions and ordered traces", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "函数工厂");
  await page.screenshot({
    path: info.outputPath("function-factory-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < 12; level++) {
    await chooseLevel(page, level);
    const certificate = functionFactoryLevels[level].certificate;
    for (const section of ["A", "B", "main"] as const)
      for (const [index, command] of [...certificate[section]].entries()) {
        await page.locator(`[data-factory-slot="${section}:${index}"]`).click();
        await page.locator(`[data-factory-command="${command}"]`).click();
      }
    await page.locator("[data-factory-run]").click();
    await expect(page.locator("[data-function-factory]")).toHaveAttribute(
      "data-factory-won",
      "true",
    );
    await complete(page, info, "function-factory", level);
  }
  expect(errors).toEqual([]);
});
test("all lossless literal run and dictionary packet plans", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "压缩邮局");
  await page.screenshot({
    path: info.outputPath("compression-post-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < 12; level++) {
    await chooseLevel(page, level);
    const config = compressionPostLevels[level];
    for (const packet of config.certificate)
      await page
        .locator(`[data-post-packet="${postPacketKey(packet)}"]`)
        .click();
    await expect(page.locator("[data-post-decoded]")).toHaveText(
      config.message,
    );
    await expect(page.locator("[data-post-undo]")).toBeDisabled();
    await expect(page.locator("[data-compression-post]")).toHaveAttribute(
      "data-post-won",
      "true",
    );
    await complete(page, info, "compression-post", level);
  }
  expect(errors).toEqual([]);
});
