import { expect, test, type Locator } from '@playwright/test';
import inventory from '../docs/grid-garden-level-inventory.json' with {type:'json'};
import { captureErrors, chooseLevel, openGame } from './helpers';

// Authored targets are a checked-in static transcription of upstream levels.js.
// No solution is read from runtime, and no game state or completion is injected.
// Lesson 26 uses the effective !important target from upstream css/style.css;
// the inventory retains its differing original style literal and explanation.
test('Grid Garden: all 28 authored lessons, touch help, interruption and earned course ending', async ({ page }, info) => {
  test.setTimeout(180000);
  const mobile = info.project.name === 'mobile';
  const errors = captureErrors(page);
  const outside: string[] = [];
  const origin = new URL(String(info.project.use.baseURL || 'http://127.0.0.1:4173')).origin;
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) outside.push(request.url());
  });

  expect(inventory.countedLevels).toBe(28);
  expect(inventory.levels).toHaveLength(28);
  expect(inventory.levels.map(lesson => lesson.ordinal)).toEqual(Array.from({ length: 28 }, (_, index) => index + 1));
  await openGame(page, '网格花园');
  const initialHost = await page.evaluate(() => ({
    hash: location.hash,
    lang: document.documentElement.lang,
    generic: ['level', 'answers', 'solved', 'user', 'colorblind'].map(key => localStorage.getItem(key)),
  }));
  let frame = page.frameLocator('iframe[title="网格花园完整课程"]');
  const host = page.locator('[data-grid-garden-ready]');
  const ready = async () => {
    await expect(host).toHaveAttribute('data-grid-garden-ready', 'true');
  };
  const activate = async (locator: Locator) => { if (mobile) await locator.tap(); else await locator.click(); };
  const typeCSS = async (text: string) => {
    const editor = frame.getByRole('textbox', { name: 'CSS 声明', exact: true });
    await activate(editor);
    await editor.press('ControlOrMeta+A');
    await editor.press('Backspace');
    if (text) await editor.pressSequentially(text);
  };
  const completed = () => page.evaluate((): number[] =>
    JSON.parse(localStorage.getItem('playgarden.progress.v2') || '{}').completed?.['grid-garden'] || [],
  );
  const earnedEnding = () => page.evaluate(() =>
    JSON.parse(localStorage.getItem('playgarden.grid-garden.v1.state') || '{}').earnedEnding === true,
  );
  const solved = () => expect(frame.locator('#next')).not.toHaveClass(/disabled/, { timeout: 6000 });
  const expectInstructions = async (index: number) => {
    // Parse the complete original HTML in an inert detached document. This
    // preserves entities and inline text without imposing a minimum clause size.
    const expected = await page.evaluate(html =>
      new DOMParser().parseFromString(html, 'text/html').body.textContent || '',
      inventory.levels[index].instructionsZhCn,
    );
    await expect(frame.locator('#instructions')).toHaveText(expected);
  };
  const choose = async (index: number) => {
    await chooseLevel(page, index);
    frame = page.frameLocator('iframe[title="网格花园完整课程"]');
    await ready();
    await expect(frame.locator('#level-counter .current')).toHaveText(String(index + 1));
    await expectInstructions(index);
    if (index !== 27) await expect(frame.locator('#code')).toBeVisible();
  };
  const noOverflow = async () => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await frame.locator('body').evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  };
  const boardMatches = async (count: number) => {
    await expect(frame.locator('#plants .plant')).toHaveCount(count);
    await expect(frame.locator('#garden .treatment')).toHaveCount(count);
    // Observe rendered rectangles only. All gameplay changes use visible controls.
    const layout = await frame.locator('#board').evaluate(() => {
      const rectangles = (selector: string) => Array.from(document.querySelectorAll(selector), node => {
        const box = node.getBoundingClientRect();
        return {
          kind: node.classList.contains('carrot') ? 'carrot' : 'weed',
          left: box.left, top: box.top, width: box.width, height: box.height,
        };
      });
      return { plants: rectangles('#plants .plant'), treatments: rectangles('#garden .treatment') };
    });
    const unmatched = [...layout.treatments];
    for (const plant of layout.plants) {
      const match = unmatched.findIndex(treatment => treatment.kind === plant.kind &&
        Math.abs(treatment.left - plant.left) <= 1 && Math.abs(treatment.top - plant.top) <= 1 &&
        Math.abs(treatment.width - plant.width) <= 1 && Math.abs(treatment.height - plant.height) <= 1);
      expect(match, `A ${plant.kind} must have exactly one matching water/poison rectangle`).toBeGreaterThanOrEqual(0);
      unmatched.splice(match, 1);
    }
    expect(unmatched).toEqual([]);
  };
  const screenshot = async (name: string) => {
    await noOverflow();
    await page.screenshot({ path: info.outputPath(`grid-garden-${name}.png`), fullPage: true });
  };

  await ready();
  await expectInstructions(0);
  await expect(page.getByLabel('选择关卡', { exact: true }).locator('option')).toHaveCount(28);
  await expect(frame.locator('#plants .plant')).toHaveCount(1);
  await expect(frame.locator('#instructions')).toContainText('grid-column-start');
  expect(await completed()).toEqual([]);

  await typeCSS('grid-column-start: banana;');
  await expect(frame.locator('#result')).toContainText('还没有全部覆盖正确');
  await expect(frame.locator('#next')).toHaveClass(/disabled/);
  expect(await completed()).toEqual([]);
  await typeCSS('background-image: url(https://grid-garden-invalid.example/never.png); position: fixed; inset: 0; } body { display: none;');
  await expect(frame.locator('#result')).toContainText('还没有全部覆盖正确');
  await expect(frame.locator('#next')).toHaveClass(/disabled/);
  await expect(frame.locator('#board')).toBeVisible();
  await expect(frame.locator('#garden')).not.toHaveAttribute('style', /url\(|position\s*:|display\s*:/);
  await expect(frame.locator('#garden .treatment').first()).not.toHaveAttribute('style', /url\(|position\s*:|display\s*:/);
  expect(outside).toEqual([]);
  await activate(frame.locator('#retry-game'));
  await expect(frame.locator('#code')).toHaveValue('');
  await expect(frame.locator('#next')).toHaveClass(/disabled/);

  // Reference help is usable with touch as well as mouse and has a real close control.
  await activate(frame.locator('#instructions code.help').filter({ hasText: /^grid-column-start$/ }).first());
  await expect(frame.locator('#instructions .tooltip')).toBeVisible();
  await screenshot('help-open');
  await activate(frame.getByRole('button', { name: '关闭帮助', exact: true }));
  await expect(frame.locator('#instructions .tooltip')).toHaveCount(0);
  expect(await completed()).toEqual([]);

  // An unfinished final-lesson draft survives leaving and opening the game.
  await choose(27);
  const finalDraft = 'grid-template: 1fr 50px;';
  await typeCSS(finalDraft);
  await expect(frame.locator('#next')).toHaveClass(/disabled/);
  await activate(page.getByRole('button', { name: '返回游戏大厅', exact: true }));
  await openGame(page, '网格花园');
  frame = page.frameLocator('iframe[title="网格花园完整课程"]');
  await ready();
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue('27');
  await expect(frame.locator('#code')).toHaveValue(finalDraft);
  expect(await completed()).toEqual([]);

  // Solving only the final lesson cannot claim the full-course ending.
  await typeCSS(inventory.levels[27].uiSolution);
  await solved();
  await boardMatches(inventory.levels[27].board.length);
  await expect.poll(completed).toEqual([27]);
  await expect(host).toHaveAttribute('data-grid-garden-solved', '1');
  expect(await earnedEnding()).toBe(false);
  await activate(frame.locator('#next'));
  await expect(host).toHaveAttribute('data-grid-garden-phase', 'navigating');
  await expect(frame.locator('#result')).toContainText('已解开 1 / 28 课', { timeout: 6000 });
  await expect(host).toHaveAttribute('data-grid-garden-phase', 'playing');
  await expect(frame.locator('#code')).toBeVisible();
  await expect(frame.locator('#levelsWrapper')).toBeVisible();
  // The menu changes iframe height and causes a layout recheck. A subsequent
  // ordinary edit/check must keep the incomplete-course status as well.
  await typeCSS(inventory.levels[27].uiSolution);
  await solved();
  await expect(frame.locator('#result')).toContainText('已解开 1 / 28 课');
  expect(await earnedEnding()).toBe(false);
  expect(await completed()).toEqual([27]);
  await screenshot('final-only-not-course-clear');

  await choose(0);
  await typeCSS(inventory.levels[0].uiSolution);
  await solved();
  await boardMatches(1);
  await expect.poll(completed).toEqual([0, 27]);
  await screenshot('first-earned');

  // Retry and the host reset clear the current draft without erasing earned lessons.
  await activate(frame.locator('#retry-game'));
  await expect(frame.locator('#code')).toHaveValue('');
  await expect(frame.locator('#next')).toHaveClass(/disabled/);
  expect(await completed()).toEqual([0, 27]);
  const oldSrc = await page.locator('iframe[title="网格花园完整课程"]').getAttribute('src');
  await typeCSS('grid-column-start:');
  await activate(page.getByRole('button', { name: '重来', exact: true }));
  await expect(page.locator('iframe[title="网格花园完整课程"]')).not.toHaveAttribute('src', oldSrc!);
  await ready();
  await expect(frame.locator('#code')).toHaveValue('');
  await expect(frame.locator('#next')).toHaveClass(/disabled/);
  expect(await completed()).toEqual([0, 27]);
  // Equivalent CSS proves acceptance is based on layout, not a target-string match.
  await typeCSS('grid-column: 3;');
  await solved();
  await boardMatches(1);
  expect(await completed()).toEqual([0, 27]);

  // Pause freezes the original 2500 ms transition and resumes its remaining time.
  await activate(frame.locator('#next'));
  await expect(host).toHaveAttribute('data-grid-garden-phase', 'navigating');
  await activate(frame.locator('#pause-game'));
  await expect(frame.locator('#paused-cover')).toBeVisible();
  await page.waitForTimeout(2700);
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue('0');
  await expect(frame.locator('#code')).toBeDisabled();
  expect(await completed()).toEqual([0, 27]);
  const resume = frame.locator('#resume-game');
  const expectResumeInPageViewport = async () => {
    await resume.scrollIntoViewIfNeeded();
    let box = await resume.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull(); expect(viewport).not.toBeNull();
    if (box!.y < 24 || box!.y + box!.height > viewport!.height - 24) {
      // Scroll the surrounding page normally, away from the viewport edge.
      // The gutter is outside the iframe, so the wheel reaches the host page.
      await page.mouse.move(8, viewport!.height / 2);
      await page.mouse.wheel(0, box!.y + box!.height / 2 - viewport!.height / 2);
      await expect.poll(async () => {
        const placed = await resume.boundingBox();
        return !!placed && placed.y >= 24 && placed.y + placed.height <= viewport!.height - 24;
      }).toBe(true);
      box = await resume.boundingBox();
      expect(box).not.toBeNull();
    }
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
  };
  await expectResumeInPageViewport();
  await page.screenshot({ path: info.outputPath(`grid-garden-${page.viewportSize()!.width}px-paused-viewport.png`), fullPage: false });
  if (mobile) {
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: 320, height: viewport.height });
    await expectResumeInPageViewport();
    await page.screenshot({ path: info.outputPath('grid-garden-320px-paused-viewport.png'), fullPage: false });
    await screenshot('320px-paused-resume-reachable');
    await page.setViewportSize(viewport);
    await expectResumeInPageViewport();
  }
  await screenshot('paused-transition');
  await expectResumeInPageViewport();
  await activate(resume);
  await expect(frame.locator('#paused-cover')).toBeHidden();
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue('0');
  // Resuming advances automatically; the player does not click Next again.
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue('1', { timeout: 6000 });
  await ready();
  await expect(frame.locator('#level-counter .current')).toHaveText('2');
  expect(await completed()).toEqual([0, 27]);

  // All remaining authored lessons are played through visible host/editor controls.
  // Course selection avoids waiting 2500 ms after every lesson; Next is tested above.
  const earned = new Set([0, 27]);
  for (const lesson of inventory.levels.slice(1, 27)) {
    await test.step(`Lesson ${lesson.ordinal}: ${lesson.name}`, async () => {
      await choose(lesson.index);
      await expect(frame.locator('#plants .plant')).toHaveCount(lesson.board.length);
      await typeCSS(lesson.uiSolution);
      await solved();
      await boardMatches(lesson.board.length);
      earned.add(lesson.index);
      await expect.poll(completed).toEqual([...earned].sort((a, b) => a - b));
      if ([16, 18, 21, 25].includes(lesson.index)) await screenshot(`lesson-${lesson.ordinal}-earned`);
      if (mobile && lesson.index === 21) {
        await page.setViewportSize({ width: 320, height: 760 });
        await boardMatches(lesson.board.length);
        await screenshot('320px-mixed-units');
        await page.setViewportSize({ width: 390, height: 844 });
      }
    });
  }

  const allLessons = Array.from({ length: 28 }, (_, index) => index);
  await expect.poll(completed).toEqual(allLessons);
  await expect(host).toHaveAttribute('data-grid-garden-solved', '28');
  expect(await earnedEnding()).toBe(false);

  // Leaving during a pending Next disposes its timer and cannot reopen the game.
  await activate(frame.locator('#next'));
  await expect(host).toHaveAttribute('data-grid-garden-phase', 'navigating');
  await activate(page.getByRole('button', { name: '返回游戏大厅', exact: true }));
  await page.waitForTimeout(2700);
  await expect(page.getByRole('textbox', { name: '搜索游戏' })).toBeVisible();
  await expect(page.locator('.game-main[data-game="grid-garden"]')).toHaveCount(0);
  expect(page.frames().some(item => item.url().includes('/grid-garden/'))).toBe(false);
  expect(await completed()).toEqual(allLessons);
  expect(await earnedEnding()).toBe(false);
  await openGame(page, '网格花园');
  frame = page.frameLocator('iframe[title="网格花园完整课程"]');
  await ready();

  await choose(27);
  await solved();
  await boardMatches(2);
  await screenshot('final-earned-layout');
  await activate(frame.locator('#next'));
  await expect(host).toHaveAttribute('data-grid-garden-phase', 'ending', { timeout: 6000 });
  await expect(frame.locator('#ending-progress')).toContainText('28 / 28');
  await expect(frame.locator('#code')).toBeHidden();
  await expect.poll(earnedEnding).toBe(true);
  await screenshot('full-course-earned-ending');
  if (mobile) {
    await page.setViewportSize({ width: 320, height: 760 });
    await screenshot('320px-earned-ending');
    await page.setViewportSize({ width: 390, height: 844 });
  }

  // Persisted course progress and ending survive a real reload.
  await page.reload();
  await openGame(page, '网格花园');
  frame = page.frameLocator('iframe[title="网格花园完整课程"]');
  await ready();
  expect(await completed()).toEqual(allLessons);
  expect(await earnedEnding()).toBe(true);
  await chooseLevel(page, 27);
  await expect(host).toHaveAttribute('data-grid-garden-phase', 'ending', { timeout: 6000 });
  await expect(frame.locator('#ending-progress')).toContainText('28 / 28');

  await activate(page.getByRole('button', { name: '返回游戏大厅', exact: true }));
  expect(page.frames().some(item => item.url().includes('/grid-garden/'))).toBe(false);
  expect(await completed()).toEqual(allLessons);
  expect(await page.evaluate(() => ({
    hash: location.hash,
    lang: document.documentElement.lang,
    generic: ['level', 'answers', 'solved', 'user', 'colorblind'].map(key => localStorage.getItem(key)),
  }))).toEqual(initialHost);
  expect(outside).toEqual([]);
  expect(errors).toEqual([]);
});
