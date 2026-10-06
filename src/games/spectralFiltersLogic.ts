// SPDX-License-Identifier: GPL-3.0-only
/** Ideal three-channel light. This deliberately does not model real spectra or pigments. */
export type Fraction = readonly [number, number];
export type RGB = readonly [Fraction, Fraction, Fraction];
export type SpectralFilter = {
  id: string;
  name: string;
  transmission: RGB;
  cost: number;
};
export type SpectralLevel = {
  id: string;
  title: string;
  lesson: string;
  beams: readonly RGB[];
  slotsPerBeam: number;
  filters: readonly SpectralFilter[];
  target: RGB;
  budget: number;
};
export type SpectralBoard = readonly number[];
export type SpectralState = {
  board: SpectralBoard;
  history: readonly SpectralBoard[];
};
export type SpectralMove = { slot: number; filter: number };
export const SPECTRAL_SEARCH_LIMIT = 2401;
export function fraction(n: number, d = 1): Fraction {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d <= 0)
    throw new Error("Invalid fraction");
  let a = Math.abs(n),
    b = d;
  while (b) [a, b] = [b, a % b];
  return [n / (a || 1), d / (a || 1)];
}
export const fractionText = ([n, d]: Fraction) =>
  d === 1 ? `${n}` : `${n}/${d}`;
export const rgbText = (rgb: RGB) =>
  rgb.map((f, i) => `${["R", "G", "B"][i]} ${fractionText(f)}`).join(" · ");
const multiply = (a: Fraction, b: Fraction): Fraction =>
  fraction(a[0] * b[0], a[1] * b[1]);
const add = (a: Fraction, b: Fraction): Fraction =>
  fraction(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
export function validSpectralLevel(l: SpectralLevel): boolean {
  const rgb = (v: RGB, max: number) =>
    Array.isArray(v) &&
    v.length === 3 &&
    v.every(
      (f) =>
        Array.isArray(f) &&
        f.length === 2 &&
        Number.isInteger(f[0]) &&
        Number.isInteger(f[1]) &&
        f[0] >= 0 &&
        f[0] <= 16 &&
        f[1] >= 1 &&
        f[1] <= 16 &&
        f[0] / f[1] <= max,
    );
  return (
    l.beams.length >= 1 &&
    l.beams.length <= 2 &&
    l.beams.every((v) => rgb(v, 3)) &&
    Number.isInteger(l.slotsPerBeam) &&
    l.slotsPerBeam >= 1 &&
    l.slotsPerBeam <= 2 &&
    l.filters.length >= 1 &&
    l.filters.length <= 6 &&
    new Set(l.filters.map((f) => f.id)).size === l.filters.length &&
    l.filters.every(
      (f) =>
        rgb(f.transmission, 1) &&
        Number.isInteger(f.cost) &&
        f.cost >= 1 &&
        f.cost <= 6,
    ) &&
    rgb(l.target, 6) &&
    Number.isInteger(l.budget) &&
    l.budget >= 1 &&
    l.budget <= 24
  );
}
export const initialSpectralBoard = (l: SpectralLevel): SpectralBoard =>
  Array(l.beams.length * l.slotsPerBeam).fill(-1);
export const createSpectralState = (l: SpectralLevel): SpectralState => ({
  board: initialSpectralBoard(l),
  history: [],
});
export function spectralCost(l: SpectralLevel, board: SpectralBoard): number {
  return board.reduce((sum, i) => sum + (l.filters[i]?.cost ?? 0), 0);
}
export function validSpectralBoard(
  l: SpectralLevel,
  board: SpectralBoard,
): boolean {
  const used = board.filter((i) => i !== -1);
  return (
    board.length === l.beams.length * l.slotsPerBeam &&
    board.every(
      (i) => Number.isInteger(i) && i >= -1 && i < l.filters.length,
    ) &&
    new Set(used).size === used.length &&
    spectralCost(l, board) <= l.budget
  );
}
export function spectralBeamOutput(
  l: SpectralLevel,
  board: SpectralBoard,
  beam: number,
): RGB {
  if (
    !Number.isInteger(beam) ||
    !l.beams[beam] ||
    !validSpectralBoard(l, board)
  )
    return [
      [0, 1],
      [0, 1],
      [0, 1],
    ];
  return l.beams[beam].map((source, channel) =>
    board
      .slice(beam * l.slotsPerBeam, (beam + 1) * l.slotsPerBeam)
      .reduce(
        (value, filter) =>
          filter < 0
            ? value
            : multiply(value, l.filters[filter].transmission[channel]),
        source,
      ),
  ) as unknown as RGB;
}
export function spectralOutput(l: SpectralLevel, board: SpectralBoard): RGB {
  return l.beams.reduce<RGB>(
    (sum, _, beam) =>
      spectralBeamOutput(l, board, beam).map((value, c) =>
        add(value, sum[c]),
      ) as unknown as RGB,
    [
      [0, 1],
      [0, 1],
      [0, 1],
    ],
  );
}
export function spectralWon(l: SpectralLevel, board: SpectralBoard): boolean {
  return (
    validSpectralBoard(l, board) &&
    spectralOutput(l, board).every(
      (v, c) => v[0] * l.target[c][1] === l.target[c][0] * v[1],
    )
  );
}
export function applySpectralMove(
  l: SpectralLevel,
  board: SpectralBoard,
  move: SpectralMove,
): SpectralBoard | null {
  if (
    !validSpectralBoard(l, board) ||
    spectralWon(l, board) ||
    !Number.isInteger(move.slot) ||
    move.slot < 0 ||
    move.slot >= board.length ||
    !Number.isInteger(move.filter) ||
    move.filter < -1 ||
    move.filter >= l.filters.length ||
    board[move.slot] === move.filter
  )
    return null;
  const next = board.map((f, i) => (i === move.slot ? move.filter : f));
  return validSpectralBoard(l, next) ? next : null;
}
export function moveSpectralFilter(
  l: SpectralLevel,
  state: SpectralState,
  move: SpectralMove,
): SpectralState {
  const next = applySpectralMove(l, state.board, move);
  return next
    ? { board: next, history: [...state.history, state.board] }
    : state;
}
export function undoSpectralFilter(
  l: SpectralLevel,
  state: SpectralState,
): SpectralState {
  if (spectralWon(l, state.board) || !state.history.length) return state;
  return {
    board: state.history[state.history.length - 1],
    history: state.history.slice(0, -1),
  };
}
export type SpectralSearch = {
  status: "found" | "exhausted" | "budget" | "cancelled" | "invalid";
  checked: number;
  board?: SpectralBoard;
  move?: SpectralMove;
};
/** Enumerates physical assignments, not certificate data. Closest candidate gives an actual-state hint. */
export function searchSpectralFilters(
  l: SpectralLevel,
  current: SpectralBoard,
  options: { limit?: number; cancelled?: () => boolean } = {},
): SpectralSearch {
  if (!validSpectralLevel(l) || !validSpectralBoard(l, current))
    return { status: "invalid", checked: 0 };
  const limit = Math.max(
    0,
    Math.min(
      SPECTRAL_SEARCH_LIMIT,
      Math.floor(options.limit ?? SPECTRAL_SEARCH_LIMIT),
    ),
  );
  let checked = 0,
    stopped: "budget" | "cancelled" | null = null,
    best: number[] | undefined,
    distance = Infinity;
  const draft = Array(current.length).fill(-1) as number[];
  function visit(slot: number, used: Set<number>, cost: number) {
    if (stopped) return;
    if (options.cancelled?.()) {
      stopped = "cancelled";
      return;
    }
    if (slot === draft.length) {
      if (checked >= limit) {
        stopped = "budget";
        return;
      }
      checked++;
      if (spectralWon(l, draft)) {
        const d = draft.reduce(
          (sum, value, i) =>
            sum +
            (value === current[i] ? 0 : current[i] < 0 || value < 0 ? 1 : 2),
          0,
        );
        if (d < distance) {
          distance = d;
          best = [...draft];
        }
      }
      return;
    }
    for (let f = -1; f < l.filters.length; f++) {
      if (f >= 0 && (used.has(f) || cost + l.filters[f].cost > l.budget))
        continue;
      draft[slot] = f;
      if (f >= 0) used.add(f);
      visit(slot + 1, used, cost + (f < 0 ? 0 : l.filters[f].cost));
      if (f >= 0) used.delete(f);
      if (stopped) break;
    }
  }
  visit(0, new Set(), 0);
  if (stopped === "cancelled") return { status: "cancelled", checked };
  if (best) {
    const clear = current.findIndex((f, i) => f >= 0 && f !== best![i]);
    const slot =
      clear >= 0 ? clear : current.findIndex((f, i) => f !== best![i]);
    return {
      status: "found",
      checked,
      board: best,
      move:
        slot < 0 ? undefined : { slot, filter: clear >= 0 ? -1 : best[slot] },
    };
  }
  return { status: stopped ?? "exhausted", checked };
}
