import { lightsOutBoards, lightsOutChapters } from "./lightsOutCampaign.ts";

/** Toggle the chosen light plus orthogonal neighbors. No edge wrapping. */
export function lightNeighbors(size: number, index: number): number[] {
  if (
    !Number.isInteger(size) ||
    size < 1 ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= size * size
  )
    return [];
  const row = Math.floor(index / size),
    col = index % size;
  return [
    index,
    ...(row > 0 ? [index - size] : []),
    ...(row < size - 1 ? [index + size] : []),
    ...(col > 0 ? [index - 1] : []),
    ...(col < size - 1 ? [index + 1] : []),
  ];
}

export function toggleLight(
  board: readonly boolean[],
  size: number,
  index: number,
): boolean[] {
  const next = [...board];
  if (board.length !== size * size) return next;
  for (const cell of lightNeighbors(size, index)) next[cell] = !next[cell];
  return next;
}

export function applyLightMoves(
  board: readonly boolean[],
  size: number,
  moves: readonly number[],
): boolean[] {
  return moves.reduce<boolean[]>(
    (current, move) => toggleLight(current, size, move),
    [...board],
  );
}
export function lightsOutSolved(board: readonly boolean[]): boolean {
  return board.length > 0 && board.every((light) => !light);
}

/** Exact minimum-move solver via RREF over GF(2), then null-space enumeration.
 * Boards through 5 × 5 fit safely in 26-bit augmented integer rows.
 */
export function solveLightsOut(
  board: readonly boolean[],
  size: number,
): number[] | null {
  if (
    !Number.isInteger(size) ||
    size < 1 ||
    size > 5 ||
    board.length !== size * size ||
    board.some((v) => typeof v !== "boolean")
  )
    return null;
  const n = size * size;
  const rows = board.map((on, row) =>
    lightNeighbors(size, row).reduce(
      (mask, col) => mask | (1 << col),
      on ? 1 << n : 0,
    ),
  );
  const pivots: number[] = [];
  let rank = 0;
  for (let col = 0; col < n; col++) {
    const pivot = rows.findIndex(
      (row, i) => i >= rank && (row & (1 << col)) !== 0,
    );
    if (pivot === -1) continue;
    [rows[pivot], rows[rank]] = [rows[rank], rows[pivot]];
    for (let row = 0; row < n; row++) {
      if (row !== rank && rows[row] & (1 << col)) rows[row] ^= rows[rank];
    }
    pivots.push(col);
    rank++;
  }
  const coefficients = (1 << n) - 1;
  if (rows.some((row) => (row & coefficients) === 0 && (row & (1 << n)) !== 0))
    return null;
  let particular = 0;
  pivots.forEach((col, row) => {
    if (rows[row] & (1 << n)) particular |= 1 << col;
  });
  const free = Array.from({ length: n }, (_, i) => i).filter(
    (col) => !pivots.includes(col),
  );
  const basis = free.map((col) => {
    let vector = 1 << col;
    pivots.forEach((pivot, row) => {
      if (rows[row] & (1 << col)) vector |= 1 << pivot;
    });
    return vector;
  });
  const positions = (mask: number) =>
    Array.from({ length: n }, (_, i) => i).filter((i) => mask & (1 << i));
  let best = positions(particular);
  for (let combination = 1; combination < 1 << basis.length; combination++) {
    let candidate = particular;
    basis.forEach((vector, i) => {
      if (combination & (1 << i)) candidate ^= vector;
    });
    const moves = positions(candidate);
    if (moves.length < best.length) best = moves;
  }
  return best;
}

export type LightsOutLevel = {
  title: string;
  chapter: number;
  lesson: string;
  size: number;
  initial: boolean[];
  scramble: number[];
  solution: number[];
};

/** Fixed, offline-curated boards. The independent row-chasing tests certify
 * every stored minimum solution; no random generation or fallback levels. */
export const lightsOutLevels: LightsOutLevel[] = lightsOutBoards.map(
  ([initialMask, solutionMask, title], index) => {
    const chapter = lightsOutChapters.findIndex(
      (part) => index >= part.start && index < part.start + part.count,
    );
    if (chapter < 0) throw new RangeError(`Missing Lights Out chapter: ${index}`);
    const { size, lesson } = lightsOutChapters[chapter];
    const cells = Array.from({ length: size * size }, (_, i) => i);
    const solution = cells.filter((i) => (solutionMask & (1 << i)) !== 0);
    return {
      title,
      chapter,
      lesson,
      size,
      initial: cells.map((i) => (initialMask & (1 << i)) !== 0),
      scramble: [...solution],
      solution,
    };
  },
);

export function getLightsOutLevel(index: number): LightsOutLevel {
  if (!Number.isInteger(index) || !lightsOutLevels[index])
    throw new RangeError(`Unknown Lights Out level: ${index}`);
  return lightsOutLevels[index];
}

export type LightsOutState = {
  board: boolean[];
  moves: number;
  history: boolean[][];
};
export function createLightsOutState(config: LightsOutLevel): LightsOutState {
  return { board: [...config.initial], moves: 0, history: [] };
}
export function playLight(
  state: LightsOutState,
  size: number,
  index: number,
  paused = false,
): LightsOutState {
  if (
    paused ||
    lightsOutSolved(state.board) ||
    lightNeighbors(size, index).length === 0
  )
    return state;
  return {
    board: toggleLight(state.board, size, index),
    moves: state.moves + 1,
    history: [...state.history, state.board],
  };
}
export function undoLight(
  state: LightsOutState,
  paused = false,
): LightsOutState {
  const previous = state.history.at(-1);
  return paused || !previous
    ? state
    : {
        board: previous,
        moves: state.moves - 1,
        history: state.history.slice(0, -1),
      };
}
