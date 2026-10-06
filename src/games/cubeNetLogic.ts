/** Original Playgarden labeled cube-net workshop. GPL-3.0-only. Exact integer 90-degree folds. */
export type NetVector = [number, number, number];
export type NetFrame = { u: NetVector; v: NetVector; normal: NetVector };
export type CubeNetLevel = {
  title: string;
  size: number;
  allowed: number[];
  fixed: Record<number, number>;
  opposites: number[][];
  idea: string;
};
export type NetFold = {
  connected: boolean;
  consistent: boolean;
  distinct: boolean;
  frames: (NetFrame | null)[];
};
export const CUBE_NET_SEARCH_LIMIT = 30000;
export const NET_FACE_NAMES = ["A", "B", "C", "D", "E", "F"] as const;
const neg = (v: NetVector): NetVector => [-v[0], -v[1], -v[2]];
const same = (a: NetVector, b: NetVector) => a.every((v, i) => v === b[i]);
export const oppositeNormals = (a: NetVector, b: NetVector) => same(a, neg(b));
export function netNeighbors(size: number, cell: number): number[] {
  return [
    cell % size ? cell - 1 : -1,
    cell % size < size - 1 ? cell + 1 : -1,
    cell >= size ? cell - size : -1,
    cell < size * (size - 1) ? cell + size : -1,
  ].filter((p) => p >= 0);
}
export function createCubeNetBoard(level: CubeNetLevel): number[] {
  return Array.from({ length: 6 }, (_, face) => level.fixed[face] ?? -1);
}
export function validCubeNetBoard(
  level: CubeNetLevel,
  board: readonly number[],
): boolean {
  const placed = board.filter((p) => p >= 0);
  return (
    board.length === 6 &&
    board.every(
      (p) => p === -1 || (Number.isInteger(p) && level.allowed.includes(p)),
    ) &&
    new Set(placed).size === placed.length &&
    Object.entries(level.fixed).every(
      ([face, cell]) => board[Number(face)] === cell,
    )
  );
}
export function placeNetFace(
  level: CubeNetLevel,
  board: readonly number[],
  face: number,
  cell: number,
): number[] | null {
  if (
    !validCubeNetBoard(level, board) ||
    !Number.isInteger(face) ||
    face < 0 ||
    face > 5 ||
    level.fixed[face] !== undefined ||
    (cell !== -1 && !level.allowed.includes(cell)) ||
    board[face] === cell ||
    (cell >= 0 && board.includes(cell))
  )
    return null;
  return board.map((p, i) => (i === face ? cell : p));
}
export function foldCubeNet(size: number, board: readonly number[]): NetFold {
  const frames: (NetFrame | null)[] = Array(6).fill(null),
    first = board.findIndex((p) => p >= 0);
  let consistent = true;
  if (first < 0)
    return { connected: false, consistent: true, distinct: true, frames };
  frames[first] = { u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1] };
  const queue = [first];
  for (let k = 0; k < queue.length; k++) {
    const face = queue[k],
      p = board[face],
      frame = frames[face]!;
    for (const q of netNeighbors(size, p)) {
      const other = board.indexOf(q);
      if (other < 0) continue;
      const dx = (q % size) - (p % size),
        dy = Math.floor(q / size) - Math.floor(p / size),
        { u, v, normal: n } = frame;
      const next: NetFrame =
        dx === 1
          ? { u: neg(n), v, normal: u }
          : dx === -1
            ? { u: n, v, normal: neg(u) }
            : dy === 1
              ? { u, v: neg(n), normal: v }
              : { u, v: n, normal: neg(v) };
      const known = frames[other];
      if (known) {
        if (
          !same(known.u, next.u) ||
          !same(known.v, next.v) ||
          !same(known.normal, next.normal)
        )
          consistent = false;
      } else {
        frames[other] = next;
        queue.push(other);
      }
    }
  }
  const visited = frames.filter((f): f is NetFrame => !!f);
  return {
    connected: visited.length === board.filter((p) => p >= 0).length,
    consistent,
    distinct:
      new Set(visited.map((f) => f.normal.join(","))).size === visited.length,
    frames,
  };
}
export function cubeNetWon(
  level: CubeNetLevel,
  board: readonly number[],
): boolean {
  if (!validCubeNetBoard(level, board) || board.includes(-1)) return false;
  const fold = foldCubeNet(level.size, board);
  return (
    fold.connected &&
    fold.consistent &&
    fold.distinct &&
    level.opposites.every(([a, b]) =>
      oppositeNormals(fold.frames[a]!.normal, fold.frames[b]!.normal),
    )
  );
}
export function describeCubeNet(
  level: CubeNetLevel,
  board: readonly number[],
): string {
  const placed = board.filter((p) => p >= 0).length;
  if (!placed) return "先放一片纸面，开始搭建。";
  const fold = foldCubeNet(level.size, board);
  if (!fold.connected) return "纸片还没有全部沿边连通；角碰角不算相连。";
  if (!fold.consistent || !fold.distinct)
    return "试折会发生重叠或折边冲突，请移动一片纸面。";
  if (placed < 6)
    return `已放 ${placed} 面，当前连通部分试折没有重叠。继续补齐六面。`;
  if (
    !level.opposites.every(([a, b]) =>
      oppositeNormals(fold.frames[a]!.normal, fold.frames[b]!.normal),
    )
  )
    return "展开图能折成盒，但指定的对面配对还没有满足。";
  return "六个面各就各位，对面配对正确，纸盒完成！";
}
export type NetSearch = {
  status: "found" | "impossible" | "limit";
  board: number[] | null;
  nodes: number;
};
/** Enumerates connected cell sets, then free labels. Current face positions are preserved. */
export function solveCubeNet(
  level: CubeNetLevel,
  current: readonly number[],
  budget = CUBE_NET_SEARCH_LIMIT,
): NetSearch {
  let nodes = 0,
    limited = false,
    answer: number[] | null = null;
  const cap = Number.isFinite(budget)
    ? Math.max(0, Math.min(CUBE_NET_SEARCH_LIMIT, Math.floor(budget)))
    : 0;
  if (!validCubeNetBoard(level, current))
    return { status: "impossible", board: null, nodes };
  const used = current.filter((p) => p >= 0),
    must = new Set(used),
    seen = new Set<string>();
  const spend = () => {
    if (nodes >= cap) {
      limited = true;
      return false;
    }
    nodes++;
    return true;
  };
  function labels(cells: number[], board: number[]): void {
    if (answer || limited || !spend()) return;
    const face = board.indexOf(-1);
    if (face < 0) {
      if (cubeNetWon(level, board)) answer = board;
      return;
    }
    for (const cell of cells)
      if (!board.includes(cell)) {
        const next = [...board];
        next[face] = cell;
        // Geometry is already certified; label constraints can be checked early.
        const fold = foldCubeNet(level.size, next);
        if (
          level.opposites.some(
            ([a, b]) =>
              fold.frames[a] &&
              fold.frames[b] &&
              !oppositeNormals(fold.frames[a]!.normal, fold.frames[b]!.normal),
          )
        )
          continue;
        labels(cells, next);
        if (answer || limited) return;
      }
  }
  function grow(cells: number[]): void {
    if (answer || limited) return;
    const key = [...cells].sort((a, b) => a - b).join(",");
    if (seen.has(key)) return;
    seen.add(key);
    if (!spend()) return;
    if (cells.length + used.filter((p) => !cells.includes(p)).length > 6)
      return;
    // Any partial connected overlap can never become a valid cube net.
    const fold = foldCubeNet(level.size, [
      ...cells,
      ...Array(6 - cells.length).fill(-1),
    ]);
    if (!fold.consistent || !fold.distinct) return;
    if (cells.length === 6) {
      if (used.every((p) => cells.includes(p))) labels(cells, [...current]);
      return;
    }
    const options = [
      ...new Set(cells.flatMap((p) => netNeighbors(level.size, p))),
    ]
      .filter((p) => level.allowed.includes(p) && !cells.includes(p))
      .sort((a, b) => Number(must.has(b)) - Number(must.has(a)) || a - b);
    for (const p of options) {
      grow([...cells, p]);
      if (answer || limited) return;
    }
  }
  if (used.length) grow([used[0]]);
  else
    for (const p of level.allowed) {
      grow([p]);
      if (answer || limited) break;
    }
  return {
    status: answer ? "found" : limited ? "limit" : "impossible",
    board: answer,
    nodes,
  };
}

/** Eleven geometrically distinct cube nets, followed by a fully paired challenge. */
export const cubeNetLevels: CubeNetLevel[] = [
  {
    title: "纸盒第一折",
    size: 5,
    allowed: [6, 11, 12, 13, 14, 16, 18],
    fixed: {
      "0": 11,
      "1": 6,
      "2": 16,
      "3": 12,
    },
    opposites: [],
    idea: "六个面要沿边连在一起。锁定面已摆好，补上剩下的面。",
  },
  {
    title: "横梁小房子",
    size: 5,
    allowed: [1, 6, 11, 12, 17, 21, 22],
    fixed: {
      "0": 6,
      "1": 1,
      "2": 11,
      "3": 12,
    },
    opposites: [],
    idea: "共享一条边的面折起来会相邻，不会互为对面。",
  },
  {
    title: "转角纸带",
    size: 5,
    allowed: [6, 10, 11, 12, 13, 17, 21, 22],
    fixed: {
      "0": 12,
      "1": 11,
      "2": 17,
    },
    opposites: [],
    idea: "沿纸带连续折三次，注意最后一面朝向哪里。",
  },
  {
    title: "折出第六面",
    size: 5,
    allowed: [6, 10, 11, 12, 13, 17, 18, 22],
    fixed: {
      "0": 17,
      "1": 12,
      "2": 22,
    },
    opposites: [],
    idea: "同一方向只能有一个面；两面叠在一起就无法封盒。",
  },
  {
    title: "阶梯纸模",
    size: 5,
    allowed: [6, 10, 11, 12, 13, 17, 21, 22, 23, 24],
    fixed: {
      "0": 11,
      "1": 6,
    },
    opposites: [[0, 5]],
    idea: "拐角处的相邻关系比纸上的左右位置更重要。",
  },
  {
    title: "避开缺口",
    size: 5,
    allowed: [5, 6, 9, 10, 11, 12, 13, 14, 16, 17],
    fixed: {
      "0": 12,
      "1": 11,
    },
    opposites: [[0, 5]],
    idea: "阴影格不能放纸片。绕过缺口，仍要保持六面连通。",
  },
  {
    title: "相对的两面",
    size: 5,
    allowed: [1, 5, 6, 11, 12, 13, 16, 17, 18, 19, 23, 24],
    fixed: {
      "0": 11,
      "1": 6,
    },
    opposites: [[0, 4]],
    idea: "两面的外法线相反时，它们才是立方体的对面。",
  },
  {
    title: "彩面相会",
    size: 5,
    allowed: [1, 5, 6, 8, 11, 12, 13, 14, 16, 18, 19, 23],
    fixed: {
      "0": 13,
      "1": 12,
    },
    opposites: [
      [0, 4],
      [1, 3],
    ],
    idea: "A 的对面可以在纸上隔很远，折起来再判断。",
  },
  {
    title: "纸带绕行",
    size: 5,
    allowed: [1, 5, 6, 8, 9, 11, 12, 13, 14, 16, 18, 19],
    fixed: {
      "0": 11,
    },
    opposites: [
      [0, 3],
      [1, 5],
    ],
    idea: "把已经确定的两面对照起来，再安排剩下的四面。",
  },
  {
    title: "错位双翼",
    size: 5,
    allowed: [2, 6, 7, 8, 10, 11, 12, 13, 14, 16, 17, 18, 21, 22, 23],
    fixed: {
      "0": 12,
    },
    opposites: [
      [0, 5],
      [1, 4],
    ],
    idea: "四格直线可能成为一圈侧壁；两端还需封口。",
  },
  {
    title: "六面有序",
    size: 5,
    allowed: [2, 6, 7, 8, 10, 11, 12, 13, 16, 17, 18, 19, 21, 22, 23],
    fixed: {
      "0": 12,
    },
    opposites: [
      [0, 4],
      [1, 5],
      [2, 3],
    ],
    idea: "先满足固定面与对面配对，再检查有没有重叠。",
  },
  {
    title: "立方体工坊",
    size: 5,
    allowed: [1, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21],
    fixed: {
      "0": 11,
    },
    opposites: [
      [0, 4],
      [1, 2],
      [3, 5],
    ],
    idea: "所有三组对面都要正确；任何合法展开图都能通关。",
  },
];

/** Labeled face positions A–F; these are examples, never the victory validator. */
export const cubeNetCertificates: number[][] = [
  [11, 6, 16, 12, 13, 14],
  [6, 1, 11, 12, 17, 22],
  [12, 11, 17, 13, 6, 22],
  [17, 12, 22, 18, 11, 6],
  [11, 6, 12, 17, 22, 23],
  [12, 11, 17, 13, 6, 14],
  [11, 6, 12, 17, 18, 23],
  [13, 12, 18, 14, 11, 6],
  [11, 6, 12, 13, 14, 19],
  [12, 11, 7, 17, 13, 22],
  [12, 11, 7, 17, 22, 18],
  [11, 6, 16, 12, 13, 14],
];
