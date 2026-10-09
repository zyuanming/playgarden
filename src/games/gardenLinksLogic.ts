// SPDX-License-Identifier: GPL-3.0-only
export type LinkBoard = (number | null)[];
export type LinkPoint = { row: number; col: number };
export type LinkLesson = {
  title: string;
  lesson: string;
  rows: number;
  cols: number;
  board: LinkBoard;
};
export const linkSymbols = [
  "花",
  "叶",
  "星",
  "月",
  "雨",
  "山",
  "云",
  "泉",
  "鸟",
  "风",
  "竹",
  "果",
  "灯",
  "蝶",
  "石",
  "芽",
  "光",
  "露",
];
function board(
  title: string,
  lesson: string,
  cols: number,
  values: number[],
): LinkLesson {
  return { title, lesson, rows: values.length / cols, cols, board: values };
}
function frame(inner: number[], width: number) {
  const h = inner.length / width,
    cols = width + 2,
    rows = h + 2,
    result = Array<number>(cols * rows).fill(-1);
  for (let r = 0; r < h; r++)
    for (let c = 0; c < width; c++)
      result[(r + 1) * cols + c + 1] = inner[r * width + c];
  const ring: number[] = [];
  for (let c = 0; c < cols; c++) ring.push(c);
  for (let r = 1; r < rows; r++) ring.push(r * cols + cols - 1);
  for (let c = cols - 2; c >= 0; c--) ring.push((rows - 1) * cols + c);
  for (let r = rows - 2; r > 0; r--) ring.push(r * cols);
  const offset = Math.max(...inner) + 1;
  ring.forEach((cell, i) => {
    result[cell] = offset + Math.floor(i / 2);
  });
  return result;
}
const middle = [0, 1, 2, 0, 3, 4, 4, 5, 3, 6, 6, 5, 1, 7, 7, 2];
export const gardenLinksLevels = [
  board(
    "绕到外面去",
    "相同花牌之间，可以画一条最多转两次弯的空路。路径也能绕过棋盘边缘。",
    4,
    [0, 1, 1, 0, 2, 3, 3, 2],
  ),
  board(
    "竖着也能连",
    "相同的字可以上下相连；中间不能穿过任何尚未收起的牌。",
    4,
    [0, 1, 2, 0, 3, 1, 2, 4, 3, 5, 5, 4],
  ),
  board(
    "先打开边线",
    "中间的牌会挡路。先收起边缘或相邻的对子，为远处的伙伴留出通道。",
    4,
    middle,
  ),
  board(
    "花圃的通道",
    "一次消除会改变后面的路径。多看看刚刚腾出的空格。",
    5,
    [0, 1, 2, 3, 0, 4, 5, 6, 5, 7, 4, 8, 6, 8, 7, 1, 9, 2, 9, 3],
  ),
  board(
    "错开的伙伴",
    "斜着相邻不能直接连。需要由横线与竖线组成的清楚路径。",
    4,
    [0, 1, 2, 0, 3, 4, 5, 6, 3, 7, 5, 6, 8, 4, 7, 9, 8, 1, 2, 9],
  ),
  board(
    "六列小花房",
    "外圈道路始终存在，但仍然最多只能转两次弯。",
    6,
    [
      0, 1, 2, 3, 4, 0, 5, 6, 7, 6, 8, 9, 5, 10, 7, 10, 8, 9, 1, 11, 2, 11, 3,
      4,
    ],
  ),
  board(
    "围廊之内",
    "先解开外围，再让里面的小路连通；收牌不会触发重力移动。",
    6,
    frame([0, 1, 2, 0, 3, 1, 2, 4, 3, 5, 5, 4], 4),
  ),
  board(
    "满园相连",
    "十八对花牌。一步步腾出空路，直到棋盘上没有任何一张牌。",
    6,
    frame(middle, 4),
  ),
];
export function findGardenLink(
  level: LinkLesson,
  state: readonly (number | null)[],
  from: number,
  to: number,
): LinkPoint[] | null {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= state.length ||
    to >= state.length ||
    state[from] === null ||
    state[from] !== state[to]
  )
    return null;
  const start = {
      row: Math.floor(from / level.cols) + 1,
      col: (from % level.cols) + 1,
    },
    end = { row: Math.floor(to / level.cols) + 1, col: (to % level.cols) + 1 };
  const directions = [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ],
    queue = [{ ...start, direction: -1, turns: 0, path: [start] }],
    seen = new Map<string, number>();
  for (let i = 0; i < queue.length; i++) {
    const s = queue[i];
    for (let d = 0; d < 4; d++) {
      const row = s.row + directions[d][0],
        col = s.col + directions[d][1],
        turns = s.turns + (s.direction !== -1 && s.direction !== d ? 1 : 0);
      if (
        turns > 2 ||
        row < 0 ||
        col < 0 ||
        row > level.rows + 1 ||
        col > level.cols + 1
      )
        continue;
      if (row === end.row && col === end.col) return [...s.path, { row, col }];
      if (
        row > 0 &&
        row <= level.rows &&
        col > 0 &&
        col <= level.cols &&
        state[(row - 1) * level.cols + col - 1] !== null
      )
        continue;
      const key = `${row},${col},${d}`;
      if ((seen.get(key) ?? 99) <= turns) continue;
      seen.set(key, turns);
      queue.push({
        row,
        col,
        direction: d,
        turns,
        path: [...s.path, { row, col }],
      });
    }
  }
  return null;
}
export function gardenLinkMoves(level: LinkLesson, state: LinkBoard) {
  const moves: { from: number; to: number; path: LinkPoint[] }[] = [];
  for (let a = 0; a < state.length; a++)
    if (state[a] !== null)
      for (let b = a + 1; b < state.length; b++)
        if (state[a] === state[b]) {
          const path = findGardenLink(level, state, a, b);
          if (path) moves.push({ from: a, to: b, path });
        }
  return moves;
}
export function gardenLinksHint(level: LinkLesson, start: LinkBoard) {
  let visited = 0,
    limited = false;
  const dead = new Set<string>();
  function search(state: LinkBoard): [number, number][] | null {
    if (state.every((v) => v === null)) return [];
    if (++visited > 2500) {
      limited = true;
      return null;
    }
    const key = state
      .map((v) => (v === null ? "." : String.fromCharCode(65 + v)))
      .join("");
    if (dead.has(key)) return null;
    for (const m of gardenLinkMoves(level, state)) {
      const next = state.map((v, i) => (i === m.from || i === m.to ? null : v)),
        tail = search(next);
      if (tail) return [[m.from, m.to], ...tail];
      if (limited) return null;
    }
    dead.add(key);
    return null;
  }
  const plan = search(start);
  return { plan, status: plan ? "solved" : limited ? "limit" : "impossible" };
}
