import {
  networkHint,
  searchNetwork,
  validNetworkValues,
  type NetworkSearch,
} from "./networkDeductionCore";
export type HashiIsland = { x: number; y: number; bridges: number };
export type HashiEdge = { a: number; b: number };
export type HashiLevel = {
  title: string;
  width: number;
  height: number;
  islands: HashiIsland[];
  solution: number[];
  idea: string;
};
export function validHashiLevel(level: HashiLevel): boolean {
  return (
    !!level &&
    Number.isInteger(level.width) &&
    level.width >= 2 &&
    level.width <= 9 &&
    Number.isInteger(level.height) &&
    level.height >= 2 &&
    level.height <= 9 &&
    Array.isArray(level.islands) &&
    level.islands.length >= 2 &&
    level.islands.length <= 30 &&
    new Set(level.islands.map((p) => `${p?.x},${p?.y}`)).size ===
      level.islands.length &&
    level.islands.every(
      (p) =>
        !!p &&
        Number.isInteger(p.x) &&
        p.x >= 0 &&
        p.x < level.width &&
        Number.isInteger(p.y) &&
        p.y >= 0 &&
        p.y < level.height &&
        Number.isInteger(p.bridges) &&
        p.bridges >= 1 &&
        p.bridges <= 8,
    )
  );
}
/** Only the closest visible island in a row/column can be a neighbor. */
export function hashiEdges(level: HashiLevel): HashiEdge[] {
  if (!validHashiLevel(level)) return [];
  const edges: HashiEdge[] = [];
  level.islands.forEach((a, i) =>
    level.islands.forEach((b, j) => {
      if (j <= i || (a.x !== b.x && a.y !== b.y)) return;
      if (
        level.islands.some(
          (p, k) =>
            k !== i &&
            k !== j &&
            (a.x === b.x
              ? p.x === a.x &&
                p.y > Math.min(a.y, b.y) &&
                p.y < Math.max(a.y, b.y)
              : p.y === a.y &&
                p.x > Math.min(a.x, b.x) &&
                p.x < Math.max(a.x, b.x)),
        )
      )
        return;
      edges.push({ a: i, b: j });
    }),
  );
  return edges;
}
export function hashiCrossings(
  level: HashiLevel,
  edges = hashiEdges(level),
): [number, number][] {
  const crossings: [number, number][] = [];
  edges.forEach((first, i) =>
    edges.forEach((second, j) => {
      if (j <= i) return;
      let a = level.islands[first.a],
        b = level.islands[first.b],
        c = level.islands[second.a],
        d = level.islands[second.b];
      if (a.x === b.x) [a, b, c, d] = [c, d, a, b];
      if (
        a.y === b.y &&
        c.x === d.x &&
        c.x > Math.min(a.x, b.x) &&
        c.x < Math.max(a.x, b.x) &&
        a.y > Math.min(c.y, d.y) &&
        a.y < Math.max(c.y, d.y)
      )
        crossings.push([i, j]);
    }),
  );
  return crossings;
}
function connected(
  count: number,
  edges: HashiEdge[],
  present: (i: number) => boolean,
): boolean {
  const seen = new Set([0]),
    queue = [0];
  for (const node of queue)
    edges.forEach((edge, i) => {
      if (!present(i)) return;
      const other = edge.a === node ? edge.b : edge.b === node ? edge.a : -1;
      if (other >= 0 && !seen.has(other)) {
        seen.add(other);
        queue.push(other);
      }
    });
  return seen.size === count;
}
export function hashiDegrees(
  level: HashiLevel,
  values: readonly number[],
): number[] {
  const degrees = level.islands.map(() => 0);
  hashiEdges(level).forEach(({ a, b }, i) => {
    degrees[a] += Math.max(0, values[i] ?? 0);
    degrees[b] += Math.max(0, values[i] ?? 0);
  });
  return degrees;
}
export function isHashiSolved(
  level: HashiLevel,
  values: readonly number[],
): boolean {
  if (!validHashiLevel(level)) return false;
  const edges = hashiEdges(level);
  return (
    validNetworkValues(values, edges.length, 2) &&
    hashiDegrees(level, values).every(
      (degree, i) => degree === level.islands[i].bridges,
    ) &&
    hashiCrossings(level, edges).every(
      ([a, b]) => values[a] <= 0 || values[b] <= 0,
    ) &&
    connected(level.islands.length, edges, (i) => values[i] > 0)
  );
}
export function hashiConflicts(
  level: HashiLevel,
  values: readonly number[],
): number[] {
  if (!validHashiLevel(level)) return [];
  const edges = hashiEdges(level);
  if (!validNetworkValues(values, edges.length, 2))
    return edges.map((_, i) => i);
  const degrees = hashiDegrees(level, values),
    result = new Set<number>();
  const capacity = level.islands.map((_, island) =>
    edges.reduce(
      (sum, edge, i) =>
        sum +
        (edge.a === island || edge.b === island
          ? values[i] < 0
            ? 2
            : values[i]
          : 0),
      0,
    ),
  );
  edges.forEach(({ a, b }, i) => {
    if (
      degrees[a] > level.islands[a].bridges ||
      degrees[b] > level.islands[b].bridges ||
      capacity[a] < level.islands[a].bridges ||
      capacity[b] < level.islands[b].bridges
    )
      result.add(i);
  });
  hashiCrossings(level, edges).forEach(([a, b]) => {
    if (values[a] > 0 && values[b] > 0) {
      result.add(a);
      result.add(b);
    }
  });
  if (
    degrees.every((degree, i) => degree === level.islands[i].bridges) &&
    !connected(level.islands.length, edges, (i) => values[i] > 0)
  )
    edges.forEach((_, i) => {
      if (values[i] > 0) result.add(i);
    });
  return [...result];
}
export function searchHashi(
  level: HashiLevel,
  values?: readonly number[],
  maxSolutions = 2,
  nodeLimit?: number,
): NetworkSearch {
  if (!validHashiLevel(level))
    return { solutions: [], nodes: 0, status: "invalid" };
  const edges = hashiEdges(level),
    board = values ?? edges.map(() => -1);
  if (!validNetworkValues(board, edges.length, 2))
    return { solutions: [], nodes: 0, status: "invalid" };
  return searchNetwork({
    values: board,
    maximum: 2,
    rules: level.islands.map((island, i) => ({
      edges: edges.flatMap((edge, e) =>
        edge.a === i || edge.b === i ? [e] : [],
      ),
      totals: [island.bridges],
    })),
    incompatible: hashiCrossings(level, edges),
    accept: (solution) => isHashiSolved(level, solution),
    possible: (domains) =>
      connected(level.islands.length, edges, (i) => !!(domains[i] & 6)),
    maxSolutions,
    nodeLimit,
  });
}
export function getHashiHint(
  level: HashiLevel,
  values: readonly number[],
  nodeLimit?: number,
) {
  return networkHint(
    values,
    (board, budget) => searchHashi(level, board, 64, budget),
    isHashiSolved(level, values),
    nodeLimit,
  );
}
export const hashiLevels: HashiLevel[] = [
  {
    title: "初识群岛",
    width: 3,
    height: 3,
    islands: [
      { x: 1, y: 0, bridges: 3 },
      { x: 2, y: 0, bridges: 3 },
      { x: 2, y: 1, bridges: 2 },
      { x: 1, y: 2, bridges: 2 },
    ],
    solution: [1, 2, 2],
    idea: "只有一个邻居的岛，它的数字直接决定桥数。",
  },
  {
    title: "双桥相望",
    width: 3,
    height: 3,
    islands: [
      { x: 2, y: 0, bridges: 1 },
      { x: 0, y: 1, bridges: 2 },
      { x: 1, y: 1, bridges: 5 },
      { x: 2, y: 1, bridges: 3 },
      { x: 1, y: 2, bridges: 1 },
    ],
    solution: [1, 2, 2, 1],
    idea: "一对岛之间最多两座桥；数字是桥的总数。",
  },
  {
    title: "沿岸出发",
    width: 4,
    height: 4,
    islands: [
      { x: 0, y: 0, bridges: 2 },
      { x: 2, y: 1, bridges: 1 },
      { x: 0, y: 2, bridges: 4 },
      { x: 2, y: 2, bridges: 4 },
      { x: 3, y: 2, bridges: 2 },
      { x: 3, y: 3, bridges: 1 },
    ],
    solution: [2, 1, 2, 1, 1],
    idea: "先看末端，再把剩余桥数向内传递。",
  },
  {
    title: "第一条岔路",
    width: 4,
    height: 4,
    islands: [
      { x: 1, y: 0, bridges: 3 },
      { x: 3, y: 0, bridges: 2 },
      { x: 0, y: 1, bridges: 2 },
      { x: 1, y: 1, bridges: 4 },
      { x: 1, y: 2, bridges: 2 },
      { x: 3, y: 2, bridges: 2 },
      { x: 3, y: 3, bridges: 1 },
    ],
    solution: [2, 1, 0, 2, 1, 1, 1],
    idea: "有多条候选航线时，桥不能穿过岛。",
  },
  {
    title: "环湾选择",
    width: 4,
    height: 4,
    islands: [
      { x: 1, y: 0, bridges: 1 },
      { x: 3, y: 0, bridges: 1 },
      { x: 3, y: 1, bridges: 2 },
      { x: 1, y: 2, bridges: 2 },
      { x: 0, y: 3, bridges: 2 },
      { x: 1, y: 3, bridges: 5 },
      { x: 2, y: 3, bridges: 3 },
      { x: 3, y: 3, bridges: 2 },
    ],
    solution: [0, 1, 1, 1, 1, 2, 2, 1],
    idea: "数齐还不够，所有岛必须连成一个整体。",
  },
  {
    title: "岛链相连",
    width: 4,
    height: 4,
    islands: [
      { x: 1, y: 0, bridges: 3 },
      { x: 3, y: 0, bridges: 2 },
      { x: 2, y: 1, bridges: 2 },
      { x: 0, y: 2, bridges: 1 },
      { x: 3, y: 2, bridges: 1 },
      { x: 0, y: 3, bridges: 2 },
      { x: 1, y: 3, bridges: 3 },
      { x: 2, y: 3, bridges: 5 },
      { x: 3, y: 3, bridges: 3 },
    ],
    solution: [2, 1, 0, 2, 0, 1, 1, 1, 1, 2],
    idea: "排除会把小岛群封闭起来的选择。",
  },
  {
    title: "十字海峡",
    width: 5,
    height: 5,
    islands: [
      { x: 1, y: 0, bridges: 1 },
      { x: 3, y: 0, bridges: 2 },
      { x: 1, y: 1, bridges: 3 },
      { x: 2, y: 1, bridges: 1 },
      { x: 1, y: 2, bridges: 6 },
      { x: 3, y: 2, bridges: 3 },
      { x: 1, y: 3, bridges: 3 },
      { x: 2, y: 3, bridges: 2 },
      { x: 2, y: 4, bridges: 2 },
      { x: 4, y: 4, bridges: 1 },
    ],
    solution: [1, 0, 1, 1, 2, 0, 2, 2, 1, 1, 1],
    idea: "相交的横、竖候选航线只能选其中一条。",
  },
  {
    title: "远近之间",
    width: 5,
    height: 5,
    islands: [
      { x: 0, y: 0, bridges: 1 },
      { x: 3, y: 0, bridges: 2 },
      { x: 3, y: 1, bridges: 2 },
      { x: 4, y: 1, bridges: 1 },
      { x: 2, y: 2, bridges: 3 },
      { x: 3, y: 2, bridges: 3 },
      { x: 2, y: 3, bridges: 2 },
      { x: 4, y: 3, bridges: 3 },
      { x: 1, y: 4, bridges: 2 },
      { x: 3, y: 4, bridges: 5 },
      { x: 4, y: 4, bridges: 4 },
    ],
    solution: [1, 1, 0, 1, 1, 1, 2, 1, 0, 2, 2, 2],
    idea: "先看高数字岛，再追踪它对远处航线的影响。",
  },
  {
    title: "避开交叉",
    width: 5,
    height: 5,
    islands: [
      { x: 0, y: 0, bridges: 2 },
      { x: 1, y: 0, bridges: 1 },
      { x: 2, y: 0, bridges: 3 },
      { x: 4, y: 0, bridges: 2 },
      { x: 0, y: 1, bridges: 3 },
      { x: 0, y: 2, bridges: 2 },
      { x: 2, y: 2, bridges: 3 },
      { x: 4, y: 2, bridges: 2 },
      { x: 1, y: 3, bridges: 1 },
      { x: 4, y: 3, bridges: 1 },
      { x: 1, y: 4, bridges: 2 },
      { x: 2, y: 4, bridges: 2 },
    ],
    solution: [0, 2, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1],
    idea: "局部数字与全局连通需要一起考虑。",
  },
  {
    title: "织起航线",
    width: 5,
    height: 5,
    islands: [
      { x: 1, y: 0, bridges: 2 },
      { x: 2, y: 0, bridges: 2 },
      { x: 3, y: 0, bridges: 2 },
      { x: 4, y: 0, bridges: 3 },
      { x: 1, y: 1, bridges: 3 },
      { x: 3, y: 1, bridges: 2 },
      { x: 1, y: 2, bridges: 1 },
      { x: 2, y: 2, bridges: 1 },
      { x: 3, y: 2, bridges: 2 },
      { x: 0, y: 3, bridges: 3 },
      { x: 4, y: 3, bridges: 4 },
      { x: 0, y: 4, bridges: 3 },
      { x: 2, y: 4, bridges: 2 },
    ],
    solution: [1, 1, 1, 0, 1, 0, 2, 1, 1, 1, 0, 1, 0, 2, 1, 2],
    idea: "每一条双桥都会减少两端的剩余需求。",
  },
  {
    title: "北方群岛",
    width: 6,
    height: 6,
    islands: [
      { x: 2, y: 0, bridges: 1 },
      { x: 3, y: 0, bridges: 3 },
      { x: 0, y: 1, bridges: 4 },
      { x: 3, y: 1, bridges: 5 },
      { x: 5, y: 1, bridges: 1 },
      { x: 2, y: 2, bridges: 3 },
      { x: 5, y: 2, bridges: 1 },
      { x: 4, y: 3, bridges: 2 },
      { x: 0, y: 4, bridges: 5 },
      { x: 1, y: 4, bridges: 2 },
      { x: 2, y: 4, bridges: 4 },
      { x: 4, y: 4, bridges: 3 },
      { x: 0, y: 5, bridges: 3 },
      { x: 3, y: 5, bridges: 1 },
    ],
    solution: [1, 0, 2, 2, 2, 1, 0, 0, 1, 2, 2, 1, 2, 1, 1, 1],
    idea: "把已确定的小片岛群逐步接起来。",
  },
  {
    title: "群岛一体",
    width: 6,
    height: 6,
    islands: [
      { x: 1, y: 0, bridges: 1 },
      { x: 2, y: 0, bridges: 4 },
      { x: 3, y: 0, bridges: 1 },
      { x: 4, y: 0, bridges: 3 },
      { x: 5, y: 0, bridges: 1 },
      { x: 2, y: 1, bridges: 5 },
      { x: 4, y: 1, bridges: 4 },
      { x: 5, y: 1, bridges: 2 },
      { x: 4, y: 2, bridges: 2 },
      { x: 2, y: 3, bridges: 6 },
      { x: 4, y: 3, bridges: 6 },
      { x: 5, y: 3, bridges: 3 },
      { x: 0, y: 4, bridges: 1 },
      { x: 2, y: 4, bridges: 4 },
      { x: 3, y: 4, bridges: 1 },
      { x: 4, y: 5, bridges: 2 },
    ],
    solution: [1, 1, 2, 0, 0, 1, 2, 0, 1, 2, 0, 1, 2, 1, 2, 2, 1, 2, 1, 1],
    idea: "同时检查桥数、交叉和全部群岛的连通。",
  },
];
export const hashiSolutions = hashiLevels.map((level) => level.solution);
