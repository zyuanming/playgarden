/** Original Playgarden levels and exact integer geometry. MIT licensed. */
export type GardenEdge = readonly [number, number];
export type GardenPoint = { x: number; y: number };
export type UntangleLevel = {
  title: string;
  idea: string;
  size: number;
  labels: readonly string[];
  edges: readonly GardenEdge[];
  initial: readonly number[];
  solution: readonly number[];
};
export type UntangleState = {
  positions: number[];
  history: number[][];
};
export type UntangleHint =
  | { kind: "move"; node: number; spot: number; temporary: boolean }
  | { kind: "solved" | "invalid" };

export function gardenPoint(size: number, spot: number): GardenPoint {
  return { x: spot % size, y: Math.floor(spot / size) };
}
export function gardenOrientation(
  a: GardenPoint,
  b: GardenPoint,
  c: GardenPoint,
) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
export function gardenPointOnSegment(
  a: GardenPoint,
  b: GardenPoint,
  p: GardenPoint,
) {
  return (
    gardenOrientation(a, b, p) === 0 &&
    p.x >= Math.min(a.x, b.x) &&
    p.x <= Math.max(a.x, b.x) &&
    p.y >= Math.min(a.y, b.y) &&
    p.y <= Math.max(a.y, b.y)
  );
}
export function gardenSegmentsIntersect(
  a: GardenPoint,
  b: GardenPoint,
  c: GardenPoint,
  d: GardenPoint,
) {
  const abC = gardenOrientation(a, b, c),
    abD = gardenOrientation(a, b, d);
  const cdA = gardenOrientation(c, d, a),
    cdB = gardenOrientation(c, d, b);
  return (
    (abC * abD < 0 && cdA * cdB < 0) ||
    (abC === 0 && gardenPointOnSegment(a, b, c)) ||
    (abD === 0 && gardenPointOnSegment(a, b, d)) ||
    (cdA === 0 && gardenPointOnSegment(c, d, a)) ||
    (cdB === 0 && gardenPointOnSegment(c, d, b))
  );
}
export function validGardenPositions(
  level: UntangleLevel,
  positions: readonly number[],
) {
  return (
    Number.isInteger(level.size) &&
    level.size >= 2 &&
    level.size <= 8 &&
    positions.length === level.labels.length &&
    new Set(positions).size === positions.length &&
    positions.every(
      (p) => Number.isInteger(p) && p >= 0 && p < level.size * level.size,
    )
  );
}
export function validGardenGraph(level: UntangleLevel) {
  if (
    level.labels.length < 3 ||
    new Set(level.labels).size !== level.labels.length
  )
    return false;
  const keys = new Set<string>();
  return level.edges.every(([a, b]) => {
    const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
    if (
      !Number.isInteger(a) ||
      !Number.isInteger(b) ||
      a < 0 ||
      b < 0 ||
      a >= level.labels.length ||
      b >= level.labels.length ||
      a === b ||
      keys.has(key)
    )
      return false;
    keys.add(key);
    return true;
  });
}
export function untangleConflicts(
  level: UntangleLevel,
  positions: readonly number[],
) {
  const crossings: [number, number][] = [],
    throughNodes: [number, number][] = [];
  if (!validGardenGraph(level) || !validGardenPositions(level, positions))
    return { valid: false, crossings, throughNodes, total: 0 };
  const points = positions.map((p) => gardenPoint(level.size, p));
  level.edges.forEach(([a, b], i) => {
    if (!points[a] || !points[b]) return;
    points.forEach((p, node) => {
      if (
        node !== a &&
        node !== b &&
        gardenPointOnSegment(points[a], points[b], p)
      )
        throughNodes.push([i, node]);
    });
    level.edges.slice(i + 1).forEach(([c, d], offset) => {
      if (a === c || a === d || b === c || b === d || !points[c] || !points[d])
        return;
      if (gardenSegmentsIntersect(points[a], points[b], points[c], points[d]))
        crossings.push([i, i + offset + 1]);
    });
  });
  return {
    valid: true,
    crossings,
    throughNodes,
    total: crossings.length + throughNodes.length,
  };
}
export function isUntangleSolved(
  level: UntangleLevel,
  state: Pick<UntangleState, "positions">,
) {
  const result = untangleConflicts(level, state.positions);
  return result.valid && result.total === 0;
}
export function createUntangleState(level: UntangleLevel): UntangleState {
  return { positions: [...level.initial], history: [] };
}
export function moveGardenNode(
  level: UntangleLevel,
  state: UntangleState,
  node: number,
  spot: number,
): UntangleState {
  if (
    !validGardenPositions(level, state.positions) ||
    !Number.isInteger(node) ||
    node < 0 ||
    node >= level.labels.length ||
    !Number.isInteger(spot) ||
    spot < 0 ||
    spot >= level.size * level.size ||
    state.positions.includes(spot) ||
    isUntangleSolved(level, state)
  )
    return state;
  const positions = [...state.positions];
  positions[node] = spot;
  return { positions, history: [...state.history, state.positions] };
}
export function undoUntangle(state: UntangleState): UntangleState {
  return state.history.length
    ? {
        positions: [...state.history.at(-1)!],
        history: state.history.slice(0, -1),
      }
    : state;
}
/** A finite relocation plan, not a heuristic search: keep correct nodes fixed,
 * fill any free certified destination, or break an occupancy cycle with one spare spot.
 * At most 2n moves are needed, independent of edge crossings in the current board. */
export function untangleHint(
  level: UntangleLevel,
  state: UntangleState,
): UntangleHint {
  if (
    !validGardenPositions(level, state.positions) ||
    !validGardenPositions(level, level.solution) ||
    !isUntangleSolved(level, { positions: [...level.solution] })
  )
    return { kind: "invalid" };
  if (isUntangleSolved(level, state)) return { kind: "solved" };
  const freeNode = level.solution.findIndex(
    (spot, node) =>
      state.positions[node] !== spot && !state.positions.includes(spot),
  );
  if (freeNode >= 0)
    return {
      kind: "move",
      node: freeNode,
      spot: level.solution[freeNode],
      temporary: false,
    };
  const misplaced = level.solution.findIndex(
    (spot, node) => state.positions[node] !== spot,
  );
  const spare = Array.from(
    { length: level.size * level.size },
    (_, i) => i,
  ).find((p) => !state.positions.includes(p) && !level.solution.includes(p));
  if (misplaced < 0 || spare === undefined) return { kind: "invalid" };
  return {
    kind: "move",
    node: state.positions.indexOf(level.solution[misplaced]),
    spot: spare,
    temporary: true,
  };
}
export function gardenKeyboardSpot(size: number, spot: number, key: string) {
  const row = Math.floor(spot / size),
    col = spot % size;
  if (key === "Home") return 0;
  if (key === "End") return size * size - 1;
  if (key === "ArrowLeft") return row * size + Math.max(0, col - 1);
  if (key === "ArrowRight") return row * size + Math.min(size - 1, col + 1);
  if (key === "ArrowUp") return Math.max(0, row - 1) * size + col;
  if (key === "ArrowDown") return Math.min(size - 1, row + 1) * size + col;
  return spot;
}
export function verifyUntangleLevel(level: UntangleLevel) {
  if (
    level.labels.length < 3 ||
    level.labels.length >= level.size * level.size ||
    new Set(level.labels).size !== level.labels.length ||
    !validGardenPositions(level, level.initial) ||
    !validGardenPositions(level, level.solution)
  )
    return false;
  const keys = new Set<string>();
  for (const [a, b] of level.edges) {
    const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
    if (
      !Number.isInteger(a) ||
      !Number.isInteger(b) ||
      a < 0 ||
      b < 0 ||
      a >= level.labels.length ||
      b >= level.labels.length ||
      a === b ||
      keys.has(key)
    )
      return false;
    keys.add(key);
  }
  const connected = new Set([0]);
  for (let pass = 0; pass < level.labels.length; pass++)
    for (const [a, b] of level.edges) {
      if (connected.has(a)) connected.add(b);
      if (connected.has(b)) connected.add(a);
    }
  return (
    connected.size === level.labels.length &&
    isUntangleSolved(level, { positions: [...level.solution] }) &&
    !isUntangleSolved(level, { positions: [...level.initial] })
  );
}

function authored(
  title: string,
  points: [number, number][],
  edges: GardenEdge[],
  idea: string,
  seed: number,
): UntangleLevel {
  const solution = points.map(([x, y]) => y * 5 + x);
  const level: UntangleLevel = {
    title,
    idea,
    size: 5,
    labels: points.map((_, i) => String.fromCharCode(65 + i)),
    edges,
    solution,
    initial: solution,
  };
  // A reproducible scramble of original boards; never external or random content.
  for (let attempt = 0; attempt < 50; attempt++) {
    const pool = Array.from({ length: 25 }, (_, i) => i);
    for (let i = 24; i > 0; i--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    level.initial = pool.slice(0, points.length);
    if (!isUntangleSolved(level, { positions: [...level.initial] }))
      return level;
  }
  throw new Error("Untangle authored scramble must start with a conflict");
}
export const untangleLevels: readonly UntangleLevel[] = [
  authored(
    "两条交叉的小径",
    [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ],
    [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
    "先找交叉的位置，移动一个端点就能改变整条小路。",
    71,
  ),
  authored(
    "围起四角花圃",
    [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ],
    [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
    ],
    "四条边组成一个圈。花朵可以换位置，小路的连接关系不变。",
    127,
  ),
  authored(
    "花圃里的斜径",
    [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ],
    [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [0, 2],
    ],
    "斜线可以存在，但不能穿过其他小路或花朵。",
    223,
  ),
  authored(
    "屋檐下的花园",
    [
      [0, 4],
      [4, 4],
      [4, 2],
      [2, 0],
      [0, 2],
    ],
    [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 0],
      [2, 4],
    ],
    "先整理外圈，再安放屋檐下的那一条横路。",
    307,
  ),
  authored(
    "第一架花梯",
    [
      [0, 0],
      [4, 0],
      [0, 2],
      [4, 2],
      [0, 4],
      [4, 4],
    ],
    [
      [0, 1],
      [2, 3],
      [4, 5],
      [0, 2],
      [2, 4],
      [1, 3],
      [3, 5],
    ],
    "两侧的小径像梯子的长边，横档不要交叉。",
    419,
  ),
  authored(
    "带斜撑的花梯",
    [
      [0, 0],
      [4, 0],
      [0, 2],
      [4, 2],
      [0, 4],
      [4, 4],
    ],
    [
      [0, 1],
      [2, 3],
      [4, 5],
      [0, 2],
      [2, 4],
      [1, 3],
      [3, 5],
      [0, 3],
    ],
    "小路多起来时，可以先把几个三角形放在相邻的位置。",
    521,
  ),
  authored(
    "双斜撑小院",
    [
      [0, 0],
      [4, 0],
      [0, 2],
      [4, 2],
      [0, 4],
      [4, 4],
    ],
    [
      [0, 1],
      [2, 3],
      [4, 5],
      [0, 2],
      [2, 4],
      [1, 3],
      [3, 5],
      [0, 3],
      [2, 5],
    ],
    "线段即使没有互相交叉，也不能穿过第三朵花。",
    631,
  ),
  authored(
    "六瓣风车",
    [
      [0, 1],
      [2, 0],
      [4, 1],
      [4, 3],
      [2, 4],
      [0, 3],
      [2, 2],
    ],
    [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 0],
      [6, 0],
      [6, 1],
      [6, 2],
      [6, 3],
    ],
    "找到连着最多小路的花朵，让它周围留出空间。",
    743,
  ),
  authored(
    "完整的风车",
    [
      [0, 1],
      [2, 0],
      [4, 1],
      [4, 3],
      [2, 4],
      [0, 3],
      [2, 2],
    ],
    [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 0],
      [6, 0],
      [6, 1],
      [6, 2],
      [6, 3],
      [6, 4],
      [6, 5],
    ],
    "六片花瓣围着中心。共享同一个端点的小路是允许的。",
    853,
  ),
  authored(
    "长廊和三角窗",
    [
      [0, 0],
      [4, 0],
      [0, 1],
      [4, 1],
      [0, 3],
      [4, 3],
      [0, 4],
      [4, 4],
    ],
    [
      [0, 1],
      [2, 3],
      [4, 5],
      [6, 7],
      [0, 2],
      [2, 4],
      [4, 6],
      [1, 3],
      [3, 5],
      [5, 7],
      [0, 3],
      [2, 5],
      [4, 7],
    ],
    "移动前想想同一朵花牵着哪些线，不必每一步都减少交叉。",
    967,
  ),
  authored(
    "九宫花园",
    [
      [0, 0],
      [2, 0],
      [4, 0],
      [0, 2],
      [2, 2],
      [4, 2],
      [0, 4],
      [2, 4],
      [4, 4],
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
    "可以先整理四个角，再为中间的花朵留出位置。",
    1087,
  ),
  authored(
    "三角花园总设计师",
    [
      [0, 0],
      [2, 0],
      [4, 0],
      [0, 2],
      [2, 2],
      [4, 2],
      [0, 4],
      [2, 4],
      [4, 4],
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
      [1, 5],
      [3, 7],
      [4, 8],
    ],
    "整理一个区域，再处理相邻区域。空地也能用来临时停放花朵。",
    1201,
  ),
];
export const untangleSolutions = untangleLevels.map((level) => [
  ...level.solution,
]);
