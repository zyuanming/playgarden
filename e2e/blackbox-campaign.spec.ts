import { test, expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openGame, chooseLevel, captureErrors } from './helpers';
import { blackboxChapters, blackboxLevels } from '../src/games/blackboxLevels';
import { createBlackboxState, fireBlackbox, getBlackboxHint, markBlackbox, type Probe } from '../src/games/blackboxLogic';
import { BLACKBOX_RESUME_KEY } from '../src/games/blackboxStorage';
import { STORAGE_KEY } from '../src/lib/progress';

type Certificate = { id: string; signature: number[]; probeTrace: Probe[] };
const certificates = JSON.parse(readFileSync('docs/blackbox/campaign.json', 'utf8')).levels as Certificate[];
const cell = (page: Page, index: number) => page.locator(`[data-blackbox-cell="${index}"]`);
const port = (page: Page, index: number) => page.locator(`[data-blackbox-port="${index}"]`);
const marks = (page: Page) => page.locator('[data-blackbox-cell]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-mark'))));
const results = (page: Page) => page.locator('[data-blackbox-port]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-result')));
const expectMarks = (page: Page, expected: number[]) => expect.poll(() => marks(page)).toEqual(expected);
const verify = (page: Page) => page.locator('[data-blackbox-verify]');
const stars = (page: Page) => page.getByRole('button', { name: /^标星/ });
const blanks = (page: Page) => page.getByRole('button', { name: /^标空/ });
const activate = (control: Locator, touch: boolean) => touch ? control.tap() : control.click();
const checkpoints = new Set<number>(); let chapterStart = 0;
for (const chapter of blackboxChapters) {
  for (const offset of [0, Math.floor((chapter.count - 1) / 2), chapter.count - 1]) checkpoints.add(chapterStart + offset);
  chapterStart += chapter.count;
}
function errorsFor(page: Page) {
  const errors = captureErrors(page);
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => errors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`));
  return errors;
}
async function ready(page: Page, index: number) {
  // A lazy shell alone is not proof that persisted game state has mounted.
  await expect(page.locator('.game-surface .loading')).toHaveCount(0);
  await expect(page.locator('[data-blackbox-cell]')).toHaveCount(blackboxLevels[index].size ** 2);
  await expect(page.locator('[data-blackbox-port]')).toHaveCount(blackboxLevels[index].size * 4);
  await expect(page.getByRole('heading', { name: blackboxLevels[index].title, exact: true })).toBeVisible();
  await expect(page.getByLabel('选择关卡', { exact: true })).toHaveValue(String(index));
  await expect(page.locator('.module-error')).toHaveCount(0);
}
async function enterAfterReload(page: Page, index: number) {
  await page.getByRole('textbox', { name: '搜索游戏' }).fill('星雾探测');
  await page.getByRole('button', { name: '开始玩星雾探测', exact: true }).click(); await ready(page, index);
}
async function checkControlSizes(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const failures = await page.locator('.game-main button, .game-main select, .game-main summary, .game-main a[href]').evaluateAll(nodes => nodes.flatMap(node => {
    const box = node.getBoundingClientRect();
    if (!box.width && !box.height) return [];
    return box.width >= 44 && box.height >= 44 && box.left >= 0 && box.right <= innerWidth ? [] : [{ text: node.getAttribute('aria-label') || node.textContent, width: box.width, height: box.height, left: box.left, right: box.right }];
  })); expect(failures).toEqual([]);
}
async function checkControlReachability(page: Page) {
  await checkControlSizes(page);
  const controls = page.locator('.game-main button:not(:disabled), .game-main select, .game-main summary, .game-main a[href]');
  for (let i = 0; i < await controls.count(); i++) {
    const target = controls.nth(i); if (!await target.isVisible()) continue;
    await target.scrollIntoViewIfNeeded(); await expect(target).toBeInViewport(); await target.click({ trial: true });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function observe(page: Page, probe: Probe, expectedShots: number, touch = false) {
  const before = await marks(page); await activate(port(page, probe.port), touch);
  await expect(port(page, probe.port)).toHaveAttribute('data-result', String(probe.result));
  if (probe.result >= 0) await expect(port(page, probe.result)).toHaveAttribute('data-result', String(probe.port));
  await expect(page.locator('[data-blackbox-shots]')).toHaveAttribute('data-blackbox-shots', String(expectedShots)); expect(await marks(page)).toEqual(before);
}
async function finish(page: Page, index: number, touch = false) {
  await activate(stars(page), touch);
  for (const atom of blackboxLevels[index].atoms) await activate(cell(page, atom), touch);
  await expect(verify(page)).toBeEnabled(); await activate(verify(page), touch);
  await expect(page.locator('[data-blackbox-won]')).toHaveAttribute('data-blackbox-won', 'true');
  await expect(page.locator('.status')).toHaveClass(/success/);
}
async function earnedOnce(page: Page, index: number) {
  await expect.poll(() => page.evaluate(({ key, index }) => {
    const progress = JSON.parse(localStorage.getItem(key) || '{}'); return (progress.completed?.blackbox || []).filter((value: number) => value === index).length;
  }, { key: STORAGE_KEY, index })).toBe(1);
}

// Seven levels per test keeps the full 84-level desktop/touch campaign inside the unchanged 120s budget.
for (let start = 0; start < 84; start += 7) test(`Blackbox genuine observations and completion ${start + 1}–${start + 7}`, async ({ page, isMobile }, info) => {
  const errors = errorsFor(page); await openGame(page, '星雾探测'); await chooseLevel(page, start); await ready(page, start);
  await expect(page.getByLabel('选择关卡', { exact: true }).locator('option')).toHaveCount(84);
  for (let index = start; index < start + 7; index++) {
    const level = blackboxLevels[index], proof = certificates[index]; expect(proof.id).toBe(level.id); await ready(page, index);
    expect(await marks(page)).toEqual(Array(level.size ** 2).fill(0)); await expect(page.locator('[data-blackbox-shots]')).toHaveAttribute('data-blackbox-shots', '0');
    await expect(verify(page)).toBeDisabled(); await checkControlSizes(page);
    if (checkpoints.has(index)) {
      await checkControlReachability(page);
      await page.screenshot({ path: info.outputPath(`blackbox-${index + 1}-start.png`), fullPage: true, animations: 'disabled' });
    }
    for (const [step, probe] of proof.probeTrace.entries()) {
      await observe(page, probe, step + 1, isMobile);
      if (step === 0) {
        await activate(port(page, probe.port), isMobile);
        if (probe.result >= 0) await activate(port(page, probe.result), isMobile);
        await expect(page.locator('[data-blackbox-shots]')).toHaveAttribute('data-blackbox-shots', '1');
      }
      if (checkpoints.has(index) && step === Math.floor((proof.probeTrace.length - 1) / 2)) {
        await checkControlSizes(page);
        await page.screenshot({ path: info.outputPath(`blackbox-${index + 1}-observed.png`), fullPage: true, animations: 'disabled' });
      }
    }
    await finish(page, index, isMobile); await earnedOnce(page, index);
    const advance = page.getByRole('button', { name: index < 83 ? '下一关' : '返回大厅', exact: true }); await expect(advance).toBeFocused();
    expect(await marks(page)).toEqual(Array.from({ length: level.size ** 2 }, (_, i) => level.atoms.includes(i) ? 1 : 0));
    await expect(page.locator('[data-blackbox-cell]:not(:disabled), [data-blackbox-port]:not(:disabled)')).toHaveCount(0);
    await expect(verify(page)).toBeDisabled(); await expect(stars(page)).toBeDisabled(); await expect(blanks(page)).toBeDisabled();
    await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
    const final = { marks: await marks(page), results: await results(page) };
    await activate(page.getByRole('button', { name: '提示', exact: true }), isMobile);
    expect({ marks: await marks(page), results: await results(page) }).toEqual(final); await expect(page.locator('.status')).toHaveClass(/success/); await earnedOnce(page, index);
    if (checkpoints.has(index)) {
      await checkControlReachability(page);
      await page.screenshot({ path: info.outputPath(`blackbox-${index + 1}-won.png`), fullPage: true, animations: 'disabled' });
    }
    await activate(advance, isMobile);
    if (index < 83) { await ready(page, index + 1); await expect(page.getByRole('heading', { name: '星雾探测', exact: true })).toBeFocused(); }
    else await expect(page.getByRole('textbox', { name: '搜索游戏' })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

type KeyRecord = { key: string; modified: boolean; prevented: boolean; keptFocus: boolean };
async function observeKeys(target: Locator) {
  await target.evaluate(node => {
    const records: KeyRecord[] = [];
    (window as unknown as { blackboxKeys: KeyRecord[] }).blackboxKeys = records;
    window.addEventListener('keydown', event => {
      if (event.target === node) records.push({ key: event.key, modified: event.ctrlKey || event.metaKey || event.altKey, prevented: event.defaultPrevented, keptFocus: document.activeElement === node });
    });
  });
}
for (const index of [0, 39, 83]) test(`Blackbox ${index + 1} native keyboard, grid/port navigation and modified controls`, async ({ page }, info) => {
  const errors = errorsFor(page), size = blackboxLevels[index].size;
  await openGame(page, '星雾探测'); await chooseLevel(page, index); await ready(page, index);
  const target = cell(page, size + 1), original = await marks(page); await target.focus(); await observeKeys(target);
  for (const modifier of ['Control', 'Meta', 'Alt']) for (const key of ['Enter', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']) {
    await target.press(`${modifier}+${key}`); await expect(target).toBeFocused(); expect(await marks(page)).toEqual(original);
    const actual = await page.evaluate(wanted => (window as unknown as { blackboxKeys: KeyRecord[] }).blackboxKeys.filter(record => record.modified && record.key === wanted).at(-1), key === 'Space' ? ' ' : key);
    expect(actual).toEqual({ key: key === 'Space' ? ' ' : key, modified: true, prevented: ['Enter', 'Space'].includes(key), keptFocus: true });
  }
  for (const modifier of ['Control', 'Meta', 'Alt'] as const) { await target.click({ modifiers: [modifier] }); expect(await marks(page)).toEqual(original); }
  await target.press('Home'); await expect(cell(page, size)).toBeFocused();
  await page.keyboard.press('ArrowUp'); await expect(cell(page, 0)).toBeFocused();
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowUp'); await expect(cell(page, 0)).toBeFocused();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown'); await expect(target).toBeFocused();
  await page.keyboard.press('End'); await expect(cell(page, size * 2 - 1)).toBeFocused();
  await cell(page, size ** 2 - 1).focus();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown'); await expect(cell(page, size ** 2 - 1)).toBeFocused();
  await target.focus(); await target.press('Enter'); await expect(target).toHaveAttribute('data-mark', '1');
  await target.press('Space'); await expect(target).toHaveAttribute('data-mark', '0');
  await blanks(page).click(); await target.focus(); await target.press('Space'); await expect(target).toHaveAttribute('data-mark', '-1');
  await target.press('Enter'); await expect(target).toHaveAttribute('data-mark', '0'); await stars(page).click();
  const entrance = port(page, 2); await entrance.focus(); await observeKeys(entrance);
  for (const modifier of ['Control', 'Meta', 'Alt']) for (const key of ['Enter', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']) {
    await entrance.press(`${modifier}+${key}`); await expect(entrance).toBeFocused(); await expect(page.locator('[data-blackbox-shots]')).toHaveAttribute('data-blackbox-shots', '0');
    const actual = await page.evaluate(wanted => (window as unknown as { blackboxKeys: KeyRecord[] }).blackboxKeys.filter(record => record.modified && record.key === wanted).at(-1), key === 'Space' ? ' ' : key);
    expect(actual?.prevented).toBe(['Enter', 'Space'].includes(key));
  }
  await entrance.press('Tab'); await expect(port(page, 3)).toBeFocused();
  await entrance.focus(); await entrance.press('Enter'); await expect(page.locator('[data-blackbox-shots]')).toHaveAttribute('data-blackbox-shots', '1');
  await entrance.press('Space'); await expect(page.locator('[data-blackbox-shots]')).toHaveAttribute('data-blackbox-shots', '1');
  for (const atom of blackboxLevels[index].atoms) await cell(page, atom).click();
  for (const control of [stars(page), blanks(page), verify(page)]) for (const modifier of ['Control', 'Meta', 'Alt'] as const) {
    await control.focus(); await control.press(`${modifier}+Enter`); await control.press(`${modifier}+Space`); await control.click({ modifiers: [modifier] });
    await expect(page.locator('[data-blackbox-won]')).toHaveAttribute('data-blackbox-won', 'false'); await expect(stars(page)).toHaveAttribute('aria-pressed', 'true');
  }
  await page.screenshot({ path: info.outputPath(`blackbox-${index + 1}-keyboard.png`), fullPage: true, animations: 'disabled' });
  await verify(page).click(); await expect(page.locator('.status')).toHaveClass(/success/); await earnedOnce(page, index);
  expect(errors).toEqual([]);
});

for (const index of [0, 39, 83]) test(`Blackbox ${index + 1} pause, current hint, undo, reload, restart and switch`, async ({ page, isMobile }, info) => {
  const errors = errorsFor(page), level = blackboxLevels[index], first = certificates[index].probeTrace[0];
  await openGame(page, '星雾探测'); await chooseLevel(page, index); await ready(page, index); await observe(page, first, 1, isMobile);
  await activate(cell(page, 0), isMobile); const current = await marks(page), measured = await results(page);
  for (const modifier of ['Control', 'Meta', 'Alt']) { await cell(page, 0).press(`${modifier}+Escape`); await expect(page.getByRole('button', { name: '暂停', exact: true })).toBeVisible(); }
  await cell(page, 0).press('Escape'); await expect(cell(page, 0)).toBeDisabled(); await expect(port(page, 0)).toBeDisabled();
  await expect(page.getByRole('button', { name: '提示', exact: true })).toBeDisabled(); await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
  await page.screenshot({ path: info.outputPath(`blackbox-${index + 1}-paused.png`), fullPage: true, animations: 'disabled' });
  await activate(page.getByRole('button', { name: '继续游戏', exact: true }), isMobile); expect(await marks(page)).toEqual(current);
  const state = markBlackbox(fireBlackbox(level, createBlackboxState(level), first.port), 0, 1), hint = getBlackboxHint(level.size, level.atoms.length, state);
  await activate(page.getByRole('button', { name: '提示', exact: true }), isMobile);
  await expect(page.locator('[data-blackbox-hint]')).toHaveAttribute('data-blackbox-hint', hint.kind);
  await expect(page.getByRole('note')).toHaveText(hint.reason); expect(await marks(page)).toEqual(current); expect(await results(page)).toEqual(measured);
  if (hint.kind === 'probe') await expect(port(page, hint.port)).toBeFocused();
  if (hint.kind === 'mark') await expect(cell(page, hint.cell)).toBeFocused();
  await page.screenshot({ path: info.outputPath(`blackbox-${index + 1}-hint.png`), fullPage: true, animations: 'disabled' });
  await activate(page.getByRole('button', { name: '撤销', exact: true }), isMobile); await expectMarks(page, Array(level.size ** 2).fill(0)); expect(await results(page)).toEqual(measured);
  await activate(stars(page), isMobile); await activate(cell(page, 0), isMobile); await expectMarks(page, current);
  await page.reload(); await enterAfterReload(page, index); expect(await marks(page)).toEqual(current); expect(await results(page)).toEqual(measured);
  await expect(page.locator('[data-blackbox-shots]')).toHaveAttribute('data-blackbox-shots', '1');
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), `${BLACKBOX_RESUME_KEY}.round.${index}`);
  expect(stored.id).toBe(level.id); expect(stored.history).toEqual([{ cell: 0, before: 0, after: 1 }]); expect(stored.probes).toEqual([{ port: first.port, result: first.result }]);
  await activate(page.getByRole('button', { name: '撤销', exact: true }), isMobile); await expectMarks(page, Array(level.size ** 2).fill(0)); expect(await results(page)).toEqual(measured);
  await activate(cell(page, 0), isMobile); const other = index === 83 ? 0 : 83;
  await chooseLevel(page, other); await ready(page, other); await expectMarks(page, Array(blackboxLevels[other].size ** 2).fill(0));
  await chooseLevel(page, index); await ready(page, index); await expectMarks(page, current); expect(await results(page)).toEqual(measured);
  await activate(page.getByRole('button', { name: '重来', exact: true }), isMobile); await ready(page, index); await expectMarks(page, Array(level.size ** 2).fill(0)); await expect(page.locator('[data-blackbox-shots]')).toHaveAttribute('data-blackbox-shots', '0');
  await page.emulateMedia({ reducedMotion: 'reduce' }); await checkControlReachability(page);
  expect(await cell(page, 0).evaluate(node => { const style = getComputedStyle(node); return style.transitionDuration.split(',').every(value => parseFloat(value) === 0) && style.animationDuration.split(',').every(value => parseFloat(value) === 0); })).toBe(true);
  expect(errors).toEqual([]);
});

test('Blackbox rapid duplicate probes, reversible notes, count gating and failed evidence validation', async ({ page, isMobile }, info) => {
  const errors = errorsFor(page); await openGame(page, '星雾探测'); await ready(page, 0);
  // Real native double-clicks exercise two handlers without injecting board state.
  await port(page, 0).dblclick(); await expect(page.locator('[data-blackbox-shots]')).toHaveAttribute('data-blackbox-shots', '1');
  await activate(port(page, 9), isMobile); await expect(page.locator('[data-blackbox-shots]')).toHaveAttribute('data-blackbox-shots', '1');
  await cell(page, 0).dblclick(); await expect(cell(page, 0)).toHaveAttribute('data-mark', '0');
  await activate(blanks(page), isMobile); await cell(page, 0).dblclick(); await expect(cell(page, 0)).toHaveAttribute('data-mark', '0');
  await activate(stars(page), isMobile); await activate(cell(page, 0), isMobile); await activate(cell(page, 1), isMobile); await expect(verify(page)).toBeDisabled();
  await activate(cell(page, 1), isMobile); await expect(verify(page)).toBeEnabled(); await activate(verify(page), isMobile);
  await expect(page.locator('[data-blackbox-won]')).toHaveAttribute('data-blackbox-won', 'false'); await expect(page.locator('[data-blackbox-shots]')).toHaveAttribute('data-blackbox-shots', '1');
  await checkControlReachability(page);
  await page.screenshot({ path: info.outputPath('blackbox-known-evidence-conflict.png'), fullPage: true, animations: 'disabled' });
  await activate(page.getByRole('button', { name: '重来', exact: true }), isMobile); await ready(page, 0);
  await activate(cell(page, 0), isMobile); await activate(verify(page), isMobile); await expect(page.locator('[data-blackbox-shots]')).toHaveAttribute('data-blackbox-shots', '1');
  await checkControlReachability(page);
  await page.screenshot({ path: info.outputPath('blackbox-new-evidence-conflict.png'), fullPage: true, animations: 'disabled' });
  const evidence = await results(page); await activate(verify(page), isMobile); expect(await results(page)).toEqual(evidence); await expect(page.locator('[data-blackbox-shots]')).toHaveAttribute('data-blackbox-shots', '1');
  await activate(cell(page, 0), isMobile); await activate(cell(page, 4), isMobile); await activate(verify(page), isMobile); await earnedOnce(page, 0); expect(errors).toEqual([]);
});

for (const failure of ['corrupt', 'read', 'write', 'remove']) test(`Blackbox survives ${failure} local storage failure without forged completion`, async ({ page, isMobile }) => {
  const errors = errorsFor(page);
  if (failure === 'corrupt') await page.addInitScript(({ key }) => { localStorage.setItem(key, '{"version":1,"submitted":true,"marks":[1]}'); }, { key: `${BLACKBOX_RESUME_KEY}.round.0` });
  if (failure === 'read' || failure === 'write') await page.addInitScript(({ failure }) => {
    const method = failure === 'read' ? 'getItem' : 'setItem'; Object.defineProperty(Storage.prototype, method, { configurable: true, value() { throw new DOMException('Storage unavailable', 'SecurityError'); } });
  }, { failure });
  await openGame(page, '星雾探测'); await ready(page, 0); await expectMarks(page, Array(9).fill(0)); await expect(page.locator('[data-blackbox-won]')).toHaveAttribute('data-blackbox-won', 'false');
  if (failure === 'write') await expect(page.getByText(/暂时无法保存/)).toBeVisible();
  await activate(port(page, 1), isMobile); await activate(cell(page, 0), isMobile);
  if (failure === 'remove') {
    await page.evaluate(() => { Object.defineProperty(Storage.prototype, 'removeItem', { configurable: true, value() { throw new DOMException('Removal unavailable', 'SecurityError'); } }); });
    await activate(page.getByRole('button', { name: '重来', exact: true }), isMobile); await ready(page, 0); await expectMarks(page, Array(9).fill(0)); await expect(page.locator('[data-blackbox-shots]')).toHaveAttribute('data-blackbox-shots', '0');
    const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), `${BLACKBOX_RESUME_KEY}.round.0`); expect(stored.history).toEqual([]); expect(stored.probes).toEqual([]);
  } else { await activate(page.getByRole('button', { name: '撤销', exact: true }), isMobile); await expectMarks(page, Array(9).fill(0)); await expect(page.locator('[data-blackbox-shots]')).toHaveAttribute('data-blackbox-shots', '1'); }
  await finish(page, 0, isMobile); await expect(page.locator('.status')).toHaveClass(/success/); expect(errors).toEqual([]);
});
