import { concurrentKitchenLevels } from "../src/games/concurrentKitchenLevels";
import { test, expect } from "@playwright/test";
import { openGame, chooseLevel, complete, captureErrors } from "./helpers";
import {
  parabolicTargetsLevels,
  parabolicTargetsSolutions,
} from "../src/games/parabolicTargetsLevels";
import {
  currentCircuitLevels,
  currentCircuitSolutions,
} from "../src/games/currentCircuitLevels";
import { budgetTownLevels } from "../src/games/budgetTownLevels";
async function readableDiagram(page: import("@playwright/test").Page) {
  const sizes = await page.locator(".bcl-scene svg text").evaluateAll((nodes) =>
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

async function inspectDiagramRight(
  page: import("@playwright/test").Page,
  info: import("@playwright/test").TestInfo,
  id: string,
) {
  const diagram = page.getByLabel("实验图，可左右滚动查看", { exact: true });
  if (await diagram.evaluate((node) => node.scrollWidth > node.clientWidth)) {
    await diagram.focus();
    for (let i = 0; i < 20; i++) await page.keyboard.press("ArrowRight");
    await expect
      .poll(() => diagram.evaluate((node) => node.scrollLeft))
      .toBeGreaterThan(0);
    await page.screenshot({
      path: info.outputPath(`${id}-diagram-right.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
}

test("all continuous parabolic clearance experiments", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "抛物线靶场");
  await expect(page.locator("[data-parabolic-game]")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("parabolic-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.locator('[data-parabolic-part="vy"][data-value="2"]').click();
  await page.getByTestId("parabolic-launch").click();
  await page.locator('[data-parabolic-part="vy"][data-value="3"]').click();
  await expect(page.getByTestId("parabolic-previous-trial")).toContainText(
    "竖直速度 2 m/s",
  );
  await page.screenshot({
    path: info.outputPath("parabolic-previous-trial.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "重来", exact: true }).click();
  for (let level = 0; level < parabolicTargetsLevels.length; level++) {
    await chooseLevel(page, level);
    for (const move of parabolicTargetsSolutions[level]) {
      if (move.part === "launch")
        await page.getByTestId("parabolic-launch").click();
      else
        await page
          .locator(
            `[data-parabolic-part="${move.part}"][data-value="${move.value}"]`,
          )
          .click();
    }
    await readableDiagram(page);
    await expect(page.getByTestId("parabolic-flight-time")).toContainText(
      `起点高度 ${parabolicTargetsLevels[level].startHeight} m`,
    );
    await complete(page, info, "parabolic", level);
    if (level === 11) await inspectDiagramRight(page, info, "parabolic");
  }
  expect(errors).toEqual([]);
});
test("all exact physical resistor circuit experiments", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "电流实验室");
  await expect(page.locator("[data-current-game]")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("current-circuit-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.locator('[data-current-part="voltage"][data-value="3"]').click();
  await page.getByTestId("current-measure").click();
  await page.locator('[data-current-part="voltage"][data-value="6"]').click();
  await expect(page.getByTestId("current-previous-trial")).toContainText("3 V");
  await page.screenshot({
    path: info.outputPath("current-previous-trial.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "重来", exact: true }).click();
  for (let level = 0; level < currentCircuitLevels.length; level++) {
    await chooseLevel(page, level);
    if (level === 1) {
      await page
        .locator('[data-current-part="ballastA"][data-value="0"]')
        .click();
      await page.getByRole("button", { name: "提示", exact: true }).click();
      await expect(page.getByTestId("current-hint")).toContainText("单灯回路");
      await page.screenshot({
        path: info.outputPath("current-single-lamp-hint.png"),
        fullPage: true,
        animations: "disabled",
      });
      await page.getByRole("button", { name: "重来", exact: true }).click();
    }
    for (const move of currentCircuitSolutions[level]) {
      if (move.part === "measure")
        await page.getByTestId("current-measure").click();
      else
        await page
          .locator(
            `[data-current-part="${move.part}"][data-value="${move.value}"]`,
          )
          .click();
    }
    await readableDiagram(page);
    await expect(page.locator(".bcl-model-values")).toContainText(
      `灯 A 固定电阻 ${currentCircuitLevels[level].lampA} Ω`,
    );
    await complete(page, info, "current-circuit", level);
    if (level === 11) await inspectDiagramRight(page, info, "current-circuit");
  }
  expect(errors).toEqual([]);
});
test("all minimum-budget spatial service plans", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "预算小镇");
  await expect(page.locator(".bt-map-cue")).toBeVisible();
  await expect(page.locator("[data-budget-town-game]")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("budget-town-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < budgetTownLevels.length; level++) {
    await chooseLevel(page, level);
    for (const id of budgetTownLevels[level].certificate.built) {
      await page.locator(`[data-budget-town-proposal="${id}"]`).click();
      await page.locator(`[data-budget-town-toggle="${id}"]`).click();
    }
    await expect(page.locator("[data-budget-town-undo]")).toBeDisabled();
    await complete(page, info, "budget-town", level);
    if (level === 11) {
      const target = budgetTownLevels[level].proposals.reduce((right, plot) =>
        plot.x > right.x ? plot : right,
      ).id;
      await page
        .locator(
          `[data-budget-town-proposal="${budgetTownLevels[level].proposals[0].id}"]`,
        )
        .click();
      await page.locator(".bt-map-scroll").evaluate((node) => {
        node.scrollLeft = 0;
      });
      const map = page.locator("[data-budget-town-map]");
      await map.focus();
      for (let i = 0; i < budgetTownLevels[level].proposals.length; i++) {
        if (
          (await page
            .locator(`[data-budget-town-proposal="${target}"]`)
            .getAttribute("aria-pressed")) === "true"
        )
          break;
        await page.keyboard.press("ArrowRight");
      }
      await expect(
        page.locator(`[data-budget-town-proposal="${target}"]`),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        page.locator(`[data-budget-town-proposal="${target}"]`),
      ).toBeInViewport();
      expect(
        await page
          .locator(`[data-budget-town-proposal="${target}"]`)
          .evaluate((node) => {
            const box = node.getBoundingClientRect(),
              viewport = node
                .closest(".bt-map-scroll")!
                .getBoundingClientRect();
            return (
              box.left >= viewport.left - 1 && box.right <= viewport.right + 1
            );
          }),
      ).toBe(true);
      await expect(page.locator("[data-budget-town-toggle]")).toBeDisabled();
      await expect(page.locator("[data-budget-town-game]")).toHaveAttribute(
        "data-budget-town-won",
        "true",
      );
      await page.screenshot({
        path: info.outputPath("budget-town-completed-keyboard-inspection.png"),
        fullPage: true,
        animations: "disabled",
      });
    }
  }
  expect(errors).toEqual([]);
});

test("all optimal concurrent kitchen schedules", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "并发厨房");
  await expect(page.locator("[data-kitchen-game]")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("concurrent-kitchen-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < concurrentKitchenLevels.length; level++) {
    await chooseLevel(page, level);
    for (const placement of concurrentKitchenLevels[level].solution) {
      await page.locator(`[data-kitchen-task="${placement.task}"]`).click();
      await page.locator(`[data-kitchen-start="${placement.start}"]`).click();
    }
    await complete(page, info, "concurrent-kitchen", level);
  }
  expect(errors).toEqual([]);
});
