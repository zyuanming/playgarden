import { test, expect } from "@playwright/test";
import { games } from "../src/lib/registry";
import { lightLevels } from "../src/games/lightLogic";
import { STORAGE_KEY } from "../src/lib/progress";

test("production base, every game module, and earned local progress survive deployment", async ({ page, baseURL }, info) => {
  const errors: string[] = [];
  const failedResponses: string[] = [];
  const loadedResources: string[] = [];
  const base = new URL(baseURL!);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin !== base.origin) return;
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${url.pathname}`);
    const mime = response.headers()["content-type"] || "";
    if (url.pathname.endsWith(".css") && !mime.includes("text/css")) failedResponses.push(`Invalid CSS MIME ${mime}: ${url.pathname}`);
    if (url.pathname.endsWith(".js") && !/(?:text|application)\/javascript/.test(mime)) failedResponses.push(`Invalid JS MIME ${mime}: ${url.pathname}`);
    if (/\.(?:js|css|webp|svg)$/.test(url.pathname)) loadedResources.push(url.pathname);
  });
  const response = await page.goto("./");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "玩出一点新发现。" })).toBeVisible();
  await expect(page.locator(".catalog-count")).toContainText(`${games.length} 款可玩游戏`);
  await expect(page.locator(".catalog-count")).toContainText(`${games.reduce((n, g) => n + g.levelCount, 0)} 个关卡`);
  if (process.env.GITHUB_SHA) {
    await expect(page.locator('meta[name="playgarden-commit"]')).toHaveAttribute("content", process.env.GITHUB_SHA);
  }
  const favicon = await page.locator('link[rel="icon"]').getAttribute("href");
  expect(favicon).toBeTruthy();
  const faviconURL = new URL(favicon!, page.url());
  expect(faviconURL.origin).toBe(base.origin);
  expect(faviconURL.pathname.startsWith(base.pathname)).toBe(true);
  const faviconResponse = await page.request.get(faviconURL.href);
  expect(faviconResponse.status()).toBe(200);
  expect(faviconResponse.headers()["content-type"]).toContain("image/svg+xml");
  await page.evaluate(async (url) => { const image = new Image(); image.src = url; await image.decode(); if (!image.naturalWidth) throw new Error("Empty favicon"); }, faviconURL.href);
  await page.screenshot({ path: info.outputPath("pages-home.png"), fullPage: true });

  await page.getByRole("button", { name: "收藏光线实验室", exact: true }).click();
  await page.getByRole("button", { name: "静音", exact: true }).click();
  // Exercise every lazy-loaded game and every artwork sheet under the deployed base.
  for (const game of games) {
    await page.getByRole("textbox", { name: "搜索游戏" }).fill(game.title);
    const artwork = page.getByRole("button", { name: `开始玩${game.title}`, exact: true });
    const image = await artwork.evaluate((el) => getComputedStyle(el).backgroundImage);
    const url = image.match(/url\(["']?(.+?)["']?\)/)?.[1];
    expect(url, `artwork URL for ${game.id}`).toBeTruthy();
    expect(new URL(url!).origin).toBe(base.origin);
    expect(new URL(url!).pathname.startsWith(base.pathname)).toBe(true);
    const artworkResponse = await page.request.get(url!);
    expect(artworkResponse.status()).toBe(200);
    expect(artworkResponse.headers()["content-type"]).toContain(url!.endsWith(".svg") ? "image/svg+xml" : "image/webp");
    await page.evaluate(async (url) => { const image = new Image(); image.src = url; await image.decode(); if (!image.naturalWidth) throw new Error("Empty artwork"); }, url!);
    await artwork.click();
    await expect(page.locator(".game-main")).toHaveAttribute("data-game", game.id);
    await expect(page.locator(".game-surface")).toBeVisible();
    await expect(page.locator(".game-surface .loading")).toHaveCount(0);
    await expect(page.locator(".module-error")).toHaveCount(0);
    if (game.freePlay) await page.getByRole("button", { name: "棋形练习", exact: true }).click();
    await expect(page.getByLabel("选择关卡", { exact: true }).locator("option")).toHaveCount(game.levelCount);
    if (game.id === "lights-out") {
      await page.getByLabel("选择关卡", { exact: true }).selectOption("111");
      await expect(page.locator(".mlg-round-badge")).toHaveText("112 / 112");
      await expect(page.locator(".mlg-light")).toHaveCount(25);
    }
    await page.getByRole("button", { name: "返回游戏大厅", exact: true }).click();
  }

  await page.getByRole("textbox", { name: "搜索游戏" }).fill("光线实验室");
  await page.getByRole("button", { name: "开始玩光线实验室", exact: true }).click();
  const first = lightLevels[0];
  for (let i = 0; i < first.mirrors.length; i++) {
    if (first.mirrors[i].slash !== first.solution[i]) {
      await page.getByRole("button", { name: new RegExp(`镜子 ${i + 1}，`) }).click();
    }
  }
  await expect(page.locator(".status")).toHaveClass(/success/);
  await expect.poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).completed.light, STORAGE_KEY)).toContain(0);
  // Games currently use in-page state, so reload deliberately returns to the lobby.
  expect(new URL(page.url()).pathname).toBe(base.pathname);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "搜索游戏" })).toBeVisible();
  await expect(page.getByRole("button", { name: "取消收藏光线实验室", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "开启声音", exact: true })).toBeVisible();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(saved.completed.light).toContain(0);
  expect(saved.favorites).toContain("light");
  expect(saved.muted).toBe(true);
  await page.getByRole("button", { name: "开始玩光线实验室", exact: true }).click();
  await expect(page.getByLabel("选择关卡", { exact: true })).toHaveValue("1");
  await expect(page.locator(".game-surface .loading")).toHaveCount(0);
  await expect(page.locator(".module-error")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^镜子 2，/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath("pages-resumed-game.png"), fullPage: true });
  expect(loadedResources.some((path) => path.endsWith(".js"))).toBe(true);
  expect(loadedResources.some((path) => path.endsWith(".css"))).toBe(true);
  expect(loadedResources.every((path) => path.startsWith(base.pathname))).toBe(true);
  expect(failedResponses).toEqual([]);
  expect(errors).toEqual([]);
});
