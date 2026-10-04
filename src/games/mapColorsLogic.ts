import type { StrokeNode } from "./oneStrokeLogic";
export type MapEdge = readonly [number, number];
export type MapColorsLevel = {
  title: string;
  nodes: readonly StrokeNode[];
  edges: readonly MapEdge[];
  colorCount: number;
  solution: readonly number[];
  idea: string;
};
export type MapColorsState = { colors: number[]; history: number[][] };
export const mapColorPalette = [
  { name: "青绿", symbol: "●", background: "#bfe2c4", foreground: "#184e3c" },
  { name: "暖黄", symbol: "▲", background: "#f5d991", foreground: "#75521d" },
  { name: "湖蓝", symbol: "■", background: "#b9dce7", foreground: "#285f78" },
  { name: "藤紫", symbol: "◆", background: "#d9c8ed", foreground: "#664187" },
] as const;
function authored(
  title: string,
  points: [number, number][],
  edges: MapEdge[],
  colorCount: number,
  solution: number[],
  idea: string,
): MapColorsLevel {
  return {
    title,
    nodes: points.map(([x, y], i) => ({
      x,
      y,
      label: String.fromCharCode(65 + i),
    })),
    edges,
    colorCount,
    solution,
    idea,
  };
}
const cycle = (count: number): MapEdge[] =>
  Array.from({ length: count }, (_, i) => [i, (i + 1) % count] as const);
const wheel = (count: number): MapEdge[] => [
  ...cycle(count),
  ...Array.from({ length: count }, (_, i) => [i, count] as const),
];
export const mapColorsLevels: readonly MapColorsLevel[] = [
  authored(
    "四间小花房",
    [
      [15, 30],
      [38, 70],
      [62, 30],
      [85, 70],
    ],
    [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
    2,
    [0, 1, 0, 1],
    "只有连线相接的花房才是邻居。两种颜色轮流用，就能铺开一条小路。",
  ),
  authored(
    "绕池塘一圈",
    [
      [22, 22],
      [78, 22],
      [78, 78],
      [22, 78],
    ],
    cycle(4),
    2,
    [0, 1, 0, 1],
    "最后一间也和第一间相邻。转完一圈，别忘了检查接缝。",
  ),
  authored(
    "中央苗圃",
    [
      [50, 50],
      [18, 18],
      [82, 18],
      [82, 82],
      [18, 82],
    ],
    [
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ],
    2,
    [0, 1, 1, 1, 1],
    "外面的花房彼此不相邻，可以共用一种颜色。邻居只看连线。",
  ),
  authored(
    "六角花园的近路",
    [
      [50, 12],
      [83, 30],
      [83, 70],
      [50, 88],
      [17, 70],
      [17, 30],
    ],
    [...cycle(6), [0, 3]],
    2,
    [0, 1, 0, 1, 0, 1],
    "多了一条近路，但仍然只需要两种颜色。试着先安排交会最多的花房。",
  ),
  authored(
    "三角小镇",
    [
      [50, 20],
      [28, 55],
      [72, 55],
      [15, 85],
      [85, 85],
    ],
    [
      [0, 1],
      [1, 2],
      [2, 0],
      [1, 3],
      [2, 4],
    ],
    3,
    [0, 1, 2, 0, 0],
    "三间互为邻居的花房，需要三种不同颜色。远处的颜色可以重复。",
  ),
  authored(
    "四季庭院",
    [
      [22, 22],
      [78, 22],
      [78, 78],
      [22, 78],
      [50, 50],
    ],
    wheel(4),
    3,
    [0, 1, 0, 1, 2],
    "中心与每一间外屋相邻。给中心留一种颜色，再安排外圈。",
  ),
  authored(
    "里外两座院",
    [
      [50, 10],
      [88, 85],
      [12, 85],
      [50, 35],
      [65, 70],
      [35, 70],
    ],
    [
      [0, 1],
      [1, 2],
      [2, 0],
      [3, 4],
      [4, 5],
      [5, 3],
      [0, 3],
      [1, 4],
      [2, 5],
    ],
    3,
    [0, 1, 2, 1, 2, 0],
    "内外院可以轮换颜色。上下相接的两间，也要互相照顾。",
  ),
  authored(
    "九宫花街",
    [
      [15, 15],
      [50, 15],
      [85, 15],
      [15, 50],
      [50, 50],
      [85, 50],
      [15, 85],
      [50, 85],
      [85, 85],
    ],
    [
      [0, 1],
      [1, 2],
      [3, 4],
      [4, 5],
      [6, 7],
      [7, 8],
      [0, 3],
      [3, 6],
      [1, 4],
      [4, 7],
      [2, 5],
      [5, 8],
      [0, 4],
      [4, 8],
    ],
    3,
    [0, 1, 2, 1, 2, 0, 2, 0, 1],
    "斜向的小径也算相邻。看到符号相同的邻居，就给其中一间换个颜色。",
  ),
  authored(
    "第四种花色",
    [
      [50, 12],
      [85, 83],
      [15, 83],
      [50, 53],
    ],
    [
      [0, 1],
      [1, 2],
      [2, 0],
      [0, 3],
      [1, 3],
      [2, 3],
    ],
    4,
    [0, 1, 2, 3],
    "这四间花房两两相连。第四种颜色刚好能把它们区分开。",
  ),
  authored(
    "五瓣环城",
    [
      [50, 12],
      [86, 39],
      [72, 82],
      [28, 82],
      [14, 39],
      [50, 50],
    ],
    wheel(5),
    4,
    [0, 1, 0, 1, 2, 3],
    "外圈有奇数间，交替两色会在最后相遇。为接缝准备第三种色吧。",
  ),
  authored(
    "南北双庭",
    [
      [15, 50],
      [85, 50],
      [50, 10],
      [50, 90],
      [50, 32],
      [50, 68],
    ],
    [
      [0, 1],
      [0, 2],
      [1, 2],
      [0, 4],
      [1, 4],
      [2, 4],
      [0, 3],
      [1, 3],
      [0, 5],
      [1, 5],
      [3, 5],
    ],
    4,
    [0, 1, 2, 2, 3, 3],
    "两座庭院共用一条街。没有连线的南北花房，可以使用一样的颜色。",
  ),
  authored(
    "七瓣缤纷城",
    [
      [50, 11],
      [80, 26],
      [88, 59],
      [67, 85],
      [33, 85],
      [12, 59],
      [20, 26],
      [50, 50],
    ],
    wheel(7),
    4,
    [0, 1, 0, 1, 0, 1, 2, 3],
    "先看邻居最多的中心，再照顾七间外屋。任何满足规则的配色都算成功。",
  ),
];
export function mapAdjacency(
  level: Pick<MapColorsLevel, "nodes" | "edges">,
): number[][] {
  const neighbors: number[][] = level.nodes.map(() => []);
  for (const [a, b] of level.edges) {
    if (a === b || !neighbors[a] || !neighbors[b]) continue;
    if (!neighbors[a].includes(b)) neighbors[a].push(b);
    if (!neighbors[b].includes(a)) neighbors[b].push(a);
  }
  return neighbors.map((list) => list.sort((a, b) => a - b));
}
export function verifyMapGraph(level: MapColorsLevel): boolean {
  if (
    level.nodes.length < 2 ||
    level.nodes.length > 20 ||
    level.edges.length > 80 ||
    !Number.isInteger(level.colorCount) ||
    level.colorCount < 2 ||
    level.colorCount > 4
  )
    return false;
  if (
    level.nodes.some(
      (node) =>
        !Number.isFinite(node.x) ||
        !Number.isFinite(node.y) ||
        node.x < 0 ||
        node.x > 100 ||
        node.y < 0 ||
        node.y > 100,
    )
  )
    return false;
  const keys = new Set<string>();
  for (const [a, b] of level.edges) {
    const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
    if (
      !Number.isInteger(a) ||
      !Number.isInteger(b) ||
      !level.nodes[a] ||
      !level.nodes[b] ||
      a === b ||
      keys.has(key)
    )
      return false;
    keys.add(key);
  }
  const adjacency = mapAdjacency(level);
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length)
    for (const next of adjacency[queue.pop()!])
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
  return seen.size === level.nodes.length;
}
export function createMapColorsState(level: MapColorsLevel): MapColorsState {
  return { colors: level.nodes.map(() => -1), history: [] };
}
export function mapColorConflicts(
  level: MapColorsLevel,
  colors: readonly number[],
): MapEdge[] {
  return level.edges.filter(
    ([a, b]) => colors[a] >= 0 && colors[a] === colors[b],
  );
}
function validColors(level: MapColorsLevel, colors: readonly number[]) {
  return (
    colors.length === level.nodes.length &&
    colors.every(
      (color) =>
        Number.isInteger(color) && color >= -1 && color < level.colorCount,
    )
  );
}
export function isMapColorsSolved(
  level: MapColorsLevel,
  colors: readonly number[],
): boolean {
  return (
    validColors(level, colors) &&
    colors.every((color) => color >= 0) &&
    mapColorConflicts(level, colors).length === 0
  );
}
export function paintMapNode(
  level: MapColorsLevel,
  state: MapColorsState,
  node: number,
  color: number,
): MapColorsState {
  if (
    !Number.isInteger(node) ||
    !level.nodes[node] ||
    !Number.isInteger(color) ||
    color < -1 ||
    color >= level.colorCount ||
    state.colors[node] === color
  )
    return state;
  const colors = [...state.colors];
  colors[node] = color;
  return { colors, history: [...state.history, [...state.colors]] };
}
export function undoMapColors(state: MapColorsState): MapColorsState {
  const previous = state.history.at(-1);
  return previous
    ? { colors: [...previous], history: state.history.slice(0, -1) }
    : state;
}
export type MapSearchResult = {
  status: "solved" | "impossible" | "limit";
  colors: number[] | null;
  visited: number;
};
/** Deterministic DSATUR search. A shared, explicit node budget also bounds hint recovery. */
export function solveMapColors(
  level: MapColorsLevel,
  partial: readonly number[] = level.nodes.map(() => -1),
  maxVisits = 50_000,
): MapSearchResult {
  if (
    !verifyMapGraph(level) ||
    !validColors(level, partial) ||
    mapColorConflicts(level, partial).length
  )
    return { status: "impossible", colors: null, visited: 0 };
  const budget = Math.max(
    0,
    Math.min(
      100_000,
      Number.isFinite(maxVisits) ? Math.floor(maxVisits) : 50_000,
    ),
  );
  const colors = [...partial],
    adjacency = mapAdjacency(level);
  let visited = 0,
    exhausted = false;
  function search(): boolean {
    if (visited >= budget) {
      exhausted = true;
      return false;
    }
    visited++;
    let node = -1,
      bestSaturation = -1,
      bestDegree = -1;
    for (let i = 0; i < colors.length; i++) {
      if (colors[i] >= 0) continue;
      const saturation = new Set(
        adjacency[i].map((n) => colors[n]).filter((c) => c >= 0),
      ).size;
      if (
        saturation > bestSaturation ||
        (saturation === bestSaturation && adjacency[i].length > bestDegree)
      ) {
        node = i;
        bestSaturation = saturation;
        bestDegree = adjacency[i].length;
      }
    }
    if (node < 0) return true;
    const forbidden = new Set(adjacency[node].map((n) => colors[n]));
    for (let color = 0; color < level.colorCount; color++) {
      if (forbidden.has(color)) continue;
      colors[node] = color;
      if (search()) return true;
      colors[node] = -1;
      if (exhausted) return false;
    }
    return false;
  }
  const solved = search();
  return {
    status: solved ? "solved" : exhausted ? "limit" : "impossible",
    colors: solved ? colors : null,
    visited,
  };
}
export type MapColorsHint = {
  kind: "paint" | "undo" | "complete" | "unavailable";
  node: number | null;
  color: number | null;
  undoSteps: number;
};
export function mapColorsHint(
  level: MapColorsLevel,
  state: MapColorsState,
): MapColorsHint {
  if (isMapColorsSolved(level, state.colors))
    return { kind: "complete", node: null, color: null, undoSteps: 0 };
  let budget = 50_000;
  for (let undoSteps = 0; undoSteps <= state.history.length; undoSteps++) {
    const colors =
      undoSteps === 0
        ? state.colors
        : state.history[state.history.length - undoSteps];
    const solution = solveMapColors(level, colors, budget);
    budget -= Math.max(1, solution.visited);
    if (solution.status === "limit" || budget <= 0) break;
    if (solution.colors) {
      const node = colors.findIndex((color) => color < 0);
      return {
        kind: undoSteps ? "undo" : "paint",
        node: node < 0 ? null : node,
        color: node < 0 ? null : solution.colors[node],
        undoSteps,
      };
    }
  }
  return { kind: "unavailable", node: null, color: null, undoSteps: 0 };
}
export function verifyMapColorsLevel(level: MapColorsLevel): boolean {
  return (
    verifyMapGraph(level) &&
    isMapColorsSolved(level, level.solution) &&
    solveMapColors(level).status === "solved"
  );
}
export const mapColorsSolutions = mapColorsLevels.map(
  (level) => level.solution,
);
