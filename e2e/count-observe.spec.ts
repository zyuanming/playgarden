// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Locator } from "@playwright/test";
import { captureErrors, openGame } from "./helpers";
import type { Live } from "./crisp-helpers";

type Icon = { type: number; color: number };
type Shape = Icon & { x: number; y: number; scale: number };
type Answer = { turn: number; count: number; targetCount: number; correct: boolean;
  automatic: boolean; scoreBefore: number; scoreAfter: number; objects: Shape[]; targets: Icon[] };
type CountObserve = { turn: number; count: number; countdown: number; submitted: boolean;
  revealTicks: number; turnsCreated: number; correctAnswers: number; wrongAnswers: number;
  counterAdvances: number; losses: number; supportsReplay: boolean; targetIcons: Icon[];
  lastAnswer: Answer | null; display: { counter: number | null; result: string | null;
    answer: number | null; objects: Shape[] } };
const matching = (objects: Shape[], icons: Icon[]) => objects.filter(o =>
  icons.some(t => t.type === o.type && t.color === o.color));

test("COUNT original: count visible targets, time a real stop, reveal errors, retry and clean lifecycle", async ({ page }, info) => {
  test.setTimeout(75000);
  const mobile = info.project.name === "mobile";
  const errors = captureErrors(page), remote: string[] = [];
  const origin = new URL(String(info.project.use.baseURL || "http://127.0.0.1:4173")).origin;
  page.on("request", request => {
    const url = new URL(request.url());
    if (/^https?:$/.test(url.protocol) && url.origin !== origin) remote.push(url.href);
  });
  // Ordinary fixed stream, before source loading. No injected board, count,
  // deadline, outcome or score, and no fast-forward or replay option changes.
  await page.addInitScript(() => {
    if (!location.pathname.includes("/crisp-original/")) return;
    let seed = 83173;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  });
  await openGame(page, "数形定格");
  const root = page.locator('[data-crisp-game="count-observe"]');
  const iframe = root.locator("iframe");
  const frame = page.frameLocator('[data-crisp-game="count-observe"] iframe');
  const canvas = frame.locator("canvas");
  const read = async () => JSON.parse((await frame.locator("body").getAttribute("data-crisp-state"))!) as Live<CountObserve>;
  const otherRecord = await page.evaluate(() => localStorage.getItem("playgarden.crisp.cardq.records"));
  await expect(root).toHaveAttribute("data-crisp-ready", "true");
  await expect(page.getByLabel("选择关卡", { exact: true })).toHaveCount(0);
  await expect(root.locator(".crisp-intro")).toContainText("大小不影响计数");
  await page.screenshot({ path: info.outputPath("count-observe-title.png"), fullPage: true });
  const touch = mobile ? await page.context().newCDPSession(page) : null;
  const act = (locator: Locator) => mobile ? locator.tap() : locator.click();
  let down = false;
  async function hold(pressed: boolean) {
    if (down === pressed) return;
    if (pressed) {
      await iframe.scrollIntoViewIfNeeded();
      const b = (await canvas.boundingBox())!;
      const point = { x: b.x + b.width * .5, y: b.y + b.height * .75 };
      if (touch) await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...point, id: 1 }] });
      else { await page.mouse.move(point.x, point.y); await page.mouse.down(); }
    } else if (touch) await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    else await page.mouse.up();
    down = pressed;
  }
  async function tap() { await hold(true); await page.waitForTimeout(55); await hold(false); }
  await tap();
  await expect.poll(async () => (await read()).phase).toBe("inGame");
  await expect.poll(async () => (await read()).audio.unlocked).toBe(true);
  await expect.poll(async () => (await read()).audio.state).toBe("running");
  await expect.poll(async () => (await read()).audio.voices).toBeGreaterThan(0);
  await expect.poll(async () => (await read()).mechanics.display.objects.length).toBeGreaterThan(0);
  const first = await read(), icons = first.mechanics.targetIcons;
  const targetObjects = matching(first.mechanics.display.objects, icons);
  const expected = targetObjects.length;
  expect(first.mechanics.turn).toBe(1); expect(first.mechanics.supportsReplay).toBe(false);
  expect(expected).toBeGreaterThan(0); expect(icons.length).toBeGreaterThan(0);
  expect(first.mechanics.display.answer).toBeNull();
  for (const o of first.mechanics.display.objects) {
    expect(o.type).toBeGreaterThanOrEqual(0); expect(o.type).toBeLessThan(3);
    expect(o.color).toBeGreaterThanOrEqual(0); expect(o.color).toBeLessThan(3);
    expect(o.scale).toBeGreaterThanOrEqual(1); expect(o.scale).toBeLessThanOrEqual(3);
  }
  // Derive the answer from the visible shape/color set, not a hidden answer.
  // Observe the real displayed counter and wait for the original clock to tick.
  await expect.poll(async () => {
    const s = await read();
    expect(s.mechanics.submitted).toBe(false);
    return s.mechanics.display.counter;
  }, { timeout: 15000, intervals: [25] }).toBe(expected);
  await tap();
  await expect.poll(async () => (await read()).mechanics.correctAnswers).toBe(1);
  await expect.poll(async () => (await read()).mechanics.display.result).toBe("OK!");
  const correct = await read(), answer = correct.mechanics.lastAnswer!;
  expect(answer.count).toBe(expected); expect(answer.targetCount).toBe(expected);
  expect(answer.correct).toBe(true); expect(answer.automatic).toBe(false);
  expect(answer.scoreAfter).toBe(answer.scoreBefore + 1); expect(correct.score).toBe(1);
  expect(correct.mechanics.counterAdvances).toBe(expected);
  expect(correct.mechanics.display.answer).toBe(expected);
  expect(correct.mechanics.display.objects).toEqual(targetObjects);
  await page.screenshot({ path: info.outputPath("count-observe-correct-reveal.png"), fullPage: true });

  await expect.poll(async () => {
    const m = (await read()).mechanics;
    return m.turn === 2 && !m.submitted && m.display.objects.length > 0;
  }, { timeout: 5000, intervals: [25] }).toBe(true);
  const second = await read();
  expect(second.mechanics.turnsCreated).toBe(2); expect(second.score).toBe(1);
  expect(second.mechanics.count).toBe(0); expect(second.mechanics.display.answer).toBeNull();
  const secondObjects = matching(second.mechanics.display.objects, second.mechanics.targetIcons);
  expect(secondObjects.length).toBeGreaterThan(0);
  // Submit zero while the true count is nonzero. Keep a real input held so
  // pause/cancel has an actual physical input stream to release.
  await hold(true);
  await expect.poll(async () => (await read()).mechanics.wrongAnswers).toBe(1);
  await expect.poll(async () => (await read()).mechanics.display.result).toBe("ERROR");
  const wrong = await read();
  expect(wrong.mechanics.lastAnswer!.count).toBe(0);
  expect(wrong.mechanics.lastAnswer!.targetCount).toBe(secondObjects.length);
  expect(wrong.mechanics.lastAnswer!.automatic).toBe(false);
  expect(wrong.mechanics.lastAnswer!.correct).toBe(false);
  expect(wrong.score).toBe(1);
  expect(wrong.mechanics.display.answer).toBe(secondObjects.length);
  expect(wrong.mechanics.display.objects).toEqual(secondObjects);
  await page.screenshot({ path: info.outputPath("count-observe-wrong-reveal.png"), fullPage: true });
  if (touch) {
    await expect.poll(async () => (await read()).pressed).toBe(true);
    await touch.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] }); down = false;
    await expect.poll(async () => (await read()).pressed).toBe(false);
  } else {
    await hold(false); await canvas.focus(); await page.keyboard.down("Enter");
    await expect.poll(async () => (await read()).pressed).toBe(true);
  }
  await act(page.getByRole("button", { name: "暂停", exact: true }));
  if (!touch) await page.keyboard.up("Enter");
  await expect.poll(async () => (await read()).hostPaused).toBe(true);
  await expect.poll(async () => (await read()).audio.state).toBe("suspended");
  const frozen = await read();
  await page.waitForTimeout(650);
  const still = await read();
  expect(still.paused).toBe(true); expect(still.pressed).toBe(false);
  expect(still.frames).toBe(frozen.frames); expect(still.ticks).toBe(frozen.ticks);
  expect(still.mechanics).toEqual(frozen.mechanics); expect(still.audio.gain).toBe(0);
  await act(page.getByRole("button", { name: "继续游戏", exact: true }));
  await expect.poll(async () => (await read()).hostPaused).toBe(false);
  await expect.poll(async () => (await read()).frames).toBeGreaterThan(frozen.frames);
  const mute = page.getByRole("button", { name: "静音", exact: true });
  if (await mute.count()) await act(mute);
  await expect.poll(async () => (await read()).audio.gain).toBe(0);
  const overlay = frame.locator("#crisp-pause");
  if (await overlay.isVisible()) await act(overlay);
  await act(page.getByRole("button", { name: "开启声音", exact: true }));
  if (await overlay.isVisible()) await act(overlay);
  await expect.poll(async () => (await read()).audio.gain).toBe(1);
  await expect.poll(async () => (await read()).audio.state).toBe("running");

  await expect.poll(async () => (await read()).phase, { timeout: 5000, intervals: [25] }).toBe("gameOver");
  const lost = await read();
  expect(lost.mechanics.losses).toBe(1); expect(lost.mechanics.revealTicks).toBe(91);
  expect(lost.score).toBe(1); expect(lost.best).toBeGreaterThanOrEqual(1);
  expect(lost.replaying).toBe(false);
  await expect(page.locator(".status")).not.toHaveClass(/success/);
  await expect(page.locator(".status")).not.toContainText("回放");
  await page.screenshot({ path: info.outputPath("count-observe-game-over.png"), fullPage: true });
  // Original no-replay mode returns to title after 300 game-over ticks.
  await expect.poll(async () => (await read()).phase, { timeout: 9000, intervals: [100] }).toBe("title");
  const titled = await read();
  expect(titled.replaying).toBe(false); expect(titled.runs).toBe(lost.runs);
  await tap();
  await expect.poll(async () => (await read()).phase).toBe("inGame");
  expect((await read()).run).toBeGreaterThan(lost.run); expect((await read()).score).toBe(0);
  // This retry naturally fails without another press once its counter passes
  // the matching total. It exercises the original too-late automatic stop.
  await expect.poll(async () => (await read()).mechanics.wrongAnswers,
    { timeout: 15000, intervals: [50] }).toBe(1);
  const missed = await read();
  expect(missed.mechanics.lastAnswer!.automatic).toBe(true);
  expect(missed.mechanics.lastAnswer!.count).toBe(missed.mechanics.lastAnswer!.targetCount + 1);
  await expect.poll(async () => (await read()).phase, { timeout: 5000 }).toBe("gameOver");
  const retryRun = (await read()).run;
  await expect.poll(async () => (await read()).ticks).toBeGreaterThan(20);
  await tap();
  await expect.poll(async () => (await read()).phase).toBe("inGame");
  expect((await read()).run).toBeGreaterThan(retryRun); expect((await read()).score).toBe(0);

  await act(page.getByRole("button", { name: "重来", exact: true }));
  await expect(root).toHaveAttribute("data-crisp-ready", "true");
  await expect.poll(async () => (await read()).phase).toBe("title");
  expect((await read()).score).toBe(0); expect((await read()).best).toBeGreaterThanOrEqual(lost.score);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await frame.locator("body").evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await iframe.evaluate(el => {
    const w = (el as HTMLIFrameElement).contentWindow as Window & {
      __crispEngine: { snapshot: () => unknown }; __crispAudio: { snapshot: () => unknown } };
    (window as unknown as { countPrevious: unknown }).countPrevious = { engine: w.__crispEngine, audio: w.__crispAudio };
  });
  await act(page.getByRole("button", { name: "返回游戏大厅", exact: true }));
  await expect(iframe).toHaveCount(0);
  const old = () => page.evaluate(() => {
    const p = (window as unknown as { countPrevious: {
      engine: { snapshot: () => { disposed: boolean; frames: number; listenerCount: number; rafPending: boolean } };
      audio: { snapshot: () => { state: string; voices: number; gain: number } } } }).countPrevious;
    return { ...p.engine.snapshot(), audio: p.audio.snapshot() };
  });
  await expect.poll(async () => (await old()).audio.state).toBe("closed");
  const clean = await old();
  expect(clean.disposed).toBe(true); expect(clean.listenerCount).toBe(0); expect(clean.rafPending).toBe(false);
  expect(clean.audio.voices).toBe(0); expect(clean.audio.gain).toBe(0);
  await page.waitForTimeout(350); expect((await old()).frames).toBe(clean.frames);
  await openGame(page, "数形定格");
  await expect(root).toHaveAttribute("data-crisp-ready", "true");
  expect((await read()).best).toBeGreaterThanOrEqual(lost.score);
  expect(await page.evaluate(() => localStorage.getItem("playgarden.crisp.cardq.records"))).toBe(otherRecord);
  const record = await page.evaluate(() => JSON.parse(localStorage.getItem("playgarden.crisp.count-observe.records")!));
  expect(record.best).toBeGreaterThanOrEqual(lost.score);
  await page.screenshot({ path: info.outputPath("count-observe-best-restored.png"), fullPage: true });
  expect(errors).toEqual([]); expect(remote).toEqual([]);
  await touch?.detach();
});
