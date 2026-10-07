// SPDX-License-Identifier: GPL-3.0-only
import { expect, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
const certificates = JSON.parse(
  readFileSync("tests/fixtures/cloudrunnerLessons.json", "utf8"),
) as {
  lesson: number;
  length: number;
  actions: {
    time: number;
    intent: "left" | "right" | "jump" | "slide";
    reason: string;
    obstacleOrTurn: number;
  }[];
}[];
const stage = (page: Page) => page.getByRole("group", { name: /云路跑道/ });
export async function openRunner(page: Page, url = "/") {
  await page.goto(url);
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("云迹跑者");
  await page
    .getByRole("button", { name: "开始玩云迹跑者", exact: true })
    .click();
  await expect(page.locator(".cr-stage")).toBeVisible();
  await expect(page.locator(".game-surface .loading")).toHaveCount(0);
}
export async function freezeRunner(page: Page) {
  // Use a fixed origin and a strictly later pause, avoiding host/browser clock races.
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
}
export async function runnerLayout(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  for (const button of await page.locator(".cr-controls button").all()) {
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  const box = await page.locator(".cr-stage").boundingBox();
  expect(box!.width).toBeGreaterThan(230);
  expect(box!.height).toBeGreaterThanOrEqual(330);
  await expect(page.locator(".module-error")).toHaveCount(0);
}
export async function swipe(page: Page, intent: string) {
  const offsets: Record<string, [number, number]> = {
    left: [-80, 0],
    right: [80, 0],
    jump: [0, -90],
    slide: [0, 90],
  };
  const box = (await stage(page).boundingBox())!,
    [dx, dy] = offsets[intent];
  const x = box.x + box.width * 0.5,
    y = box.y + box.height * 0.6;
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 0 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x + dx, y: y + dy, id: 0 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await session.detach();
}
export async function playLesson(
  page: Page,
  lesson: number,
  info: TestInfo,
  method: "keyboard" | "button" | "swipe" = "button",
  prefix = "runner",
) {
  await page.getByRole("button", { name: "六段入门", exact: true }).click();
  await page
    .getByLabel("选择关卡", { exact: true })
    .selectOption(String(lesson));
  await expect(
    page.getByRole("button", { name: "开始这一段", exact: true }),
  ).toBeVisible();
  await runnerLayout(page);
  await page.screenshot({
    path: info.outputPath(`${prefix}-lesson-${lesson + 1}-ready.png`),
    fullPage: true,
  });
  await page.getByRole("button", { name: "开始这一段", exact: true }).click();
  await page.clock.runFor(32);
  let elapsed = 0;
  const cert = certificates[lesson];
  for (const [index, a] of cert.actions.entries()) {
    const target = Math.round(a.time * 1000);
    await page.clock.runFor(Math.max(0, target - elapsed));
    elapsed = target;
    await expect(page.locator(".cloudrunner")).toHaveAttribute(
      "data-phase",
      "playing",
    );
    if (method === "keyboard") {
      await stage(page).focus();
      await page.keyboard.press(
        {
          left: "ArrowLeft",
          right: "ArrowRight",
          jump: "ArrowUp",
          slide: "ArrowDown",
        }[a.intent]!,
      );
    } else if (method === "swipe") await swipe(page, a.intent);
    else {
      const name =
        a.intent === "jump"
          ? "跳跃"
          : a.intent === "slide"
            ? "滑铲"
            : a.reason === "turn"
              ? a.intent === "left"
                ? "预备左转"
                : "预备右转"
              : a.intent === "left"
                ? "向左换道"
                : "向右换道";
      await page.getByRole("button", { name, exact: true }).click();
    }
    await page.clock.runFor(80);
    elapsed += 80;
    await page.screenshot({
      path: info.outputPath(
        `${prefix}-lesson-${lesson + 1}-action-${index + 1}.png`,
      ),
      fullPage: true,
    });
    if (a.reason === "turn") {
      const turnTime = Math.round(((a.obstacleOrTurn + 2) / 14) * 1000);
      await page.clock.runFor(turnTime - elapsed);
      elapsed = turnTime;
      await expect(page.locator(".cloudrunner")).toHaveAttribute(
        "data-phase",
        "playing",
      );
      await page.screenshot({
        path: info.outputPath(
          `${prefix}-lesson-${lesson + 1}-turn-${index + 1}.png`,
        ),
        fullPage: true,
      });
    }
  }
  await page.clock.runFor(Math.ceil((cert.length / 14) * 1000 - elapsed) + 500);
  await expect(page.locator(".cloudrunner")).toHaveAttribute(
    "data-outcome",
    "finished",
  );
  await expect(page.locator(".status")).toHaveClass(/success/);
  await expect(
    page.getByRole("button", { name: "再跑一次", exact: true }),
  ).toHaveCount(0);
  await runnerLayout(page);
  await page.screenshot({
    path: info.outputPath(`${prefix}-lesson-${lesson + 1}-finished.png`),
    fullPage: true,
  });
}
