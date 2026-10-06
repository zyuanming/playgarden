// SPDX-License-Identifier: GPL-3.0-only
import { test, expect } from "@playwright/test";
import {
  openRunner,
  freezeRunner,
  playLesson,
  runnerLayout,
  swipe,
} from "./cloudrunnerJourney";
import { runnerLessons } from "../src/games/cloudrunnerLogic";
for (let lesson = 0; lesson < runnerLessons.length; lesson++)
  test(`Cloudrunner lesson ${lesson + 1}: independent control certificate`, async ({
    page,
    isMobile,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openRunner(page);
    await expect(page.getByRole("heading", {name:"云迹跑者",exact:true})).toBeVisible();
    await freezeRunner(page);
    await playLesson(
      page,
      lesson,
      info,
      isMobile ? (lesson % 2 === 0 ? "swipe" : "button") : "keyboard",
    );
    expect(errors).toEqual([]);
  });
test("云迹跑者 full lifecycle, failure, audio, combo shortcuts, and next lesson", async ({
  page,
  isMobile,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openRunner(page);
  await freezeRunner(page);
  await expect(
    page.getByRole("button", { name: "撤销", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "六段入门", exact: true }).click();
  await page.getByRole("button", { name: "开始这一段", exact: true }).click();
  await page.clock.runFor(32);
  const stage = page.getByRole("group", { name: /云路跑道/ });
  await stage.focus();
  for (const modifier of ["Control", "Meta", "Alt"]) {
    await page.keyboard.press(`${modifier}+ArrowRight`);
    await expect(page.locator(".cloudrunner")).toHaveAttribute(
      "data-lane",
      "center",
    );
  }
  // Ignore unrelated form keys and keep the actual focused selector untouched.
  const select = page.getByLabel("选择关卡", { exact: true });
  await select.focus();
  await expect(select).toBeFocused();
  await page.keyboard.press("Control+ArrowRight");
  await expect(select).toBeFocused();
  await expect(page.locator(".cloudrunner")).toHaveAttribute(
    "data-lane",
    "center",
  );
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  const pausedDistance = await page
    .locator(".cloudrunner")
    .getAttribute("data-distance");
  await page.clock.runFor(3000);
  await expect(page.locator(".cloudrunner")).toHaveAttribute(
    "data-distance",
    pausedDistance!,
  );
  await expect(
    page.getByRole("button", { name: "跳跃", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: info.outputPath("runner-shell-paused.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  await page.clock.runFor(120);
  // Two simultaneous action classes remain effective; cancellation cannot leak a swipe.
  if (isMobile) await swipe(page, "right");
  else {
    await stage.focus();
    await page.keyboard.press("ArrowRight");
  }
  await page.getByRole("button", { name: "跳跃", exact: true }).click();
  await expect(page.locator(".cloudrunner")).toHaveAttribute(
    "data-lane",
    "right",
  );
  await expect(page.locator(".cloudrunner")).toHaveAttribute(
    "data-action",
    "jumping",
  );
  await stage.dispatchEvent("pointerdown", {
    pointerId: 9,
    isPrimary: true,
    clientX: 100,
    clientY: 200,
    pointerType: "touch",
  });
  await stage.dispatchEvent("pointercancel", { pointerId: 9, isPrimary: true });
  await stage.dispatchEvent("pointerup", {
    pointerId: 9,
    isPrimary: true,
    clientX: 10,
    clientY: 200,
    pointerType: "touch",
  });
  await expect(page.locator(".cloudrunner")).toHaveAttribute(
    "data-lane",
    "right",
  );
  await page.getByRole("button", { name: "静音", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "开启声音", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(page.locator(".status")).toContainText("路口箭头变亮");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.locator(".cloudrunner")).toHaveAttribute(
    "data-held",
    "true",
  );
  const held = await page.locator(".cloudrunner").getAttribute("data-distance");
  await page.clock.runFor(2000);
  await expect(page.locator(".cloudrunner")).toHaveAttribute(
    "data-distance",
    held!,
  );
  await page.screenshot({
    path: info.outputPath("runner-interruption-held.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "回到云路", exact: true }).click();
  await page.clock.runFor(300);
  await page.getByRole("button", { name: "重来", exact: true }).click();
  await expect(page.locator(".cloudrunner")).toHaveAttribute(
    "data-phase",
    "start",
  );
  await page.getByRole("button", { name: "开始这一段", exact: true }).click();
  await page.clock.runFor(4000);
  await expect(page.locator(".cloudrunner")).toHaveAttribute(
    "data-outcome",
    "crashed",
  );
  await page.screenshot({
    path: info.outputPath("runner-collision.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "再跑一次", exact: true }).click();
  await expect(page.locator(".cloudrunner")).toHaveAttribute(
    "data-distance",
    "0.000",
  );
  await playLesson(page, 3, info, "button", "runner-turn");
  await page.getByRole("button", { name: "下一关", exact: true }).click();
  await expect(select).toHaveValue("4");
  await expect(page.locator(".cloudrunner")).toHaveAttribute(
    "data-phase",
    "start",
  );
  await page.getByRole("button", { name: "无尽漫游", exact: true }).click();
  await page.getByRole("button", { name: "开始奔跑", exact: true }).click();
  await page.clock.runFor(600);
  await expect(page.locator(".cloudrunner")).toHaveAttribute(
    "data-phase",
    "playing",
  );
  await page.screenshot({
    path: info.outputPath("runner-endless.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "返回游戏大厅", exact: true }).click();
  await page.clock.runFor(2000);
  await expect(page.locator(".cloudrunner")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("云迹跑者 320 px, landscape, reduced motion, and turn mistake", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openRunner(page);
  await freezeRunner(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await runnerLayout(page);
  await page.screenshot({
    path: info.outputPath("runner-320-ready.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "六段入门", exact: true }).click();
  await page.getByLabel("选择关卡", { exact: true }).selectOption("3");
  await page.getByRole("button", { name: "开始这一段", exact: true }).click();
  await page.clock.runFor(5400);
  await expect(page.locator(".cr-turn")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "预备右转", exact: true }).click();
  await page.screenshot({
    path: info.outputPath("runner-320-wrong-turn.png"),
    fullPage: true,
  });
  await page.clock.runFor(2200);
  await expect(page.locator(".cloudrunner")).toHaveAttribute(
    "data-outcome",
    "crashed",
  );
  await expect(page.locator(".cr-sheet")).toContainText("转错了方向");
  await page.setViewportSize({ width: 740, height: 390 });
  await runnerLayout(page);
  await page.screenshot({
    path: info.outputPath("runner-landscape-failure.png"),
    fullPage: true,
  });
});
