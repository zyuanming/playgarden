import { test, expect } from "@playwright/test";
import { openGame, chooseLevel, complete, captureErrors } from "./helpers";
import { paperFoldLevels } from "../src/games/paperFoldLevels";
import { treeRotationsLevels } from "../src/games/treeRotationsLevels";
import { getSpectralCertificate } from "../src/games/spectralFiltersLevels";
import { getWaveCertificate } from "../src/games/waveStudioLevels";

test("all paper layer folds punches and actual Three previews", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "折纸打孔");
  await page.locator("[data-paper-preview]").click();
  await expect(page.locator(".pf-scene canvas")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("paper-fold-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < 12; level++) {
    await chooseLevel(page, level);
    if (
      (await page
        .locator("[data-paper-preview]")
        .getAttribute("aria-pressed")) !== "true"
    )
      await page.locator("[data-paper-preview]").click();
    await expect(page.locator(".pf-scene canvas")).toBeVisible();
    for (const action of paperFoldLevels[level].certificate.actions) {
      if (action.kind === "fold")
        await page.locator(`[data-paper-fold="${action.crease}"]`).click();
      else if (action.kind === "punch")
        await page.locator(`[data-paper-cell="${action.cell}"]`).click();
      else await page.locator("[data-paper-unfold]").click();
      if (level === 5 && action.kind === "fold")
        await page.screenshot({
          path: info.outputPath("paper-fold-layered.png"),
          fullPage: true,
          animations: "disabled",
        });
    }
    await expect(page.locator("[data-paper-fold-game]")).toHaveAttribute(
      "data-paper-won",
      "true",
    );
    await expect(page.locator("[data-paper-undo]")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await complete(page, info, "paper-fold", level);
  }
  expect(errors).toEqual([]);
});
test("all BST rotations preserve order while meeting public search goals", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "树形旋转");
  await page.screenshot({
    path: info.outputPath("tree-rotations-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < 12; level++) {
    await chooseLevel(page, level);
    for (const move of treeRotationsLevels[level].certificate.moves) {
      await page.locator(`[data-tree-node="${move.key}"]`).click();
      await page.locator(`[data-tree-rotate="${move.direction}"]`).click();
    }
    await expect(page.locator("[data-tree-rotations-won]")).toHaveAttribute(
      "data-tree-rotations-won",
      "true",
    );
    await complete(page, info, "tree-rotations", level);
  }
  expect(errors).toEqual([]);
});
test("all exact spectral transmission and shared filter inventories", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "理想滤光");
  await page.screenshot({
    path: info.outputPath("spectral-filters-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < 12; level++) {
    await chooseLevel(page, level);
    for (const [slot, value] of getSpectralCertificate(level)!.entries()) {
      if (
        (await page
          .locator("[data-spectral-game]")
          .getAttribute("data-spectral-won")) === "true"
      )
        break;
      await page
        .locator(`[data-spectral-slot="${slot}"]`)
        .selectOption(String(value));
    }
    await expect(page.locator("[data-spectral-game]")).toHaveAttribute(
      "data-spectral-won",
      "true",
    );
    await complete(page, info, "spectral-filters", level);
  }
  expect(errors).toEqual([]);
});
test("all harmonic coefficients phases and required cancellation", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "谐波工作室");
  await page.screenshot({
    path: info.outputPath("wave-studio-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < 12; level++) {
    await chooseLevel(page, level);
    for (const [oscillator, setting] of getWaveCertificate(level)!.entries()) {
      for (const field of ["frequency", "phase", "amplitude"] as const) {
        if (
          (await page
            .locator("[data-wave-game]")
            .getAttribute("data-wave-won")) === "true"
        )
          break;
        await page
          .locator(
            `[data-wave-oscillator="${oscillator}"][data-wave-field="${field}"]`,
          )
          .selectOption(String(setting[field]));
      }
    }
    await expect(page.locator("[data-wave-game]")).toHaveAttribute(
      "data-wave-won",
      "true",
    );
    await complete(page, info, "wave-studio", level);
  }
  expect(errors).toEqual([]);
});
