export type Tile = {
  x: number;
  y: number;
  kind: "straight" | "corner";
  rotation: number;
};
export type BridgeLevel = {
  size: number;
  tiles: Tile[];
  solution: number[];
  hint: string;
};
export const bridgeLevels: BridgeLevel[] = [
  {
    size: 5,
    tiles: [0, 1, 2, 3, 4].map((x) => ({
      x,
      y: 2,
      kind: "straight",
      rotation: x % 2 ? 0 : 1,
    })),
    solution: [0, 0, 0, 0, 0],
    hint: "把每块桥面都转成东西方向，连成一条直线。",
  },
  {
    size: 5,
    tiles: [
      { x: 0, y: 2, kind: "straight", rotation: 1 },
      { x: 1, y: 2, kind: "corner", rotation: 0 },
      { x: 1, y: 1, kind: "corner", rotation: 2 },
      { x: 2, y: 1, kind: "straight", rotation: 1 },
      { x: 3, y: 1, kind: "corner", rotation: 3 },
      { x: 3, y: 2, kind: "corner", rotation: 1 },
      { x: 4, y: 2, kind: "straight", rotation: 1 },
    ],
    solution: [0, 2, 0, 0, 1, 3, 0],
    hint: "桥先向上绕行，再回到右侧出口。仔细看每块桥的两个开口。",
  },
  {
    size: 5,
    tiles: [
      { x: 0, y: 2, kind: "corner", rotation: 0 },
      { x: 0, y: 3, kind: "corner", rotation: 2 },
      { x: 1, y: 3, kind: "straight", rotation: 1 },
      { x: 2, y: 3, kind: "corner", rotation: 0 },
      { x: 2, y: 2, kind: "straight", rotation: 0 },
      { x: 2, y: 1, kind: "corner", rotation: 3 },
      { x: 3, y: 1, kind: "straight", rotation: 1 },
      { x: 4, y: 1, kind: "corner", rotation: 3 },
      { x: 4, y: 2, kind: "corner", rotation: 1 },
    ],
    solution: [1, 3, 0, 2, 1, 0, 0, 1, 3],
    hint: "从左岸先向下，在中央向上，再从右侧折回出口。",
  },
];
// Directions: east, south, west, north. Corner 0 connects east and south.
export const exits = (tile: Tile) =>
  tile.kind === "straight"
    ? [tile.rotation % 2, (tile.rotation % 2) + 2]
    : [tile.rotation % 4, (tile.rotation + 1) % 4];
export function bridgeConnected(tiles: Tile[], size: number) {
  let x = 0,
    y = 2,
    from = 2;
  const seen = new Set<string>();
  const dirs = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  while (true) {
    const key = `${x},${y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    const tile = tiles.find((t) => t.x === x && t.y === y);
    if (!tile) return false;
    const e = exits(tile);
    if (!e.includes(from)) return false;
    const to = e.find((d) => d !== from)!;
    x += dirs[to][0];
    y += dirs[to][1];
    if (x === size && y === 2) return true;
    if (x < 0 || y < 0 || x >= size || y >= size) return false;
    from = (to + 2) % 4;
  }
}

// Distinct non-self-intersecting bridge routes, always beginning and ending at row 3.
const extraBridgePaths: [number, number][][] = [
  [
    [0, 2],
    [0, 1],
    [1, 1],
    [2, 1],
    [2, 2],
    [3, 2],
    [4, 2],
  ],
  [
    [0, 2],
    [1, 2],
    [1, 3],
    [2, 3],
    [3, 3],
    [4, 3],
    [4, 2],
  ],
  [
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 4],
    [2, 4],
    [3, 4],
    [4, 4],
    [4, 3],
    [4, 2],
  ],
  [
    [0, 2],
    [1, 2],
    [1, 1],
    [1, 0],
    [2, 0],
    [3, 0],
    [3, 1],
    [3, 2],
    [4, 2],
  ],
  [
    [0, 2],
    [0, 1],
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
    [2, 2],
    [2, 3],
    [3, 3],
    [4, 3],
    [4, 2],
  ],
  [
    [0, 2],
    [0, 3],
    [1, 3],
    [1, 4],
    [2, 4],
    [3, 4],
    [3, 3],
    [3, 2],
    [3, 1],
    [4, 1],
    [4, 2],
  ],
  [
    [0, 2],
    [1, 2],
    [1, 1],
    [2, 1],
    [2, 0],
    [3, 0],
    [4, 0],
    [4, 1],
    [4, 2],
  ],
  [
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 4],
    [1, 3],
    [2, 3],
    [2, 2],
    [2, 1],
    [3, 1],
    [3, 2],
    [4, 2],
  ],
  [
    [0, 2],
    [0, 1],
    [1, 1],
    [1, 0],
    [2, 0],
    [3, 0],
    [3, 1],
    [2, 1],
    [2, 2],
    [2, 3],
    [3, 3],
    [4, 3],
    [4, 2],
  ],
];
extraBridgePaths.forEach((route, index) => {
  const solution: number[] = [];
  const tiles: Tile[] = route.map(([x, y], i) => {
    const previous = route[i - 1] ?? [-1, 2],
      next = route[i + 1] ?? [5, 2];
    const dir = (p: number[]) =>
      p[0] > x ? 0 : p[1] > y ? 1 : p[0] < x ? 2 : 3;
    const pair = [dir(previous), dir(next)];
    const kind: Tile["kind"] =
      (pair[0] + 2) % 4 === pair[1] ? "straight" : "corner";
    const rotation = Array.from(
      { length: kind === "straight" ? 2 : 4 },
      (_, n) => n,
    ).find((n) => {
      const e = exits({ x, y, kind, rotation: n });
      return pair.every((d) => e.includes(d));
    })!;
    solution.push(rotation);
    return { x, y, kind, rotation: (rotation + 1 + ((index + i) % 2)) % 4 };
  });
  bridgeLevels.push({
    size: 5,
    tiles,
    solution,
    hint: "从左岸沿着已有桥块追踪路线，让每一块的白色道路与前后两块相接。直桥有两个等价方向，弯桥只有一个正确转角。",
  });
});
