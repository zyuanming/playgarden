// SPDX-License-Identifier: GPL-3.0-only
import { expect, type Page, type TestInfo, type Locator } from "@playwright/test";
import { openGame, captureErrors } from "./helpers";
export type Live<M> = { phase: string; run: number; ticks: number; frames: number; score: number; best: number; runs: number; paused: boolean; hostPaused: boolean; localPaused: boolean; pressed: boolean; replaying: boolean; difficulty: number; audio: { state: string; gain: number; muted: boolean; unlocked: boolean; voices: number }; mechanics: M };
export async function crispJourney<M>(page: Page, info: TestInfo, game: string, title: string) {
  const mobile = info.project.name === "mobile", errors = captureErrors(page), remote: string[] = [];
  const origin = new URL(String(info.project.use.baseURL || "http://127.0.0.1:4173")).origin;
  page.on("request", r => { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol) && u.origin !== origin) remote.push(u.href); });
  // One fixed RNG stream, set before original scripts load; no simulation state changes.
  await page.addInitScript(() => {
    if (!location.pathname.includes("/crisp-original/")) return;
    let seed = 83173;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  });
  await openGame(page, title);
  const root = page.locator(`[data-crisp-game="${game}"]`);
  const iframe = root.locator("iframe"), frame = page.frameLocator(`[data-crisp-game="${game}"] iframe`), canvas = frame.locator("canvas");
  const read = async () => JSON.parse((await frame.locator("body").getAttribute("data-crisp-state"))!) as Live<M>;
  await expect(root).toHaveAttribute("data-crisp-ready", "true");
  await expect(page.getByLabel("选择关卡", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath(`${game}-title.png`), fullPage: true });
  const cdp = mobile ? await page.context().newCDPSession(page) : null;
  let down = false;
  const act = (locator: Locator) => mobile ? locator.tap() : locator.click();
  const point = async () => { const b = (await canvas.boundingBox())!; return { x: b.x + b.width * .5, y: b.y + b.height * .5 }; };
  async function hold(value: boolean) {
    if (down === value) return;
    if (value) {
      await iframe.scrollIntoViewIfNeeded();
      const p = await point();
      if (cdp) await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...p, id: 1 }] });
      else { await page.mouse.move(p.x, p.y); await page.mouse.down(); }
    } else if (cdp) await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    else await page.mouse.up();
    down = value;
  }
  const tap = async () => { await hold(true); await page.waitForTimeout(55); await hold(false); };
  await tap();
  await expect.poll(async () => (await read()).phase).toBe("inGame");
  await expect.poll(async () => (await read()).audio.unlocked).toBe(true);
  await expect.poll(async () => (await read()).audio.state).toBe("running");
  await expect.poll(async () => (await read()).audio.voices).toBeGreaterThan(0);
  async function pauseAndSound() {
    if (mobile) {
      // Complete one real touch stream before tapping another target. Mixing a
      // mouse click into a held CDP touch produced a second compatibility click
      // on touchEnd in CI, toggling the host pause button back to running.
      await hold(true);
      await expect.poll(async () => (await read()).pressed).toBe(true);
      await cdp!.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
      down = false;
      await expect.poll(async () => (await read()).pressed).toBe(false);
      await act(page.getByRole("button", { name: "暂停", exact: true }));
    } else {
      // A held keyboard key plus a mouse toolbar click is a coherent physical
      // gesture and proves that pause/blur releases internal held-key state.
      await canvas.focus();
      await page.keyboard.down("Enter");
      await expect.poll(async () => (await read()).pressed).toBe(true);
      await act(page.getByRole("button", { name: "暂停", exact: true }));
      await page.keyboard.up("Enter");
    }
    await expect(page.getByRole("button", { name: "继续游戏", exact: true })).toBeVisible();
    await expect.poll(async () => (await read()).hostPaused).toBe(true);
    await expect.poll(async () => (await read()).paused).toBe(true);
    await expect.poll(async () => (await read()).audio.state).toBe("suspended");
    const frozen = await read();
    await page.waitForTimeout(650);
    const after = await read();
    expect(after.frames).toBe(frozen.frames); expect(after.ticks).toBe(frozen.ticks); expect(JSON.stringify(after.mechanics)).toBe(JSON.stringify(frozen.mechanics)); expect(after.pressed).toBe(false); expect(after.audio.gain).toBe(0);
    await act(page.getByRole("button", { name: "继续游戏", exact: true }));
    await expect.poll(async () => (await read()).hostPaused).toBe(false);
    await expect.poll(async () => (await read()).frames).toBeGreaterThan(frozen.frames);
    const soundOff = page.getByRole("button", { name: "静音", exact: true });
    if (await soundOff.count()) await act(soundOff);
    await expect.poll(async () => (await read()).audio.gain).toBe(0);
    // Sound controls may blur the frame; resume the explicit in-frame pause overlay.
    const overlay = frame.locator("#crisp-pause");
    if (await overlay.isVisible()) { await act(overlay); }
    await expect.poll(async () => (await read()).paused).toBe(false);
    await act(page.getByRole("button", { name: "开启声音", exact: true }));
    if (await overlay.isVisible()) { await act(overlay); }
    await expect.poll(async () => (await read()).audio.gain).toBe(1);
    await expect.poll(async () => (await read()).audio.state).toBe("running");
    if (mobile) {
      await hold(true);
      await cdp!.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] }); down = false;
    } else {
      await canvas.focus(); await page.keyboard.down("Space");
      await expect.poll(async () => (await read()).pressed).toBe(true);
      await page.keyboard.up("Space");
      await hold(true);
      const b = (await canvas.boundingBox())!; await page.mouse.move(b.x - 4, b.y + b.height / 2);
      await hold(false);
    }
    await expect.poll(async () => (await read()).pressed).toBe(false);
  }
  async function finish(lost: Live<M>) {
    await hold(false);
    expect(lost.replaying).toBe(false);
    expect(lost.score).toBeGreaterThan(0);
    expect(lost.best).toBeGreaterThanOrEqual(lost.score);
    await expect(page.locator(".status")).not.toHaveClass(/success/);
    await page.screenshot({ path: info.outputPath(`${game}-natural-loss.png`), fullPage: true });
    // Let the unchanged original game-over delay lead to actual input replay.
    await expect.poll(async () => (await read()).replaying, { timeout: 7000 }).toBe(true);
    const runs = (await read()).runs;
    await page.waitForTimeout(350);
    expect((await read()).runs).toBe(runs);
    await tap();
    await expect.poll(async () => (await read()).phase).toBe("inGame");
    expect((await read()).run).toBeGreaterThan(lost.run);
    expect((await read()).score).toBe(0);
    await act(page.getByRole("button", { name: "重来", exact: true }));
    await expect(root).toHaveAttribute("data-crisp-ready", "true");
    await expect.poll(async () => (await read()).phase).toBe("title");
    expect((await read()).score).toBe(0); expect((await read()).best).toBeGreaterThanOrEqual(lost.score);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await frame.locator("body").evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Keep read-only references so removal can prove real cleanup, beyond disappearance.
    await iframe.evaluate(el => {
      const w = (el as HTMLIFrameElement).contentWindow as Window & { __crispEngine: { snapshot: () => unknown }; __crispAudio: { snapshot: () => unknown } };
      (window as unknown as { crispPrevious: unknown }).crispPrevious = { engine: w.__crispEngine, audio: w.__crispAudio };
    });
    await act(page.getByRole("button", { name: "返回游戏大厅", exact: true }));
    await expect(iframe).toHaveCount(0);
    const old = () => page.evaluate(() => {
      const p = (window as unknown as { crispPrevious: { engine: { snapshot: () => { disposed: boolean; frames: number; listenerCount: number; rafPending: boolean } }; audio: { snapshot: () => { state: string; voices: number; gain: number } } } }).crispPrevious;
      return { ...p.engine.snapshot(), audio: p.audio.snapshot() };
    });
    await expect.poll(async () => (await old()).audio.state).toBe("closed");
    const clean = await old(); expect(clean.disposed).toBe(true); expect(clean.listenerCount).toBe(0); expect(clean.rafPending).toBe(false); expect(clean.audio.voices).toBe(0); expect(clean.audio.gain).toBe(0);
    await page.waitForTimeout(350); expect((await old()).frames).toBe(clean.frames);
    await openGame(page, title);
    await expect(root).toHaveAttribute("data-crisp-ready", "true");
    expect((await read()).best).toBeGreaterThanOrEqual(lost.score);
    await page.screenshot({ path: info.outputPath(`${game}-best-restored.png`), fullPage: true });
    expect(errors).toEqual([]); expect(remote).toEqual([]);
    await cdp?.detach();
  }
  return { read, tap, hold, canvas, frame, pauseAndSound, finish };
}
