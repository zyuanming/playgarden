/** Original Playgarden voxel tomography puzzle. GPL-3.0-only. Integer geometry only. */
export type VoxelSide = "front" | "side" | "top";
export type VoxelLevel = {
  title: string;
  size: number;
  front: number[];
  side: number[];
  top: number[];
  locked: Record<number, 0 | 1>;
  idea: string;
};
export const VOXEL_SEARCH_LIMIT = 20000;
export const voxelIndex = (n: number, x: number, y: number, z: number) =>
  z * n * n + y * n + x;
export function voxelCoordinates(
  n: number,
  index: number,
): [number, number, number] {
  return [index % n, Math.floor(index / n) % n, Math.floor(index / (n * n))];
}
export function voxelRay(n: number, side: VoxelSide, index: number): number[] {
  const a = index % n,
    b = Math.floor(index / n);
  return Array.from({ length: n }, (_, t) =>
    side === "front"
      ? voxelIndex(n, a, t, b)
      : side === "side"
        ? voxelIndex(n, t, a, b)
        : voxelIndex(n, a, b, t),
  );
}
export function voxelProjection(
  n: number,
  board: readonly number[],
  side: VoxelSide,
): number[] {
  return Array.from({ length: n * n }, (_, i) =>
    voxelRay(n, side, i).reduce(
      (total, p) => total + (board[p] === 1 ? 1 : 0),
      0,
    ),
  );
}
export function validVoxelBoard(
  level: VoxelLevel,
  board: readonly number[],
): boolean {
  return (
    board.length === level.size ** 3 &&
    board.every((v) => v === 0 || v === 1) &&
    Object.entries(level.locked).every(([p, v]) => board[Number(p)] === v)
  );
}
export function createVoxelBoard(level: VoxelLevel): number[] {
  return Array.from(
    { length: level.size ** 3 },
    (_, i) => level.locked[i] ?? 0,
  );
}
export function voxelWon(level: VoxelLevel, board: readonly number[]): boolean {
  return (
    validVoxelBoard(level, board) &&
    (["front", "side", "top"] as const).every((side) =>
      voxelProjection(level.size, board, side).every(
        (v, i) => v === level[side][i],
      ),
    )
  );
}
export function toggleVoxel(
  level: VoxelLevel,
  board: readonly number[],
  index: number,
): number[] | null {
  if (
    !validVoxelBoard(level, board) ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= board.length ||
    level.locked[index] !== undefined
  )
    return null;
  return board.map((v, i) => (i === index ? 1 - v : v));
}
export type VoxelSearch = {
  status: "found" | "impossible" | "limit";
  board: number[] | null;
  nodes: number;
};
/** Search only adds cubes to the current construction. A failure never means the puzzle itself is impossible. */
export function solveVoxel(
  level: VoxelLevel,
  current: readonly number[],
  budget = VOXEL_SEARCH_LIMIT,
): VoxelSearch {
  let nodes = 0,
    limited = false;
  const cap = Number.isFinite(budget)
    ? Math.max(0, Math.min(VOXEL_SEARCH_LIMIT, Math.floor(budget)))
    : 0;
  if (!validVoxelBoard(level, current))
    return { status: "impossible", board: null, nodes };
  const rays = (["front", "side", "top"] as const).flatMap((side) =>
    level[side].map((target, index) => ({
      target,
      cells: voxelRay(level.size, side, index),
    })),
  );
  const visit = (input: number[]): number[] | null => {
    if (nodes >= cap) {
      limited = true;
      return null;
    }
    nodes++;
    const values = [...input];
    let changed = true;
    while (changed) {
      changed = false;
      for (const { target, cells } of rays) {
        const used = cells.reduce(
            (sum, p) => sum + (values[p] === 1 ? 1 : 0),
            0,
          ),
          unknown = cells.filter((p) => values[p] === -1);
        if (used > target || used + unknown.length < target) return null;
        if (
          unknown.length &&
          (used === target || used + unknown.length === target)
        ) {
          for (const p of unknown) values[p] = used === target ? 0 : 1;
          changed = true;
        }
      }
    }
    if (!values.includes(-1)) return voxelWon(level, values) ? values : null;
    const tight = rays
      .filter((ray) => ray.cells.some((p) => values[p] === -1))
      .sort(
        (a, b) =>
          a.cells.filter((p) => values[p] === -1).length -
          b.cells.filter((p) => values[p] === -1).length,
      )[0];
    const p = tight.cells.find((p) => values[p] === -1)!;
    for (const value of [1, 0]) {
      const next = [...values];
      next[p] = value;
      const found = visit(next);
      if (found) return found;
      if (limited) return null;
    }
    return null;
  };
  const board = visit(
    current.map((v, i) => level.locked[i] ?? (v === 1 ? 1 : -1)),
  );
  return {
    status: board ? "found" : limited ? "limit" : "impossible",
    board,
    nodes,
  };
}

/** Authored targets are stored separately from the replay certificates. */
export const voxelViewsLevels: VoxelLevel[] = [
  {
    title: "一层小角",
    size: 2,
    front: [2, 1, 0, 0],
    side: [2, 1, 0, 0],
    top: [1, 1, 1, 0],
    locked: {},
    idea: "先看俯视图：同一根竖线为 0 时，整列都不能放方块。",
  },
  {
    title: "向上转弯",
    size: 2,
    front: [1, 1, 1, 0],
    side: [2, 0, 1, 0],
    top: [2, 1, 0, 0],
    locked: {},
    idea: "正视图分辨高度，俯视图分辨前后。把两个方向的线索交叉起来。",
  },
  {
    title: "折线积木",
    size: 2,
    front: [1, 2, 0, 1],
    side: [2, 1, 0, 1],
    top: [1, 1, 0, 2],
    locked: {},
    idea: "数字 2 表示这条视线中有两块，而不是一块较高的方块。",
  },
  {
    title: "错层小桥",
    size: 2,
    front: [2, 1, 0, 2],
    side: [2, 1, 1, 1],
    top: [1, 2, 1, 1],
    locked: {},
    idea: "同一个高度上的前后位置，可用侧视图来区分。",
  },
  {
    title: "枝桠平台",
    size: 3,
    front: [1, 3, 1, 0, 1, 0, 0, 0, 0],
    side: [3, 1, 1, 0, 1, 0, 0, 0, 0],
    top: [1, 1, 1, 0, 2, 0, 0, 1, 0],
    locked: {},
    idea: "从数字 0 开始排除，再把正视与侧视中的非零线交叉。",
  },
  {
    title: "双层转角",
    size: 3,
    front: [1, 1, 3, 3, 0, 0, 0, 0, 0],
    side: [3, 1, 1, 1, 1, 1, 0, 0, 0],
    top: [2, 1, 1, 1, 0, 1, 1, 0, 1],
    locked: {},
    idea: "前后与左右的计数并不相同；留意每张图的坐标标签。",
  },
  {
    title: "阶梯与尾巴",
    size: 3,
    front: [1, 1, 3, 0, 1, 2, 0, 0, 1],
    side: [3, 1, 1, 2, 0, 1, 1, 0, 0],
    top: [1, 2, 3, 0, 0, 1, 0, 0, 2],
    locked: {},
    idea: "一条长度为 3 的视线写着 3，就必须占满其中三格。",
  },
  {
    title: "中庭花架",
    size: 3,
    front: [3, 2, 3, 1, 1, 1, 0, 0, 0],
    side: [3, 2, 3, 0, 2, 1, 0, 0, 0],
    top: [1, 1, 1, 2, 0, 2, 1, 2, 1],
    locked: {},
    idea: "俯视图中心的 0 保留了通孔；每个高度都要避开这一列。",
  },
  {
    title: "交错脊梁",
    size: 3,
    front: [1, 2, 2, 2, 2, 1, 0, 1, 0],
    side: [2, 2, 1, 1, 2, 2, 0, 1, 0],
    top: [2, 1, 0, 1, 3, 1, 0, 1, 2],
    locked: {
      "0": 1,
    },
    idea: "锁定方块是已经确定的位置，其余位置仍可以调整。",
  },
  {
    title: "斜向书架",
    size: 3,
    front: [2, 3, 1, 2, 2, 1, 0, 1, 1],
    side: [3, 2, 1, 1, 3, 1, 0, 2, 0],
    top: [2, 1, 1, 2, 3, 2, 0, 2, 0],
    locked: {
      "13": 1,
    },
    idea: "只让每张图的总数相同还不够；每一条视线都必须吻合。",
  },
  {
    title: "四柱长廊",
    size: 3,
    front: [3, 2, 3, 2, 0, 2, 1, 1, 1],
    side: [3, 2, 3, 2, 0, 2, 3, 0, 0],
    top: [3, 2, 3, 1, 0, 1, 2, 1, 2],
    locked: {},
    idea: "可以有不止一种满足投影的搭法。这里检查的是三张图，不是隐藏造型。",
  },
  {
    title: "三向空间谜题",
    size: 3,
    front: [2, 1, 2, 1, 2, 1, 2, 1, 2],
    side: [2, 1, 2, 1, 2, 1, 2, 1, 2],
    top: [2, 1, 2, 1, 2, 1, 2, 1, 2],
    locked: {},
    idea: "没有全空或全满的视线时，可以先试放一块，再交叉检查三张图；不同搭法都可能有效。",
  },
];

/** One certified construction per level, not a uniqueness claim. */
export const voxelViewsCertificates: number[][] = [
  [0, 1, 2],
  [0, 1, 4],
  [0, 1, 3, 7],
  [0, 1, 2, 5, 7],
  [0, 1, 2, 4, 7, 13],
  [0, 1, 2, 5, 8, 9, 12, 15],
  [0, 1, 2, 5, 8, 10, 11, 17, 20],
  [0, 1, 2, 3, 5, 6, 7, 8, 12, 14, 16],
  [0, 1, 4, 5, 8, 9, 12, 13, 16, 17, 22],
  [0, 1, 2, 3, 4, 7, 9, 12, 13, 14, 16, 22, 23],
  [0, 1, 2, 3, 5, 6, 7, 8, 9, 11, 15, 17, 18, 19, 20],
  [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26],
];
