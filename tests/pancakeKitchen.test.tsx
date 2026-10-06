// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { readFileSync } from 'node:fs';
import type { GameProps } from '../src/lib/types';
import { GameShell } from '../src/components/GameShell';
import PancakeKitchen from '../src/games/PancakeKitchen';
import { pancakeLevels } from '../src/games/pancakeLevels';
import { createPancakeState, getPancakeHint, PANCAKE_SAVE_LIMIT, playPancake, type PancakeState } from '../src/games/pancakeLogic';
import { loadPancakeRound, parsePancakeRound, savePancakeRound, PANCAKE_RESUME_KEY } from '../src/games/pancakeStorage';

const certificates = JSON.parse(readFileSync('docs/pancake/campaign.json', 'utf8')).levels as { id: string; solution: number[] }[];
const layer = (count: number) => document.querySelector<HTMLButtonElement>(`[data-pancake-flip="${count}"]`)!;
const stack = () => [...document.querySelectorAll('[data-pancake-slot]')].map(el => Number(el.getAttribute('data-size')));
const moves = () => Number(document.querySelector('[data-pancake-moves]')!.textContent);
const confirm = () => screen.getByRole('button', { name: /^确认翻转/ }) as HTMLButtonElement;
const cancel = () => screen.getByRole('button', { name: '取消选择', exact: true }) as HTMLButtonElement;
const reversePrefix = (values: number[], count: number) => values.map((_, i) => values[i < count ? count - i - 1 : i]);
const defaults = (overrides: Partial<GameProps> = {}): GameProps => ({ level: 0, paused: false, resetToken: 0, hintToken: 0, undoToken: 0, onComplete: vi.fn(), onStatus: vi.fn(), ...overrides });
const clickMove = (count: number) => { fireEvent.click(layer(count)); fireEvent.click(confirm()); };
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Pancake 120-level real DOM campaign', () => {
  pancakeLevels.forEach((level, index) => it(`completes ${level.id} using real preview and confirmation controls`, () => {
    const props = defaults({ level: index }); render(<PancakeKitchen {...props} />);
    const proof = certificates[index];
    expect(proof.id).toBe(level.id);
    expect(stack()).toEqual(level.stack);
    expect(document.querySelectorAll('[data-pancake-flip]')).toHaveLength(level.stack.length - 1);
    expect(document.querySelector('[data-pancake-flip="1"]')).toBeNull();
    expect(confirm().disabled).toBe(true);
    for (const [step, count] of proof.solution.entries()) {
      const previous = stack(), expected = reversePrefix(previous, count);
      fireEvent.click(layer(count));
      expect(stack()).toEqual(previous);
      expect(moves()).toBe(step);
      expect(layer(count).getAttribute('aria-pressed')).toBe('true');
      expect(document.querySelectorAll('[data-in-range="true"]')).toHaveLength(count);
      expect(screen.getByRole('img', { name: `翻转后从上到下：${expected.join('、')}` })).toBeTruthy();
      fireEvent.click(confirm());
      expect(stack()).toEqual(expected);
      expect(moves()).toBe(step + 1);
    }
    expect(stack()).toEqual(Array.from({ length: level.stack.length }, (_, i) => i + 1));
    expect(document.querySelector('[data-pancake-won]')?.getAttribute('data-pancake-won')).toBe('true');
    expect(props.onComplete).toHaveBeenCalledTimes(1);
    expect(confirm().disabled).toBe(true);
    expect(cancel().disabled).toBe(true);
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-pancake-flip]')) expect(button.disabled).toBe(true);
    fireEvent.click(layer(2)); fireEvent.click(confirm());
    expect(moves()).toBe(proof.solution.length);
    expect(props.onComplete).toHaveBeenCalledTimes(1);
  }));
});

for (const index of [0, 59, 119]) it(`level ${index + 1}: native keyboard previews, confirms, cancels and preserves layer identity`, async () => {
  const user = userEvent.setup(), props = defaults({ level: index }); render(<PancakeKitchen {...props} />);
  const original = stack(), count = certificates[index].solution[0], target = layer(count), size = original.length;
  target.focus(); expect(document.activeElement).toBe(target);
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
    for (const key of ['Enter', ' ', 'ArrowUp', 'ArrowDown', 'Home', 'End', 's']) {
      const event = new KeyboardEvent('keydown', { key, [modifier]: true, bubbles: true, cancelable: true });
      fireEvent(target, event);
      expect(event.defaultPrevented).toBe(['Enter', ' '].includes(key));
      expect(document.activeElement).toBe(target);
      expect(stack()).toEqual(original);
      expect(target.getAttribute('aria-pressed')).toBe('false');
    }
    fireEvent.click(target, { [modifier]: true }); expect(stack()).toEqual(original);
    expect(target.getAttribute('aria-pressed')).toBe('false');
  }
  await user.keyboard('{Home}'); expect(document.activeElement).toBe(layer(2));
  await user.keyboard('{ArrowUp}'); expect(document.activeElement).toBe(layer(2));
  await user.keyboard('{End}'); expect(document.activeElement).toBe(layer(size));
  await user.keyboard('{ArrowDown}'); expect(document.activeElement).toBe(layer(size));
  await user.keyboard('{ArrowUp}'); expect(document.activeElement).toBe(layer(size - 1));
  target.focus(); await user.keyboard('{Enter}');
  expect(stack()).toEqual(original); expect(target.getAttribute('aria-pressed')).toBe('true');
  await user.click(cancel()); expect(stack()).toEqual(original); expect(document.activeElement).toBe(target);
  expect(target.getAttribute('aria-pressed')).toBe('false');
  await user.keyboard(' '); expect(stack()).toEqual(original);
  await user.keyboard(' '); expect(stack()).toEqual(reversePrefix(original, count));
  expect(layer(count)).toBe(target);
  if (certificates[index].solution.length > 1) expect(document.activeElement).toBe(target);
  expect(moves()).toBe(1);
});

it('guards modified native activation of both confirmation and cancel controls', async () => {
  const user = userEvent.setup(); render(<PancakeKitchen {...defaults({ level: 2 })} />);
  const original = stack(), count = certificates[2].solution[0]; fireEvent.click(layer(count));
  for (const button of [confirm(), cancel()]) for (const [key, flag] of [['Control', 'ctrlKey'], ['Meta', 'metaKey'], ['Alt', 'altKey']]) {
    button.focus(); expect(document.activeElement).toBe(button);
    await user.keyboard(`{${key}>}{Enter}{/${key}}`);
    await user.keyboard(`{${key}>} {/${key}}`);
    fireEvent.click(button, { [flag]: true });
    expect(stack()).toEqual(original); expect(moves()).toBe(0);
    expect(layer(count).getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(button);
  }
  await user.click(confirm()); expect(stack()).toEqual(reversePrefix(original, count));
});

for (const index of [2, 59, 119]) it(`level ${index + 1}: pause consumes tokens, current-state hint, undo, reset and level change`, () => {
  const props = defaults({ level: index }), view = render(<PancakeKitchen {...props} />), count = certificates[index].solution[0];
  expect(certificates[index].solution.length).toBeGreaterThan(1);
  const original = stack(); fireEvent.click(layer(count));
  view.rerender(<PancakeKitchen {...props} paused hintToken={7} undoToken={9} />);
  expect(layer(count).disabled).toBe(true); expect(confirm().disabled).toBe(true); expect(cancel().disabled).toBe(true);
  fireEvent.click(layer(count)); fireEvent.click(confirm()); fireEvent.click(cancel());
  expect(stack()).toEqual(original); expect(moves()).toBe(0);
  view.rerender(<PancakeKitchen {...props} hintToken={7} undoToken={9} />);
  expect(stack()).toEqual(original); expect(layer(count).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(layer(count)); const current = stack();
  expect(current).toEqual(reversePrefix(original, count)); expect(moves()).toBe(1);
  const hint = getPancakeHint(current); expect(hint.kind).toBe('move');
  view.rerender(<PancakeKitchen {...props} hintToken={11} undoToken={9} />);
  expect(stack()).toEqual(current); expect(moves()).toBe(1);
  if (hint.kind === 'move') {
    expect(layer(hint.count).getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(layer(hint.count));
    expect(screen.getByRole('note').textContent).toBe(hint.reason);
  }
  view.rerender(<PancakeKitchen {...props} hintToken={11} undoToken={13} />);
  expect(stack()).toEqual(original); expect(moves()).toBe(0); expect(confirm().disabled).toBe(true);
  clickMove(count); expect(stack()).toEqual(current);
  view.rerender(<PancakeKitchen {...props} resetToken={8} hintToken={11} undoToken={13} />);
  expect(stack()).toEqual(original); expect(moves()).toBe(0); expect(confirm().disabled).toBe(true);
  const other = index === 119 ? 2 : 119;
  view.rerender(<PancakeKitchen {...props} level={other} resetToken={12} hintToken={11} undoToken={13} />);
  expect(stack()).toEqual(pancakeLevels[other].stack); expect(moves()).toBe(0);
  expect(props.onComplete).not.toHaveBeenCalled();
});

it('StrictMode reports completion only once and consumes terminal hints and undo until a new round', () => {
  const props = defaults({ level: 2 }), view = render(<StrictMode><PancakeKitchen {...props} /></StrictMode>);
  for (const count of certificates[2].solution) clickMove(count);
  const end = stack(); expect(props.onComplete).toHaveBeenCalledTimes(1);
  for (const paused of [false, true, false]) {
    view.rerender(<StrictMode><PancakeKitchen {...props} paused={paused} hintToken={12} undoToken={17} /></StrictMode>);
    fireEvent.click(layer(2)); fireEvent.click(confirm());
    expect(stack()).toEqual(end); expect(moves()).toBe(certificates[2].solution.length);
    expect(props.onComplete).toHaveBeenCalledTimes(1);
  }
  view.rerender(<StrictMode><PancakeKitchen {...props} resetToken={19} hintToken={12} undoToken={17} /></StrictMode>);
  expect(stack()).toEqual(pancakeLevels[2].stack); expect(moves()).toBe(0);
  expect(confirm().disabled).toBe(true);
  for (const count of certificates[2].solution) clickMove(count);
  expect(props.onComplete).toHaveBeenCalledTimes(2);
});

it('allows extra legal flips and still reports a genuine over-target win', () => {
  const props = defaults({ level: 2 }); render(<PancakeKitchen {...props} />);
  clickMove(2); clickMove(2);
  for (const count of certificates[2].solution) clickMove(count);
  expect(moves()).toBe(pancakeLevels[2].minMoves + 2);
  expect(props.onComplete).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('note').textContent).toContain(`开局最少 ${pancakeLevels[2].minMoves} 次`);
});

for (const index of [2, 59, 119]) it(`level ${index + 1}: persists actual play and undo history across remount`, () => {
  const props = defaults({ level: index }); let view = render(<PancakeKitchen {...props} />);
  clickMove(certificates[index].solution[0]); const current = stack();
  expect(props.onComplete).not.toHaveBeenCalled(); view.unmount();
  view = render(<PancakeKitchen {...props} />);
  expect(stack()).toEqual(current); expect(moves()).toBe(1); expect(confirm().disabled).toBe(true);
  view.rerender(<PancakeKitchen {...props} undoToken={5} />);
  expect(stack()).toEqual(pancakeLevels[index].stack); expect(moves()).toBe(0);
  const saved = JSON.parse(localStorage.getItem(`${PANCAKE_RESUME_KEY}.round.${index}`)!);
  expect(saved.id).toBe(pancakeLevels[index].id); expect(saved.history).toEqual([]);
});

it('shell restart remains fresh when removeItem throws but the old saved midgame is readable', async () => {
  const onComplete = vi.fn(), user = userEvent.setup();
  render(<GameShell id="pancake" onBack={vi.fn()} onComplete={onComplete} completed={[]} />);
  await user.selectOptions(screen.getByLabelText('选择关卡', { exact: true }), '2');
  await waitFor(() => expect(stack()).toEqual(pancakeLevels[2].stack));
  await user.click(layer(certificates[2].solution[0])); await user.click(confirm());
  const current = stack(), key = `${PANCAKE_RESUME_KEY}.round.2`;
  expect(current).not.toEqual(pancakeLevels[2].stack);
  expect(JSON.parse(localStorage.getItem(key)!).stack).toEqual(current);
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('remove blocked'); });
  await user.click(screen.getByRole('button', { name: '重来', exact: true }));
  await waitFor(() => expect(stack()).toEqual(pancakeLevels[2].stack));
  expect(remove).toHaveBeenCalledWith(key);
  expect(moves()).toBe(0); expect(confirm().disabled).toBe(true);
  expect(JSON.parse(localStorage.getItem(key)!).stack).toEqual(pancakeLevels[2].stack);
  expect(onComplete).not.toHaveBeenCalled();
});

describe('Pancake storage validates the entire legal chain', () => {
  const index = 2, level = pancakeLevels[index], initial = createPancakeState(level);
  const encode = (value: object) => JSON.stringify({ version: 1, id: level.id, ...value });

  it('accepts witnessed history and a genuine final move, rejecting forged wins and foreign/corrupt saves', () => {
    const current = playPancake(initial, certificates[index].solution[0]);
    let won = initial; for (const count of certificates[index].solution) won = playPancake(won, count);
    expect(parsePancakeRound(encode(current), level)).toEqual(current);
    expect(parsePancakeRound(encode(won), level)).toEqual(won);
    const bad: (string | null)[] = [null, '', 'not JSON', 'null', '[]', 'true',
      encode({ ...current, version: 2 }), encode({ ...current, id: pancakeLevels[3].id }),
      encode({ ...current, moves: -1 }), encode({ ...current, moves: 1.5 }), encode({ ...current, moves: Number.MAX_SAFE_INTEGER + 1 }),
      encode({ ...current, moves: 0 }), encode({ ...current, history: [] }), encode({ ...current, history: [current.stack] }),
      encode({ ...current, history: [initial.stack, current.stack] }),
      encode({ ...current, stack: [1, 1, 3] }), encode({ ...current, stack: [1, 2, 3, 4] }), encode({ ...current, stack: [true, 2, 3] }),
      encode({ ...current, history: [[1, 1, 3]] }),
      encode({ stack: [1, 2, 3], moves: 0, history: [] }),
      encode({ stack: [1, 2, 3], moves: 1, history: [initial.stack] }),
      encode({ stack: [2, 1, 3], moves: won.moves + 1, history: [...won.history, won.stack] }),
      encode({ ...current, padding: 'x'.repeat(200001) })];
    for (const raw of bad) expect(parsePancakeRound(raw, level)).toEqual(initial);
    const parsed = parsePancakeRound(encode(current), level);
    expect(parsed.stack).not.toBe(current.stack); expect(parsed.history[0]).not.toBe(current.history[0]);
  });

  it('does not award completion when a forged sorted stack is loaded into the UI', () => {
    localStorage.setItem(`${PANCAKE_RESUME_KEY}.round.${index}`, encode({ stack: [1, 2, 3], moves: 0, history: [] }));
    const props = defaults({ level: index }); render(<PancakeKitchen {...props} />);
    expect(stack()).toEqual(level.stack); expect(props.onComplete).not.toHaveBeenCalled();
    expect(document.querySelector('[data-pancake-won]')?.getAttribute('data-pancake-won')).toBe('false');
  });

  it('accepts exactly 4096 witnessed unsolved flips and refuses longer saves without overwriting the last good save', () => {
    const alternate = reversePrefix(initial.stack, 2);
    const history = Array.from({ length: PANCAKE_SAVE_LIMIT }, (_, i) => [...(i % 2 ? alternate : initial.stack)]);
    const limit: PancakeState = { stack: [...initial.stack], history, moves: PANCAKE_SAVE_LIMIT };
    expect(PANCAKE_SAVE_LIMIT).toBe(4096);
    expect(parsePancakeRound(encode(limit), level)).toEqual(limit);
    expect(savePancakeRound(index, level, limit)).toBe(true);
    const key = `${PANCAKE_RESUME_KEY}.round.${index}`, previous = localStorage.getItem(key);
    const excess = playPancake(limit, 2);
    expect(excess.moves).toBe(4097); expect(savePancakeRound(index, level, excess)).toBe(false);
    expect(localStorage.getItem(key)).toBe(previous);
    expect(parsePancakeRound(encode(excess), level)).toEqual(initial);
    expect(parsePancakeRound(encode({ ...limit, history: [...history, initial.stack] }), level)).toEqual(initial);
  });

  it('keeps real play and undo available when reading or saving local storage fails', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('read blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota or privacy restriction'); });
    expect(loadPancakeRound(index, level)).toEqual(initial);
    expect(savePancakeRound(index, level, initial)).toBe(false);
    const props = defaults({ level: index }), view = render(<PancakeKitchen {...props} />);
    expect(screen.getByText(/当前这一局暂时无法保存/)).toBeTruthy();
    clickMove(certificates[index].solution[0]); expect(stack()).not.toEqual(level.stack);
    view.rerender(<PancakeKitchen {...props} undoToken={3} />); expect(stack()).toEqual(level.stack);
    expect(props.onComplete).not.toHaveBeenCalled();
  });
});
