// SPDX-License-Identifier: MIT
export type WavePhase = 0 | 90 | 180 | 270;
export type Oscillator = {
  frequency: number;
  amplitude: number;
  phase: WavePhase;
};
export type WaveCoefficients = {
  cosine: readonly number[];
  sine: readonly number[];
};
export type WaveLevel = {
  id: string;
  title: string;
  lesson: string;
  oscillators: number;
  frequencies: readonly number[];
  amplitudes: readonly number[];
  phases: readonly WavePhase[];
  target: WaveCoefficients;
  activeRequired: number;
  budget: number;
};
export type WaveBoard = readonly Oscillator[];
export type WaveState = { board: WaveBoard; history: readonly WaveBoard[] };
export type WaveMove = {
  oscillator: number;
  field: keyof Oscillator;
  value: number;
};
export const WAVE_SEARCH_LIMIT = 262144;
export const WAVE_SEARCH_CHUNK = 256;
export function validWaveLevel(l: WaveLevel): boolean {
  const ints = (v: readonly number[], min: number, max: number) =>
    v.length > 0 &&
    new Set(v).size === v.length &&
    v.every((n) => Number.isInteger(n) && n >= min && n <= max);
  return (
    Number.isInteger(l.oscillators) &&
    l.oscillators >= 1 &&
    l.oscillators <= 3 &&
    ints(l.frequencies, 1, 4) &&
    ints(l.amplitudes, 0, 3) &&
    l.amplitudes.includes(0) &&
    l.phases.length > 0 &&
    new Set(l.phases).size === l.phases.length &&
    l.phases.every((p) => [0, 90, 180, 270].includes(p)) &&
    [l.target.cosine, l.target.sine].every(
      (a) =>
        a.length === 4 &&
        a.every((n) => Number.isInteger(n) && Math.abs(n) <= 9),
    ) &&
    Number.isInteger(l.activeRequired) &&
    l.activeRequired >= 1 &&
    l.activeRequired <= l.oscillators &&
    Number.isInteger(l.budget) &&
    l.budget >= 1 &&
    l.budget <= 9
  );
}
export const initialWaveBoard = (l: WaveLevel): WaveBoard =>
  Array.from({ length: l.oscillators }, () => ({
    frequency: l.frequencies[0],
    amplitude: 0,
    phase: l.phases[0],
  }));
export const createWaveState = (l: WaveLevel): WaveState => ({
  board: initialWaveBoard(l),
  history: [],
});
export function validWaveBoard(l: WaveLevel, board: WaveBoard): boolean {
  return (
    board.length === l.oscillators &&
    board.every(
      (o) =>
        l.frequencies.includes(o.frequency) &&
        l.amplitudes.includes(o.amplitude) &&
        l.phases.includes(o.phase),
    )
  );
}
export function waveCoefficients(board: WaveBoard): WaveCoefficients {
  const cosine = [0, 0, 0, 0],
    sine = [0, 0, 0, 0];
  for (const o of board) {
    if (o.phase === 0) cosine[o.frequency - 1] += o.amplitude;
    else if (o.phase === 180) cosine[o.frequency - 1] -= o.amplitude;
    else if (o.phase === 90) sine[o.frequency - 1] -= o.amplitude;
    else if (o.phase === 270) sine[o.frequency - 1] += o.amplitude;
  }
  return { cosine, sine };
}
export const waveCost = (board: WaveBoard) =>
  board.reduce((s, o) => s + o.amplitude, 0);
export function waveWon(l: WaveLevel, board: WaveBoard): boolean {
  if (
    !validWaveBoard(l, board) ||
    waveCost(board) > l.budget ||
    board.filter((o) => o.amplitude > 0).length !== l.activeRequired
  )
    return false;
  const actual = waveCoefficients(board);
  return (
    actual.cosine.every((n, i) => n === l.target.cosine[i]) &&
    actual.sine.every((n, i) => n === l.target.sine[i])
  );
}
export function applyWaveMove(
  l: WaveLevel,
  board: WaveBoard,
  move: WaveMove,
): WaveBoard | null {
  if (
    !validWaveBoard(l, board) ||
    waveWon(l, board) ||
    !Number.isInteger(move.oscillator) ||
    move.oscillator < 0 ||
    move.oscillator >= board.length ||
    !["frequency", "amplitude", "phase"].includes(move.field) ||
    board[move.oscillator][move.field] === move.value
  )
    return null;
  const next = board.map((o, i) =>
    i === move.oscillator ? { ...o, [move.field]: move.value } : o,
  );
  return validWaveBoard(l, next) ? next : null;
}
export function moveWaveOscillator(
  l: WaveLevel,
  state: WaveState,
  move: WaveMove,
): WaveState {
  const next = applyWaveMove(l, state.board, move);
  return next
    ? { board: next, history: [...state.history, state.board] }
    : state;
}
export function undoWaveOscillator(l: WaveLevel, state: WaveState): WaveState {
  return waveWon(l, state.board) || !state.history.length
    ? state
    : {
        board: state.history[state.history.length - 1],
        history: state.history.slice(0, -1),
      };
}
export function sampleWave(coefficients: WaveCoefficients, t: number): number {
  return coefficients.cosine.reduce(
    (sum, c, i) =>
      sum +
      c * Math.cos(2 * Math.PI * (i + 1) * t) +
      coefficients.sine[i] * Math.sin(2 * Math.PI * (i + 1) * t),
    0,
  );
}
export type WaveSearchResult = {
  status:
    "searching" | "found" | "exhausted" | "budget" | "cancelled" | "invalid";
  checked: number;
  board?: WaveBoard;
  move?: WaveMove;
};
/** A bounded, resumable enumeration of the public setting space. No solution certificate is read. */
export function createWaveSearch(
  l: WaveLevel,
  current: WaveBoard,
  options: { limit?: number; cancelled?: () => boolean } = {},
) {
  const choices = l.frequencies.flatMap((frequency) =>
    l.amplitudes.flatMap((amplitude) =>
      l.phases.map((phase) => ({ frequency, amplitude, phase })),
    ),
  );
  const ordered = current.map((o) => [
    o,
    ...choices.filter(
      (c) =>
        c.frequency !== o.frequency ||
        c.amplitude !== o.amplitude ||
        c.phase !== o.phase,
    ),
  ]);
  const total = choices.length ** l.oscillators;
  const limit = Math.max(
    0,
    Math.min(WAVE_SEARCH_LIMIT, Math.floor(options.limit ?? WAVE_SEARCH_LIMIT)),
  );
  let checked = 0,
    cancelled = false;
  let result: WaveSearchResult = {
    status:
      validWaveLevel(l) && validWaveBoard(l, current) ? "searching" : "invalid",
    checked,
  };
  return {
    cancel() {
      cancelled = true;
    },
    step(batch = WAVE_SEARCH_CHUNK): WaveSearchResult {
      if (result.status !== "searching") return result;
      if (cancelled || options.cancelled?.())
        return (result = { status: "cancelled", checked });
      const count = Number.isFinite(batch)
        ? Math.max(1, Math.min(WAVE_SEARCH_CHUNK, Math.floor(batch)))
        : WAVE_SEARCH_CHUNK;
      for (let n = 0; n < count; n++) {
        if (cancelled || options.cancelled?.())
          return (result = { status: "cancelled", checked });
        if (checked >= total)
          return (result = { status: "exhausted", checked });
        if (checked >= limit) return (result = { status: "budget", checked });
        let code = checked;
        const candidate = ordered.map((list) => {
          const o = list[code % choices.length];
          code = Math.floor(code / choices.length);
          return { ...o };
        });
        checked++;
        if (waveWon(l, candidate)) {
          let move: WaveMove | undefined;
          for (let i = 0; i < candidate.length && !move; i++) {
            for (const field of ["frequency", "phase", "amplitude"] as const) {
              if (candidate[i][field] !== current[i][field]) {
                move = { oscillator: i, field, value: candidate[i][field] };
                break;
              }
            }
          }
          return (result = {
            status: "found",
            checked,
            board: candidate,
            move,
          });
        }
      }
      return (result = { status: "searching", checked });
    },
  };
}
