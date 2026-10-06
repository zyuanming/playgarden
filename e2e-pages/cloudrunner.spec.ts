// SPDX-License-Identifier: GPL-3.0-only
import { test, expect } from "@playwright/test";
import {
  openRunner,
  freezeRunner,
  playLesson,
  runnerLayout,
} from "../e2e/cloudrunnerJourney";
test("public cloudrunner exact version, MIT, assets and authentic first middle final play", async ({
  page,
  isMobile,
}, info) => {
  const errors: string[] = [],
    bad: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => bad.push(r.url()));
  page.on("response", (r) => {
    if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
  });
  await openRunner(page, "./");
  if (process.env.GITHUB_SHA)
    await expect(
      page.locator('meta[name="playgarden-commit"]'),
    ).toHaveAttribute("content", process.env.GITHUB_SHA);
  await expect(
    page.getByRole("link", { name: "Mark Stent 的 runner" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/markstent/runner/tree/22a0d0dd74f880025559235bf6139a85316da821",
  );
  const notice = await page
    .getByRole("link", { name: "完整 MIT 许可", exact: true })
    .getAttribute("href");
  const res = await page.request.get(new URL(notice!, page.url()).href);
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain("Copyright (c) 2026 Mark Stent");
  await freezeRunner(page);
  for (const lesson of [0, 3, 5])
    await playLesson(
      page,
      lesson,
      info,
      isMobile ? "button" : "keyboard",
      "public-runner",
    );
  await runnerLayout(page);
  expect(errors).toEqual([]);
  expect(bad).toEqual([]);
});
