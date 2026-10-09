// SPDX-License-Identifier: GPL-3.0-only
// Authored, not run. Use the repository's one final desktop/mobile E2E invocation.
// Only ordinary visible buttons / keys and the browser clock affect the game.
import { test, expect, type Page, type Locator } from "@playwright/test";
import { captureErrors, chooseLevel, openGame } from "./helpers";

const root = (page: Page) => page.locator(".pend-game");
async function observe(page: Page) {
  return root(page).evaluate((el) => ({
    phase: el.getAttribute("data-pend-phase"),
    angle: Number(el.getAttribute("data-pend-angle")),
    omega: Number(el.getAttribute("data-pend-omega")),
    amplitude: Number(el.getAttribute("data-pend-amplitude")),
    target: Number(el.getAttribute("data-pend-target")),
    time: Number(el.getAttribute("data-pend-time")),
    pushes: Number(el.getAttribute("data-pend-pushes")),
    left: Number(el.getAttribute("data-pend-left")),
    right: Number(el.getAttribute("data-pend-right")),
    available: el.getAttribute("data-pend-can-push") === "true",
  }));
}

test("Pendulum: signed impulses, pause, real overswing and first/final bell goals", async ({
  page,
}, info) => {
  test.setTimeout(240000);
  const errors = captureErrors(page);
  const act = async (button: Locator) =>
    info.project.name === "mobile" ? button.tap() : button.click();
  const button = (name: string) =>
    page.getByRole("button", { name, exact: true });
  await openGame(page, "摆钟节拍");
  await page.clock.install({ time: new Date("2026-10-09T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-09T12:00:01Z"));
  await act(button("重来"));
  const stage = root(page).locator(".pend-stage");
  await expect(button("撤销")).toBeDisabled();
  const ready = await observe(page);
  await page.clock.runFor(1000);
  expect(await observe(page)).toEqual(ready);
  await stage.focus();
  await stage.press("ArrowRight");
  await expect(root(page)).toHaveAttribute("data-pend-phase", "ready");
  await act(button("开始摆动"));
  await page.clock.runFor(500);
  await stage.focus();
  const beforeBrake = await observe(page);
  expect(beforeBrake.omega).toBeGreaterThan(0.25);
  await stage.press("Control+ArrowLeft");
  expect((await observe(page)).pushes).toBe(0);
  await page.keyboard.down("ArrowLeft");
  await page.keyboard.down("ArrowLeft");
  await page.keyboard.up("ArrowLeft");
  const braked = await observe(page);
  expect(braked.pushes).toBe(1);
  expect(braked.amplitude).toBeLessThan(beforeBrake.amplitude);
  await expect(button("向左推")).toBeDisabled();
  await stage.press("ArrowRight");
  expect((await observe(page)).pushes).toBe(1);
  await page.clock.runFor(900);
  await expect(button("向右推")).toBeEnabled(); // Small swings can rearm without leaving the gate.
  await act(button("提示"));
  expect((await observe(page)).pushes).toBe(1);
  await expect(root(page).locator(".pend-message")).toContainText(
    /摆幅|推力|刹车/,
  );

  await act(button("暂停"));
  const frozen = await observe(page);
  await page.clock.runFor(2000);
  expect(await observe(page)).toEqual(frozen);
  await act(button("继续游戏"));
  await page.clock.runFor(100);
  expect((await observe(page)).time - frozen.time).toBeLessThan(0.12);
  await act(button("重来"));
  expect(await observe(page)).toEqual(ready);

  async function checkLayout() {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await root(page)
        .locator("button")
        .evaluateAll((buttons) =>
          buttons.every((el) => {
            const box = el.getBoundingClientRect();
            return box.width >= 44 && box.height >= 44;
          }),
        ),
    ).toBe(true);
  }
  async function play(maintain: boolean) {
    await act(button("开始摆动"));
    for (let frame = 0; frame < 1500; frame++) {
      const s = await observe(page);
      if (s.phase !== "running") return s;
      // Read the same current direction and energy estimate shown to the player.
      // This does not import physics, set state, synthesize a crossing or use a win route.
      if (s.available && (!maintain || s.amplitude < s.target + 6)) {
        const right = Math.abs(s.omega) > 0.025 ? s.omega > 0 : s.angle <= 0;
        await act(button(right ? "向右推" : "向左推"));
      }
      await page.clock.runFor(32);
    }
    throw new Error(
      "Ordinary controls did not finish within 48 simulated seconds",
    );
  }

  await checkLayout();
  await page.screenshot({
    path: info.outputPath("pendulum-first-ready.png"),
    fullPage: true,
  });
  const first = await play(true);
  expect(first.phase).toBe("won");
  expect(first.left).toBe(1);
  expect(first.right).toBe(1);
  await expect(page.locator(".status")).toHaveClass(/success/);
  await expect(button("向左推")).toBeDisabled();
  await expect(button("向右推")).toBeDisabled();
  const won = await observe(page);
  await page.clock.runFor(1500);
  expect(await observe(page)).toEqual(won);
  await page.screenshot({
    path: info.outputPath("pendulum-first-bells.png"),
    fullPage: true,
  });

  await chooseLevel(page, 7);
  const overswing = await play(false);
  expect(overswing.phase).toBe("lost");
  expect(Math.abs(overswing.angle)).toBeGreaterThanOrEqual(80);
  await expect(button("向右推")).toBeDisabled();
  await page.screenshot({
    path: info.outputPath("pendulum-real-overswing.png"),
    fullPage: true,
  });
  await act(button("重新尝试"));
  expect((await observe(page)).pushes).toBe(0);
  expect((await observe(page)).phase).toBe("ready");
  const final = await play(true);
  expect(final.phase).toBe("won");
  expect(final.left).toBe(3);
  expect(final.right).toBe(3);
  await expect(page.locator(".status")).toHaveClass(/success/);
  await checkLayout();
  await page.screenshot({
    path: info.outputPath("pendulum-final-six-bells.png"),
    fullPage: true,
  });

  await act(button("重来"));
  await act(button("开始摆动"));
  await page.clock.runFor(200);
  await act(button("返回游戏大厅"));
  await page.clock.runFor(1000);
  await expect(root(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});
