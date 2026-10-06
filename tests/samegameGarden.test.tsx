// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { readFileSync } from 'node:fs';
import type { GameProps } from '../src/lib/types';
import SameGameGarden from '../src/games/SameGameGarden';
import { samegameLevels } from '../src/games/samegameLevels';
import { createSameGameState, getSameGameHint, playSameGame, removeSameGameGroup } from '../src/games/samegameLogic';
import { parseSameGameRound, saveSameGameRound, SAMEGAME_RESUME_KEY } from '../src/games/samegameStorage';

const certificates = JSON.parse(readFileSync('docs/samegame/campaign.json', 'utf8')).levels as { id: string; solution: number[] }[];
const cell = (index: number) => document.querySelector<HTMLButtonElement>(`[data-samegame-cell="${index}"]`)!;
const board = () => [...document.querySelectorAll('[data-samegame-cell]')].map(el => Number(el.getAttribute('data-value')));
const defaults = (overrides: Partial<GameProps> = {}): GameProps => ({ level: 0, paused: false, resetToken: 0, hintToken: 0, undoToken: 0, onComplete: vi.fn(), onStatus: vi.fn(), ...overrides });
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Same Game 100-level real DOM campaign', () => {
  samegameLevels.forEach((level, index) => it(`completes ${level.id} using previews and real buttons`, () => {
    const props = defaults({ level: index }); render(<SameGameGarden {...props} />);
    const proof = certificates.find(item => item.id === level.id)!;
    expect(proof).toBeDefined();
    for (const move of proof.solution) {
      const previous = board(); fireEvent.click(cell(move)); expect(board()).toEqual(previous);
      expect(cell(move).getAttribute('aria-pressed')).toBe('true');
      const expected = removeSameGameGroup(previous, level.width, level.height, move);
      fireEvent.click(screen.getByRole('button', { name: /^确认消除/ })); expect(board()).toEqual(expected);
    }
    expect(board().every(value => value === -1)).toBe(true);
    expect(props.onComplete).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-samegame-won]')?.getAttribute('data-samegame-won')).toBe('true');
    expect(cell(0).disabled).toBe(true);
  }));
});

it('previews, cancels, confirms with keyboard, guards modifiers and preserves focus', async () => {
  const user = userEvent.setup(), props = defaults(); render(<SameGameGarden {...props} />);
  const index = certificates[0].solution[0], target = cell(index), original = board();
  target.focus(); expect(document.activeElement).toBe(target);
  for (const flag of ['ctrlKey', 'metaKey', 'altKey']) for (const key of ['Enter', ' ', 'ArrowRight']) {
    fireEvent.keyDown(target, { key, [flag]: true }); fireEvent.click(target, { [flag]: true }); expect(board()).toEqual(original); expect(document.activeElement).toBe(target);
  }
  await user.keyboard('{Enter}'); expect(board()).toEqual(original); expect(target.getAttribute('aria-pressed')).toBe('true');
  await user.click(screen.getByRole('button', { name: '取消选择' })); expect(board()).toEqual(original);
  target.focus(); await user.keyboard(' '); expect(board()).toEqual(original); await user.keyboard(' ');
  expect(board()).not.toEqual(original); expect(document.activeElement).toBe(target);
  await user.keyboard('{ArrowDown}');
  expect(document.activeElement).toBe(cell(Math.min(samegameLevels[0].height - 1, Math.floor(index / samegameLevels[0].width) + 1) * samegameLevels[0].width + index % samegameLevels[0].width));
});

it('freezes a selected preview on pause, consumes paused tokens, undoes and resets', () => {
  const props = defaults({ level: 49 }), view = render(<SameGameGarden {...props} />), move = certificates[49].solution[0];
  fireEvent.click(cell(move)); const initial = board();
  view.rerender(<SameGameGarden {...props} paused hintToken={1} undoToken={1} />);
  expect(cell(move).disabled).toBe(true); fireEvent.click(cell(move)); expect(board()).toEqual(initial);
  expect((screen.getByRole('button', { name: /^确认消除/ }) as HTMLButtonElement).disabled).toBe(true);
  view.rerender(<SameGameGarden {...props} hintToken={1} undoToken={1} />);
  expect(board()).toEqual(initial); fireEvent.click(cell(move)); expect(board()).not.toEqual(initial);
  view.rerender(<SameGameGarden {...props} hintToken={1} undoToken={2} />); expect(board()).toEqual(initial);
  fireEvent.click(cell(move)); fireEvent.click(cell(move)); expect(board()).not.toEqual(initial);
  view.rerender(<SameGameGarden {...props} resetToken={1} hintToken={1} undoToken={2} />); expect(board()).toEqual(initial);
  view.rerender(<SameGameGarden {...props} level={99} resetToken={2} />); expect(board()).toEqual(samegameLevels[99].board);
});

it('uses current-state hints without making the move and locks completion against tokens', () => {
  const props = defaults({ level: 99 }), view = render(<StrictMode><SameGameGarden {...props} /></StrictMode>);
  const first = certificates[99].solution[0]; fireEvent.click(cell(first)); fireEvent.click(cell(first));
  const current = board(), hint = getSameGameHint(samegameLevels[99], current);
  expect(hint.kind).toBe('move'); view.rerender(<StrictMode><SameGameGarden {...props} hintToken={1} /></StrictMode>);
  expect(board()).toEqual(current);
  if (hint.kind === 'move') expect(cell(hint.index).getAttribute('aria-pressed')).toBe('true');
  for (const move of certificates[99].solution.slice(1)) {
    fireEvent.click(screen.getByRole('button', { name: '取消选择' })); fireEvent.click(cell(move)); fireEvent.click(cell(move));
  }
  expect(props.onComplete).toHaveBeenCalledTimes(1); const end = board();
  view.rerender(<StrictMode><SameGameGarden {...props} hintToken={2} undoToken={1} /></StrictMode>);
  expect(board()).toEqual(end); expect(props.onComplete).toHaveBeenCalledTimes(1);
});

it('persists legal history and resumes a high-index round with functional undo', () => {
  const props = defaults({ level: 99 }); let view = render(<SameGameGarden {...props} />);
  const move = certificates[99].solution[0]; fireEvent.click(cell(move)); fireEvent.click(cell(move)); const current = board(); view.unmount();
  view = render(<SameGameGarden {...props} />); expect(board()).toEqual(current);
  view.rerender(<SameGameGarden {...props} undoToken={1} />); expect(board()).toEqual(samegameLevels[99].board);
});

it('rejects forged completion, disconnected or malformed history, foreign ids and huge saves', () => {
  const level = samegameLevels[0], initial = createSameGameState(level), state = playSameGame(initial, level, certificates[0].solution[0]);
  const encode = (value: object) => JSON.stringify({ version: 1, id: level.id, ...value });
  expect(parseSameGameRound(encode(state), level)).toEqual(state);
  for (const raw of ['no json', encode({ board: Array(level.width * level.height).fill(-1), history: [] }), encode({ ...state, id: 'other' }), encode({ ...state, history: [state.board] }), encode({ ...state, history: Array(100).fill(initial.board) }), encode({ ...state, board: [true] })]) expect(parseSameGameRound(raw, level)).toEqual(initial);
});

it('keeps play available when storage is blocked and gives accurate save feedback', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(saveSameGameRound(0, samegameLevels[0], createSameGameState(samegameLevels[0]))).toBe(false);
  render(<SameGameGarden {...defaults()} />); expect(screen.getByText(/暂时无法保存这一局/)).toBeTruthy();
  const move = certificates[0].solution[0]; fireEvent.click(cell(move)); fireEvent.click(cell(move)); expect(board()).not.toEqual(samegameLevels[0].board);
});
