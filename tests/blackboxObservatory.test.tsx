// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { readFileSync } from 'node:fs';
import type { GameProps } from '../src/lib/types';
import { GameShell } from '../src/components/GameShell';
import BlackboxObservatory from '../src/games/BlackboxObservatory';
import { blackboxLevels } from '../src/games/blackboxLevels';
import { blackboxSignature, createBlackboxState, fireBlackbox, getBlackboxHint, markBlackbox, observedBlackbox, type Probe } from '../src/games/blackboxLogic';
import { BLACKBOX_RESUME_KEY } from '../src/games/blackboxStorage';

type Certificate = { id: string; signature: number[]; probeTrace: Probe[] };
const certificates = JSON.parse(readFileSync('docs/blackbox/campaign.json', 'utf8')).levels as Certificate[];
const defaults = (overrides: Partial<GameProps> = {}): GameProps => ({ level: 0, paused: false, resetToken: 0, hintToken: 0, undoToken: 0, onComplete: vi.fn(), onStatus: vi.fn(), ...overrides });
const cell = (index: number) => document.querySelector<HTMLButtonElement>(`[data-blackbox-cell="${index}"]`)!;
const port = (index: number) => document.querySelector<HTMLButtonElement>(`[data-blackbox-port="${index}"]`)!;
const marks = () => [...document.querySelectorAll('[data-blackbox-cell]')].map(node => Number(node.getAttribute('data-mark')));
const results = () => [...document.querySelectorAll('[data-blackbox-port]')].map(node => node.getAttribute('data-result'));
const shots = () => Number(document.querySelector('[data-blackbox-shots]')!.getAttribute('data-blackbox-shots'));
const verify = () => document.querySelector<HTMLButtonElement>('[data-blackbox-verify]')!;
const stars = () => screen.getByRole('button', { name: /^标星/ }) as HTMLButtonElement;
const blanks = () => screen.getByRole('button', { name: /^标空/ }) as HTMLButtonElement;
const won = () => document.querySelector('[data-blackbox-won]')!.getAttribute('data-blackbox-won');
const saved = (index: number) => JSON.parse(localStorage.getItem(`${BLACKBOX_RESUME_KEY}.round.${index}`)!);
const playProof = (index: number) => {
  for (const probe of certificates[index].probeTrace) fireEvent.click(port(probe.port));
  fireEvent.click(stars());
  for (const atom of blackboxLevels[index].atoms) fireEvent.click(cell(atom));
  fireEvent.click(verify());
};
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Blackbox 84-level real-control campaign', () => {
  blackboxLevels.forEach((level, index) => it(`completes ${level.id} through evidence, marking and validation`, () => {
    const props = defaults({ level: index }); render(<BlackboxObservatory {...props} />);
    const proof = certificates[index]; expect(proof.id).toBe(level.id);
    expect(document.querySelectorAll('[data-blackbox-cell]')).toHaveLength(level.size ** 2);
    expect(document.querySelectorAll('[data-blackbox-port]')).toHaveLength(level.size * 4);
    expect(marks()).toEqual(Array(level.size ** 2).fill(0)); expect(shots()).toBe(0); expect(verify().disabled).toBe(true);
    const evidence: Probe[] = [];
    for (const probe of proof.probeTrace) {
      fireEvent.click(port(probe.port)); evidence.push(probe);
      expect(shots()).toBe(evidence.length);
      for (const learned of observedBlackbox(evidence)) expect(port(learned.port).getAttribute('data-result')).toBe(String(learned.result));
      expect(marks()).toEqual(Array(level.size ** 2).fill(0));
      fireEvent.click(port(probe.port)); expect(shots()).toBe(evidence.length);
      if (probe.result >= 0) { fireEvent.click(port(probe.result)); expect(shots()).toBe(evidence.length); }
    }
    fireEvent.click(stars());
    for (const [placed, atom] of level.atoms.entries()) {
      expect(verify().disabled).toBe(true); fireEvent.click(cell(atom));
      expect(cell(atom).getAttribute('data-mark')).toBe('1');
      expect(verify().disabled).toBe(placed + 1 !== level.atoms.length);
    }
    expect(won()).toBe('false'); expect(props.onComplete).not.toHaveBeenCalled();
    fireEvent.click(verify()); expect(won()).toBe('true'); expect(props.onComplete).toHaveBeenCalledTimes(1);
    expect(blackboxSignature(level.size, marks().flatMap((value, i) => value === 1 ? [i] : []))).toEqual(proof.signature);
    const final = { marks: marks(), results: results(), shots: shots() };
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-blackbox-cell], [data-blackbox-port]')) expect(button.disabled).toBe(true);
    expect(verify().disabled).toBe(true); expect(stars().disabled).toBe(true); expect(blanks().disabled).toBe(true);
    fireEvent.click(cell(0)); fireEvent.click(port(0)); fireEvent.click(verify());
    expect({ marks: marks(), results: results(), shots: shots() }).toEqual(final); expect(props.onComplete).toHaveBeenCalledTimes(1);
  }));
});

for (const index of [0, 39, 83]) it(`${index + 1}: native grid/port keyboard, boundaries and modifier guards`, async () => {
  const user = userEvent.setup(), props = defaults({ level: index }); render(<BlackboxObservatory {...props} />);
  const level = blackboxLevels[index], size = level.size, target = cell(size + 1), clean = marks(); target.focus();
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) for (const key of ['Enter', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']) {
    const event = new KeyboardEvent('keydown', { key, [modifier]: true, bubbles: true, cancelable: true }); fireEvent(target, event);
    expect(event.defaultPrevented).toBe(['Enter', ' '].includes(key)); expect(document.activeElement).toBe(target); expect(marks()).toEqual(clean);
  }
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) { fireEvent.click(target, { [modifier]: true }); expect(marks()).toEqual(clean); }
  await user.keyboard('{Home}'); expect(document.activeElement).toBe(cell(size));
  await user.keyboard('{ArrowUp}'); expect(document.activeElement).toBe(cell(0));
  await user.keyboard('{ArrowLeft}{ArrowUp}'); expect(document.activeElement).toBe(cell(0));
  await user.keyboard('{ArrowRight}{ArrowDown}'); expect(document.activeElement).toBe(cell(size + 1));
  await user.keyboard('{End}'); expect(document.activeElement).toBe(cell(size * 2 - 1));
  cell(size ** 2 - 1).focus();
  await user.keyboard('{ArrowRight}{ArrowDown}'); expect(document.activeElement).toBe(cell(size ** 2 - 1));
  await user.keyboard('{ArrowLeft}{ArrowUp}'); expect(document.activeElement).toBe(cell(size ** 2 - size - 2));
  target.focus(); await user.keyboard('{Enter}'); expect(target.getAttribute('data-mark')).toBe('1');
  await user.keyboard(' '); expect(target.getAttribute('data-mark')).toBe('0');
  await user.click(blanks()); target.focus(); await user.keyboard(' '); expect(target.getAttribute('data-mark')).toBe('-1');
  await user.keyboard('{Enter}'); expect(target.getAttribute('data-mark')).toBe('0');
  const entrance = port(2); entrance.focus();
  for (const modifier of ['Control', 'Meta', 'Alt']) {
    await user.keyboard(`{${modifier}>}{Enter} {/${modifier}}`); expect(shots()).toBe(0); expect(document.activeElement).toBe(entrance);
  }
  await user.tab(); expect(document.activeElement).toBe(port(3));
  entrance.focus(); await user.keyboard('{Enter}'); expect(shots()).toBe(1);
  await user.keyboard(' '); expect(shots()).toBe(1); expect(entrance.getAttribute('data-result')).toBe(String(certificates[index].signature[2]));
});

it('guards native modified activation and modified clicks on mode and validation controls', async () => {
  const user = userEvent.setup(), props = defaults(); render(<BlackboxObservatory {...props} />);
  fireEvent.click(cell(4));
  for (const control of [stars(), blanks(), verify()]) for (const [modifier, flag] of [['Control', 'ctrlKey'], ['Meta', 'metaKey'], ['Alt', 'altKey']]) {
    control.focus(); await user.keyboard(`{${modifier}>}{Enter} {/${modifier}}`); fireEvent.click(control, { [flag]: true });
    expect(won()).toBe('false'); expect(marks()[4]).toBe(1); expect(document.activeElement).toBe(control);
    expect(stars().getAttribute('aria-pressed')).toBe('true');
  }
  expect(props.onComplete).not.toHaveBeenCalled(); fireEvent.click(verify()); expect(props.onComplete).toHaveBeenCalledTimes(1);
});

it('erases repeated marks and undo changes notes only, preserving all measured evidence', () => {
  const props = defaults({ level: 39 }), view = render(<BlackboxObservatory {...props} />);
  const probe = certificates[39].probeTrace[0]; fireEvent.click(port(probe.port)); const measured = results();
  fireEvent.click(cell(0)); expect(marks()[0]).toBe(1); fireEvent.click(cell(0)); expect(marks()[0]).toBe(0);
  fireEvent.click(blanks()); fireEvent.click(cell(0)); expect(marks()[0]).toBe(-1); fireEvent.click(cell(0)); expect(marks()[0]).toBe(0);
  for (const [token, expected] of [[1, -1], [2, 0], [3, 1], [4, 0], [5, 0]]) {
    view.rerender(<BlackboxObservatory {...props} undoToken={token} />); expect(marks()[0]).toBe(expected);
    expect(shots()).toBe(1); expect(results()).toEqual(measured);
  }
});

it('validation reveals one missing conflict, then uses existing evidence without charging another shot', () => {
  const props = defaults(); render(<BlackboxObservatory {...props} />);
  fireEvent.click(cell(0)); expect(verify().disabled).toBe(false); fireEvent.click(verify());
  const expected = certificates[0].signature, guessed = blackboxSignature(3, [0])!;
  const conflict = expected.findIndex((value, i) => value !== guessed[i]);
  expect(port(conflict).getAttribute('data-result')).toBe(String(expected[conflict])); expect(shots()).toBe(1); expect(won()).toBe('false');
  const measured = results(); fireEvent.click(verify()); expect(shots()).toBe(1); expect(results()).toEqual(measured);
  expect(props.onComplete).not.toHaveBeenCalled(); fireEvent.click(cell(0)); fireEvent.click(cell(4)); fireEvent.click(verify());
  expect(won()).toBe('true'); expect(props.onComplete).toHaveBeenCalledTimes(1);
});

for (const index of [0, 39, 83]) it(`${index + 1}: hints advise from current evidence, focus and never play`, () => {
  const props = defaults({ level: index }), view = render(<BlackboxObservatory {...props} />), level = blackboxLevels[index];
  let state = createBlackboxState(level); state = fireBlackbox(level, state, certificates[index].probeTrace[0].port);
  fireEvent.click(port(certificates[index].probeTrace[0].port)); fireEvent.click(cell(0)); state = markBlackbox(state, 0, 1);
  const hint = getBlackboxHint(level.size, level.atoms.length, state), before = { marks: marks(), results: results(), shots: shots() };
  view.rerender(<BlackboxObservatory {...props} hintToken={4} />);
  expect({ marks: marks(), results: results(), shots: shots() }).toEqual(before);
  expect(document.querySelector('[data-blackbox-hint]')!.getAttribute('data-blackbox-hint')).toBe(hint.kind);
  expect(screen.getByRole('note').textContent).toBe(hint.reason);
  if (hint.kind === 'mark') expect(document.activeElement).toBe(cell(hint.cell));
  if (hint.kind === 'probe') expect(document.activeElement).toBe(port(hint.port));
  expect(props.onComplete).not.toHaveBeenCalled();
});

it('pause consumes hint and undo tokens without deferred operations; reset and level change remain fresh', () => {
  const props = defaults({ level: 39 }), view = render(<BlackboxObservatory {...props} />);
  fireEvent.click(port(certificates[39].probeTrace[0].port)); fireEvent.click(cell(0)); const current = { marks: marks(), results: results(), shots: shots() };
  view.rerender(<BlackboxObservatory {...props} paused hintToken={8} undoToken={9} />);
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-blackbox-cell], [data-blackbox-port]')) expect(button.disabled).toBe(true);
  expect(verify().disabled).toBe(true); expect(stars().disabled).toBe(true); expect(blanks().disabled).toBe(true);
  fireEvent.click(cell(0)); fireEvent.click(port(0)); fireEvent.click(verify());
  view.rerender(<BlackboxObservatory {...props} hintToken={8} undoToken={9} />);
  expect({ marks: marks(), results: results(), shots: shots() }).toEqual(current);
  view.rerender(<BlackboxObservatory {...props} hintToken={8} undoToken={10} />); expect(marks()[0]).toBe(0); expect(shots()).toBe(1);
  fireEvent.click(cell(0)); view.rerender(<BlackboxObservatory {...props} resetToken={1} hintToken={8} undoToken={10} />);
  expect(marks()).toEqual(Array(25).fill(0)); expect(shots()).toBe(0);
  view.rerender(<BlackboxObservatory {...props} level={0} resetToken={2} hintToken={8} undoToken={10} />);
  expect(marks()).toEqual(Array(9).fill(0)); expect(shots()).toBe(0); expect(props.onComplete).not.toHaveBeenCalled();
});

it('StrictMode completion is reported once and terminal tokens cannot revive the board', () => {
  const props = defaults(), view = render(<StrictMode><BlackboxObservatory {...props} /></StrictMode>); playProof(0);
  expect(props.onComplete).toHaveBeenCalledTimes(1); const final = { marks: marks(), results: results(), shots: shots() };
  for (const paused of [true, false, true, false]) {
    view.rerender(<StrictMode><BlackboxObservatory {...props} paused={paused} hintToken={5} undoToken={8} /></StrictMode>);
    fireEvent.click(cell(4)); fireEvent.click(port(0)); fireEvent.click(verify());
    expect({ marks: marks(), results: results(), shots: shots() }).toEqual(final); expect(props.onComplete).toHaveBeenCalledTimes(1);
  }
  view.rerender(<StrictMode><BlackboxObservatory {...props} resetToken={2} hintToken={5} undoToken={8} /></StrictMode>);
  expect(marks()).toEqual(Array(9).fill(0)); expect(shots()).toBe(0); playProof(0); expect(props.onComplete).toHaveBeenCalledTimes(2);
});

for (const index of [0, 39, 83]) it(`${index + 1}: real probes and reversible marks survive remount and level switching`, () => {
  const props = defaults({ level: index }); let view = render(<BlackboxObservatory {...props} />);
  fireEvent.click(port(certificates[index].probeTrace[0].port)); fireEvent.click(cell(0)); const current = { marks: marks(), results: results(), shots: shots() };
  view.unmount(); view = render(<BlackboxObservatory {...props} />);
  expect({ marks: marks(), results: results(), shots: shots() }).toEqual(current); expect(saved(index).history).toHaveLength(1);
  view.rerender(<BlackboxObservatory {...props} undoToken={1} />); expect(marks()[0]).toBe(0); expect(shots()).toBe(1);
  fireEvent.click(cell(0)); const other = index === 83 ? 0 : 83;
  view.rerender(<BlackboxObservatory {...props} level={other} resetToken={2} undoToken={1} />); expect(shots()).toBe(0);
  view.rerender(<BlackboxObservatory {...props} resetToken={3} undoToken={1} />);
  expect({ marks: marks(), results: results(), shots: shots() }).toEqual(current); expect(props.onComplete).not.toHaveBeenCalled();
});

it('corrupt, forged completion, illegal observation and broken history saves never render earned wins', () => {
  const level = blackboxLevels[0], initial = createBlackboxState(level), key = `${BLACKBOX_RESUME_KEY}.round.0`;
  for (const value of ['not JSON', 'null', JSON.stringify({ version: 1, id: level.id, ...initial, submitted: true }),
    JSON.stringify({ version: 1, id: level.id, ...initial, marks: [1, ...Array(8).fill(0)], history: [] }),
    JSON.stringify({ version: 1, id: level.id, ...initial, probes: [{ port: 0, result: -1 }] }),
    JSON.stringify({ version: 1, id: level.id, ...initial, history: [{ cell: 0, before: 1, after: 0 }] })]) {
    localStorage.setItem(key, value); const props = defaults(), view = render(<BlackboxObservatory {...props} />);
    expect(marks()).toEqual(initial.marks); expect(shots()).toBe(0); expect(won()).toBe('false'); expect(props.onComplete).not.toHaveBeenCalled(); view.unmount();
  }
});

for (const failure of ['read', 'write', 'both']) it(`${failure} storage failure keeps in-memory play, undo and a real win available`, () => {
  if (failure !== 'write') vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('read blocked'); });
  if (failure !== 'read') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota or privacy restriction'); });
  const props = defaults(), view = render(<BlackboxObservatory {...props} />);
  if (failure !== 'read') expect(screen.getByText(/暂时无法保存/)).toBeTruthy();
  fireEvent.click(port(1)); fireEvent.click(cell(0)); view.rerender(<BlackboxObservatory {...props} undoToken={1} />);
  expect(marks()[0]).toBe(0); expect(shots()).toBe(1); fireEvent.click(cell(4)); fireEvent.click(verify());
  expect(won()).toBe('true'); expect(props.onComplete).toHaveBeenCalledTimes(1);
});

it('shell restart stays fresh when removeItem fails and overwrites the still-readable old round', async () => {
  const user = userEvent.setup(), onComplete = vi.fn(); render(<GameShell id="blackbox" onBack={vi.fn()} onComplete={onComplete} completed={[]} />);
  await waitFor(() => expect(document.querySelectorAll('[data-blackbox-cell]')).toHaveLength(9));
  await user.click(port(1)); await user.click(cell(0)); expect(saved(0).history).toHaveLength(1);
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('remove blocked'); });
  await user.click(screen.getByRole('button', { name: /^重来$/ }));
  await waitFor(() => expect(marks()).toEqual(Array(9).fill(0))); expect(shots()).toBe(0);
  expect(remove).toHaveBeenCalledWith(`${BLACKBOX_RESUME_KEY}.round.0`); expect(saved(0).history).toEqual([]); expect(saved(0).probes).toEqual([]); expect(onComplete).not.toHaveBeenCalled();
});


it('same-batch rapid native clicks preserve order and cannot duplicate a completed round', () => {
  const props = defaults(); render(<BlackboxObservatory {...props} />);
  act(() => { port(0).click(); port(0).click(); port(9).click(); cell(0).click(); cell(0).click(); });
  expect(shots()).toBe(1); expect(marks()).toEqual(Array(9).fill(0)); expect(saved(0).history).toEqual([{ cell: 0, before: 0, after: 1 }, { cell: 0, before: 1, after: 0 }]);
  fireEvent.click(cell(4)); expect(verify().disabled).toBe(false);
  act(() => { verify().click(); verify().click(); cell(4).click(); port(1).click(); });
  expect(won()).toBe('true'); expect(marks()[4]).toBe(1); expect(shots()).toBe(1); expect(props.onComplete).toHaveBeenCalledTimes(1);
});

it('explicit eraser clears either note and does not add history for an already blank cell', () => {
  const props = defaults(), view = render(<BlackboxObservatory {...props} />);
  fireEvent.click(cell(0)); fireEvent.click(blanks()); fireEvent.click(cell(1));
  const erase = screen.getByRole('button', { name: /^擦除$/ }); fireEvent.click(erase);
  fireEvent.click(cell(0)); fireEvent.click(cell(1)); expect(marks()).toEqual(Array(9).fill(0));
  const history = saved(0).history; fireEvent.click(cell(1)); expect(saved(0).history).toEqual(history);
  view.rerender(<BlackboxObservatory {...props} undoToken={1} />); expect(marks()[1]).toBe(-1);
  view.rerender(<BlackboxObservatory {...props} undoToken={2} />); expect(marks()[0]).toBe(1); expect(shots()).toBe(0);
});
