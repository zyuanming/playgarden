/** Original GPL-3.0-only-licensed finite-resource vector navigation. No timers, randomness or floating-point geometry. */
export type Coordinate = { x: number; y: number };
export type VectorCard = { dx: number; dy: number; count: number };
export type CoordinateLevel = {
  title: string;
  size: number;
  min: number;
  start: Coordinate;
  finish: Coordinate;
  rocks: Coordinate[];
  gems: Coordinate[];
  cards: VectorCard[];
  idea: string;
  solution: number[];
};
export type CoordinateBoard = {
  position: Coordinate;
  remaining: number[];
  collected: number;
};
export type CoordinateState = CoordinateBoard & { history: CoordinateBoard[] };
export const COORDINATE_SEARCH_LIMIT = 30000;
export const coordinateEqual = (a: Coordinate, b: Coordinate) =>
  a.x === b.x && a.y === b.y;
export const coordinateLabel = (p: Coordinate) => `(${p.x}, ${p.y})`;
export function vectorLabel(card: Pick<VectorCard, "dx" | "dy">): string {
  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
  return `(${signed(card.dx)}, ${signed(card.dy)})`;
}
export function insideCoordinate(
  level: CoordinateLevel,
  p: Coordinate,
): boolean {
  return (
    Number.isInteger(p.x) &&
    Number.isInteger(p.y) &&
    p.x >= level.min &&
    p.y >= level.min &&
    p.x < level.min + level.size &&
    p.y < level.min + level.size
  );
}
export function createCoordinateState(level: CoordinateLevel): CoordinateState {
  return {
    position: { ...level.start },
    remaining: level.cards.map((c) => c.count),
    collected: level.gems.reduce(
      (mask, p, i) =>
        coordinateEqual(p, level.start) ? mask | (1 << i) : mask,
      0,
    ),
    history: [],
  };
}
export function coordinateWon(
  level: CoordinateLevel,
  board: CoordinateBoard,
): boolean {
  return (
    board.collected === (1 << level.gems.length) - 1 &&
    coordinateEqual(board.position, level.finish)
  );
}
export function validCoordinateBoard(
  level: CoordinateLevel,
  board: CoordinateBoard,
): boolean {
  return (
    insideCoordinate(level, board.position) &&
    !level.rocks.some((p) => coordinateEqual(p, board.position)) &&
    board.remaining.length === level.cards.length &&
    board.remaining.every(
      (n, i) => Number.isInteger(n) && n >= 0 && n <= level.cards[i].count,
    ) &&
    Number.isInteger(board.collected) &&
    board.collected >= 0 &&
    board.collected < 1 << level.gems.length
  );
}
export function coordinatePath(
  level: CoordinateLevel,
  board: CoordinateBoard,
  cardIndex: number,
): Coordinate[] | null {
  const card = level.cards[cardIndex];
  if (
    !Number.isInteger(cardIndex) ||
    !card ||
    !board.remaining[cardIndex] ||
    coordinateWon(level, board)
  )
    return null;
  if (
    !Number.isInteger(card.dx) ||
    !Number.isInteger(card.dy) ||
    (!card.dx && !card.dy) ||
    (card.dx && card.dy && Math.abs(card.dx) !== Math.abs(card.dy))
  )
    return null;
  const length = Math.max(Math.abs(card.dx), Math.abs(card.dy));
  const path = Array.from({ length }, (_, i) => ({
    x: board.position.x + Math.sign(card.dx) * (i + 1),
    y: board.position.y + Math.sign(card.dy) * (i + 1),
  }));
  return path.every(
    (p) =>
      insideCoordinate(level, p) &&
      !level.rocks.some((r) => coordinateEqual(r, p)),
  )
    ? path
    : null;
}
export function applyCoordinateMove(
  level: CoordinateLevel,
  board: CoordinateBoard,
  cardIndex: number,
): CoordinateBoard | null {
  if (!validCoordinateBoard(level, board)) return null;
  const path = coordinatePath(level, board, cardIndex),
    position = path?.at(-1);
  if (!position) return null;
  return {
    position,
    remaining: board.remaining.map((n, i) => n - Number(i === cardIndex)),
    collected: level.gems.reduce(
      (mask, p, i) => (coordinateEqual(p, position) ? mask | (1 << i) : mask),
      board.collected,
    ),
  };
}
export function coordinateMove(
  state: CoordinateState,
  level: CoordinateLevel,
  cardIndex: number,
): CoordinateState {
  const next = applyCoordinateMove(level, state, cardIndex);
  return next
    ? {
        ...next,
        history: [
          ...state.history,
          {
            position: state.position,
            remaining: state.remaining,
            collected: state.collected,
          },
        ],
      }
    : state;
}
export function undoCoordinate(state: CoordinateState): CoordinateState {
  const previous = state.history.at(-1);
  return previous
    ? { ...previous, history: state.history.slice(0, -1) }
    : state;
}
export type CoordinateSearch = {
  status: "solved" | "found" | "unsolvable" | "limit" | "invalid";
  moves: number[];
  visited: number;
};
export function searchCoordinate(
  level: CoordinateLevel,
  board: CoordinateBoard,
  limit = COORDINATE_SEARCH_LIMIT,
): CoordinateSearch {
  if (!validCoordinateBoard(level, board))
    return { status: "invalid", moves: [], visited: 0 };
  if (coordinateWon(level, board))
    return { status: "solved", moves: [], visited: 0 };
  const budget = Math.max(
    0,
    Math.min(COORDINATE_SEARCH_LIMIT, Math.floor(limit) || 0),
  );
  if (!budget) return { status: "limit", moves: [], visited: 0 };
  const key = (s: CoordinateBoard) =>
    `${s.position.x},${s.position.y}|${s.collected}|${s.remaining.join(",")}`;
  const queue: { board: CoordinateBoard; parent: number; card: number }[] = [
    { board, parent: -1, card: -1 },
  ];
  const seen = new Set([key(board)]);
  let bounded = false;
  for (let h = 0; h < queue.length; h++) {
    for (let card = 0; card < level.cards.length; card++) {
      const next = applyCoordinateMove(level, queue[h].board, card);
      if (!next) continue;
      if (coordinateWon(level, next)) {
        const moves = [card];
        for (let i = h; queue[i].parent !== -1; i = queue[i].parent)
          moves.unshift(queue[i].card);
        return { status: "found", moves, visited: queue.length };
      }
      const id = key(next);
      if (seen.has(id)) continue;
      if (queue.length >= budget) {
        bounded = true;
        continue;
      }
      seen.add(id);
      queue.push({ board: next, parent: h, card });
    }
  }
  return {
    status: bounded ? "limit" : "unsolvable",
    moves: [],
    visited: queue.length,
  };
}
function level(
  title: string,
  size: number,
  min: number,
  route: number[][],
  gemStops: number[],
  rocks: number[][],
  idea: string,
  extras: VectorCard[] = [],
): CoordinateLevel {
  const points = route.map(([x, y]) => ({ x, y }));
  const vectors = points
    .slice(1)
    .map((p, i) => ({ dx: p.x - points[i].x, dy: p.y - points[i].y }));
  const cards: VectorCard[] = [];
  for (const v of [...vectors.map((v) => ({ ...v, count: 1 })), ...extras]) {
    const existing = cards.find((c) => c.dx === v.dx && c.dy === v.dy);
    if (existing) existing.count += v.count;
    else cards.push({ ...v });
  }
  // Card order deliberately differs from the path certificate.
  cards.sort((a, b) => a.dx - b.dx || a.dy - b.dy);
  const config: CoordinateLevel = {
    title,
    size,
    min,
    start: points[0],
    finish: points.at(-1)!,
    gems: gemStops.map((i) => points[i]),
    rocks: rocks.map(([x, y]) => ({ x, y })),
    cards,
    idea,
    solution: vectors.map((v) =>
      cards.findIndex((c) => c.dx === v.dx && c.dy === v.dy),
    ),
  };
  let state: CoordinateBoard = createCoordinateState(config);
  for (const move of config.solution) {
    const next = applyCoordinateMove(config, state, move);
    if (!next) throw new Error(`Invalid coordinate certificate: ${title}`);
    state = next;
  }
  if (!coordinateWon(config, state))
    throw new Error(`Incomplete coordinate certificate: ${title}`);
  return config;
}
export const coordinateTreasureLevels: CoordinateLevel[] = [
  level(
    "沿着坐标走",
    4,
    0,
    [
      [0, 0],
      [2, 0],
      [2, 2],
      [3, 2],
    ],
    [1, 2],
    [[1, 1]],
    "横坐标 x 向右增加，纵坐标 y 向上增加。",
  ),
  level(
    "绕过小礁石",
    4,
    0,
    [
      [0, 0],
      [0, 2],
      [2, 2],
      [2, 1],
      [3, 1],
    ],
    [1, 3],
    [
      [1, 0],
      [1, 1],
    ],
    "先看整条路线：移动两格时，中间那格也不能有礁石。",
  ),
  level(
    "回来取宝石",
    4,
    0,
    [
      [0, 1],
      [2, 1],
      [2, 3],
      [0, 3],
      [0, 2],
    ],
    [1, 2, 3],
    [
      [1, 2],
      [3, 2],
    ],
    "负向量能让你向左或向下，不是只能前进。",
  ),
  level(
    "斜线捷径",
    5,
    0,
    [
      [0, 0],
      [2, 2],
      [4, 2],
      [4, 4],
      [2, 4],
    ],
    [1, 2, 3],
    [
      [1, 0],
      [2, 1],
      [3, 3],
    ],
    "两个分量一起变化，就沿斜线走。落点才会拾取宝石。",
    [{ dx: 0, dy: 1, count: 1 }],
  ),
  level(
    "四方小岛",
    5,
    0,
    [
      [0, 0],
      [0, 3],
      [2, 3],
      [2, 1],
      [4, 1],
      [4, 4],
    ],
    [1, 2, 4],
    [
      [1, 1],
      [1, 2],
      [3, 3],
    ],
    "长卡不要急着用：为回程保留正确方向。",
  ),
  level(
    "一张卡两次用",
    5,
    0,
    [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 4],
      [2, 4],
      [4, 4],
    ],
    [1, 3, 5],
    [
      [1, 1],
      [3, 1],
      [3, 3],
    ],
    "卡片右下角是剩余次数；同一方向可能需要重复使用。",
  ),
  level(
    "原点两边",
    5,
    -2,
    [
      [-2, -2],
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [-2, 2],
    ],
    [1, 2, 4],
    [
      [-1, 0],
      [0, -1],
      [1, 1],
    ],
    "负坐标也是真实位置。从负数加上正数，可以回到原点。",
  ),
  level(
    "零点十字路",
    5,
    -2,
    [
      [0, 0],
      [2, 0],
      [2, -2],
      [0, -2],
      [-2, -2],
      [-2, 0],
      [-2, 2],
      [0, 2],
    ],
    [1, 3, 5, 6],
    [
      [1, 1],
      [-1, 1],
      [1, -1],
    ],
    "别把坐标和向量混淆：新位置 = 原位置 + 移动量。",
  ),
  level(
    "落点的秘密",
    6,
    0,
    [
      [0, 0],
      [3, 0],
      [3, 3],
      [1, 3],
      [1, 1],
      [4, 1],
      [4, 4],
      [2, 4],
    ],
    [1, 3, 5, 6],
    [
      [2, 2],
      [2, 5],
      [5, 2],
    ],
    "经过宝石还不算收集，规划好每一次准确落点。",
  ),
  level(
    "斜角双回环",
    6,
    -2,
    [
      [-2, -2],
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [-2, 0],
      [-2, 2],
      [0, 2],
      [0, 3],
    ],
    [1, 2, 5, 6],
    [
      [1, -1],
      [1, 1],
      [-1, 3],
      [3, 1],
    ],
    "先收集支路宝石，再去终点。斜向卡也会被途中礁石挡住。",
  ),
  level(
    "长短卡接力",
    7,
    -3,
    [
      [-3, -3],
      [0, -3],
      [0, -1],
      [2, -1],
      [2, 2],
      [-1, 2],
      [-1, 0],
      [-3, 0],
      [-3, 3],
      [0, 3],
    ],
    [1, 3, 5, 7, 8],
    [
      [-2, -2],
      [1, 0],
      [0, 1],
      [1, 3],
    ],
    "每张卡都是有限资源；相同总位移，顺序不同也会走进死路。",
  ),
  level(
    "星图归航",
    7,
    -3,
    [
      [-3, -3],
      [-1, -1],
      [1, -1],
      [3, 1],
      [3, 3],
      [0, 3],
      [0, 0],
      [-2, 0],
      [-2, 2],
      [0, 2],
      [0, 3],
    ],
    [1, 3, 5, 7, 8, 9],
    [
      [0, -2],
      [2, -2],
      [-1, 1],
      [1, 1],
      [-3, 2],
    ],
    "综合使用正负坐标、长短向量和斜线，带齐六颗宝石归航。",
  ),
];
export const coordinateTreasureSolutions = coordinateTreasureLevels.map(
  (level) => level.solution,
);
