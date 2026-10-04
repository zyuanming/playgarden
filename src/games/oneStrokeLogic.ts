/** Original, hand-drawn planar trails. Coordinates are percentages of the board. */
export type StrokeNode = { x: number; y: number; label: string };
export type StrokeEdge = readonly [number, number];
export type OneStrokeLevel = {
  title: string;
  nodes: readonly StrokeNode[];
  edges: readonly StrokeEdge[];
  solution: readonly number[];
  idea: string;
};
export type OneStrokeState = { path: number[] };
export type StrokeOutcome =
  "start" | "move" | "invalid-node" | "no-edge" | "used-edge" | "finished";
export const strokeEdgeKey = (a: number, b: number) =>
  `${Math.min(a, b)}:${Math.max(a, b)}`;

function authored(
  title: string,
  points: [number, number][],
  solution: number[],
  idea: string,
): OneStrokeLevel {
  return {
    title,
    idea,
    solution,
    nodes: points.map(([x, y], index) => ({
      x,
      y,
      label: String.fromCharCode(65 + index),
    })),
    edges: solution
      .slice(1)
      .map((node, index) => [solution[index], node] as const),
  };
}
export const oneStrokeLevels: readonly OneStrokeLevel[] = [
  authored(
    "散步的第一条路",
    [
      [15, 25],
      [38, 70],
      [62, 25],
      [85, 70],
    ],
    [0, 1, 2, 3],
    "先从小路的一端出发。每走一段，绿色脚印就会留下来。",
  ),
  authored(
    "三角花圃",
    [
      [50, 15],
      [85, 78],
      [15, 78],
    ],
    [0, 1, 2, 0],
    "回到起点也没关系。点可以再经过，路段只能走一次。",
  ),
  authored(
    "带尾巴的小院",
    [
      [25, 30],
      [70, 30],
      [70, 75],
      [25, 75],
      [85, 15],
    ],
    [4, 1, 0, 3, 2, 1],
    "细细数一数：有两个点连着奇数条路，它们适合做起点和终点。",
  ),
  authored(
    "蝴蝶两片叶",
    [
      [50, 50],
      [15, 20],
      [15, 80],
      [85, 20],
      [85, 80],
    ],
    [0, 1, 2, 0, 3, 4, 0],
    "中间的点可以经过很多次，左右两个小圈都要走到。",
  ),
  authored(
    "屋顶的秘密",
    [
      [20, 80],
      [80, 80],
      [80, 45],
      [20, 45],
      [50, 15],
    ],
    [3, 0, 1, 2, 3, 4, 2],
    "两条看起来相近的路线不一定都能继续；先想想最后留在哪里。",
  ),
  authored(
    "风筝与线",
    [
      [50, 50],
      [20, 25],
      [20, 75],
      [80, 25],
      [80, 75],
      [50, 12],
    ],
    [5, 0, 1, 2, 0, 3, 4, 0],
    "走到只剩一条路的叶尖后，就不能再出来。把它安排在一端吧。",
  ),
  authored(
    "小梯子",
    [
      [20, 25],
      [50, 25],
      [80, 25],
      [20, 75],
      [50, 75],
      [80, 75],
    ],
    [1, 0, 3, 4, 1, 2, 5, 4],
    "有三条路相会的点是奇数路口。试着从其中一个出发。",
  ),
  authored(
    "连绵三座山",
    [
      [12, 75],
      [25, 25],
      [38, 75],
      [50, 25],
      [62, 75],
      [75, 25],
      [88, 75],
    ],
    [0, 1, 2, 3, 4, 5, 6, 4, 2, 0],
    "每座小山都是一个圈。可以先完成一个圈，也可以走到远处再回来。",
  ),
  authored(
    "长廊岔路",
    [
      [12, 25],
      [37, 25],
      [63, 25],
      [88, 25],
      [12, 75],
      [37, 75],
      [63, 75],
      [88, 75],
    ],
    [2, 1, 0, 4, 5, 6, 2, 3, 7, 6],
    "别把未走过的小路留在身后。提示会检查你现在还能不能继续。",
  ),
  authored(
    "窗边的捷径",
    [
      [15, 15],
      [50, 15],
      [85, 15],
      [85, 50],
      [85, 85],
      [50, 85],
      [15, 85],
      [15, 50],
      [50, 50],
    ],
    [7, 0, 1, 2, 3, 4, 5, 6, 7, 8, 3],
    "穿过窗心的短路也要走到。画得最短的路，不一定要最先走。",
  ),
  authored(
    "四叶幸运草",
    [
      [50, 50],
      [20, 15],
      [45, 12],
      [85, 20],
      [88, 45],
      [80, 85],
      [55, 88],
      [15, 80],
      [12, 55],
    ],
    [0, 1, 2, 0, 3, 4, 0, 5, 6, 0, 7, 8, 0],
    "所有路口都连着偶数条路，就可以从任意路口出发，再回到那里。",
  ),
  authored(
    "花园的十四条路",
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
    [0, 1, 2, 5, 4, 3, 6, 7, 8, 5, 7, 4, 1, 3, 0],
    "把小圈接成大圈。每次走之前，看看剩下的路是否仍然连在一起。",
  ),
];

export function createOneStrokeState(): OneStrokeState {
  return { path: [] };
}
export function strokeDegrees(
  level: Pick<OneStrokeLevel, "nodes" | "edges">,
): number[] {
  const degrees = level.nodes.map(() => 0);
  for (const [a, b] of level.edges) {
    if (degrees[a] !== undefined) degrees[a]++;
    if (degrees[b] !== undefined) degrees[b]++;
  }
  return degrees;
}
export function verifyStrokeGraph(
  level: Pick<OneStrokeLevel, "nodes" | "edges">,
): boolean {
  if (
    level.nodes.length < 2 ||
    level.nodes.length > 32 ||
    !level.edges.length ||
    level.edges.length > 64
  )
    return false;
  if (
    level.nodes.some(
      (n) =>
        !Number.isFinite(n.x) ||
        !Number.isFinite(n.y) ||
        n.x < 0 ||
        n.x > 100 ||
        n.y < 0 ||
        n.y > 100,
    )
  )
    return false;
  const keys = new Set<string>();
  for (const [a, b] of level.edges) {
    if (
      !Number.isInteger(a) ||
      !Number.isInteger(b) ||
      a === b ||
      !level.nodes[a] ||
      !level.nodes[b]
    )
      return false;
    const key = strokeEdgeKey(a, b);
    if (keys.has(key)) return false;
    keys.add(key);
  }
  const seen = new Set<number>([0]);
  const queue = [0];
  while (queue.length) {
    const v = queue.pop()!;
    for (const [a, b] of level.edges) {
      const next = a === v ? b : b === v ? a : -1;
      if (next >= 0 && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size === level.nodes.length;
}
export function validStrokePath(
  level: OneStrokeLevel,
  path: readonly number[],
): boolean {
  if (
    path.length > level.edges.length + 1 ||
    path.some((v) => !Number.isInteger(v) || !level.nodes[v])
  )
    return false;
  const keys = new Set(level.edges.map(([a, b]) => strokeEdgeKey(a, b)));
  const used = new Set<string>();
  for (let i = 1; i < path.length; i++) {
    const key = strokeEdgeKey(path[i - 1], path[i]);
    if (!keys.has(key) || used.has(key)) return false;
    used.add(key);
  }
  return true;
}
export function usedStrokeEdges(state: OneStrokeState): Set<string> {
  return new Set(
    state.path.slice(1).map((node, i) => strokeEdgeKey(state.path[i], node)),
  );
}
export function isOneStrokeSolved(
  level: OneStrokeLevel,
  state: OneStrokeState,
): boolean {
  return (
    state.path.length === level.edges.length + 1 &&
    validStrokePath(level, state.path)
  );
}
export function chooseStrokeNode(
  level: OneStrokeLevel,
  state: OneStrokeState,
  node: number,
): { state: OneStrokeState; outcome: StrokeOutcome } {
  if (!Number.isInteger(node) || !level.nodes[node])
    return { state, outcome: "invalid-node" };
  if (isOneStrokeSolved(level, state)) return { state, outcome: "finished" };
  if (!state.path.length) return { state: { path: [node] }, outcome: "start" };
  const key = strokeEdgeKey(state.path.at(-1)!, node);
  if (!level.edges.some(([a, b]) => strokeEdgeKey(a, b) === key))
    return { state, outcome: "no-edge" };
  if (usedStrokeEdges(state).has(key)) return { state, outcome: "used-edge" };
  return { state: { path: [...state.path, node] }, outcome: "move" };
}
export function undoOneStroke(state: OneStrokeState): OneStrokeState {
  return state.path.length ? { path: state.path.slice(0, -1) } : state;
}
/** Bounded Hierholzer traversal; at most 64 edges, O(E²) edge probes, and no exponential search. Returns a remaining route including its starting node. */
export function solveOneStroke(
  level: OneStrokeLevel,
  path: readonly number[] = [],
): number[] | null {
  if (!verifyStrokeGraph(level) || !validStrokePath(level, path)) return null;
  const used = usedStrokeEdges({ path: [...path] });
  const remaining = level.edges.filter(
    ([a, b]) => !used.has(strokeEdgeKey(a, b)),
  );
  if (!remaining.length) return path.length ? [path.at(-1)!] : null;
  const degrees = strokeDegrees({ nodes: level.nodes, edges: remaining });
  const odd = degrees.map((d, i) => (d % 2 ? i : -1)).filter((i) => i >= 0);
  if (odd.length !== 0 && odd.length !== 2) return null;
  const start = path.at(-1) ?? odd[0] ?? remaining[0][0];
  if (!degrees[start] || (odd.length === 2 && !odd.includes(start)))
    return null;
  const stack = [start],
    route: number[] = [],
    consumed = new Set<number>();
  while (stack.length) {
    const v = stack.at(-1)!;
    const edgeIndex = remaining.findIndex(
      ([a, b], i) => !consumed.has(i) && (a === v || b === v),
    );
    if (edgeIndex < 0) route.push(stack.pop()!);
    else {
      consumed.add(edgeIndex);
      const [a, b] = remaining[edgeIndex];
      stack.push(a === v ? b : a);
    }
  }
  if (consumed.size !== remaining.length) return null;
  return route.reverse();
}
export type OneStrokeHint = {
  kind: "start" | "move" | "undo" | "complete" | "unavailable";
  node: number | null;
  undoSteps: number;
};
export function oneStrokeHint(
  level: OneStrokeLevel,
  state: OneStrokeState,
): OneStrokeHint {
  if (isOneStrokeSolved(level, state))
    return { kind: "complete", node: null, undoSteps: 0 };
  for (let undoSteps = 0; undoSteps <= state.path.length; undoSteps++) {
    const path = state.path.slice(0, state.path.length - undoSteps);
    const solution = solveOneStroke(level, path);
    if (solution)
      return {
        kind: undoSteps ? "undo" : path.length ? "move" : "start",
        node: solution[path.length ? 1 : 0] ?? null,
        undoSteps,
      };
  }
  return { kind: "unavailable", node: null, undoSteps: 0 };
}
export function verifyOneStrokeLevel(level: OneStrokeLevel): boolean {
  return (
    verifyStrokeGraph(level) &&
    isOneStrokeSolved(level, { path: [...level.solution] }) &&
    solveOneStroke(level) !== null
  );
}
export const oneStrokeSolutions = oneStrokeLevels.map(
  (level) => level.solution,
);
/** Arrow keys follow the screen direction, without taking a game move. */
export function strokeKeyboardNode(
  nodes: readonly StrokeNode[],
  current: number,
  key: string,
): number {
  if (key === "Home") return 0;
  if (key === "End") return nodes.length - 1;
  const direction =
    key === "ArrowRight"
      ? [1, 0]
      : key === "ArrowLeft"
        ? [-1, 0]
        : key === "ArrowDown"
          ? [0, 1]
          : key === "ArrowUp"
            ? [0, -1]
            : null;
  if (!direction || !nodes[current]) return current;
  let best = current,
    score = Infinity;
  nodes.forEach((node, index) => {
    const dx = node.x - nodes[current].x,
      dy = node.y - nodes[current].y;
    const forward = dx * direction[0] + dy * direction[1];
    if (forward <= 0) return;
    const side = Math.abs(dx * direction[1] - dy * direction[0]);
    const candidate = Math.hypot(dx, dy) + side * 2;
    if (candidate < score) {
      best = index;
      score = candidate;
    }
  });
  return best;
}
