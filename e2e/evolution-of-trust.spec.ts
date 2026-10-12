// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type CDPSession, type Locator, type Page, type TestInfo } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

// This journey uses the upstream buttons, range inputs, tabs and chapter dots.
// evaluate() below only observes DOM/rendered simulation state and the adapter's
// pure lifecycle status getter. No publish/subscribe, source progression calls,
// injected saves, fake clock, RNG seed, or speed overrides are used.
test.use({ trace: 'off' });
const TITLE = '信任的进化';
const FRAME = 'iframe[title="信任的进化完整互动旅程"]';
const ROUND_TIMEOUT = 20000;
const STEP_TIMEOUT = 20000;
const GATE_TIMEOUT = 90000;
type Phase = 'play' | 'eliminate' | 'reproduce';
type Lifecycle = { state: string; paused: boolean; reasons: string[]; scene: number; timers: number; applications: number; problems: string[]; audioContextState: string | null };
type Agent = { strategy: string; coins: number; x: number; y: number; alpha: number; angle: number; target: number };
type Observation = { slide: number; totalSlides: number; transitioning: boolean; lifecycle: Lifecycle; muted: boolean; rounds: number; steps: Record<Phase, number>; tournament: null | { stage: number; autoplay: boolean; agents: Agent[] }; rules: { turns: number; selection: number; noise: number }; text: string };

function journey(page: Page, info: TestInfo, origin: string) {
  const mobile = info.project.name === 'mobile';
  const frame = page.frameLocator(FRAME);
  const inputs: object[] = [], observations: object[] = [], errors: string[] = [], warnings: string[] = [], outside: string[] = [], failed: object[] = [];
  let touch: CDPSession | undefined;
  page.on('pageerror', error => errors.push(error.stack || error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
    else if (message.type() === 'warning') warnings.push(message.text());
  });
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) outside.push(request.url());
  });
  page.on('requestfailed', request => failed.push({ url: request.url(), failure: request.failure()?.errorText }));
  page.on('response', response => { if (response.status() >= 400) failed.push({ url: response.url(), status: response.status() }); });

  const observe = () => frame.locator('body').evaluate((): Observation => {
    type RenderAgent = { strategyName: string; coins: number; angle: number; gotoAngle: number; graphics: { x: number; y: number; alpha: number } };
    const w = window as unknown as {
      slideshow: { slideIndex: number; objects: { tournament?: { STAGE: number; isAutoPlaying: boolean; agents: RenderAgent[] } } };
      SLIDES: unknown[]; Scratcher: { isTransitioning: boolean }; TrustLifecycle: { status: () => Lifecycle };
      Howler: { _muted: boolean }; Tournament: { NUM_TURNS: number; SELECTION: number }; PD: { NOISE: number };
    };
    const t = w.slideshow.objects.tournament;
    const textRoot = document.querySelector(innerWidth < 760 ? '#mobile-narrative' : '#slideshow') as HTMLElement;
    return {
      slide: w.slideshow.slideIndex, totalSlides: w.SLIDES.length, transitioning: w.Scratcher.isTransitioning,
      lifecycle: w.TrustLifecycle.status(), muted: w.Howler._muted,
      rounds: Number(document.body.dataset.trustRounds),
      steps: { play: Number(document.body.dataset.trustPlaySteps), eliminate: Number(document.body.dataset.trustEliminateSteps), reproduce: Number(document.body.dataset.trustReproduceSteps) },
      tournament: t ? { stage: t.STAGE, autoplay: t.isAutoPlaying, agents: t.agents.map(a => ({ strategy: a.strategyName, coins: a.coins, x: a.graphics.x, y: a.graphics.y, alpha: a.graphics.alpha, angle: a.angle, target: a.gotoAngle })) } : null,
      rules: { turns: w.Tournament.NUM_TURNS, selection: w.Tournament.SELECTION, noise: w.PD.NOISE },
      text: textRoot?.innerText.slice(0, 1800) || '',
    };
  });
  const checkpoint = async (label: string) => { const value = await observe(); observations.push({ label, at: Date.now(), ...value }); return value; };
  const ready = async () => {
    await expect(page.locator('[data-trust-ready]')).toHaveAttribute('data-trust-ready', 'true', { timeout: 35000 });
    await expect(frame.locator('body')).toHaveAttribute('data-trust-rounds', /\d+/);
    await expect(frame.locator('#runtime-error')).toHaveCount(0);
    await expect(page.locator('.trust-error')).toHaveCount(0);
  };
  const settled = async () => { await expect.poll(async () => (await observe()).transitioning, { timeout: 15000 }).toBe(false); };
  const activate = async (node: Locator, label: string) => {
    await expect(node).toBeVisible({ timeout: GATE_TIMEOUT });
    await expect(node).toBeEnabled({ timeout: GATE_TIMEOUT });
    await expect.poll(() => node.evaluate(el => {
      for (let p: Element | null = el; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.5) return false;
      }
      return true;
    }), { timeout: GATE_TIMEOUT }).toBe(true);
    inputs.push({ action: mobile ? 'tap' : 'click', control: label, text: (await node.getAttribute('aria-label')) || await node.innerText(), at: Date.now() });
    if (mobile) await node.tap(); else await node.click();
  };
  const control = (id: string) => frame.locator(mobile ? `#mobile-controls button[data-control="${id}"]` : `.button[data-trust-id="${id}"] #hitbox`);
  const copy = (id: string) => frame.locator(mobile ? `#mobile-narrative [data-original-id="${id}"]` : `.textbox[data-trust-id="${id}"]`);
  const press = async (id: string) => { await settled(); await activate(control(id), id); };
  const advance = async (id: string) => {
    const before = (await observe()).slide;
    await press(id);
    await expect.poll(async () => (await observe()).slide, { timeout: 15000 }).toBe(before + 1);
    await settled();
  };
  const chapter = async (id: string, name: RegExp) => {
    await settled(); await activate(frame.locator('#select').getByRole('button', { name }), `chapter:${id}`);
    await expect(page.locator('[data-trust-chapter]')).toHaveAttribute('data-trust-chapter', id);
    await settled();
  };
  const population = (s: Observation) => s.tournament!.agents.reduce<Record<string, number>>((counts, agent) => { counts[agent.strategy] = (counts[agent.strategy] || 0) + 1; return counts; }, {});
  const step = async (phase: Phase, id: string) => {
    const before = (await observe()).steps[phase];
    await press(id);
    await expect.poll(async () => (await observe()).steps[phase], { timeout: STEP_TIMEOUT }).toBe(before + 1);
  };
  const waitRest = async () => { await expect.poll(async () => (await observe()).tournament?.stage, { timeout: STEP_TIMEOUT }).toBe(0); };
  const stop = async (id: string) => {
    await expect.poll(async () => (await observe()).tournament?.autoplay).toBe(true);
    await press(id);
    await expect.poll(async () => (await observe()).tournament?.autoplay).toBe(false);
    await waitRest();
  };
  const range = (message: string) => frame.locator(`${mobile ? '#mobile-narrative' : '#slideshow'} input[type="range"][data-message="${message}"]`);
  const dragRange = async (message: string, ratio: number, cancel = false) => {
    const node = range(message);
    await expect(node).toBeVisible(); await node.scrollIntoViewIfNeeded();
    const bounds = await node.boundingBox(); if (!bounds) throw Error(`Missing slider bounds: ${message}`);
    const before = Number(await node.inputValue()), min = Number(await node.getAttribute('min')), max = Number(await node.getAttribute('max')), unit = Number(await node.getAttribute('step'));
    const start = bounds.x + 8 + (bounds.width - 16) * ((before - min) / (max - min));
    const end = bounds.x + (ratio === 0 ? 2 : ratio === 1 ? bounds.width - 2 : bounds.width * ratio), y = bounds.y + bounds.height / 2;
    if (mobile) {
      touch ||= await page.context().newCDPSession(page);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y, id: 1 }] });
      for (let i = 1; i <= 8; i++) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start + (end - start) * i / 8, y, id: 1 }] });
      await touch.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
    } else {
      await page.mouse.move(start, y); await page.mouse.down(); await page.mouse.move(end, y, { steps: 8 }); await page.mouse.up();
    }
    const expected = ratio === 0 ? min : ratio === 1 ? max : Math.round((min + (max - min) * ratio) / unit) * unit;
    await expect.poll(async () => Math.abs(Number(await node.inputValue()) - expected)).toBeLessThanOrEqual(ratio === 0 || ratio === 1 ? unit / 10 : unit * 1.01);
    const value = Number(await node.inputValue());
    inputs.push({ action: mobile ? cancel ? 'touch-drag-cancel' : 'touch-drag' : 'mouse-drag', control: message, before, ratio, value, at: Date.now() });
    return value;
  };
  const tab = async (name: string) => activate(mobile ? frame.locator('#mobile-controls').getByRole('button', { name, exact: true }) : frame.locator('#sandbox_tabs').getByRole('button', { name, exact: true }), `sandbox-tab:${name}`);
  const payoff = async () => (await frame.locator('.incdec[data-payoff="R"] .incdec_num').allTextContents()).map(Number);
  const increasePayoff = async () => activate(mobile ? frame.locator('#mobile-narrative').getByRole('button', { name: '双方合作 增加', exact: true }).first() : frame.locator('.incdec[data-payoff="R"] [arrow="up"]').first(), 'payoff:R:increase');
  const screenshot = async (name: string, anchor?: Locator) => {
    if (anchor) await anchor.scrollIntoViewIfNeeded(); else await page.locator(FRAME).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`trust-${name}-${mobile ? 'touch' : 'desktop'}.png`), fullPage: false });
    if (mobile) {
      expect(await frame.locator('body').evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const metrics = await frame.locator('#mobile-view').evaluate(el => ({ width: el.clientWidth, font: parseFloat(getComputedStyle(el.querySelector('.mobile-row') || el).fontSize) }));
      expect(metrics.width).toBeGreaterThan(250); expect(metrics.font).toBeGreaterThanOrEqual(16);
      observations.push({ label: `mobile-layout:${name}`, metrics });
    }
  };
  const enter = async () => {
    await page.getByRole('textbox', { name: '搜索游戏' }).fill(TITLE);
    await activate(page.getByRole('button', { name: `开始玩${TITLE}`, exact: true }), 'catalog:open');
    await ready();
  };
  const assertClean = async () => { expect(errors).toEqual([]); expect(outside).toEqual([]); expect(failed).toEqual([]); expect((await observe()).lifecycle.problems).toEqual([]); };
  const save = async () => {
    const final = await observe().catch(() => null);
    writeFileSync(info.outputPath('trust-ordinary-inputs-and-observations.json'), JSON.stringify({ mobile, inputs, observations, errors, warnings, outside, failed, final }, null, 2));
    await page.screenshot({ path: info.outputPath('trust-last-viewport.png'), fullPage: false }).catch(() => {});
    if (touch) await touch.detach().catch(() => {});
  };
  return { mobile, frame, inputs, observations, errors, observe, checkpoint, ready, settled, activate, control, copy, press, advance, chapter, population, step, waitRest, stop, range, dragRange, tab, payoff, increasePayoff, screenshot, enter, assertClean, save };
}

test('complete original Trust journey, visible choices, simulation gates, sandbox and lifecycle', async ({ page, baseURL }, info) => {
  // 25 original animated rounds + 21 manual evolution steps + 13 expanded-demo
  // steps + 14 noisy generations. Each awaited gate has its own smaller bound.
  test.setTimeout(720000);
  if (!baseURL) throw Error('The targeted Trust journey needs its configured baseURL.');
  const j = journey(page, info, new URL(baseURL).origin);
  try {
    await page.goto('/');
    // The shared lobby defaults to sound enabled. Use its real mute control
    // before entering, then verify the iframe follows that host preference.
    await j.activate(page.getByRole('button', { name: '静音', exact: true }), 'host:mute-before-enter');
    await j.enter();
    await expect(page.getByLabel('选择关卡', { exact: true })).toHaveCount(0);
    await expect(j.copy('title')).toContainText(TITLE);
    await expect(j.copy('subtitle')).toContainText(/nicky case/i);
    await expect(j.frame.locator('#sound')).toHaveAttribute('sound', 'off');
    await j.activate(j.frame.locator('#sound'), 'sound:on');
    await expect(j.frame.locator('#sound')).toHaveAttribute('sound', 'on');
    await j.activate(j.frame.locator('#sound'), 'sound:off');
    await j.advance('loading_button'); await j.advance('intro_button');

    // Both one-off answers use the actual payoff highlights and explanations.
    await j.advance('btnCooperate');
    await expect(j.copy('topWords')).toContainText(/合作/);
    await j.advance('btnCheat');
    await expect(j.copy('topWords')).toContainText(/欺骗|背叛/);
    await j.checkpoint('both-one-off-payoff-explanations'); await j.advance('btnNext');

    const roundBaseline = (await j.observe()).rounds;
    const opponentRounds = [5, 4, 4, 5, 7], opponents: string[] = [];
    let played = 0;
    for (let opponent = 0; opponent < opponentRounds.length; opponent++) {
      for (let n = 0; n < opponentRounds[opponent]; n++) {
        if (played > 0) {
          await expect(j.copy('info')).toContainText(`第${opponent + 1}/5个对手`, { timeout: ROUND_TIMEOUT });
          if (n === 0) opponents.push(await j.copy('info').innerText());
        }
        await j.press(played === 0 ? 'buttonCheat' : 'buttonCooperate');
        played++;
        await expect.poll(async () => (await j.observe()).rounds, { timeout: ROUND_TIMEOUT }).toBe(roundBaseline + played);
        if (played === 1) {
          opponents.push(await j.copy('info').innerText());
          await j.screenshot('repeated-choice-and-score', j.control('buttonCooperate'));
        }
      }
    }
    expect(played).toBe(25); expect(opponents).toHaveLength(5);
    await expect(j.copy('score2')).toHaveText('24', { timeout: ROUND_TIMEOUT });
    for (const character of ['tft', 'all_d', 'all_c', 'grudge', 'prober']) await expect(j.copy(`char_${character}`)).toContainText(/\S/);
    j.observations.push({ label: 'five-opponents-and-25-earned-choices', opponents, choices: played, score: await j.copy('score2').innerText() });
    await j.advance('next_button');

    // Every tournament pairing is displayed with its ten-round payoff history.
    await j.advance('bet_tft'); await j.advance('button');
    for (let match = 1; match <= 10; match++) {
      await expect(j.copy('text')).toContainText(`第${match}局：`);
      await expect(j.copy('text').locator('.score_small')).toHaveCount(10);
      await expect(j.copy('text')).toContainText('总分：');
      await j.checkpoint(`tournament-pairing-${match}`);
      if (match < 10) await j.press('button');
    }
    await j.advance('button'); await j.screenshot('tournament-winner', j.copy('text')); await j.advance('button');

    await j.advance('button'); await j.advance('bet_tft');
    const manualBaseline = (await j.observe()).steps.reproduce, generations: object[] = [];
    for (let generation = 1; generation <= 7; generation++) {
      await j.step('play', 'step_1'); await j.step('eliminate', 'step_2');
      await expect.poll(async () => (await j.observe()).tournament?.agents.length).toBe(20);
      await j.step('reproduce', 'step_3');
      await expect.poll(async () => (await j.observe()).tournament?.agents.length).toBe(25);
      const state = await j.checkpoint(`manual-generation-${generation}`); generations.push(j.population(state));
    }
    expect((await j.observe()).steps.reproduce - manualBaseline).toBe(7);
    expect(new Set(generations.map(v => JSON.stringify(v))).size).toBeGreaterThan(1);
    await j.screenshot('seven-original-generations', j.copy('text')); await j.advance('button');
    const expandedBaseline = await j.observe();
    await j.press('autoplay');
    await expect(j.control('next')).toBeVisible({ timeout: GATE_TIMEOUT });
    const expanded = await j.checkpoint('expanded-strategy-demo-earned-continue');
    expect(Object.values(expanded.steps).reduce((a, b) => a + b, 0) - Object.values(expandedBaseline.steps).reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(13);
    await j.stop('autoplay'); await j.advance('next'); await j.advance('next');

    // Distrust: ordinary Start/Stop/Reset, then all three first-generation steps.
    await j.press('playButton'); await j.stop('playButton'); await j.press('resetButton'); await j.waitRest();
    for (const phase of ['play', 'eliminate', 'reproduce'] as const) await j.step(phase, 'stepButton');
    const rounds = await j.dragRange('rules/turns', 0.5);
    expect((await j.observe()).rules.turns).toBe(rounds);
    await j.press('playButton'); await expect(j.control('continueButton')).toBeVisible();
    await j.stop('playButton'); await j.advance('continueButton'); await j.advance('next');
    expect(await j.payoff()).toEqual([2, 2]); await j.increasePayoff();
    await expect.poll(j.payoff).toEqual([3, 3]);
    await j.press('resetButton'); expect(await j.payoff()).toEqual([3, 3]);
    expect((await j.observe()).tournament!.agents.every(a => a.coins === 0)).toBe(true);
    await j.press('playButton'); await expect(j.control('continueButton')).toBeVisible();
    await j.stop('playButton'); await j.advance('continueButton'); await j.advance('next');

    // Four real animated prompts introduce the accidental defection.
    for (const [i, label] of ['合作', '合作', '合作', '欺骗'].entries()) {
      await expect(j.control('button')).toHaveAccessibleName(label);
      const count = (await j.observe()).rounds;
      await j.press('button');
      await expect.poll(async () => (await j.observe()).rounds, { timeout: ROUND_TIMEOUT }).toBeGreaterThanOrEqual(count + 1);
      await j.checkpoint(`noise-prompt-${i + 1}`);
    }
    await j.advance('button');
    for (const character of ['tf2t', 'pavlov', 'random']) await expect(j.copy(`char_${character}`)).toContainText(/\S/);
    await j.advance('next_button');
    for (const [scenario, prediction, required] of [['cooperators', 'bet_pavlov', 6], ['defectors', 'bet_tf2t', 8]] as const) {
      await j.advance(prediction);
      const baseline = (await j.observe()).steps.reproduce;
      await expect(j.control('btn_next')).toHaveCount(0);
      await j.press('playButton');
      await expect(j.control('btn_next')).toBeVisible({ timeout: GATE_TIMEOUT });
      const state = await j.checkpoint(`noise-${scenario}-earned-gate`);
      expect(state.steps.reproduce - baseline).toBeGreaterThanOrEqual(required);
      await j.stop('playButton');
      // The random outcome is preserved; only genuine reproduction and the gate
      // are required, never a particular winning population.
      await j.screenshot(`noise-${scenario}-result`, j.copy('text_next'));
      await j.advance('btn_next');
    }
    const noise = await j.dragRange('rules/noise', 0.5); expect((await j.observe()).rules.noise).toBeCloseTo(noise);
    await j.press('playButton'); await expect(j.control('continueButton')).toBeVisible();
    await j.stop('playButton'); await j.advance('continueButton'); await j.advance('button');

    // Every sandbox tab is used at real touch size. Endpoints, proportional
    // redistribution and a later fresh drag exercise the original anchor rules.
    await expect(page.locator('[data-trust-chapter]')).toHaveAttribute('data-trust-chapter', 'sandbox');
    await j.tab('玩家成分');
    const visiblePopulation = () => j.frame.locator(`${j.mobile ? '#mobile-narrative' : '#slideshow'} input[data-message^="sandbox/pop/"]`).evaluateAll(nodes => nodes.map(n => Number((n as HTMLInputElement).value)));
    expect((await visiblePopulation()).reduce((a, b) => a + b, 0)).toBe(25);
    await j.dragRange('sandbox/pop/tft', 1); await expect.poll(visiblePopulation).toEqual([25, 0, 0, 0, 0, 0, 0, 0]);
    await j.dragRange('sandbox/pop/tft', 0);
    await expect.poll(async () => (await visiblePopulation()).reduce((a, b) => a + b, 0)).toBe(25);
    const redistributed = await visiblePopulation();
    expect(redistributed[0]).toBe(0); expect(redistributed.reduce((a, b) => a + b, 0)).toBe(25);
    expect(redistributed.slice(1).filter(n => n > 0)).toHaveLength(7);
    await j.dragRange('sandbox/pop/tft', 0.5);
    const editedPopulation = j.population(await j.observe());
    expect(Object.values(editedPopulation).reduce((a, b) => a + b, 0)).toBe(25);
    await j.screenshot('sandbox-population-top', j.range('sandbox/pop/tft'));
    await j.screenshot('sandbox-population-bottom', j.range('sandbox/pop/random'));
    await j.tab('报酬'); await j.increasePayoff(); await expect.poll(j.payoff).toEqual([3, 3]);
    await j.screenshot('sandbox-payoffs', j.mobile ? j.frame.getByRole('button', { name: '双方合作 增加', exact: true }).first() : j.frame.locator('.incdec[data-payoff="R"]').first());
    await j.press('sandbox_reset_payoffs'); await expect.poll(j.payoff).toEqual([2, 2]);
    await j.tab('规则');
    const turns = await j.dragRange('rules/turns', 0.5), selection = await j.dragRange('rules/evolution', 0.5), sandboxNoise = await j.dragRange('rules/noise', 0.2);
    expect((await j.observe()).rules).toEqual({ turns, selection, noise: sandboxNoise });
    await j.screenshot('sandbox-rules', j.range('rules/evolution'));
    if (j.mobile) {
      await page.setViewportSize({ width: 740, height: 390 });
      await j.dragRange('rules/noise', 1); await j.dragRange('rules/noise', 0.5);
      await j.screenshot('sandbox-rotated-touch-slider', j.range('rules/noise'));
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await j.press('label_reset');
    expect(j.population(await j.observe())).toEqual(editedPopulation);
    await j.step('play', 'label_step'); await j.step('eliminate', 'label_step');
    await expect.poll(async () => (await j.observe()).tournament?.agents.length).toBe(25 - selection);
    await j.step('reproduce', 'label_step'); await j.waitRest();
    expect((await j.observe()).tournament!.agents).toHaveLength(25);
    await j.press('label_start'); await j.stop('label_start');
    const stopped = await j.checkpoint('sandbox-autoplay-stopped');
    await page.waitForTimeout(700); // Wall-clock observation; no virtual-time advance.
    const stillStopped = await j.observe(); expect(stillStopped.steps).toEqual(stopped.steps);
    // Stop halts generation progression. Exact rendered-state freezing is
    // independently checked under host Pause below.
    const stoppedSimulation = (s: Observation) => ({ stage: s.tournament!.stage, autoplay: s.tournament!.autoplay, agents: s.tournament!.agents.map(a => ({ strategy: a.strategy, coins: a.coins })) });
    expect(stoppedSimulation(stillStopped)).toEqual(stoppedSimulation(stopped));
    await j.press('label_reset'); expect(j.population(await j.observe())).toEqual(editedPopulation);
    expect((await j.observe()).tournament!.agents.every(a => a.coins === 0)).toBe(true);

    // Freeze an actively playing tournament, wait for audio suspension to settle,
    // then compare exact state twice. A generous score delta is not sufficient.
    await j.activate(j.frame.locator('#sound'), 'sound:on-before-pause');
    await j.press('label_start');
    await j.activate(page.getByRole('button', { name: '暂停', exact: true }), 'host:pause');
    await expect.poll(async () => (await j.observe()).lifecycle.state).toBe('paused');
    await expect.poll(async () => (await j.observe()).lifecycle.audioContextState).toMatch(/^(suspended|closed)$/);
    await page.waitForTimeout(150);
    const frozen = await j.checkpoint('host-pause-settled');
    await page.waitForTimeout(1200);
    const frozenAgain = await j.observe();
    expect(frozenAgain).toEqual(frozen);
    await j.activate(page.getByRole('button', { name: '继续游戏', exact: true }), 'host:resume');
    await expect.poll(async () => (await j.observe()).lifecycle.state).toBe('running');
    expect((await j.observe()).muted).toBe(false);
    await j.stop('label_start'); await j.activate(j.frame.locator('#sound'), 'sound:off-after-pause');

    await j.advance('button_next');
    await expect(page.locator('[data-trust-complete]')).toHaveAttribute('data-trust-complete', 'false');
    await j.screenshot('conclusion-summary-top', j.copy('text1')); await j.screenshot('conclusion-summary-bottom', j.copy('text8'));
    await j.advance('button'); await j.screenshot('outro-reflection', j.copy('text')); await j.advance('button');
    await expect(j.copy('text2')).toContainText('原创示意插图');
    await expect(j.frame.locator('#slideshow img[src="assets/conclusion/truce.svg"]')).toHaveCount(1);
    await j.screenshot('ending-illustration', j.frame.locator('#slideshow img[src="assets/conclusion/truce.svg"]'));
    await j.screenshot('ending-illustration-and-caption', j.copy('text2'));
    await j.advance('button');
    await expect(page.locator('[data-trust-complete]')).toHaveAttribute('data-trust-complete', 'true');
    await expect(page.locator('[data-trust-chapter]')).toHaveAttribute('data-trust-chapter', 'credits');
    const completed = await j.checkpoint('full-original-journey-complete');
    expect(Number(await page.locator('[data-trust-visited]').getAttribute('data-trust-visited'))).toBe(completed.totalSlides);
    await expect(j.copy('text')).toContainText(/nicky|Nicky/i);
    await j.screenshot('full-credits', j.copy('text'));

    // Chapter shortcuts are deliberately first used AFTER the earned ending.
    await j.chapter('sandbox', /沙盒模式/);
    const previousSlider = await j.range('sandbox/pop/tft').elementHandle();
    if (!previousSlider) throw Error('Missing original slider before chapter interruption.');
    await j.dragRange('sandbox/pop/tft', 0.5, true);
    const oldValue = await previousSlider.inputValue();
    const previousScene = (await j.observe()).lifecycle.scene;
    await j.chapter('conclusion', /结论/); await j.chapter('sandbox', /沙盒模式/);
    expect((await j.observe()).lifecycle.scene).toBeGreaterThan(previousScene);
    expect(await previousSlider.evaluate(el => el.isConnected)).toBe(false);
    expect(Number(await j.range('sandbox/pop/tft').inputValue())).toBe(3);
    await j.dragRange('sandbox/pop/tft', 1);
    expect(await previousSlider.inputValue()).toBe(oldValue); await previousSlider.dispose();

    // Leave a noisy population before its delayed Continue exists, then re-enter
    // through the genuine chapter control and verify the scenario starts fresh.
    await j.chapter('noise', /人人都会/);
    for (let i = 0; i < 4; i++) {
      const before = (await j.observe()).rounds; await j.press('button');
      await expect.poll(async () => (await j.observe()).rounds, { timeout: ROUND_TIMEOUT }).toBeGreaterThanOrEqual(before + 1);
    }
    await j.advance('button'); await j.advance('next_button'); await j.advance('bet_pavlov');
    await expect(j.control('btn_next')).toHaveCount(0); await j.press('playButton');
    await j.chapter('sandbox', /沙盒模式/); await page.waitForTimeout(1000);
    expect((await j.observe()).tournament!.agents).toHaveLength(25);
    await j.chapter('noise', /人人都会/);
    await expect(j.control('button')).toHaveAccessibleName('合作');
    await expect(j.copy('topWords')).toContainText('人无完人');
    await j.chapter('sandbox', /沙盒模式/);

    // Two immediate genuine chapter taps must leave one coherent destination.
    const dot = j.frame.locator('#select').getByRole('button', { name: /结论/ });
    await dot.scrollIntoViewIfNeeded();
    if (j.mobile) { await dot.tap(); await dot.tap(); } else await dot.dblclick();
    j.inputs.push({ action: j.mobile ? 'double-tap' : 'double-click', control: 'chapter:conclusion', at: Date.now() });
    await j.settled(); await expect(page.locator('[data-trust-chapter]')).toHaveAttribute('data-trust-chapter', 'conclusion');
    for (let i = 1; i <= 8; i++) await expect(j.frame.locator(`.textbox[data-trust-id="text${i}"]`)).toHaveCount(1);
    await j.chapter('sandbox', /沙盒模式/);
    await j.activate(j.frame.locator('#sound'), 'sound:on-before-restart'); await j.press('label_start');
    const restarted = await page.locator(FRAME).evaluateHandle((f: HTMLIFrameElement) => f.contentWindow);
    await j.activate(page.getByRole('button', { name: '重来', exact: true }), 'host:restart'); await j.ready();
    await expect.poll(() => restarted.evaluate(w => (w as unknown as { TrustLifecycle: { status: () => Lifecycle } }).TrustLifecycle.status())).toMatchObject({ state: 'disposed', timers: 0, applications: 0, problems: [] });
    await restarted.dispose();
    expect((await j.observe()).slide).toBe(0); expect((await j.observe()).rounds).toBe(0);
    await expect(page.locator('[data-trust-complete]')).toHaveAttribute('data-trust-complete', 'false');
    await j.advance('loading_button'); await j.chapter('sandbox', /沙盒模式/); await j.press('label_start');
    const exited = await page.locator(FRAME).evaluateHandle((f: HTMLIFrameElement) => f.contentWindow);
    await j.activate(page.getByRole('button', { name: '返回游戏大厅', exact: true }), 'host:exit-active-simulation');
    await expect(page.locator(FRAME)).toHaveCount(0);
    await expect.poll(() => exited.evaluate(w => (w as unknown as { TrustLifecycle: { status: () => Lifecycle } }).TrustLifecycle.status())).toMatchObject({ state: 'disposed', timers: 0, applications: 0, problems: [] });
    await exited.dispose(); await j.enter();
    expect((await j.observe()).slide).toBe(0); expect((await j.observe()).rounds).toBe(0);
    await expect(j.frame.locator('#select .dot')).toHaveCount(10);
    await j.screenshot('fresh-after-active-exit', j.control('loading_button'));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await j.assertClean();
  } finally { await j.save(); }
});

test('Trust survives genuine development StrictMode effect replay and repeated active unmounts', async ({ page }, info) => {
  test.setTimeout(100000);
  const port = 4460 + info.workerIndex, base = `http://127.0.0.1:${port}`;
  // The repository entry point must really mount StrictMode; a production
  // preview or a test that merely fires synthetic mount messages is insufficient.
  expect(readFileSync('src/main.tsx', 'utf8')).toMatch(/<(?:(?:React\.)?StrictMode)>/);
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; const log = (chunk: Buffer) => { output = (output + String(chunk)).slice(-20000); };
  server.stdout.on('data', log); server.stderr.on('data', log);
  const j = journey(page, info, base);
  try {
    await expect.poll(async () => { try { return (await fetch(base)).ok; } catch { return false; } }, { timeout: 15000 }).toBe(true);
    await page.goto(base);
    for (let mount = 0; mount < 2; mount++) {
      await j.enter();
      expect((await j.observe()).lifecycle.state).toBe('running');
      await expect(j.control('loading_button')).toHaveCount(1);
      await j.advance('loading_button'); await j.chapter('sandbox', /沙盒模式/);
      await j.press('label_start');
      const old = await page.locator(FRAME).evaluateHandle((f: HTMLIFrameElement) => f.contentWindow);
      await j.activate(page.getByRole('button', { name: '返回游戏大厅', exact: true }), `strictmode:active-unmount-${mount}`);
      await expect(page.locator(FRAME)).toHaveCount(0);
      await expect.poll(() => old.evaluate(w => (w as unknown as { TrustLifecycle: { status: () => Lifecycle } }).TrustLifecycle.status())).toMatchObject({ state: 'disposed', timers: 0, applications: 0, problems: [] });
      await old.dispose();
    }
    await j.enter(); await j.assertClean();
    await j.screenshot('strictmode-fresh-reentry', j.control('loading_button'));
  } finally {
    server.kill('SIGTERM');
    writeFileSync(info.outputPath('trust-strictmode-development-server.json'), JSON.stringify({ output, mode: 'Real Vite development server with the existing React.StrictMode root' }, null, 2));
    await j.save();
  }
});
