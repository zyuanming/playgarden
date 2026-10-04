import { test, expect } from "@playwright/test";
import { openGame, chooseLevel, complete, captureErrors } from "./helpers";
import {
  kakuroCertificates,
  arithmeticCageCertificates,
} from "../tests/fixtures/arithmeticConstraintCertificates";
for (const [title, id, certificates] of [
  ["和数庭院", "kakuro", kakuroCertificates],
  ["算笼工坊", "arithmetic-cage", arithmeticCageCertificates],
] as const)
  test(`all unique ${id} arithmetic constraints`, async ({ page }, info) => {
    const errors = captureErrors(page);
    await openGame(page, title);
    await expect(page.locator("[data-arithmetic-puzzle]")).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`${id}-start.png`),
      fullPage: true,
      animations: "disabled",
    });
    for (let level = 0; level < certificates.length; level++) {
      await chooseLevel(page, level);
      for (const [index, value] of certificates[level].solution.entries()) {
        if (!value) continue;
        await page.locator(`[data-arithmetic-cell="${index}"]`).click();
        await page
          .getByRole("button", { name: `填入 ${value}`, exact: true })
          .click();
        await expect(
          page.locator(`[data-arithmetic-cell="${index}"]`),
        ).toHaveAttribute("data-value", String(value));
      }
      await complete(page, info, id, level);
    }
    expect(errors).toEqual([]);
  });
