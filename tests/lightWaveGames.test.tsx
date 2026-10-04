// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import SpectralFilters from "../src/games/SpectralFilters";
import WaveStudio from "../src/games/WaveStudio";
import {
  getSpectralCertificate,
  spectralFiltersLevels,
} from "../src/games/spectralFiltersLevels";
import {
  applySpectralMove,
  createSpectralState,
  fraction,
  initialSpectralBoard,
  moveSpectralFilter,
  searchSpectralFilters,
  spectralOutput,
  spectralWon,
  undoSpectralFilter,
  validSpectralBoard,
  validSpectralLevel,
  type Fraction,
  type SpectralBoard,
  type SpectralLevel,
} from "../src/games/spectralFiltersLogic";
import {
  getWaveCertificate,
  waveStudioLevels,
} from "../src/games/waveStudioLevels";
import {
  applyWaveMove,
  createWaveSearch,
  createWaveState,
  initialWaveBoard,
  moveWaveOscillator,
  sampleWave,
  undoWaveOscillator,
  validWaveBoard,
  validWaveLevel,
  waveCoefficients,
  waveWon,
  WAVE_SEARCH_CHUNK,
  WAVE_SEARCH_LIMIT,
  type Oscillator,
  type WaveBoard,
  type WaveLevel,
} from "../src/games/waveStudioLogic";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const props = () => ({
  level: 0,
  paused: false,
  resetToken: 0,
  hintToken: 0,
  undoToken: 0,
  onComplete: vi.fn(),
  onStatus: vi.fn(),
});
// Independent optical oracle: unreduced BigInt numerator/denominator arithmetic.
type BigFraction = { n: bigint; d: bigint };
const big = (f: Fraction): BigFraction => ({
  n: BigInt(f[0]),
  d: BigInt(f[1]),
});
function opticalOracle(l: SpectralLevel, board: SpectralBoard): BigFraction[] {
  const sums = Array.from({ length: 3 }, () => ({ n: 0n, d: 1n }));
  l.beams.forEach((beam, b) =>
    beam.forEach((input, c) => {
      let value = big(input);
      for (let s = 0; s < l.slotsPerBeam; s++) {
        const index = board[b * l.slotsPerBeam + s];
        if (index >= 0) {
          const t = big(l.filters[index].transmission[c]);
          value = { n: value.n * t.n, d: value.d * t.d };
        }
      }
      const previous = sums[c];
      sums[c] = {
        n: previous.n * value.d + value.n * previous.d,
        d: previous.d * value.d,
      };
    }),
  );
  return sums;
}
function opticalGoal(l: SpectralLevel, board: SpectralBoard): boolean {
  const used = board.filter((i) => i >= 0);
  return (
    board.length === l.beams.length * l.slotsPerBeam &&
    board.every(
      (i) => i >= -1 && i < l.filters.length && Number.isInteger(i),
    ) &&
    new Set(used).size === used.length &&
    used.reduce((s, i) => s + l.filters[i].cost, 0) <= l.budget &&
    opticalOracle(l, board).every(
      (f, c) => f.n * BigInt(l.target[c][1]) === BigInt(l.target[c][0]) * f.d,
    )
  );
}
function opticalSolutions(l: SpectralLevel): number[][] {
  const winners: number[][] = [];
  const visit = (board: number[], bag: number[], cost: number) => {
    if (board.length === l.beams.length * l.slotsPerBeam) {
      if (opticalGoal(l, board)) winners.push(board);
      return;
    }
    for (const f of [...bag].reverse())
      if (cost + l.filters[f].cost <= l.budget)
        visit(
          [...board, f],
          bag.filter((i) => i !== f),
          cost + l.filters[f].cost,
        );
    visit([...board, -1], bag, cost);
  };
  visit(
    [],
    l.filters.map((_, i) => i),
    0,
  );
  return winners;
}
// Independent waveform oracle evaluates cosine oscillators directly at 64 evenly
// spaced points. This is well above 2*4, so represented harmonics do not alias.
function numericWave(board: WaveBoard, t: number): number {
  return board.reduce(
    (sum, o) =>
      sum +
      o.amplitude *
        Math.cos(2 * Math.PI * o.frequency * t + (o.phase * Math.PI) / 180),
    0,
  );
}
function fourierOracle(board: WaveBoard) {
  const cosine = [0, 0, 0, 0],
    sine = [0, 0, 0, 0];
  for (let f = 1; f <= 4; f++)
    for (let j = 0; j < 64; j++) {
      const angle = (2 * Math.PI * f * j) / 64,
        value = numericWave(board, j / 64);
      cosine[f - 1] += (value * Math.cos(angle)) / 32;
      sine[f - 1] += (value * Math.sin(angle)) / 32;
    }
  return { cosine, sine };
}
function waveOracleGoal(l: WaveLevel, board: WaveBoard) {
  const coefficients = fourierOracle(board);
  return (
    board.filter((o) => o.amplitude !== 0).length === l.activeRequired &&
    board.reduce((s, o) => s + o.amplitude, 0) <= l.budget &&
    coefficients.cosine.every(
      (n, i) => Math.abs(n - l.target.cosine[i]) < 1e-9,
    ) &&
    coefficients.sine.every((n, i) => Math.abs(n - l.target.sine[i]) < 1e-9)
  );
}
// A separate search uses trig-derived per-oscillator coefficients, reverse
// traversal and resource pruning. It never calls production search or phase tables.
function independentWaveSolution(l: WaveLevel): Oscillator[] | null {
  const choices = [...l.frequencies]
    .reverse()
    .flatMap((frequency) =>
      [...l.amplitudes]
        .reverse()
        .flatMap((amplitude) =>
          [...l.phases]
            .reverse()
            .map((phase) => ({ frequency, amplitude, phase })),
        ),
    );
  function visit(board: Oscillator[], cost: number): Oscillator[] | null {
    if (board.length === l.oscillators) {
      if (board.filter((o) => o.amplitude > 0).length !== l.activeRequired)
        return null;
      const c = [0, 0, 0, 0],
        s = [0, 0, 0, 0];
      board.forEach((o) => {
        c[o.frequency - 1] += Math.round(
          o.amplitude * Math.cos((o.phase * Math.PI) / 180),
        );
        s[o.frequency - 1] -= Math.round(
          o.amplitude * Math.sin((o.phase * Math.PI) / 180),
        );
      });
      return c.every((n, i) => n === l.target.cosine[i]) &&
        s.every((n, i) => n === l.target.sine[i])
        ? board
        : null;
    }
    for (const o of choices)
      if (cost + o.amplitude <= l.budget) {
        const found = visit([...board, o], cost + o.amplitude);
        if (found) return found;
      }
    return null;
  }
  return visit([], 0);
}
function finishSearch(
  l: WaveLevel,
  board = initialWaveBoard(l),
  limit = WAVE_SEARCH_LIMIT,
) {
  const search = createWaveSearch(l, board, { limit });
  let result = search.step();
  while (result.status === "searching") result = search.step();
  return result;
}
function spectralSelect(container: HTMLElement, slot: number) {
  return container.querySelector(
    `[data-spectral-slot="${slot}"]`,
  ) as HTMLSelectElement;
}
function waveSelect(
  container: HTMLElement,
  oscillator: number,
  field: keyof Oscillator,
) {
  return container.querySelector(
    `[data-wave-oscillator="${oscillator}"][data-wave-field="${field}"]`,
  ) as HTMLSelectElement;
}
const change = (select: HTMLSelectElement, value: number) =>
  fireEvent.change(select, { target: { value: String(value) } });
function assertModifiers(select: HTMLSelectElement) {
  select.focus();
  expect(document.activeElement).toBe(select);
  const value = select.value;
  for (const key of ["ctrlKey", "metaKey", "altKey"]) {
    const event = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
      [key]: true,
    });
    fireEvent(select, event);
    expect(event.defaultPrevented).toBe(false);
    expect(select.value).toBe(value);
    expect(document.activeElement).toBe(select);
  }
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe("Spectral Filters exact independent model", () => {
  it("certifies 12 independent authored goals and all alternative physical assignments", () => {
    expect(spectralFiltersLevels).toHaveLength(12);
    expect(new Set(spectralFiltersLevels.map((l) => l.id)).size).toBe(12);
    let alternatives = 0;
    spectralFiltersLevels.forEach((l, index) => {
      expect(validSpectralLevel(l)).toBe(true);
      const certificate = getSpectralCertificate(index)!;
      expect(opticalGoal(l, certificate)).toBe(true);
      let state = createSpectralState(l);
      expect(spectralWon(l, state.board)).toBe(false);
      certificate.forEach((filter, slot) => {
        if (filter >= 0) state = moveSpectralFilter(l, state, { slot, filter });
      });
      expect(spectralWon(l, state.board)).toBe(true);
      opticalOracle(l, state.board).forEach((f, c) => {
        const actual = spectralOutput(l, state.board)[c];
        expect(BigInt(actual[0]) * f.d).toBe(f.n * BigInt(actual[1]));
      });
      const solutions = opticalSolutions(l);
      expect(solutions.length).toBeGreaterThan(0);
      for (const solution of solutions) {
        expect(spectralWon(l, solution)).toBe(true);
        if (solution.join() !== certificate.join()) alternatives++;
      }
      expect(searchSpectralFilters(l, initialSpectralBoard(l)).status).toBe(
        "found",
      );
    });
    expect(alternatives).toBeGreaterThan(20);
  });
  it("certificates are defensive copies; corrupted examples cannot change public targets or acceptance", () => {
    const original = getSpectralCertificate(11)! as number[],
      target = JSON.stringify(spectralFiltersLevels[11]);
    original[0] = -1;
    expect(opticalGoal(spectralFiltersLevels[11], original)).toBe(false);
    expect(spectralWon(spectralFiltersLevels[11], original)).toBe(false);
    expect(getSpectralCertificate(11)![0]).toBe(0);
    expect(JSON.stringify(spectralFiltersLevels[11])).toBe(target);
    expect(getSpectralCertificate(-1)).toBeNull();
    expect(getSpectralCertificate(0.5)).toBeNull();
    expect(getSpectralCertificate(12)).toBeNull();
    const poisoned = {
      ...spectralFiltersLevels[0],
      get solution() {
        throw Error("Do not read certificates");
      },
    };
    expect(searchSpectralFilters(poisoned, [-1]).status).toBe("found");
  });
  it("validates physical inventory, costs and invalid actions; won states cannot mutate or undo", () => {
    const l = spectralFiltersLevels[4],
      start = deepFreeze(createSpectralState(l));
    for (const move of [
      { slot: -1, filter: 0 },
      { slot: 2, filter: 0 },
      { slot: 0.5, filter: 0 },
      { slot: 0, filter: 4 },
      { slot: 0, filter: NaN },
      { slot: 0, filter: -1 },
    ])
      expect(moveSpectralFilter(l, start, move)).toBe(start);
    const next = moveSpectralFilter(l, start, { slot: 0, filter: 0 });
    expect(applySpectralMove(l, next.board, { slot: 1, filter: 0 })).toBeNull();
    expect(undoSpectralFilter(l, next).board).toEqual(start.board);
    const won = moveSpectralFilter(l, next, { slot: 1, filter: 1 });
    expect(spectralWon(l, won.board)).toBe(true);
    expect(undoSpectralFilter(l, won)).toBe(won);
    expect(moveSpectralFilter(l, won, { slot: 0, filter: -1 })).toBe(won);
    expect(validSpectralBoard(l, [0, 0])).toBe(false);
    expect(validSpectralBoard(l, [-2, -1])).toBe(false);
    expect(validSpectralLevel({ ...l, slotsPerBeam: 3 })).toBe(false);
    expect(
      applySpectralMove({ ...l, budget: 1 }, [0, -1], { slot: 1, filter: 1 }),
    ).toBeNull();
    expect(fraction(2, 4)).toEqual([1, 2]);
    expect(() => fraction(1, 0)).toThrow();
  });
  it("hints repair actual wrong layouts; reports cap, cancellation and exhausted distinctly", () => {
    const l = spectralFiltersLevels[10];
    let board: SpectralBoard = [1, -1, -1, -1];
    for (let step = 0; step < 9 && !spectralWon(l, board); step++) {
      const hint = searchSpectralFilters(l, board);
      expect(hint.status).toBe("found");
      expect(hint.move).toBeDefined();
      board = applySpectralMove(l, board, hint.move!)!;
      expect(board).not.toBeNull();
    }
    expect(opticalGoal(l, board)).toBe(true);
    expect(
      searchSpectralFilters(l, initialSpectralBoard(l), { limit: 0 }),
    ).toEqual({ status: "budget", checked: 0 });
    expect(
      searchSpectralFilters(l, initialSpectralBoard(l), {
        cancelled: () => true,
      }),
    ).toEqual({ status: "cancelled", checked: 0 });
    expect(searchSpectralFilters(l, [99]).status).toBe("invalid");
    const impossible = {
      ...spectralFiltersLevels[0],
      target: [
        [3, 1],
        [3, 1],
        [3, 1],
      ] as const,
    };
    expect(searchSpectralFilters(impossible, [-1]).status).toBe("exhausted");
  });
});

describe("Wave Studio exact Fourier model", () => {
  it("certifies 12 levels through independent 64-sample Fourier analysis and reverse search", () => {
    expect(waveStudioLevels).toHaveLength(12);
    expect(new Set(waveStudioLevels.map((l) => l.id)).size).toBe(12);
    waveStudioLevels.forEach((l, index) => {
      expect(validWaveLevel(l)).toBe(true);
      const certificate = getWaveCertificate(index)!;
      expect(waveOracleGoal(l, certificate)).toBe(true);
      expect(waveWon(l, certificate)).toBe(true);
      let replay = createWaveState(l);
      certificate.forEach((o, oscillator) => {
        for (const field of ["frequency", "phase", "amplitude"] as const)
          replay = moveWaveOscillator(l, replay, {
            oscillator,
            field,
            value: o[field],
          });
      });
      expect(waveWon(l, replay.board)).toBe(true);
      expect(waveOracleGoal(l, replay.board)).toBe(true);
      const alternative = independentWaveSolution(l);
      expect(alternative).not.toBeNull();
      expect(waveOracleGoal(l, alternative!)).toBe(true);
      expect(waveWon(l, alternative!)).toBe(true);
      const numeric = fourierOracle(certificate),
        exact = waveCoefficients(certificate);
      numeric.cosine.forEach((n, i) =>
        expect(n).toBeCloseTo(exact.cosine[i], 10),
      );
      numeric.sine.forEach((n, i) => expect(n).toBeCloseTo(exact.sine[i], 10));
      for (let sample = 0; sample < 64; sample++)
        expect(sampleWave(exact, sample / 64)).toBeCloseTo(
          numericWave(certificate, sample / 64),
          10,
        );
      const result = finishSearch(l);
      expect(result.status).toBe("found");
      expect(waveOracleGoal(l, result.board!)).toBe(true);
    });
  });
  it("ws-11 requires cancellation in every valid solution, rejecting the old reinforcement shortcut", () => {
    const level = waveStudioLevels[10];
    const shortcut: WaveBoard = [
      { frequency: 2, amplitude: 1, phase: 180 },
      { frequency: 4, amplitude: 1, phase: 270 },
      { frequency: 4, amplitude: 1, phase: 270 },
    ];
    expect(waveWon(level, shortcut)).toBe(false);
    expect(waveOracleGoal(level, shortcut)).toBe(false);
    let count = 0;
    const options = level.frequencies.flatMap((frequency) =>
      level.amplitudes
        .filter((a) => a > 0)
        .flatMap((amplitude) =>
          level.phases.map((phase) => ({ frequency, amplitude, phase })),
        ),
    );
    const visit = (board: Oscillator[], cost: number) => {
      if (board.length < level.oscillators) {
        for (const o of options)
          if (cost + o.amplitude <= level.budget)
            visit([...board, o], cost + o.amplitude);
        return;
      }
      const contributions = board.map((o) => {
        const vector = Array(8).fill(0) as number[];
        vector[o.frequency - 1] = Math.round(
          o.amplitude * Math.cos((o.phase * Math.PI) / 180),
        );
        vector[o.frequency + 3] = -Math.round(
          o.amplitude * Math.sin((o.phase * Math.PI) / 180),
        );
        return vector;
      });
      const sum = Array.from({ length: 8 }, (_, i) =>
        contributions.reduce((total, vector) => total + vector[i], 0),
      );
      if (
        !sum.every(
          (n, i) => n === [...level.target.cosine, ...level.target.sine][i],
        )
      )
        return;
      count++;
      expect(waveWon(level, board)).toBe(true);
      expect(
        sum.some(
          (_, i) =>
            contributions.some((v) => v[i] > 0) &&
            contributions.some((v) => v[i] < 0),
        ),
      ).toBe(true);
      expect(cost).toBeGreaterThan(
        sum.reduce((total, n) => total + Math.abs(n), 0),
      );
    };
    visit([], 0);
    expect(count).toBeGreaterThan(0);
  });
  it("quarter-turn conversion is independently verified at every frequency and amplitude", () => {
    for (let f = 1; f <= 4; f++)
      for (let a = 0; a <= 3; a++)
        for (const phase of [0, 90, 180, 270] as const) {
          const board = [{ frequency: f, amplitude: a, phase }],
            expected = fourierOracle(board),
            actual = waveCoefficients(board);
          expected.cosine.forEach((n, i) =>
            expect(n).toBeCloseTo(actual.cosine[i], 10),
          );
          expected.sine.forEach((n, i) =>
            expect(n).toBeCloseTo(actual.sine[i], 10),
          );
        }
  });
  it("certificates cannot alter goals, solver or accepted alternative oscillator orderings", () => {
    const l = waveStudioLevels[11],
      snapshot = JSON.stringify(l),
      certificate = getWaveCertificate(11)!;
    certificate[0].phase = 180;
    expect(waveWon(l, certificate)).toBe(false);
    expect(waveOracleGoal(l, certificate)).toBe(false);
    expect(getWaveCertificate(11)![0].phase).toBe(0);
    expect(JSON.stringify(l)).toBe(snapshot);
    expect(waveWon(l, [...getWaveCertificate(11)!].reverse())).toBe(true);
    expect(getWaveCertificate(-1)).toBeNull();
    expect(getWaveCertificate(0.1)).toBeNull();
    expect(getWaveCertificate(12)).toBeNull();
    const poisoned = {
      ...waveStudioLevels[0],
      get solution() {
        throw Error("Do not read certificates");
      },
    };
    expect(finishSearch(poisoned).status).toBe("found");
  });
  it("guards illegal edits, supports reversible over-budget attempts and freezes victories", () => {
    const l = waveStudioLevels[11],
      start = deepFreeze(createWaveState(l));
    for (const move of [
      { oscillator: -1, field: "frequency" as const, value: 1 },
      { oscillator: 0, field: "phase" as const, value: 45 },
      { oscillator: 3, field: "amplitude" as const, value: 1 },
      { oscillator: 0.5, field: "amplitude" as const, value: 1 },
      { oscillator: 0, field: "amplitude" as const, value: NaN },
    ])
      expect(moveWaveOscillator(l, start, move)).toBe(start);
    let state = moveWaveOscillator(l, start, {
      oscillator: 0,
      field: "amplitude",
      value: 3,
    });
    state = moveWaveOscillator(l, state, {
      oscillator: 1,
      field: "amplitude",
      value: 3,
    });
    expect(validWaveBoard(l, state.board)).toBe(true);
    expect(waveWon(l, state.board)).toBe(false);
    expect(undoWaveOscillator(l, state).board[1].amplitude).toBe(0);
    const won = { board: getWaveCertificate(11)!, history: [start.board] };
    expect(undoWaveOscillator(l, won)).toBe(won);
    expect(
      moveWaveOscillator(l, won, {
        oscillator: 0,
        field: "amplitude",
        value: 0,
      }),
    ).toBe(won);
    expect(validWaveLevel({ ...l, oscillators: 4 })).toBe(false);
    expect(validWaveBoard(l, [])).toBe(false);
  });
  it("search chunks are bounded and distinguishes exhausted, budget, cancellation and invalid", () => {
    const l = waveStudioLevels[11],
      impossible = {
        ...l,
        target: { cosine: [9, 9, 9, 9], sine: [9, 9, 9, 9] },
      };
    const search = createWaveSearch(impossible, initialWaveBoard(l), {
      limit: 600,
    });
    expect(search.step(100000).checked).toBe(WAVE_SEARCH_CHUNK);
    expect(search.step().checked).toBe(512);
    expect(search.step()).toEqual({ status: "budget", checked: 600 });
    const cancelled = createWaveSearch(l, initialWaveBoard(l));
    cancelled.step(1);
    cancelled.cancel();
    expect(cancelled.step()).toEqual({ status: "cancelled", checked: 1 });
    expect(
      createWaveSearch(l, initialWaveBoard(l), { cancelled: () => true }).step()
        .status,
    ).toBe("cancelled");
    expect(createWaveSearch(l, [], {}).step().status).toBe("invalid");
    const tiny = {
      ...waveStudioLevels[0],
      target: { cosine: [0, 0, 0, 0], sine: [0, 0, 0, 0] },
    };
    expect(finishSearch(tiny).status).toBe("exhausted");
    expect(finishSearch(l, initialWaveBoard(l), 0)).toEqual({
      status: "budget",
      checked: 0,
    });
  });
  it("one-item hints lead from an arbitrary current setting to a valid configuration", () => {
    const l = waveStudioLevels[8];
    let board: WaveBoard = [
      { frequency: 3, amplitude: 2, phase: 180 },
      { frequency: 1, amplitude: 1, phase: 270 },
    ];
    for (let step = 0; step < 10 && !waveWon(l, board); step++) {
      const result = finishSearch(l, board);
      expect(result.status).toBe("found");
      board = applyWaveMove(l, board, result.move!)!;
      expect(board).not.toBeNull();
    }
    expect(waveOracleGoal(l, board)).toBe(true);
  });
});

describe("24 complete DOM journeys with independent solutions", () => {
  spectralFiltersLevels.forEach((l, level) =>
    it(`Spectral ${l.id}: accessible controls, alternate solution and immutable win`, () => {
      const p = { ...props(), level },
        { container, rerender } = render(<SpectralFilters {...p} />);
      const solution = opticalSolutions(l)[0];
      assertModifiers(spectralSelect(container, 0));
      solution.forEach((filter, slot) => {
        if (filter >= 0) change(spectralSelect(container, slot), filter);
      });
      const root = container.querySelector("[data-spectral-game]")!;
      expect(root.getAttribute("data-spectral-won")).toBe("true");
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      const snapshot = root.getAttribute("data-spectral-board");
      fireEvent.click(container.querySelector("[data-spectral-undo]")!);
      rerender(<SpectralFilters {...p} undoToken={77} hintToken={99} />);
      expect(root.getAttribute("data-spectral-board")).toBe(snapshot);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(spectralSelect(container, 0).disabled).toBe(true);
      rerender(
        <SpectralFilters {...p} resetToken={3} undoToken={77} hintToken={99} />,
      );
      expect(
        container
          .querySelector("[data-spectral-won]")!
          .getAttribute("data-spectral-won"),
      ).toBe("false");
    }),
  );
  waveStudioLevels.forEach((l, level) =>
    it(`Wave ${l.id}: numeric controls, independent solution and immutable win`, () => {
      const p = { ...props(), level },
        { container, rerender } = render(<WaveStudio {...p} />);
      const solution = independentWaveSolution(l)!;
      assertModifiers(waveSelect(container, 0, "frequency"));
      solution.forEach((o, i) => {
        change(waveSelect(container, i, "frequency"), o.frequency);
        change(waveSelect(container, i, "phase"), o.phase);
        change(waveSelect(container, i, "amplitude"), o.amplitude);
      });
      const root = container.querySelector("[data-wave-game]")!;
      expect(root.getAttribute("data-wave-won")).toBe("true");
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        waveOracleGoal(l, JSON.parse(root.getAttribute("data-wave-board")!)),
      ).toBe(true);
      const snapshot = root.getAttribute("data-wave-board");
      fireEvent.click(container.querySelector("[data-wave-undo]")!);
      rerender(<WaveStudio {...p} undoToken={33} hintToken={55} />);
      expect(root.getAttribute("data-wave-board")).toBe(snapshot);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(waveSelect(container, 0, "amplitude").disabled).toBe(true);
      rerender(
        <WaveStudio {...p} resetToken={3} undoToken={33} hintToken={55} />,
      );
      expect(
        container
          .querySelector("[data-wave-won]")!
          .getAttribute("data-wave-won"),
      ).toBe("false");
    }),
  );
});

describe("interruption, token consumption and focus lifecycle", () => {
  it("Spectral paused tokens are consumed, undo resumes normally, reset and level change remain fresh", () => {
    const p = { ...props(), level: 3 },
      { container, rerender } = render(<SpectralFilters {...p} />);
    change(spectralSelect(container, 0), 2);
    const before = container
      .querySelector("[data-spectral-game]")!
      .getAttribute("data-spectral-board");
    spectralSelect(container, 0).focus();
    rerender(<SpectralFilters {...p} paused undoToken={4} hintToken={8} />);
    expect(document.activeElement).toBe(
      container.querySelector(".spectral-filters"),
    );
    rerender(<SpectralFilters {...p} undoToken={4} hintToken={8} />);
    expect(
      container
        .querySelector("[data-spectral-game]")!
        .getAttribute("data-spectral-board"),
    ).toBe(before);
    rerender(<SpectralFilters {...p} undoToken={5} hintToken={8} />);
    expect(spectralSelect(container, 0).value).toBe("-1");
    spectralSelect(container, 0).focus();
    rerender(<SpectralFilters {...p} level={4} undoToken={5} hintToken={8} />);
    expect(document.activeElement).toBe(
      container.querySelector(".spectral-filters"),
    );
    expect(
      container
        .querySelector("[data-spectral-won]")!
        .getAttribute("data-spectral-won"),
    ).toBe("false");
  });
  it("Spectral hints reflect the changed board and never steal external Shell focus", () => {
    const p = { ...props(), level: 10 },
      shell = document.createElement("button");
    document.body.append(shell);
    const { container, rerender, unmount } = render(<SpectralFilters {...p} />);
    change(spectralSelect(container, 0), 1);
    shell.focus();
    rerender(<SpectralFilters {...p} hintToken={1} />);
    expect(document.activeElement).toBe(shell);
    expect(container.textContent).toContain("取回当前滤片");
    rerender(<SpectralFilters {...p} paused hintToken={1} />);
    expect(document.activeElement).toBe(shell);
    rerender(<SpectralFilters {...p} resetToken={4} hintToken={1} />);
    expect(document.activeElement).toBe(shell);
    unmount();
    shell.remove();
  });
  it("Wave cancellation preserves focus and eliminates pending searches on pause, edits and unmount", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const p = { ...props(), level: 11 },
      { container, rerender, unmount } = render(<WaveStudio {...p} />);
    rerender(<WaveStudio {...p} hintToken={1} />);
    expect(
      container
        .querySelector("[data-wave-searching]")!
        .getAttribute("data-wave-searching"),
    ).toBe("true");
    act(() => {
      vi.advanceTimersToNextTimer();
    });
    expect(container.textContent).toContain("已检查 256 个设置");
    const cancel = container.querySelector(
      "[data-wave-cancel]",
    ) as HTMLButtonElement;
    cancel.focus();
    fireEvent.click(cancel);
    expect(document.activeElement).toBe(cancel);
    expect(vi.getTimerCount()).toBe(0);
    rerender(<WaveStudio {...p} hintToken={2} />);
    change(waveSelect(container, 0, "frequency"), 3);
    expect(vi.getTimerCount()).toBe(0);
    rerender(<WaveStudio {...p} hintToken={3} />);
    waveSelect(container, 0, "amplitude").focus();
    rerender(<WaveStudio {...p} paused hintToken={4} undoToken={4} />);
    expect(document.activeElement).toBe(
      container.querySelector(".wave-studio"),
    );
    expect(vi.getTimerCount()).toBe(0);
    rerender(<WaveStudio {...p} hintToken={4} undoToken={4} />);
    expect(waveSelect(container, 0, "frequency").value).toBe("3");
    expect(vi.getTimerCount()).toBe(0);
    rerender(<WaveStudio {...p} hintToken={5} undoToken={4} />);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("Wave chunked hints finish, cancelling does not alter settings, reset leaves external focus alone", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const p = { ...props(), level: 3 },
      shell = document.createElement("button");
    document.body.append(shell);
    const { container, rerender, unmount } = render(<WaveStudio {...p} />);
    shell.focus();
    rerender(<WaveStudio {...p} hintToken={7} />);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(container.textContent).toContain("提示：振荡器");
    expect(document.activeElement).toBe(shell);
    const before = container
      .querySelector("[data-wave-game]")!
      .getAttribute("data-wave-board");
    fireEvent.click(container.querySelector("[data-wave-cancel]")!);
    expect(
      container
        .querySelector("[data-wave-game]")!
        .getAttribute("data-wave-board"),
    ).toBe(before);
    rerender(<WaveStudio {...p} resetToken={2} hintToken={7} />);
    expect(document.activeElement).toBe(shell);
    expect(vi.getTimerCount()).toBe(0);
    unmount();
    shell.remove();
  });
  it("Wave local undo works, success moves disabled select focus safely, and StrictMode reports once", () => {
    const p = props(),
      { container, rerender } = render(
        <StrictMode>
          <WaveStudio {...p} />
        </StrictMode>,
      );
    change(waveSelect(container, 0, "frequency"), 2);
    fireEvent.click(container.querySelector("[data-wave-undo]")!);
    expect(waveSelect(container, 0, "frequency").value).toBe("1");
    const amplitude = waveSelect(container, 0, "amplitude");
    amplitude.focus();
    change(amplitude, 1);
    expect(document.activeElement).toBe(
      container.querySelector(".wave-studio"),
    );
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    rerender(
      <StrictMode>
        <WaveStudio {...p} paused hintToken={4} undoToken={4} />
      </StrictMode>,
    );
    rerender(
      <StrictMode>
        <WaveStudio {...p} hintToken={4} undoToken={4} />
      </StrictMode>,
    );
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    rerender(
      <StrictMode>
        <WaveStudio {...p} level={1} hintToken={4} undoToken={4} />
      </StrictMode>,
    );
    expect(waveSelect(container, 0, "amplitude").value).toBe("0");
  });
});
