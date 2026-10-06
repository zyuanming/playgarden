// SPDX-License-Identifier: GPL-3.0-only
/** Original public-constraint symmetry puzzle. No hidden answer is consulted. */
export type SymmetryCell = 0 | 1 | null;
export type SymmetryTransform =
  | "vertical"
  | "horizontal"
  | "diagonal"
  | "antiDiagonal"
  | "quarterTurn"
  | "halfTurn";
export type SymmetryLevel = {
  id: string;
  title: string;
  lesson: string;
  size: number;
  initial: readonly SymmetryCell[];
  locked: readonly number[];
  transforms: readonly SymmetryTransform[];
  filled: number;
  budget: number;
};
export type SymmetryState = {
  board: SymmetryCell[];
  history: SymmetryCell[][];
};
export const symmetryTransformNames: Record<SymmetryTransform, string> = {
  vertical: "左右镜像",
  horizontal: "上下镜像",
  diagonal: "主对角线镜像 ↘",
  antiDiagonal: "副对角线镜像 ↙",
  quarterTurn: "顺时针旋转 90°",
  halfTurn: "旋转 180°",
};
export function symmetryImage(
  index: number,
  size: number,
  transform: SymmetryTransform,
): number {
  const r = Math.floor(index / size),
    c = index % size;
  switch (transform) {
    case "vertical":
      return r * size + size - 1 - c;
    case "horizontal":
      return (size - 1 - r) * size + c;
    case "diagonal":
      return c * size + r;
    case "antiDiagonal":
      return (size - 1 - c) * size + size - 1 - r;
    case "quarterTurn":
      return c * size + size - 1 - r;
    case "halfTurn":
      return size * size - 1 - index;
  }
}
export function symmetryOrbits(level: SymmetryLevel): number[][] {
  const seen = new Set<number>(),
    orbits: number[][] = [];
  for (let i = 0; i < level.size ** 2; i++) {
    if (seen.has(i)) continue;
    const orbit = [i];
    seen.add(i);
    for (let j = 0; j < orbit.length; j++)
      for (const t of level.transforms) {
        const k = symmetryImage(orbit[j], level.size, t);
        if (!seen.has(k)) {
          seen.add(k);
          orbit.push(k);
        }
      }
    orbits.push(orbit.sort((a, b) => a - b));
  }
  return orbits;
}
export function symmetryCost(
  level: SymmetryLevel,
  board: readonly SymmetryCell[],
): number {
  return board.reduce<number>(
    (n, v, i) => n + (v !== level.initial[i] ? 1 : 0),
    0,
  );
}
export function symmetryConflicts(
  level: SymmetryLevel,
  board: readonly SymmetryCell[],
): Set<number> {
  const conflicts = new Set<number>();
  for (const orbit of symmetryOrbits(level)) {
    const known = new Set(orbit.map((i) => board[i]).filter((v) => v !== null));
    if (known.size > 1) orbit.forEach((i) => conflicts.add(i));
  }
  return conflicts;
}
export function validSymmetryLevel(l: SymmetryLevel): boolean {
  return (
    Number.isInteger(l.size) &&
    l.size >= 2 &&
    l.size <= 5 &&
    l.initial.length === l.size ** 2 &&
    l.initial.every((v) => v === null || v === 0 || v === 1) &&
    l.transforms.length > 0 &&
    l.transforms.every((t) => t in symmetryTransformNames) &&
    Number.isInteger(l.filled) &&
    l.filled >= 0 &&
    l.filled <= l.initial.length &&
    Number.isInteger(l.budget) &&
    l.budget >= 0 &&
    l.budget <= l.initial.length &&
    new Set(l.locked).size === l.locked.length &&
    l.locked.every(
      (i) =>
        Number.isInteger(i) &&
        i >= 0 &&
        i < l.initial.length &&
        l.initial[i] !== null,
    )
  );
}
export function symmetryWon(
  l: SymmetryLevel,
  board: readonly SymmetryCell[],
): boolean {
  return (
    validSymmetryLevel(l) &&
    board.length === l.initial.length &&
    board.every((v) => v === 0 || v === 1) &&
    l.locked.every((i) => board[i] === l.initial[i]) &&
    board.filter((v) => v === 1).length === l.filled &&
    symmetryCost(l, board) <= l.budget &&
    symmetryConflicts(l, board).size === 0
  );
}
export const createSymmetryState = (l: SymmetryLevel): SymmetryState => ({
  board: [...l.initial],
  history: [],
});
export function editSymmetry(
  l: SymmetryLevel,
  state: SymmetryState,
  index: number,
  value: SymmetryCell,
): SymmetryState {
  if (
    symmetryWon(l, state.board) ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= state.board.length ||
    l.locked.includes(index) ||
    (value !== 0 && value !== 1 && value !== null) ||
    state.board[index] === value ||
    (value === null && l.initial[index] !== null)
  )
    return state;
  const board = [...state.board];
  board[index] = value;
  if (symmetryCost(l, board) > l.budget) return state;
  return { board, history: [...state.history, state.board] };
}
export function undoSymmetry(
  l: SymmetryLevel,
  state: SymmetryState,
): SymmetryState {
  if (symmetryWon(l, state.board) || !state.history.length) return state;
  return {
    board: [...state.history[state.history.length - 1]],
    history: state.history.slice(0, -1),
  };
}
export type SymmetryHint =
  | { status: "found"; index: number; value: 0 | 1 | null; changes: number }
  | { status: "solved" | "none" | "budget" | "cancelled" };
export const SYMMETRY_HINT_LIMIT = 32768;
/** Enumerate orbit assignments from PUBLIC clues, minimizing edits to the actual current board.
 * This cooperative generator yields every 128 candidates so the UI can cancel work. */
export function* symmetryHintSteps(
  l: SymmetryLevel,
  board: readonly SymmetryCell[],
  limit = SYMMETRY_HINT_LIMIT,
): Generator<void, SymmetryHint> {
  if (symmetryWon(l, board)) return { status: "solved" };
  if (!validSymmetryLevel(l)) return { status: "none" };
  const orbits = symmetryOrbits(l),
    free: number[][] = [],
    base: SymmetryCell[] = Array(l.initial.length).fill(0);
  for (const orbit of orbits) {
    const pins = orbit
      .filter((i) => l.locked.includes(i))
      .map((i) => l.initial[i]);
    if (new Set(pins).size > 1) return { status: "none" };
    if (pins.length)
      orbit.forEach((i) => {
        base[i] = pins[0];
      });
    else free.push(orbit);
  }
  const total = 2 ** free.length;
  let best: SymmetryCell[] | null = null,
    distance = Infinity;
  for (let mask = 0; mask < Math.min(total, limit); mask++) {
    const candidate = [...base];
    free.forEach((orbit, j) =>
      orbit.forEach((i) => {
        candidate[i] = (Math.floor(mask / 2 ** j) % 2) as 0 | 1;
      }),
    );
    if (
      candidate.filter((v) => v === 1).length === l.filled &&
      symmetryCost(l, candidate) <= l.budget
    ) {
      const d = candidate.reduce<number>(
        (n, v, i) => n + Number(v !== board[i]),
        0,
      );
      if (d < distance) {
        best = candidate;
        distance = d;
      }
    }
    if (mask % 128 === 127) yield;
  }
  // A partial search never claims an optimum or impossibility.
  if (total > limit) return { status: "budget" };
  if (!best) return { status: "none" };
  const result = best as SymmetryCell[];
  const changes = result.flatMap((v, i) => (v !== board[i] ? [i] : []));
  // Restore an already-spent cell first if necessary, preserving the finite budget.
  const index =
    changes.find((i) => result[i] === l.initial[i]) ??
    changes.find(
      (i) => symmetryCost(l, board) < l.budget || board[i] !== l.initial[i],
    );
  if (index !== undefined)
    return { status: "found", index, value: result[index], changes: distance };
  // Unknown initial cells can be temporarily restored to '?' to free a unit.
  const restore = changes.find(
    (i) => board[i] !== l.initial[i] && !l.locked.includes(i),
  );
  return restore === undefined
    ? { status: "none" }
    : {
        status: "found",
        index: restore,
        value: l.initial[restore],
        changes: distance,
      };
}
export function searchSymmetryHint(
  l: SymmetryLevel,
  board: readonly SymmetryCell[],
  limit = SYMMETRY_HINT_LIMIT,
): SymmetryHint {
  const g = symmetryHintSteps(l, board, limit);
  let s = g.next();
  while (!s.done) s = g.next();
  return s.value;
}
