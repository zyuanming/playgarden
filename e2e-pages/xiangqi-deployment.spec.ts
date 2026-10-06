import { test, expect, type Page } from "@playwright/test";
const root = (page: Page) => page.locator(".xiangqi-garden");
async function enter(page: Page) {
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("中国象棋");
  await page
    .getByRole("button", { name: "开始玩中国象棋", exact: true })
    .click();
  await expect(page.getByRole("grid")).toBeVisible();
}
async function play(page: Page, move: string, screenshot?: string) {
  await page.locator(`[data-xiangqi-square="${move.slice(0, 2)}"]`).click();
  await page.locator(`[data-xiangqi-square="${move.slice(2)}"]`).click();
  const confirm = page.getByRole("button", { name: "确认走棋", exact: true });
  await expect(confirm).toBeEnabled();
  if (screenshot) await page.screenshot({ path: screenshot, fullPage: true });
  await confirm.click();
}

test("Xiangqi published base, original artwork, license, actual worker, saved game and teaching win", async ({
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
  const revision = process.env.GITHUB_SHA;
  if (revision)
    await expect(
      page.getByRole("link", { name: "本版本完整源码与构建说明", exact: true }),
    ).toHaveAttribute(
      "href",
      `https://github.com/zyuanming/playgarden/tree/${revision}`,
    );
  const copying = await page.request.get(
    new URL("playgarden-COPYING.txt", base).href,
  );
  expect(copying.status()).toBe(200);
  expect(await copying.text()).toContain("Version 3, 29 June 2007");
  const notices = await page.request.get(
    new URL("THIRD_PARTY_NOTICES.txt", base).href,
  );
  expect(notices.status()).toBe(200);
  expect(await notices.text()).toContain(
    "Complete bundled runtime dependency notices",
  );
  expect(await notices.text()).toContain("Copyright (c) 2017, Jeff Hlywa");
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("中国象棋");
  const card = page.getByRole("button", {
    name: "开始玩中国象棋",
    exact: true,
  });
  const art = await card.evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(art).toContain("xiangqi-art.svg");
  const license = await page.request.get(
    new URL("xiangqi-LICENSE.txt", base).href,
  );
  expect(license.status()).toBe(200);
  expect(await license.text()).toContain("Copyright (c) 2017, Jeff Hlywa");
  await page.screenshot({
    path: info.outputPath("xiangqi-published-card.png"),
    fullPage: true,
  });
  await card.click();
  await expect(page.getByRole("grid")).toBeVisible();
  await expect(root(page)).toHaveAttribute("data-xiangqi-moves", "0");
  await page.screenshot({
    path: info.outputPath("xiangqi-published-start.png"),
    fullPage: true,
  });
  await play(
    page,
    "a3a4",
    info.outputPath("xiangqi-published-selected-confirm.png"),
  );
  await expect(root(page)).toHaveAttribute("data-xiangqi-moves", "2");
  expect(workerURLs).toHaveLength(1);
  for (const url of workerURLs) {
    expect(new URL(url).origin).toBe(base.origin);
    expect(new URL(url).pathname.startsWith(base.pathname)).toBe(true);
    expect(url).toContain("xiangqi.worker");
  }
  await expect(page.getByText(/正在使用简易兼容陪练/)).toHaveCount(0);
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("playgarden.xiangqi.v1.round.free")!)
        .moves,
  );
  expect(saved).toHaveLength(2);
  await page.reload();
  await enter(page);
  await expect(root(page)).toHaveAttribute("data-xiangqi-moves", "2");
  await expect(
    page.locator(`[data-xiangqi-square="${saved[1].slice(2)}"]`),
  ).toHaveAttribute("aria-label", /黑方/);
  await page.screenshot({
    path: info.outputPath("xiangqi-published-resume.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "棋形练习", exact: true }).click();
  await page.getByLabel("选择关卡", { exact: true }).selectOption("12");
  await expect(root(page)).toHaveAttribute("data-xiangqi-stage", "ready");
  // A fixed independent certificate for the final practice, no injected progress.
  const { readFileSync } = await import("node:fs");
  const corpus = JSON.parse(readFileSync("docs/xiangqi/corpus.json", "utf8"));
  const p = corpus[12];
  await play(page, p.solutions[0]);
  await expect(root(page)).toHaveAttribute("data-xiangqi-won", "true");
  await expect(page.locator(".status")).toHaveClass(/success/);
  await page.screenshot({
    path: info.outputPath("xiangqi-published-final-practice.png"),
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
