// SPDX-License-Identifier: GPL-3.0-only
export type Domino = { id: number; a: number; b: number };
export type DominoState = { chain: Domino[]; remaining: number[] };
export type DominoMove = { id: number; side: "left" | "right" };
function path(title: string, lesson: string, pips: number[], anchor: number) {
  const tiles = pips.slice(1).map((b, id) => ({ id, a: pips[id], b }));
  const rack = tiles
    .filter((t) => t.id !== anchor)
    .sort(
      (a, b) =>
        ((a.id * 7 + 3) % tiles.length) - ((b.id * 7 + 3) % tiles.length),
    )
    .map((t) => (t.id % 2 ? { ...t, a: t.b, b: t.a } : t));
  return {
    title,
    lesson,
    tiles: [...rack, tiles[anchor]],
    anchor: tiles[anchor],
  };
}
export const dominoTrailLevels = [
  path(
    "小径开头",
    "先看两头的点数，只有相同点数才能贴在一起。",
    [0, 1, 2, 3, 1],
    1,
  ),
  path(
    "两端都能接",
    "选一张骨牌，再选择把它接到左端还是右端。",
    [0, 2, 1, 3, 2, 4, 1],
    2,
  ),
  path(
    "双数小站",
    "双数骨牌的两半相同，接上后末端点数保持不变。",
    [1, 1, 3, 2, 2, 4, 0, 3],
    3,
  ),
  path(
    "回来再出发",
    "一段闭环可能需要先接好，再离开那个点数。",
    [0, 1, 2, 0, 3, 4, 3, 2, 5],
    4,
  ),
  path(
    "留住岔路",
    "同一点数有多张可选时，别急着把路走到死胡同。",
    [6, 1, 2, 3, 1, 4, 2, 5, 4, 0],
    3,
  ),
  path(
    "双环相会",
    "左右两端都能发展。用撤销比较不同的拼接顺序。",
    [0, 2, 4, 0, 3, 5, 3, 1, 4, 6, 1, 2],
    5,
  ),
  path(
    "三座回环",
    "相同的牌也各自占一个位置，每一张都要用上。",
    [5, 0, 1, 2, 0, 3, 3, 4, 1, 5, 2, 4, 6],
    5,
  ),
  path(
    "花园环游",
    "整理分支、双数与回环，让整副骨牌连成不断的一条路。",
    [6, 0, 2, 3, 0, 1, 1, 4, 2, 5, 4, 6, 3, 5, 1, 2],
    7,
  ),
];
export function initialDomino(
  level: (typeof dominoTrailLevels)[number],
): DominoState {
  return {
    chain: [level.anchor],
    remaining: level.tiles
      .filter((t) => t.id !== level.anchor.id)
      .map((t) => t.id),
  };
}
export function attachDomino(
  state: DominoState,
  tiles: Domino[],
  move: DominoMove,
): DominoState | null {
  const tile = tiles.find((t) => t.id === move.id);
  if (!tile || !state.remaining.includes(move.id)) return null;
  const end = move.side === "left" ? state.chain[0].a : state.chain.at(-1)!.b;
  let oriented: Domino;
  if (move.side === "left") {
    if (tile.b === end) oriented = tile;
    else if (tile.a === end) oriented = { ...tile, a: tile.b, b: tile.a };
    else return null;
  } else {
    if (tile.a === end) oriented = tile;
    else if (tile.b === end) oriented = { ...tile, a: tile.b, b: tile.a };
    else return null;
  }
  return {
    chain:
      move.side === "left"
        ? [oriented, ...state.chain]
        : [...state.chain, oriented],
    remaining: state.remaining.filter((id) => id !== move.id),
  };
}
export function dominoWon(state: DominoState, total: number) {
  return (
    state.remaining.length === 0 &&
    state.chain.length === total &&
    new Set(state.chain.map((t) => t.id)).size === total &&
    state.chain.every((t, i) => i === 0 || state.chain[i - 1].b === t.a)
  );
}
export function solveDomino(
  state: DominoState,
  tiles: Domino[],
): DominoMove[] | null {
  const seen = new Set<string>();
  function visit(s: DominoState): DominoMove[] | null {
    if (dominoWon(s, tiles.length)) return [];
    const key = `${s.chain[0].a}/${s.chain.at(-1)!.b}/${[...s.remaining].sort((a, b) => a - b)}`;
    if (seen.has(key)) return null;
    seen.add(key);
    for (const id of s.remaining)
      for (const side of ["left", "right"] as const) {
        const move = { id, side },
          next = attachDomino(s, tiles, move);
        if (next) {
          const rest = visit(next);
          if (rest) return [move, ...rest];
        }
      }
    return null;
  }
  return visit(state);
}
