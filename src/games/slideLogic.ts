/** Original, deterministic sliding puzzles. Every solution is a legal tile-value sequence. */
export type SlideLevel = {
  title: string;
  size: number;
  tiles: number[];
  solution: number[];
  par: number;
  hint: string;
};
export type SlideSnapshot = { tiles: number[]; route: number[] };
export type SlideState = SlideSnapshot & {
  size: number;
  history: SlideSnapshot[];
};

const layouts: [number, number[], number[]][] = [
  [3, [1, 2, 3, 4, 0, 6, 7, 5, 8], [5, 8]],
  [3, [1, 2, 3, 5, 0, 6, 4, 7, 8], [5, 4, 7, 8]],
  [3, [1, 5, 0, 4, 3, 2, 7, 8, 6], [2, 3, 5, 2, 3, 6]],
  [3, [1, 2, 3, 7, 6, 8, 5, 4, 0], [8, 6, 4, 5, 7, 4, 5, 8]],
  [3, [4, 1, 3, 2, 0, 8, 7, 6, 5], [2, 4, 1, 2, 8, 5, 6, 8, 5, 6]],
  [3, [0, 5, 2, 1, 7, 4, 8, 6, 3], [1, 7, 4, 3, 6, 8, 7, 4, 5, 2, 3, 6]],
  [
    4,
    [0, 2, 3, 4, 1, 6, 7, 8, 5, 13, 14, 12, 11, 9, 10, 15],
    [1, 5, 11, 9, 13, 11, 9, 13, 10, 14, 11, 10, 14, 15],
  ],
  [
    4,
    [1, 2, 3, 4, 11, 9, 6, 8, 0, 5, 7, 15, 13, 10, 12, 14],
    [11, 9, 5, 11, 9, 5, 6, 7, 12, 14, 15, 12, 11, 10, 14, 15],
  ],
  [
    4,
    [5, 8, 0, 3, 2, 1, 4, 12, 9, 6, 10, 7, 13, 14, 11, 15],
    [8, 1, 2, 5, 1, 2, 6, 10, 7, 12, 4, 8, 3, 4, 8, 7, 11, 15],
  ],
  [
    4,
    [6, 5, 2, 3, 10, 9, 1, 7, 0, 11, 8, 4, 13, 14, 15, 12],
    [10, 9, 1, 7, 4, 8, 11, 10, 9, 6, 5, 1, 6, 5, 1, 2, 3, 4, 8, 12],
  ],
  [
    4,
    [0, 6, 3, 4, 2, 9, 11, 7, 1, 13, 10, 15, 14, 5, 12, 8],
    [2, 1, 13, 5, 14, 13, 5, 9, 6, 2, 1, 5, 9, 10, 15, 8, 12, 15, 11, 7, 8, 12],
  ],
  [
    4,
    [1, 6, 2, 4, 11, 14, 10, 7, 5, 15, 13, 3, 9, 0, 12, 8],
    [
      15, 13, 3, 8, 12, 15, 13, 14, 11, 5, 9, 13, 14, 11, 10, 3, 11, 10, 6, 2,
      3, 7, 8, 12,
    ],
  ],
];
const titles = [
  "两步出发",
  "转过小角",
  "上排旅行",
  "绕一小圈",
  "交错小路",
  "九宫挑战",
  "新的花园",
  "下排回廊",
  "穿过中央",
  "长长的弯",
  "全盘漫游",
  "十五格大师",
];
export const slideLevels: SlideLevel[] = layouts.map(
  ([size, tiles, solution], i) => ({
    title: titles[i],
    size,
    tiles,
    solution,
    par: solution.length,
    hint: `目标是从左到右、从上到下排好 1–${size * size - 1}，空格留在右下角。先移动数字 ${solution[0]}。`,
  }),
);

export function validSlideBoard(
  tiles: readonly number[],
  size: number,
): boolean {
  return (
    Number.isInteger(size) &&
    size >= 2 &&
    size <= 5 &&
    tiles.length === size * size &&
    new Set(tiles).size === tiles.length &&
    tiles.every((v) => Number.isInteger(v) && v >= 0 && v < tiles.length)
  );
}
export function isSlideSolved(tiles: readonly number[], size: number): boolean {
  return (
    validSlideBoard(tiles, size) &&
    tiles.every((v, i) => v === (i + 1) % tiles.length)
  );
}
export function slideManhattan(tiles: readonly number[], size: number): number {
  if (!validSlideBoard(tiles, size)) return Infinity;
  return tiles.reduce(
    (sum, value, i) =>
      value === 0
        ? sum
        : sum +
          Math.abs(Math.floor(i / size) - Math.floor((value - 1) / size)) +
          Math.abs((i % size) - ((value - 1) % size)),
    0,
  );
}
export function isSlideSolvable(
  tiles: readonly number[],
  size: number,
): boolean {
  if (!validSlideBoard(tiles, size)) return false;
  let inversions = 0;
  for (let i = 0; i < tiles.length; i++)
    for (let j = i + 1; j < tiles.length; j++) {
      if (tiles[i] && tiles[j] && tiles[i] > tiles[j]) inversions++;
    }
  const blankRowFromBottom = size - Math.floor(tiles.indexOf(0) / size);
  return size % 2
    ? inversions % 2 === 0
    : (inversions + blankRowFromBottom) % 2 === 1;
}
export function legalSlideMoves(
  tiles: readonly number[],
  size: number,
): number[] {
  if (!validSlideBoard(tiles, size)) return [];
  const blank = tiles.indexOf(0);
  return tiles.filter(
    (value, i) =>
      value !== 0 &&
      Math.abs(Math.floor(i / size) - Math.floor(blank / size)) +
        Math.abs((i % size) - (blank % size)) ===
        1,
  );
}
export function moveSlideTile(
  tiles: readonly number[],
  size: number,
  tile: number,
): number[] | null {
  if (!legalSlideMoves(tiles, size).includes(tile)) return null;
  const next = [...tiles],
    index = next.indexOf(tile),
    blank = next.indexOf(0);
  [next[blank], next[index]] = [next[index], next[blank]];
  return next;
}
export function createSlideState(level: SlideLevel): SlideState {
  return {
    size: level.size,
    tiles: [...level.tiles],
    route: [...level.solution],
    history: [],
  };
}
export function slideMove(state: SlideState, tile: number): SlideState {
  if (isSlideSolved(state.tiles, state.size)) return state;
  const tiles = moveSlideTile(state.tiles, state.size, tile);
  if (!tiles) return state;
  // An off-route move can always be reversed. Hints remain legal after any detour.
  const route =
    state.route[0] === tile ? state.route.slice(1) : [tile, ...state.route];
  return {
    ...state,
    tiles,
    route,
    history: [...state.history, { tiles: state.tiles, route: state.route }],
  };
}
export function undoSlide(state: SlideState): SlideState {
  const previous = state.history.at(-1);
  return previous
    ? { ...state, ...previous, history: state.history.slice(0, -1) }
    : state;
}
export function slideHint(state: SlideState): number | null {
  return isSlideSolved(state.tiles, state.size)
    ? null
    : (state.route[0] ?? null);
}
/** Arrow keys move the empty space in the indicated direction. */
export function slideArrowTile(
  tiles: readonly number[],
  size: number,
  key: string,
): number | null {
  if (!validSlideBoard(tiles, size)) return null;
  const blank = tiles.indexOf(0),
    row = Math.floor(blank / size),
    col = blank % size;
  const offset: Record<string, [number, number]> = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  };
  const delta = offset[key];
  if (!delta) return null;
  const r = row + delta[0],
    c = col + delta[1];
  return r >= 0 && r < size && c >= 0 && c < size ? tiles[r * size + c] : null;
}
