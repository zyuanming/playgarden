// SPDX-License-Identifier: GPL-3.0-only
// Original region layouts, rules and bounded completion search.
export type StarBattleLevel = { id: string; title: string; size: number; regions: number[]; solution: number[]; lesson: string };
export type StarMark = 0 | 1 | 2;
export type StarBattleState = { marks: StarMark[]; history: StarMark[][] };
export const starBattleLevels: StarBattleLevel[] = [
  {
    "id": "star-01",
    "title": "第一片星空",
    "size": 5,
    "regions": [
      0,
      0,
      1,
      1,
      1,
      2,
      0,
      1,
      1,
      1,
      2,
      2,
      2,
      4,
      4,
      3,
      3,
      3,
      4,
      4,
      3,
      3,
      3,
      4,
      4
    ],
    "solution": [
      1,
      8,
      10,
      17,
      24
    ],
    "lesson": "先看小区域，再让每一行都有自己的星星。"
  },
  {
    "id": "star-02",
    "title": "斜角的距离",
    "size": 5,
    "regions": [
      1,
      0,
      0,
      0,
      0,
      1,
      1,
      0,
      2,
      2,
      1,
      3,
      2,
      2,
      2,
      3,
      3,
      4,
      4,
      4,
      3,
      3,
      3,
      4,
      4
    ],
    "solution": [
      2,
      5,
      13,
      16,
      24
    ],
    "lesson": "两颗星星即使分属不同区域，也不能斜着相邻。"
  },
  {
    "id": "star-03",
    "title": "六色星图",
    "size": 6,
    "regions": [
      0,
      0,
      0,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      1,
      3,
      3,
      4,
      1,
      2,
      2,
      3,
      3,
      4,
      4,
      5,
      2,
      3,
      3,
      4,
      4,
      5,
      2,
      3,
      4,
      4,
      5,
      5,
      5
    ],
    "solution": [
      1,
      9,
      17,
      18,
      26,
      34
    ],
    "lesson": "同时照顾行、列和区域，三种约束缺一不可。"
  },
  {
    "id": "star-04",
    "title": "弯曲的星河",
    "size": 6,
    "regions": [
      2,
      0,
      0,
      0,
      1,
      1,
      2,
      2,
      0,
      0,
      1,
      1,
      2,
      2,
      2,
      0,
      3,
      1,
      4,
      4,
      5,
      5,
      3,
      3,
      4,
      4,
      5,
      5,
      3,
      3,
      4,
      4,
      5,
      5,
      5,
      3
    ],
    "solution": [
      2,
      11,
      13,
      22,
      24,
      33
    ],
    "lesson": "同一区域可能跨越多行，沿着粗边框辨认它。"
  },
  {
    "id": "star-05",
    "title": "交错的轨迹",
    "size": 6,
    "regions": [
      1,
      0,
      0,
      0,
      0,
      0,
      1,
      1,
      1,
      0,
      0,
      2,
      3,
      3,
      2,
      2,
      2,
      2,
      3,
      3,
      5,
      2,
      4,
      4,
      3,
      3,
      5,
      5,
      4,
      4,
      3,
      3,
      5,
      5,
      4,
      4
    ],
    "solution": [
      3,
      6,
      16,
      19,
      29,
      32
    ],
    "lesson": "一颗星星会排除周围八格，也会占住整行整列。"
  },
  {
    "id": "star-06",
    "title": "七区观测站",
    "size": 7,
    "regions": [
      0,
      0,
      1,
      1,
      2,
      2,
      3,
      0,
      0,
      1,
      1,
      2,
      2,
      3,
      0,
      4,
      1,
      1,
      2,
      2,
      3,
      4,
      4,
      1,
      5,
      2,
      3,
      3,
      4,
      4,
      5,
      5,
      2,
      3,
      3,
      4,
      5,
      5,
      5,
      6,
      6,
      6,
      4,
      5,
      5,
      6,
      6,
      6,
      6
    ],
    "solution": [
      0,
      9,
      18,
      27,
      29,
      38,
      47
    ],
    "lesson": "用叉号记下排除的位置，叉号不是必填答案。"
  },
  {
    "id": "star-07",
    "title": "边缘的线索",
    "size": 7,
    "regions": [
      0,
      0,
      0,
      0,
      1,
      1,
      1,
      2,
      2,
      0,
      0,
      1,
      1,
      1,
      2,
      2,
      2,
      0,
      1,
      1,
      5,
      2,
      2,
      3,
      3,
      3,
      3,
      5,
      4,
      4,
      4,
      3,
      3,
      5,
      5,
      4,
      4,
      4,
      6,
      3,
      5,
      5,
      6,
      6,
      6,
      6,
      6,
      6,
      5
    ],
    "solution": [
      2,
      12,
      15,
      25,
      28,
      41,
      45
    ],
    "lesson": "先观察边缘区域，别让最后一列无处落星。"
  },
  {
    "id": "star-08",
    "title": "星区会合",
    "size": 7,
    "regions": [
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      1,
      1,
      1,
      0,
      0,
      2,
      2,
      1,
      4,
      3,
      3,
      3,
      2,
      2,
      4,
      4,
      4,
      3,
      3,
      2,
      2,
      4,
      4,
      4,
      3,
      3,
      5,
      2,
      4,
      6,
      6,
      6,
      5,
      5,
      5,
      6,
      6,
      6,
      6,
      5,
      5,
      5
    ],
    "solution": [
      4,
      8,
      20,
      24,
      28,
      40,
      44
    ],
    "lesson": "检查剩余行与剩余区域是否还能一一对应。"
  },
  {
    "id": "star-09",
    "title": "八方夜色",
    "size": 8,
    "regions": [
      0,
      0,
      0,
      1,
      1,
      1,
      1,
      2,
      0,
      0,
      0,
      1,
      1,
      1,
      1,
      2,
      3,
      3,
      3,
      1,
      1,
      4,
      4,
      2,
      3,
      5,
      3,
      3,
      4,
      4,
      2,
      2,
      5,
      5,
      5,
      3,
      4,
      4,
      2,
      2,
      5,
      5,
      6,
      6,
      4,
      4,
      4,
      2,
      5,
      6,
      6,
      6,
      7,
      7,
      7,
      7,
      5,
      6,
      6,
      6,
      7,
      7,
      7,
      7
    ],
    "solution": [
      1,
      12,
      23,
      26,
      37,
      40,
      51,
      62
    ],
    "lesson": "先留出间隔，再找每个弯曲星区的落点。"
  },
  {
    "id": "star-10",
    "title": "星图收藏家",
    "size": 8,
    "regions": [
      1,
      1,
      1,
      0,
      0,
      0,
      2,
      2,
      1,
      1,
      1,
      0,
      0,
      2,
      2,
      2,
      1,
      1,
      3,
      0,
      0,
      2,
      2,
      2,
      4,
      4,
      3,
      3,
      3,
      5,
      2,
      2,
      4,
      4,
      3,
      3,
      3,
      5,
      5,
      5,
      4,
      4,
      6,
      6,
      6,
      5,
      5,
      5,
      4,
      4,
      6,
      6,
      7,
      7,
      7,
      5,
      6,
      6,
      6,
      6,
      7,
      7,
      7,
      7
    ],
    "solution": [
      4,
      9,
      22,
      27,
      32,
      47,
      50,
      61
    ],
    "lesson": "把区域、行列和不相邻规则放在一起推理。"
  }
];
export const STAR_BATTLE_SEARCH_LIMIT = 100000;
export function createStarBattleState(level: StarBattleLevel): StarBattleState {
  return { marks: Array<StarMark>(level.size * level.size).fill(0), history: [] };
}
const validMarks = (level: StarBattleLevel, marks: readonly StarMark[]) =>
  marks.length === level.size * level.size && marks.every((v) => v === 0 || v === 1 || v === 2);
export function starBattleConflicts(level: StarBattleLevel, marks: readonly StarMark[]): number[] {
  if (!validMarks(level, marks)) return [];
  const stars = marks.flatMap((v, i) => v === 1 ? [i] : []), conflicts = new Set<number>();
  for (let a = 0; a < stars.length; a++) for (let b = a + 1; b < stars.length; b++) {
    const x = stars[a], y = stars[b], n = level.size;
    const dr = Math.abs(Math.floor(x / n) - Math.floor(y / n)), dc = Math.abs(x % n - y % n);
    if (!dr || !dc || level.regions[x] === level.regions[y] || (dr <= 1 && dc <= 1)) {
      conflicts.add(x); conflicts.add(y);
    }
  }
  return [...conflicts];
}
export function starBattleWon(level: StarBattleLevel, marks: readonly StarMark[]): boolean {
  return validMarks(level, marks) && marks.filter((v) => v === 1).length === level.size && !starBattleConflicts(level, marks).length;
}
export function markStarBattle(level: StarBattleLevel, state: StarBattleState, cell: number, mark: StarMark): StarBattleState {
  if (!Number.isInteger(cell) || cell < 0 || cell >= state.marks.length || !validMarks(level, state.marks) || ![0, 1, 2].includes(mark) || starBattleWon(level, state.marks)) return state;
  const value = state.marks[cell] === mark ? 0 : mark;
  if (value === state.marks[cell]) return state;
  const marks = [...state.marks]; marks[cell] = value;
  return { marks, history: [...state.history, state.marks] };
}
export function undoStarBattle(level: StarBattleLevel, state: StarBattleState): StarBattleState {
  if (starBattleWon(level, state.marks) || !state.history.length) return state;
  return { marks: state.history[state.history.length - 1], history: state.history.slice(0, -1) };
}
export type StarBattleSearch = { status: "solved" | "impossible" | "limit"; solution: number[] | null; visited: number };
export function solveStarBattle(level: StarBattleLevel, marks: readonly StarMark[], maxNodes = STAR_BATTLE_SEARCH_LIMIT): StarBattleSearch {
  if (!validMarks(level, marks) || starBattleConflicts(level, marks).length) return { status: "impossible", solution: null, visited: 0 };
  const n = level.size, stars = marks.flatMap((v, i) => v === 1 ? [i] : []);
  const limit = Number.isFinite(maxNodes) ? Math.max(1, Math.min(STAR_BATTLE_SEARCH_LIMIT, Math.floor(maxNodes))) : STAR_BATTLE_SEARCH_LIMIT;
  let visited = 0, limited = false;
  const compatible = (cell: number) => stars.every((star) => {
    const dr = Math.abs(Math.floor(cell / n) - Math.floor(star / n)), dc = Math.abs(cell % n - star % n);
    return dr !== 0 && dc !== 0 && level.regions[cell] !== level.regions[star] && (dr > 1 || dc > 1);
  });
  const search = (): number[] | null => {
    if (visited >= limit) { limited = true; return null; }
    visited++;
    if (stars.length === n) return [...stars].sort((a, b) => a - b);
    let candidates: number[] | null = null;
    for (let row = 0; row < n; row++) {
      if (stars.some((star) => Math.floor(star / n) === row)) continue;
      const cells = Array.from({ length: n }, (_, col) => row * n + col).filter((cell) => marks[cell] !== 2 && compatible(cell));
      if (!cells.length) return null;
      if (!candidates || cells.length < candidates.length) candidates = cells;
    }
    for (const cell of candidates ?? []) {
      stars.push(cell); const result = search(); stars.pop();
      if (result) return result;
      if (limited) return null;
    }
    return null;
  };
  const solution = search();
  return { status: solution ? "solved" : limited ? "limit" : "impossible", solution, visited };
}
export function starBattleHint(level: StarBattleLevel, state: StarBattleState): { cell: number | null; message: string } {
  if (starBattleWon(level, state.marks)) return { cell: null, message: "星图已经完成，重来或换关可以开始新的星图。" };
  const conflict = starBattleConflicts(level, state.marks)[0];
  if (conflict !== undefined) return { cell: conflict, message: `第 ${Math.floor(conflict / level.size) + 1} 行第 ${conflict % level.size + 1} 列的星星与其他星星冲突，请取下其中一颗。` };
  const result = solveStarBattle(level, state.marks);
  if (result.status === "limit") return { cell: null, message: "本次搜索达到上限，暂时没有可靠建议。可以先检查最小的区域。" };
  const cell = result.solution?.find((index) => state.marks[index] !== 1);
  if (cell !== undefined) return { cell, message: `按当前星星和叉号继续，一种可行安排是在第 ${Math.floor(cell / level.size) + 1} 行第 ${cell % level.size + 1} 列放星星。` };
  return { cell: null, message: "当前星星与叉号的组合无法完成。请撤销最近的尝试，或取下星星、清除叉号后重新推理。" };
}
