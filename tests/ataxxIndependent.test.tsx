// @vitest-environment jsdom
// Independent controlled-worker integration regression. No engine/search mocking.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import AtaxxGarden from '../src/games/AtaxxGarden';
import { ATAXX_SAVE, moves, replay, start, type Lesson, type Move, type Position } from '../src/games/ataxxLogic';
import type { SearchResult } from '../src/games/ataxxSearch';
import type { GameProps } from '../src/lib/types';

class ControlledWorker {
  static instances: ControlledWorker[] = [];
  onmessage: ((event: { data: { id: number; result: SearchResult } }) => void) | null = null;
  onerror: (() => void) | null = null;
  request!: { id: number; p: Position; history: Move[]; lesson?: Lesson };
  terminated = false;
  constructor() { ControlledWorker.instances.push(this); }
  postMessage(request: ControlledWorker['request']) { this.request = request; }
  terminate() { this.terminated = true; }
  emit(result?: SearchResult) {
    this.onmessage?.({ data: { id: this.request.id, result: result ?? { kind: 'answer', move: moves(this.request.p)[0], value: 1, nodes: 1, depth: 1 } } });
  }
  fail() { this.onerror?.(); }
}
const defaults = (extra: Partial<GameProps> = {}): GameProps => ({
  level: 0, freePlay: true, paused: false, resetToken: 0, hintToken: 0, undoToken: 0,
  onComplete: vi.fn(), onStatus: vi.fn(), ...extra,
});
const root = () => document.querySelector<HTMLElement>('.ataxx-layout')!;
const history = () => JSON.parse(root().dataset.ataxxHistory!) as Move[];
const board = () => root().dataset.ataxxBoard;
const cell = (i: number) => document.querySelector<HTMLButtonElement>(`.ataxx-layout button[data-cell="${i}"]`)!;
const confirm = () => screen.getByRole('button', { name: /^确认移动/ });
const tick = (ms = 240) => act(() => vi.advanceTimersByTime(ms));
function preview(from = 0, to = 8) { fireEvent.click(cell(from)); fireEvent.click(cell(to)); }
function move(from = 0, to = 8) { preview(from, to); fireEvent.click(confirm()); }
function latestWorker() { return ControlledWorker.instances.at(-1)!; }

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  ControlledWorker.instances = [];
  vi.stubGlobal('Worker', ControlledWorker);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

it('preview and cancellation never mutate the board; same-batch repeated confirmation commits once', () => {
  render(<AtaxxGarden {...defaults()} />);
  const initial = board();
  act(() => { fireEvent.click(cell(0)); fireEvent.click(cell(8)); });
  expect(board()).toBe(initial);
  expect(cell(8).getAttribute('aria-pressed')).toBe('true');
  expect(history()).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: '取消选择' }));
  expect(board()).toBe(initial);
  expect((confirm() as HTMLButtonElement).disabled).toBe(true);
  preview();
  act(() => { fireEvent.click(confirm()); fireEvent.click(confirm()); });
  expect(history()).toEqual([{ from: 0, to: 8 }]);
  expect(root().dataset.ataxxTurn).toBe('2');
  tick();
  expect(ControlledWorker.instances).toHaveLength(1);
});

it('pause before the AI timer prevents worker creation; resume schedules one reply', () => {
  const props = defaults(), view = render(<AtaxxGarden {...props} />);
  move(); tick(239);
  view.rerender(<AtaxxGarden {...props} paused />);
  tick(2000);
  expect(ControlledWorker.instances).toHaveLength(0);
  expect(history()).toHaveLength(1);
  view.rerender(<AtaxxGarden {...props} />);
  tick();
  expect(ControlledWorker.instances).toHaveLength(1);
  act(() => latestWorker().emit());
  expect(history()).toHaveLength(2);
});

it('pause terminates an active worker, rejects late results, and resume starts a fresh task', () => {
  const props = defaults(), view = render(<AtaxxGarden {...props} />);
  move(); tick();
  const old = latestWorker();
  view.rerender(<AtaxxGarden {...props} paused />);
  expect(old.terminated).toBe(true);
  act(() => old.emit());
  expect(history()).toHaveLength(1);
  view.rerender(<AtaxxGarden {...props} />);
  tick();
  expect(ControlledWorker.instances).toHaveLength(2);
  const next = latestWorker();
  act(() => { old.emit(); next.emit(); next.emit(); });
  expect(history()).toHaveLength(2);
  expect(next.terminated).toBe(true);
});

it('visibility change cancels an active worker and resumes with one current-position reply', () => {
  render(<AtaxxGarden {...defaults()} />);
  move(); tick(); const old = latestWorker();
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  fireEvent(document, new Event('visibilitychange'));
  expect(old.terminated).toBe(true);
  act(() => old.emit());
  expect(history()).toHaveLength(1);
  tick(2000);
  expect(ControlledWorker.instances).toHaveLength(1);
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  fireEvent(document, new Event('visibilitychange')); tick();
  act(() => latestWorker().emit());
  expect(history()).toHaveLength(2);
});

it('undo while AI is pending rejects its result; undo after its reply removes the whole human turn', () => {
  const props = defaults(), view = render(<AtaxxGarden {...props} />);
  const initial = board(); move(); tick(); const old = latestWorker();
  view.rerender(<AtaxxGarden {...props} undoToken={1} />);
  expect(board()).toBe(initial); expect(history()).toHaveLength(0); expect(old.terminated).toBe(true);
  act(() => old.emit()); expect(history()).toHaveLength(0);
  move(); tick(); act(() => latestWorker().emit()); expect(history()).toHaveLength(2);
  view.rerender(<AtaxxGarden {...props} undoToken={2} />);
  expect(board()).toBe(initial); expect(history()).toHaveLength(0);
});

it('restart and mode changes reject old workers; returning to free play restores only the saved legal actions', () => {
  const props = defaults(), view = render(<AtaxxGarden {...props} />);
  const initial = board(); move(); tick(); const beforeRestart = latestWorker();
  view.rerender(<AtaxxGarden {...props} resetToken={1} />);
  expect(history()).toHaveLength(0); expect(board()).toBe(initial); expect(beforeRestart.terminated).toBe(true);
  act(() => beforeRestart.emit()); expect(history()).toHaveLength(0);
  move(); tick(); const beforeMode = latestWorker();
  view.rerender(<AtaxxGarden {...props} resetToken={1} freePlay={false} />);
  expect(root().dataset.ataxxId).toBe('ataxx-01'); expect(history()).toHaveLength(0);
  expect(beforeMode.terminated).toBe(true); act(() => beforeMode.emit()); expect(history()).toHaveLength(0);
  view.rerender(<AtaxxGarden {...props} resetToken={1} />);
  expect(root().dataset.ataxxId).toBe('free'); expect(history()).toHaveLength(1);
  tick(); act(() => latestWorker().emit()); expect(history()).toHaveLength(2);
});

it('strict mode creates one effective task; unmount terminates it and late output is inert', () => {
  const props = defaults(), view = render(<StrictMode><AtaxxGarden {...props} /></StrictMode>);
  move(); tick(); expect(ControlledWorker.instances).toHaveLength(1);
  const worker = latestWorker(); view.unmount(); expect(worker.terminated).toBe(true);
  act(() => worker.emit()); expect(props.onComplete).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});

it.each(['error', 'watchdog'] as const)('worker %s uses a legal fallback once and ignores any later reply', (kind) => {
  render(<AtaxxGarden {...defaults()} />);
  move(); tick(); const worker = latestWorker();
  if (kind === 'error') act(() => worker.fail()); else tick(1600);
  const accepted = history(); expect(accepted).toHaveLength(2);
  expect(replay(start(), accepted)).not.toBeNull(); expect(worker.terminated).toBe(true);
  expect(screen.getByText(/本次使用本地备用分析/)).toBeTruthy();
  act(() => worker.emit()); expect(history()).toEqual(accepted);
});

it('an illegal worker response cannot mutate the game and exposes a recoverable error', () => {
  render(<AtaxxGarden {...defaults()} />); move(); tick();
  const worker = latestWorker(), snapshot = board();
  act(() => worker.emit({ kind: 'answer', move: { from: -1, to: 99 }, value: 1, nodes: 1, depth: 1 }));
  expect(history()).toHaveLength(1); expect(board()).toBe(snapshot); expect(worker.terminated).toBe(true);
  expect(screen.getByText(/电脑未能给出合法移动/)).toBeTruthy();
});

it('a blocked Worker constructor also uses the bounded legal local fallback', () => {
  vi.stubGlobal('Worker', class { constructor() { throw new Error('Worker unavailable'); } });
  render(<AtaxxGarden {...defaults()} />); move(); tick();
  expect(history()).toHaveLength(2); expect(replay(start(), history())).not.toBeNull();
  expect(screen.getByText(/本次使用本地备用分析/)).toBeTruthy();
});

it('budget-exhausted hints are read-only and never claim the position is unsolvable', () => {
  const props = defaults({ freePlay: false }), view = render(<AtaxxGarden {...props} />);
  const initial = board(); view.rerender(<AtaxxGarden {...props} hintToken={1} />); tick(0);
  act(() => latestWorker().emit({ kind: 'budget', nodes: 40001 }));
  expect(board()).toBe(initial); expect(history()).toHaveLength(0);
  expect(screen.getByText(/分析达到预算.*这不表示无解/)).toBeTruthy();
  expect((confirm() as HTMLButtonElement).disabled).toBe(true); expect(props.onComplete).not.toHaveBeenCalled();
});

it('hint preview needs explicit confirmation and cancelled hints must be requested again after pause', () => {
  const props = defaults({ freePlay: false }), view = render(<AtaxxGarden {...props} />);
  view.rerender(<AtaxxGarden {...props} hintToken={1} />); tick(0); const old = latestWorker();
  view.rerender(<AtaxxGarden {...props} hintToken={1} paused />);
  expect(old.terminated).toBe(true); act(() => old.emit()); expect(history()).toHaveLength(0);
  view.rerender(<AtaxxGarden {...props} hintToken={1} />); tick(2000);
  expect(ControlledWorker.instances).toHaveLength(1);
  view.rerender(<AtaxxGarden {...props} hintToken={2} />); tick(0);
  act(() => latestWorker().emit({ kind: 'answer', move: { from: 0, to: 1 }, value: 1, nodes: 1, depth: 1 }));
  expect(history()).toHaveLength(0); expect((confirm() as HTMLButtonElement).disabled).toBe(false);
  expect(document.activeElement).toBe(cell(1)); fireEvent.click(confirm());
  expect(root().dataset.ataxxPhase).toBe('success'); expect(props.onComplete).toHaveBeenCalledTimes(1);
  view.rerender(<AtaxxGarden {...props} hintToken={3} undoToken={1} />);
  expect(history()).toHaveLength(1); expect(props.onComplete).toHaveBeenCalledTimes(1);
});

it('malformed stored snapshots reset; denied storage still allows legal play', () => {
  localStorage.setItem(`${ATAXX_SAVE}.round.free`, JSON.stringify({ id: 'free', history: [{ from: 0, to: 48 }] }));
  const props = defaults(), view = render(<AtaxxGarden {...props} />);
  expect(history()).toHaveLength(0); expect(board()).toBe(start().board.join(',')); view.unmount();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
  render(<AtaxxGarden {...props} freshStart />);
  expect(screen.getByText(/当前无法保存/)).toBeTruthy(); move(); expect(history()).toHaveLength(1);
});
