/** Original Playgarden weighted graphs, integer costs, and MST engine. MIT licensed. */
export type NetworkStation = { label: string; x: number; y: number };
export type NetworkEdge = { a: number; b: number; cost: number };
export type MinimumNetworkLevel = {
  title: string;
  idea: string;
  stations: readonly NetworkStation[];
  edges: readonly NetworkEdge[];
  certificate: readonly number[];
  minimumCost: number;
};
export type NetworkState = { selected: number[]; history: number[][] };
export type NetworkHint =
  { kind: "add" | "remove"; edge: number } | { kind: "solved" | "invalid" };

function disjointSet(count: number) {
  const parents = Array.from({ length: count }, (_, i) => i);
  function root(node: number): number {
    while (parents[node] !== node) {
      parents[node] = parents[parents[node]];
      node = parents[node];
    }
    return node;
  }
  return {
    join(a: number, b: number) {
      const x = root(a),
        y = root(b);
      if (x === y) return false;
      parents[y] = x;
      return true;
    },
  };
}
export function verifyNetworkGraph(level: MinimumNetworkLevel) {
  const n = level.stations.length,
    keys = new Set<string>();
  if (
    n < 2 ||
    n > 12 ||
    new Set(level.stations.map((s) => s.label)).size !== n ||
    level.edges.length > (n * (n - 1)) / 2
  )
    return false;
  for (const { a, b, cost } of level.edges) {
    const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
    if (
      !Number.isInteger(a) ||
      !Number.isInteger(b) ||
      a < 0 ||
      b < 0 ||
      a >= n ||
      b >= n ||
      a === b ||
      !Number.isInteger(cost) ||
      cost <= 0 ||
      cost > 99 ||
      keys.has(key)
    )
      return false;
    keys.add(key);
  }
  return level.stations.every(
    (s) =>
      Number.isFinite(s.x) &&
      Number.isFinite(s.y) &&
      s.x >= 0 &&
      s.x <= 100 &&
      s.y >= 0 &&
      s.y <= 100,
  );
}
export function validNetworkSelection(
  level: MinimumNetworkLevel,
  selected: readonly number[],
) {
  return (
    new Set(selected).size === selected.length &&
    selected.every(
      (i) => Number.isInteger(i) && i >= 0 && i < level.edges.length,
    )
  );
}
export function analyzeNetwork(
  level: MinimumNetworkLevel,
  selected: readonly number[],
) {
  let components = level.stations.length,
    cost = 0,
    cycle = false;
  if (!verifyNetworkGraph(level) || !validNetworkSelection(level, selected))
    return { valid: false, components, cost, cycle, connected: false };
  const forest = disjointSet(components);
  for (const index of selected) {
    const { a, b, cost: edgeCost } = level.edges[index];
    cost += edgeCost;
    if (forest.join(a, b)) components--;
    else cycle = true;
  }
  return { valid: true, components, cost, cycle, connected: components === 1 };
}
/** Kruskal with selected edges preferred within equal costs. This computes a
 * minimum-cost tree with maximum overlap with the current selection, using
 * integer lexicographic weights; it is polynomial, with no search cutoff. */
export function optimalNetworkTree(
  level: MinimumNetworkLevel,
  preferred: readonly number[] = [],
): number[] | null {
  if (!verifyNetworkGraph(level)) return null;
  const keep = new Set(preferred),
    forest = disjointSet(level.stations.length);
  const order = level.edges
    .map((_, i) => i)
    .sort(
      (i, j) =>
        level.edges[i].cost - level.edges[j].cost ||
        Number(keep.has(j)) - Number(keep.has(i)) ||
        i - j,
    );
  const result: number[] = [];
  for (const i of order)
    if (forest.join(level.edges[i].a, level.edges[i].b)) result.push(i);
  return result.length === level.stations.length - 1
    ? result.sort((a, b) => a - b)
    : null;
}
export function networkMinimumCost(level: MinimumNetworkLevel): number | null {
  const tree = optimalNetworkTree(level);
  return tree ? tree.reduce((sum, i) => sum + level.edges[i].cost, 0) : null;
}
export function isMinimumNetworkSolved(
  level: MinimumNetworkLevel,
  state: Pick<NetworkState, "selected">,
) {
  const result = analyzeNetwork(level, state.selected),
    optimum = networkMinimumCost(level);
  return (
    result.valid &&
    result.connected &&
    !result.cycle &&
    optimum !== null &&
    result.cost === optimum
  );
}
export function createNetworkState(): NetworkState {
  return { selected: [], history: [] };
}
export function toggleNetworkEdge(
  level: MinimumNetworkLevel,
  state: NetworkState,
  edge: number,
): NetworkState {
  if (
    !verifyNetworkGraph(level) ||
    !Number.isInteger(edge) ||
    edge < 0 ||
    edge >= level.edges.length ||
    !validNetworkSelection(level, state.selected) ||
    isMinimumNetworkSolved(level, state)
  )
    return state;
  return {
    selected: state.selected.includes(edge)
      ? state.selected.filter((i) => i !== edge)
      : [...state.selected, edge].sort((a, b) => a - b),
    history: [...state.history, state.selected],
  };
}
export function undoNetwork(state: NetworkState): NetworkState {
  return state.history.length
    ? {
        selected: [...state.history.at(-1)!],
        history: state.history.slice(0, -1),
      }
    : state;
}
export function minimumNetworkHint(
  level: MinimumNetworkLevel,
  state: NetworkState,
): NetworkHint {
  if (!validNetworkSelection(level, state.selected)) return { kind: "invalid" };
  const target = optimalNetworkTree(level, state.selected);
  if (!target) return { kind: "invalid" };
  if (isMinimumNetworkSolved(level, state)) return { kind: "solved" };
  const remove = state.selected.find((i) => !target.includes(i));
  if (remove !== undefined) return { kind: "remove", edge: remove };
  const add = target.find((i) => !state.selected.includes(i));
  return add === undefined ? { kind: "invalid" } : { kind: "add", edge: add };
}
/** Independent certificate check. The cycle property proves a spanning tree is
 * minimum iff every non-tree edge costs at least the largest edge on its tree path.
 * This intentionally does not call Kruskal or compare against one chosen answer. */
export function verifyMinimumNetworkCertificate(level: MinimumNetworkLevel) {
  const result = analyzeNetwork(level, level.certificate);
  if (
    !result.valid ||
    !result.connected ||
    result.cycle ||
    result.cost !== level.minimumCost
  )
    return false;
  const adjacency: { node: number; cost: number }[][] = level.stations.map(
    () => [],
  );
  for (const i of level.certificate) {
    const { a, b, cost } = level.edges[i];
    adjacency[a].push({ node: b, cost });
    adjacency[b].push({ node: a, cost });
  }
  return level.edges.every(({ a, b, cost }, i) => {
    if (level.certificate.includes(i)) return true;
    const queue = [{ node: a, maximum: 0 }],
      seen = new Set([a]);
    for (let head = 0; head < queue.length; head++) {
      const item = queue[head];
      if (item.node === b) return cost >= item.maximum;
      for (const next of adjacency[item.node])
        if (!seen.has(next.node)) {
          seen.add(next.node);
          queue.push({
            node: next.node,
            maximum: Math.max(item.maximum, next.cost),
          });
        }
    }
    return false;
  });
}
export function networkKeyboardEdge(count: number, edge: number, key: string) {
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowLeft" || key === "ArrowUp") return Math.max(0, edge - 1);
  if (key === "ArrowRight" || key === "ArrowDown")
    return Math.min(count - 1, edge + 1);
  return edge;
}
/** Place each weight on its own edge, away from stations and earlier labels. */
export function networkLabelPositions(level: MinimumNetworkLevel) {
  const placed: { x: number; y: number }[] = [];
  for (const edge of level.edges) {
    const a = level.stations[edge.a],
      b = level.stations[edge.b];
    const candidates = [0.5, 0.35, 0.65, 0.25, 0.75, 0.42, 0.58, 0.2, 0.8].map(
      (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }),
    );
    const clearance = (point: { x: number; y: number }) =>
      Math.min(
        ...level.stations.map(
          (station) => Math.hypot(point.x - station.x, point.y - station.y) - 7,
        ),
        ...placed.map(
          (other) => Math.hypot(point.x - other.x, point.y - other.y) - 6,
        ),
      );
    placed.push(
      candidates.reduce((best, candidate) =>
        clearance(candidate) > clearance(best) ? candidate : best,
      ),
    );
  }
  return placed;
}
function authored(
  title: string,
  count: number,
  tree: [number, number, number][],
  extras: [number, number, number][],
  minimumCost: number,
  idea: string,
): MinimumNetworkLevel {
  const entries = [...tree, ...extras].map(([a, b, cost], original) => ({
    a,
    b,
    cost,
    original,
  }));
  let seed = [...title].reduce(
    (value, character) => (value * 31 + character.codePointAt(0)!) >>> 0,
    2166136261,
  );
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const level: MinimumNetworkLevel = {
    title,
    idea,
    minimumCost,
    stations: Array.from({ length: count }, (_, i) => ({
      label: String.fromCharCode(65 + i),
      x: Math.round(50 + 36 * Math.sin((i * 2 * Math.PI) / count)),
      y: Math.round(50 - 36 * Math.cos((i * 2 * Math.PI) / count)),
    })),
    edges: entries,
    certificate: [],
  };
  // Seeded presentation order must not disclose the authored spanning tree.
  for (let attempt = 0; attempt < 100; attempt++) {
    for (let i = entries.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [entries[i], entries[j]] = [entries[j], entries[i]];
    }
    const prefix = {
      selected: Array.from({ length: count - 1 }, (_, i) => i),
      history: [],
    };
    if (!isMinimumNetworkSolved(level, prefix)) break;
  }
  level.certificate = entries.flatMap((entry, index) =>
    entry.original < tree.length ? [index] : [],
  );
  return level;
}
export const minimumNetworkLevels: readonly MinimumNetworkLevel[] = [
  authored(
    "连接四座小站",
    4,
    [
      [0, 1, 1],
      [1, 2, 2],
      [2, 3, 1],
    ],
    [
      [0, 2, 4],
      [0, 3, 5],
    ],
    4,
    "先连接便宜的线路，再看还剩哪座站没有连通。",
  ),
  authored(
    "同价也有好方案",
    4,
    [
      [0, 1, 2],
      [1, 2, 2],
      [2, 3, 2],
    ],
    [
      [0, 3, 2],
      [0, 2, 3],
      [1, 3, 4],
    ],
    6,
    "同样便宜的选择可能不止一种。只要总造价最低，任何方案都算成功。",
  ),
  authored(
    "中央花站",
    5,
    [
      [0, 1, 1],
      [0, 2, 3],
      [0, 3, 2],
      [3, 4, 2],
    ],
    [
      [1, 2, 4],
      [2, 4, 5],
      [1, 4, 3],
    ],
    8,
    "不用把每一对站直接连接；沿着其他站换乘，也能到达目的地。",
  ),
  authored(
    "环路里的节约",
    5,
    [
      [0, 1, 2],
      [1, 2, 1],
      [2, 3, 3],
      [3, 4, 2],
    ],
    [
      [0, 4, 5],
      [0, 2, 2],
      [1, 3, 4],
      [2, 4, 3],
    ],
    8,
    "如果形成一圈，可以试着拿掉其中最贵的一条路。",
  ),
  authored(
    "两片街区",
    6,
    [
      [0, 1, 1],
      [1, 2, 2],
      [2, 3, 5],
      [3, 4, 1],
      [4, 5, 2],
    ],
    [
      [0, 2, 2],
      [3, 5, 2],
      [1, 4, 7],
      [0, 5, 8],
    ],
    11,
    "街区内部便宜，不代表全网已经连通。要留意连接两片街区的桥。",
  ),
  authored(
    "岔路与同价桥",
    6,
    [
      [0, 1, 2],
      [0, 2, 3],
      [2, 3, 1],
      [2, 4, 2],
      [4, 5, 3],
    ],
    [
      [1, 3, 3],
      [1, 5, 5],
      [3, 4, 2],
      [0, 5, 6],
      [3, 5, 4],
    ],
    11,
    "同价线路不一定都要选。寻找一个没有多余回路的连通方案。",
  ),
  authored(
    "七站晨间线路",
    7,
    [
      [0, 1, 2],
      [1, 2, 4],
      [1, 3, 1],
      [3, 4, 3],
      [3, 5, 2],
      [5, 6, 1],
    ],
    [
      [0, 3, 2],
      [2, 4, 4],
      [4, 6, 5],
      [0, 6, 4],
      [2, 6, 6],
    ],
    13,
    "从不同地点出发挑路，也能得到同一个最省的总造价。",
  ),
  authored(
    "山谷换乘站",
    7,
    [
      [0, 1, 1],
      [1, 2, 2],
      [2, 3, 4],
      [3, 4, 1],
      [4, 5, 3],
      [5, 6, 2],
    ],
    [
      [0, 2, 2],
      [1, 3, 4],
      [2, 4, 5],
      [3, 5, 3],
      [4, 6, 3],
      [0, 6, 7],
    ],
    13,
    "已有一条便宜线路时，继续添加前先检查它会不会绕成一圈。",
  ),
  authored(
    "八站花环",
    8,
    [
      [0, 1, 2],
      [1, 2, 1],
      [2, 3, 3],
      [3, 4, 2],
      [4, 5, 4],
      [5, 6, 1],
      [6, 7, 2],
    ],
    [
      [0, 7, 4],
      [0, 3, 3],
      [1, 4, 4],
      [2, 5, 5],
      [3, 6, 4],
      [4, 7, 4],
    ],
    15,
    "直连很方便，但较长的换乘路线也可能更省建造费用。",
  ),
  authored(
    "双中心城市",
    8,
    [
      [0, 1, 1],
      [0, 2, 2],
      [0, 3, 3],
      [3, 4, 5],
      [4, 5, 1],
      [4, 6, 2],
      [4, 7, 3],
    ],
    [
      [1, 2, 2],
      [2, 3, 3],
      [5, 6, 2],
      [6, 7, 3],
      [2, 6, 5],
      [1, 7, 7],
      [0, 4, 6],
    ],
    17,
    "可以先比较跨区线路，再回头整理每个区的小路。",
  ),
  authored(
    "九站连通计划",
    9,
    [
      [0, 1, 2],
      [1, 2, 3],
      [1, 3, 1],
      [3, 4, 2],
      [4, 5, 4],
      [4, 6, 1],
      [6, 7, 3],
      [7, 8, 2],
    ],
    [
      [0, 3, 2],
      [2, 4, 3],
      [3, 6, 2],
      [5, 7, 4],
      [6, 8, 3],
      [0, 8, 6],
      [2, 8, 5],
    ],
    18,
    "选中的线路可以随时取消。用总造价和连通片数一起检查计划。",
  ),
  authored(
    "花园交通总设计师",
    9,
    [
      [0, 1, 3],
      [0, 2, 2],
      [2, 3, 1],
      [2, 4, 4],
      [4, 5, 2],
      [4, 6, 3],
      [6, 7, 1],
      [6, 8, 2],
    ],
    [
      [1, 3, 3],
      [0, 4, 4],
      [3, 5, 5],
      [2, 6, 4],
      [5, 7, 3],
      [7, 8, 2],
      [1, 8, 6],
      [0, 8, 5],
      [3, 8, 4],
    ],
    18,
    "最后一关允许多种最优树。把每个站连起来，只留下必要的小路。",
  ),
];
export const minimumNetworkSolutions = minimumNetworkLevels.map((level) => [
  ...level.certificate,
]);
