import {
  networkHint,
  searchNetwork,
  validNetworkValues,
  type NetworkSearch,
} from "./networkDeductionCore";
export type SlitherlinkEdge = {
  a: number;
  b: number;
  row: number;
  col: number;
  orientation: "h" | "v";
  cells: number[];
};
export type SlitherlinkLevel = {
  title: string;
  rows: number;
  cols: number;
  clues: number[];
  solution: number[];
  idea: string;
};
export function validSlitherlinkLevel(level: SlitherlinkLevel): boolean {
  return (
    !!level &&
    Number.isInteger(level.rows) &&
    level.rows >= 1 &&
    level.rows <= 6 &&
    Number.isInteger(level.cols) &&
    level.cols >= 1 &&
    level.cols <= 6 &&
    Array.isArray(level.clues) &&
    level.clues.length === level.rows * level.cols &&
    level.clues.every(
      (value) => Number.isInteger(value) && value >= -1 && value <= 3,
    )
  );
}
/** Stable order: all horizontal edges by row, then all vertical edges by row. */
export function slitherlinkEdges(level: SlitherlinkLevel): SlitherlinkEdge[] {
  if (!validSlitherlinkLevel(level)) return [];
  const { rows, cols } = level,
    edges: SlitherlinkEdge[] = [];
  for (let row = 0; row <= rows; row++)
    for (let col = 0; col < cols; col++)
      edges.push({
        a: row * (cols + 1) + col,
        b: row * (cols + 1) + col + 1,
        row,
        col,
        orientation: "h",
        cells: [
          row > 0 ? (row - 1) * cols + col : -1,
          row < rows ? row * cols + col : -1,
        ].filter((i) => i >= 0),
      });
  for (let row = 0; row < rows; row++)
    for (let col = 0; col <= cols; col++)
      edges.push({
        a: row * (cols + 1) + col,
        b: (row + 1) * (cols + 1) + col,
        row,
        col,
        orientation: "v",
        cells: [
          col > 0 ? row * cols + col - 1 : -1,
          col < cols ? row * cols + col : -1,
        ].filter((i) => i >= 0),
      });
  return edges;
}
export function slitherlinkCounts(
  level: SlitherlinkLevel,
  values: readonly number[],
): number[] {
  const counts = level.clues.map(() => 0);
  slitherlinkEdges(level).forEach((edge, i) => {
    if (values[i] === 1) edge.cells.forEach((cell) => counts[cell]++);
  });
  return counts;
}
export function isSlitherlinkSolved(
  level: SlitherlinkLevel,
  values: readonly number[],
): boolean {
  if (!validSlitherlinkLevel(level)) return false;
  const edges = slitherlinkEdges(level);
  if (
    !validNetworkValues(values, edges.length, 1) ||
    !values.includes(1) ||
    slitherlinkCounts(level, values).some(
      (count, i) => level.clues[i] >= 0 && count !== level.clues[i],
    )
  )
    return false;
  const degrees = Array.from(
    { length: (level.rows + 1) * (level.cols + 1) },
    () => 0,
  );
  edges.forEach(({ a, b }, i) => {
    if (values[i] === 1) {
      degrees[a]++;
      degrees[b]++;
    }
  });
  if (degrees.some((degree) => degree !== 0 && degree !== 2)) return false;
  const first = edges[values.indexOf(1)].a,
    seen = new Set([first]),
    queue = [first];
  for (const node of queue)
    edges.forEach(({ a, b }, i) => {
      if (values[i] !== 1) return;
      const next = a === node ? b : b === node ? a : -1;
      if (next >= 0 && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    });
  return degrees.every((degree, i) => !degree || seen.has(i));
}
export function slitherlinkConflicts(
  level: SlitherlinkLevel,
  values: readonly number[],
): number[] {
  if (!validSlitherlinkLevel(level)) return [];
  const edges = slitherlinkEdges(level),
    conflicts = new Set<number>();
  if (!validNetworkValues(values, edges.length, 1))
    return edges.map((_, i) => i);
  level.clues.forEach((clue, cell) => {
    if (clue < 0) return;
    const surrounding = edges.flatMap((edge, i) =>
        edge.cells.includes(cell) ? [i] : [],
      ),
      count = surrounding.filter((i) => values[i] === 1).length,
      unknown = surrounding.filter((i) => values[i] < 0).length;
    if (count > clue || count + unknown < clue)
      surrounding.forEach((i) => conflicts.add(i));
  });
  for (let vertex = 0; vertex < (level.rows + 1) * (level.cols + 1); vertex++) {
    const incident = edges.flatMap((edge, i) =>
        edge.a === vertex || edge.b === vertex ? [i] : [],
      ),
      count = incident.filter((i) => values[i] === 1).length;
    if (count > 2 || (count === 1 && incident.every((i) => values[i] >= 0)))
      incident.forEach((i) => conflicts.add(i));
  }
  return [...conflicts];
}
export function searchSlitherlink(
  level: SlitherlinkLevel,
  values?: readonly number[],
  maxSolutions = 2,
  nodeLimit?: number,
): NetworkSearch {
  if (!validSlitherlinkLevel(level))
    return { solutions: [], nodes: 0, status: "invalid" };
  const edges = slitherlinkEdges(level),
    board = values ?? edges.map(() => -1);
  if (!validNetworkValues(board, edges.length, 1))
    return { solutions: [], nodes: 0, status: "invalid" };
  const rules = level.clues.flatMap((clue, cell) =>
    clue < 0
      ? []
      : [
          {
            edges: edges.flatMap((edge, i) =>
              edge.cells.includes(cell) ? [i] : [],
            ),
            totals: [clue],
          },
        ],
  );
  for (let vertex = 0; vertex < (level.rows + 1) * (level.cols + 1); vertex++)
    rules.push({
      edges: edges.flatMap((edge, i) =>
        edge.a === vertex || edge.b === vertex ? [i] : [],
      ),
      totals: [0, 2],
    });
  return searchNetwork({
    values: board,
    maximum: 1,
    rules,
    accept: (solution) => isSlitherlinkSolved(level, solution),
    maxSolutions,
    nodeLimit,
  });
}
export function getSlitherlinkHint(
  level: SlitherlinkLevel,
  values: readonly number[],
  nodeLimit?: number,
) {
  return networkHint(
    values,
    (board, budget) => searchSlitherlink(level, board, 64, budget),
    isSlitherlinkSolved(level, values),
    nodeLimit,
  );
}
export const slitherlinkLevels: SlitherlinkLevel[] = [
  {
    title: "沿边画圈",
    rows: 2,
    cols: 2,
    clues: [3, 3, 1, 1],
    solution: [1, 1, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0],
    idea: "数字表示格子四周画线的数量。",
  },
  {
    title: "留白一格",
    rows: 2,
    cols: 2,
    clues: [1, 3, 1, -1],
    solution: [0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 1, 1],
    idea: "空白格没有数字限制，圆点仍不能分岔。",
  },
  {
    title: "小径转弯",
    rows: 3,
    cols: 3,
    clues: [1, 3, 2, 0, 2, 3, 0, 0, 1],
    solution: [
      0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0,
    ],
    idea: "每个被使用的圆点都恰好连接两条线。",
  },
  {
    title: "圈外空地",
    rows: 3,
    cols: 3,
    clues: [0, -1, 3, 2, 2, 1, -1, 1, 2],
    solution: [
      0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1,
    ],
    idea: "数字 0 周围不能画线，可以标叉帮助排除。",
  },
  {
    title: "穿过转角",
    rows: 3,
    cols: 3,
    clues: [0, 1, -1, 2, -1, 2, -1, 1, 2],
    solution: [
      0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1,
    ],
    idea: "不要提前闭合小圈；最终只能有一个环。",
  },
  {
    title: "四方花田",
    rows: 4,
    cols: 4,
    clues: [0, 0, 0, 0, 0, -1, 1, 0, 1, 2, 2, 2, -1, 2, 1, 3],
    solution: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1,
    ],
    idea: "先从 0 和 3 入手，再连接转角。",
  },
  {
    title: "折返小路",
    rows: 4,
    cols: 4,
    clues: [1, 1, -1, 1, 2, 1, 1, -1, 1, 0, 1, 2, 2, 2, -1, -1],
    solution: [
      0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0,
      1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 0,
    ],
    idea: "同时观察相邻格共享的那一条边。",
  },
  {
    title: "留白渐多",
    rows: 4,
    cols: 4,
    clues: [2, -1, -1, 2, 1, 0, 1, 2, 2, -1, -1, -1, 1, 1, -1, 0],
    solution: [
      1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1,
      1, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0,
    ],
    idea: "留白需要依靠圆点连接规则推理。",
  },
  {
    title: "五排花圃",
    rows: 5,
    cols: 5,
    clues: [
      0, -1, 1, 0, 0, -1, 2, 3, 2, 0, 1, 2, 0, 2, 1, -1, 1, 0, 1, -1, 1, 2, 1,
      2, 1,
    ],
    solution: [
      0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1,
      0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    ],
    idea: "更大的棋盘仍只有一个连续闭环。",
  },
  {
    title: "相邻线索",
    rows: 5,
    cols: 5,
    clues: [
      2, 2, -1, 0, 0, 1, 0, -1, -1, 0, 1, 1, 3, 1, -1, 1, 0, 1, -1, 2, 2, 1, -1,
      1, 2,
    ],
    solution: [
      1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0,
      1, 1, 1, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0,
      0, 0, 0, 1, 1, 0, 0, 0, 0, 1,
    ],
    idea: "排除会让路径断头或分岔的边。",
  },
  {
    title: "曲折回廊",
    rows: 5,
    cols: 5,
    clues: [
      -1, -1, 2, 1, -1, 1, 3, 0, 0, 1, -1, 2, 1, 0, 1, 0, -1, 2, -1, 2, 0, -1,
      2, -1, 2,
    ],
    solution: [
      0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1,
      0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
      1, 0, 0, 1, 0, 0, 0, 1, 1, 0,
    ],
    idea: "数字够了就停止添线，再检查环的走向。",
  },
  {
    title: "唯一花环",
    rows: 5,
    cols: 5,
    clues: [
      3, -1, -1, -1, -1, 1, 1, 1, 3, 1, 1, 0, 1, 3, 0, -1, 0, -1, 3, -1, 2, 1,
      -1, -1, -1,
    ],
    solution: [
      1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0,
      1, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0,
      0, 0, 1, 0, 1, 0, 0, 1, 0, 0,
    ],
    idea: "连成一圈，并逐一核对所有保留的数字。",
  },
];
export const slitherlinkSolutions = slitherlinkLevels.map(
  (level) => level.solution,
);
