// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Locator } from "@playwright/test";
import { openGame, chooseLevel, captureErrors } from "./helpers";
type Live = {
  level: number;
  mode: string;
  time: number;
  money: number;
  reputation: number;
  processed: number;
  completed: Record<string, number>;
  outcome: string | null;
  ended: boolean;
  objectives: Record<string, boolean>;
  services: {
    id: string;
    type: string;
    tier: number;
    x: number;
    z: number;
    connections: string[];
  }[];
  connections: string[][];
};
test("Original Server Survival: real level 1 and 25, local resources, pause, reset, editable topology", async ({
  page,
}, info) => {
  test.setTimeout(360000);
  const errors = captureErrors(page),
    remoteRequests: string[] = [],
    act = async (l: Locator) =>
      info.project.name === "mobile" ? l.tap() : l.click();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      !["127.0.0.1", "localhost"].includes(url.hostname) &&
      /^https?:/.test(url.protocol)
    )
      remoteRequests.push(url.href);
  });
  await openGame(page, "云端守护站");
  await act(page.getByRole("button", { name: "原作25关", exact: true }));
  const root = page.locator("[data-server-original-game]"),
    frame = page.frameLocator('iframe[title="Server Survival 原作"]');
  const read = async () =>
    JSON.parse(
      (await frame.locator("body").getAttribute("data-pg-state"))!,
    ) as Live;
  const openPanel = async () => {
    const p = frame.locator("#pg-access");
    if (!((await p.getAttribute("open")) !== null))
      await act(p.locator("summary").first());
  };
  const build = async (type: string, x: number, z: number) => {
    await openPanel();
    const n = (await read()).services.length;
    await frame.locator("#pg-service").selectOption(type);
    await frame.locator("#pg-x").fill(String(x));
    await frame.locator("#pg-z").fill(String(z));
    await act(frame.getByRole("button", { name: "在坐标建设", exact: true }));
    await expect.poll(async () => (await read()).services.length).toBe(n + 1);
  };
  const wire = async (from: number, to: number) => {
    const s = await read(),
      a = from < 0 ? "internet" : s.services[from].id,
      b = s.services[to].id;
    await frame.locator("#pg-from").selectOption(a);
    await frame.locator("#pg-to").selectOption(b);
    await act(frame.getByRole("button", { name: "连接两端", exact: true }));
    await expect
      .poll(async () =>
        (await read()).connections.some((e) => e[0] === a && e[1] === b),
      )
      .toBe(true);
  };
  const fast = async () => {
    await openPanel();
    await act(frame.getByRole("button", { name: "运行 3 倍", exact: true }));
  };
  await expect(root).toHaveAttribute("data-server-original-ready", "true", {
    timeout: 30000,
  });
  await expect(
    page.getByLabel("选择关卡", { exact: true }).locator("option"),
  ).toHaveCount(25);
  await openPanel();
  await page.screenshot({
    path: info.outputPath("server-original-first-start.png"),
    fullPage: true,
  });
  await build("waf", -24, 0);
  const firstBuild = await read();
  expect(firstBuild.money).toBe(260);
  await act(page.getByRole("button", { name: "重来", exact: true }));
  await expect(root).toHaveAttribute("data-server-original-ready", "true", {
    timeout: 30000,
  });
  await expect.poll(async () => (await read()).services.length).toBe(0);
  expect((await read()).money).toBe(300);
  // An empty real network must lose, without awarding a shell completion.
  await fast();
  await expect
    .poll(async () => (await read()).outcome, { timeout: 45000 })
    .toBe("lose");
  await expect(root).toHaveAttribute("data-server-original-won", "false");
  await page.screenshot({
    path: info.outputPath("server-original-first-failure.png"),
    fullPage: true,
  });
  await act(page.getByRole("button", { name: "重来", exact: true }));
  await expect(root).toHaveAttribute("data-server-original-ready", "true", {
    timeout: 30000,
  });
  expect((await read()).services).toHaveLength(0);
  await build("waf", -24, 0);
  await build("alb", -12, 0);
  await build("compute", 0, 0);
  await build("db", 12, 0);
  await wire(-1, 0);
  await wire(0, 1);
  await wire(1, 2);
  await wire(2, 3);
  // Invalid direction must remain an actual refusal, not a phantom green line.
  const before = (await read()).connections.length;
  await frame.locator("#pg-from").selectOption((await read()).services[3].id);
  await frame.locator("#pg-to").selectOption((await read()).services[0].id);
  await act(frame.getByRole("button", { name: "连接两端", exact: true }));
  expect((await read()).connections.length).toBe(before);
  await expect(frame.locator("#pg-feedback")).toContainText("不支持");
  if (info.project.name === "desktop") {
    await frame.locator("#pg-x").focus();
    await expect(frame.locator("#pg-x")).toBeFocused();
    const services = (await read()).services.length;
    await frame.locator("#pg-x").press("Control+v");
    expect((await read()).services.length).toBe(services);
    await expect(frame.locator("#pg-x")).toBeFocused();
  }
  await fast();
  await expect
    .poll(async () => (await read()).processed, { timeout: 20000 })
    .toBeGreaterThan(0);
  await act(page.getByRole("button", { name: "暂停", exact: true }));
  await page.waitForTimeout(500);
  const paused = await read();
  await page.waitForTimeout(1100);
  const frozen = await read();
  expect(frozen.time).toBe(paused.time);
  expect(frozen.processed).toBe(paused.processed);
  expect(frozen.money).toBe(paused.money);
  await act(page.getByRole("button", { name: "继续游戏", exact: true }));
  await expect(root).toHaveAttribute("data-server-original-won", "true", {
    timeout: 60000,
  });
  const firstWin = await read();
  expect(firstWin.outcome).toBe("win");
  expect(firstWin.completed.READ).toBeGreaterThanOrEqual(50);
  expect(firstWin.reputation).toBeGreaterThanOrEqual(80);
  await expect(page.locator(".status")).toHaveClass(/success/);
  await page.screenshot({
    path: info.outputPath("server-original-first-complete.png"),
    fullPage: true,
  });
  // Preserve the complete original capstone. No injected game state or objective edits.
  await chooseLevel(page, 24);
  await expect(root).toHaveAttribute("data-server-original-ready", "true", {
    timeout: 30000,
  });
  const capstone = await read();
  expect(capstone.level).toBe(25);
  expect(capstone.services).toHaveLength(9);
  expect(capstone.services.filter((s) => s.type === "serverless")).toHaveLength(
    2,
  );
  await build("gpu", 24, -4);
  const gpu = (await read()).services[9];
  await wire(3, 9);
  await wire(4, 9);
  await frame.locator("#pg-edit-node").selectOption(gpu.id);
  await act(frame.getByRole("button", { name: "升级选中服务", exact: true }));
  await expect
    .poll(
      async () => (await read()).services.find((s) => s.id === gpu.id)?.tier,
    )
    .toBe(2);
  await page.screenshot({
    path: info.outputPath("server-original-final-ai-build.png"),
    fullPage: true,
  });
  await fast();
  await expect(root).toHaveAttribute("data-server-original-won", "true", {
    timeout: 185000,
  });
  const finalWin = await read();
  expect(finalWin.outcome).toBe("win");
  expect(finalWin.time).toBeGreaterThanOrEqual(120);
  expect(finalWin.completed.INFERENCE).toBeGreaterThanOrEqual(150);
  expect(finalWin.reputation).toBeGreaterThanOrEqual(55);
  expect(Object.values(finalWin.objectives).every(Boolean)).toBe(true);
  await expect(page.locator(".status")).toHaveClass(/success/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await frame
      .locator("body")
      .evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("server-original-final-complete.png"),
    fullPage: true,
  });
  // Unmount the engine, then reload: only actual earned completions may persist.
  await act(page.getByRole("button", { name: "返回游戏大厅", exact: true }));
  await expect(page.locator('iframe[title="Server Survival 原作"]')).toHaveCount(0);
  await page.reload();
  await openGame(page, "云端守护站");
  await act(page.getByRole("button", { name: "原作25关", exact: true }));
  await expect(root).toHaveAttribute("data-server-original-ready", "true", { timeout: 30000 });
  const options = page.getByLabel("选择关卡", { exact: true }).locator("option");
  await expect(options.nth(0)).toContainText("已完成");
  await expect(options.nth(24)).toContainText("已完成");
  await expect(options.nth(1)).not.toContainText("已完成");
  // Save and load via the original visible browser-save controls. No storage writes in tests.
  await act(page.getByRole("button", { name: "生存 / 沙盒", exact: true }));
  await expect(root).toHaveAttribute("data-server-original-ready", "true", { timeout: 30000 });
  await act(frame.locator('[onclick="startSandbox()"]'));
  await expect.poll(async () => (await read()).mode).toBe("sandbox");
  await build("cdn", -12, 0);
  await build("s3", 4, 0);
  await wire(-1, 0);
  await wire(0, 1);
  const saved = await read();
  expect(saved.money).toBeGreaterThan(0);
  await act(frame.locator("#btn-save"));
  await act(frame.locator(`[onclick="saveGameState('browser')"]`));
  await expect(frame.locator("#save-modal")).toBeHidden();
  await act(page.getByRole("button", { name: "返回游戏大厅", exact: true }));
  await expect(page.locator('iframe[title="Server Survival 原作"]')).toHaveCount(0);
  await openGame(page, "云端守护站");
  await expect(root).toHaveAttribute("data-server-original-ready", "true", { timeout: 30000 });
  await act(frame.locator("#load-btn"));
  await expect.poll(async () => (await read()).services.length).toBe(2);
  const restored = await read();
  expect(restored.mode).toBe("sandbox");
  expect(restored.money).toBe(saved.money);
  expect(restored.services).toEqual(saved.services);
  expect(restored.connections).toEqual(saved.connections);
  await page.screenshot({ path: info.outputPath("server-original-sandbox-restored.png"), fullPage: true });
  await act(page.getByRole("button", { name: "返回游戏大厅", exact: true }));
  await expect(page.locator('iframe[title="Server Survival 原作"]')).toHaveCount(0);
  expect(remoteRequests).toEqual([]);
  expect(errors).toEqual([]);
});
