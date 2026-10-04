import { contrastRatio } from "./colorContrast";
import { test, expect, type Page } from "@playwright/test";
import { openGame, chooseLevel, complete, captureErrors } from "./helpers";
import { memoryRoutesSolutions } from "../src/games/memoryRoutesSolutions";
import { rhythmEchoSolutions } from "../src/games/rhythmEchoSolutions";
import { symmetryRepairLevels } from "../src/games/symmetryRepairLevels";
import { probabilityBagLevels } from "../src/games/probabilityBagLevels";
import {
  independentSymmetrySolutions,
  independentBagSolutions,
} from "../tests/symmetryProbabilityOracle";

async function readableDisabled(page: Page, selector: string) {
  const colors = await page.locator(selector).evaluateAll((nodes) =>
    nodes.map((node) => {
      const s = getComputedStyle(node),
        backgrounds: string[] = [];
      for (
        let current: Element | null = node;
        current;
        current = current.parentElement
      )
        backgrounds.push(getComputedStyle(current).backgroundColor);
      return {
        opacity: s.opacity,
        fg: s.color,
        backgrounds,
        label: node.textContent,
      };
    }),
  );
  expect(colors.length).toBeGreaterThan(0);
  for (const color of colors) {
    expect(color.opacity).toBe("1");
    expect(
      contrastRatio(color.fg, color.backgrounds),
      JSON.stringify(color),
    ).toBeGreaterThanOrEqual(4.5);
  }
}

test("all ordered memory routes with repeatable observation", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "路线记忆");
  await readableDisabled(page, ".mr-actions button:disabled");
  await page.screenshot({
    path: info.outputPath("memory-routes-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < 12; level++) {
    await chooseLevel(page, level);
    await page.locator("[data-memory-routes-ready]").click();
    await expect(page.locator("[data-memory-routes-game]")).toHaveAttribute(
      "data-memory-routes-phase",
      "recall",
    );
    expect(
      await page
        .locator("[data-memory-routes-cell]")
        .evaluateAll((nodes) =>
          nodes.every((n) => n.getAttribute("data-memory-routes-steps") === ""),
        ),
    ).toBe(true);
    for (const cell of memoryRoutesSolutions[level])
      await page.locator(`[data-memory-routes-cell="${cell}"]`).click();
    await expect(page.locator("[data-memory-routes-game]")).toHaveAttribute(
      "data-memory-routes-won",
      "true",
    );
    await complete(page, info, "memory-routes", level);
  }
  expect(errors).toEqual([]);
});
test("all untimed rhythm motif transformations", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "节奏回声");
  await readableDisabled(page, ".rhythm-echo button:disabled");
  const labels = await page
    .locator(".re-token-panel button small")
    .evaluateAll((nodes) =>
      nodes.map((n) => parseFloat(getComputedStyle(n).fontSize)),
    );
  expect(labels.length).toBeGreaterThan(0);
  expect(Math.min(...labels)).toBeGreaterThanOrEqual(12);
  await page.screenshot({
    path: info.outputPath("rhythm-echo-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < 12; level++) {
    await chooseLevel(page, level);
    await page.locator("[data-rhythm-echo-ready]").click();
    await expect(page.locator("[data-rhythm-echo-score]")).toHaveCount(0);
    for (const token of rhythmEchoSolutions[level])
      await page.locator(`[data-rhythm-echo-token="${token}"]`).click();
    await expect(page.locator("[data-rhythm-echo-game]")).toHaveAttribute(
      "data-rhythm-echo-won",
      "true",
    );
    await readableDisabled(page, ".rhythm-echo button:disabled");
    await complete(page, info, "rhythm-echo", level);
  }
  expect(errors).toEqual([]);
});
test("rhythm live anchor is interrupted safely and untimed fallback stays available", async ({
  page,
}) => {
  const errors = captureErrors(page);
  await openGame(page, "节奏回声");
  await page.locator('[data-rhythm-echo-mode-button="live"]').click();
  await page.locator("[data-rhythm-echo-ready]").click();
  await page.locator("[data-rhythm-echo-tap]").click();
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  await page.locator("[data-rhythm-echo-tap]").click();
  await expect(page.locator("[data-rhythm-echo-game]")).toHaveAttribute(
    "data-rhythm-echo-entered",
    "",
  );
  await page.locator('[data-rhythm-echo-mode-button="tokens"]').click();
  for (const token of rhythmEchoSolutions[0])
    await page.locator(`[data-rhythm-echo-token="${token}"]`).click();
  await expect(page.locator("[data-rhythm-echo-game]")).toHaveAttribute(
    "data-rhythm-echo-won",
    "true",
  );
  expect(errors).toEqual([]);
});
test("all finite-budget symmetry repairs from independent orbit certificates", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "对称修补");
  await page.screenshot({
    path: info.outputPath("symmetry-repair-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < 12; level++) {
    await chooseLevel(page, level);
    const target = independentSymmetrySolutions(symmetryRepairLevels[level])[0];
    for (const [cell, value] of target.entries()) {
      if (
        (await page
          .locator("[data-symmetry-game]")
          .getAttribute("data-symmetry-won")) === "true"
      )
        break;
      const node = page.locator(`[data-symmetry-cell="${cell}"]`);
      if ((await node.getAttribute("data-value")) !== String(value))
        await node.press(value === 1 ? "f" : "e");
    }
    await expect(page.locator("[data-symmetry-game]")).toHaveAttribute(
      "data-symmetry-won",
      "true",
    );
    await complete(page, info, "symmetry-repair", level);
  }
  expect(errors).toEqual([]);
});
test("all exact probability compositions from physical-token enumeration", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "概率抽袋");
  await page.screenshot({
    path: info.outputPath("probability-bag-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < 12; level++) {
    await chooseLevel(page, level);
    const target = independentBagSolutions(probabilityBagLevels[level])[0];
    const counts = async () =>
      (await page
        .locator("[data-probability-game]")
        .getAttribute("data-probability-counts"))!
        .split(",")
        .map(Number);
    for (let color = 0; color < 3; color++)
      while ((await counts())[color] > target[color])
        await page.locator(`[data-probability-remove="${color}"]`).click();
    for (let color = 0; color < 3; color++)
      while ((await counts())[color] < target[color])
        await page.locator(`[data-probability-add="${color}"]`).click();
    await expect(page.locator("[data-probability-game]")).toHaveAttribute(
      "data-probability-won",
      "true",
    );
    await complete(page, info, "probability-bag", level);
  }
  expect(errors).toEqual([]);
});
