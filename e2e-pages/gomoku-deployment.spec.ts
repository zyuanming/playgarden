import { test, expect, type Page } from "@playwright/test";
const root = (page: Page) => page.locator(".gomoku-garden");
async function enter(page: Page) {
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("自由五子棋");
  await page
    .getByRole("button", { name: "开始玩自由五子棋", exact: true })
    .click();
  await expect(page.getByRole("grid")).toBeVisible();
}
async function play(page: Page, i: number, screenshot?: string) {
  await page.locator(`[data-gomoku-point="${i}"]`).click();
  const confirm = page.getByRole("button", { name: /^确认落子/ });
  await expect(confirm).toBeEnabled();
  const ratio = await confirm.evaluate((node) => {
    const style = getComputedStyle(node);
    const light = (color: string) => {
      const values = color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
    };
    const a = light(style.color),
      b = light(style.backgroundColor);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
  if (screenshot) await page.screenshot({ path: screenshot, fullPage: true });
  await confirm.click();
}

test("Gomoku published base, original artwork, license, actual worker, saved game and teaching win", async ({
  page,
  baseURL,
}, info) => {
  const base = new URL(baseURL!);
  const errors: string[] = [];
  const network: string[] = [];
  const workerURLs: string[] = [];
  const checked200 = new Map<string, string>();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) =>
    errors.push(`${r.url()}: ${r.failure()?.errorText}`),
  );
  page.on("worker", (w) => workerURLs.push(w.url()));
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.protocol.startsWith("http") && u.origin !== base.origin)
      network.push(u.href);
  });
  page.on("response", (r) => {
    const u = new URL(r.url());
    if (u.origin !== base.origin) return;
    if (r.status() >= 400) errors.push(`${r.status()} ${u.pathname}`);
    if (!/\.(?:js|css)$/.test(u.pathname)) return;
    const mime = r.headers()["content-type"] || "";
    if (r.status() === 200) checked200.set(u.href, mime);
    const actual = r.status() === 304 ? checked200.get(u.href) || mime : mime;
    if (
      !(/\.js$/.test(u.pathname)
        ? /(?:text|application)\/javascript/.test(actual)
        : actual.includes("text/css"))
    )
      errors.push(`MIME ${u.pathname}: ${actual}`);
  });
  await page.goto("./");
  if (process.env.GITHUB_SHA)
    await expect(
      page.locator('meta[name="playgarden-commit"]'),
    ).toHaveAttribute("content", process.env.GITHUB_SHA);
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("自由五子棋");
  const card = page.getByRole("button", {
    name: "开始玩自由五子棋",
    exact: true,
  });
  const art = await card.evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(art).toContain("gomoku-art.svg");
  const license = await page.request.get(
    new URL("gomoku-LICENSE.txt", base).href,
  );
  expect(license.status()).toBe(200);
  expect(await license.text()).toContain(
    "Copyright (c) 2026 open-gomoku Contributors",
  );
  await card.click();
  await expect(page.getByRole("grid")).toBeVisible();
  await expect(root(page)).toHaveAttribute("data-gomoku-moves", "0");
  await page.screenshot({
    path: info.outputPath("gomoku-published-start.png"),
    fullPage: true,
  });
  await play(
    page,
    112,
    info.outputPath("gomoku-published-selected-confirm.png"),
  );
  await expect(root(page)).toHaveAttribute("data-gomoku-moves", "2");
  expect(workerURLs).toHaveLength(1);
  for (const url of workerURLs) {
    expect(new URL(url).origin).toBe(base.origin);
    expect(new URL(url).pathname.startsWith(base.pathname)).toBe(true);
    expect(url).toContain("gomoku.worker");
  }
  await expect(page.getByText(/正在使用简易兼容陪练/)).toHaveCount(0);
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("playgarden.gomoku.v1.round.free")!)
        .moves,
  );
  expect(saved).toHaveLength(2);
  await page.reload();
  await enter(page);
  await expect(root(page)).toHaveAttribute("data-gomoku-moves", "2");
  await expect(
    page.locator(`[data-gomoku-point="${saved[1]}"]`),
  ).toHaveAttribute("aria-label", /白棋/);
  await page.screenshot({
    path: info.outputPath("gomoku-published-resume.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "棋形练习", exact: true }).click();
  await page.getByLabel("选择关卡", { exact: true }).selectOption("23");
  await expect(root(page)).toHaveAttribute("data-gomoku-stage", "ready");
  // A fixed independent certificate for the final practice, no injected progress.
  const { readFileSync } = await import("node:fs");
  const corpus = JSON.parse(readFileSync("docs/gomoku/corpus.json", "utf8"));
  const p = corpus[23];
  await play(page, p.solution);
  await expect(root(page)).toHaveAttribute("data-gomoku-stage", "finish");
  await play(page, p.continuation[2]);
  await expect(root(page)).toHaveAttribute("data-gomoku-won", "true");
  await expect(page.locator(".status")).toHaveClass(/success/);
  await page.screenshot({
    path: info.outputPath("gomoku-published-final-practice.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(network).toEqual([]);
  expect(errors).toEqual([]);
});
