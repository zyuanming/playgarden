// SPDX-License-Identifier: GPL-3.0-only
export const tidalLevels = [
  {
    id: "tidal-post-01",
    rows: ["S1.E", ".###"],
    solution: "RRR",
  },
  {
    id: "tidal-post-02",
    rows: ["Sw0E"],
    solution: "RWRR",
  },
  {
    id: "tidal-post-03",
    rows: ["###S", "#.1.", "E#w2", ".0.2"],
    solution: "DDLWDLLU",
  },
  {
    id: "tidal-post-04",
    rows: ["S.##1", "..##2", ".2..#", ".w0.w", "0w#0E"],
    solution: "DDDRWRRRD",
  },
  {
    id: "tidal-post-05",
    rows: ["..1.1", "E#...", "#..1.", "..#..", "0wS0w"],
    solution: "LWUURUULLD",
  },
  {
    id: "tidal-post-06",
    rows: ["aw02.", "12.Eb", ".1...", ".w0..", "S#.2#"],
    solution: "URWUUULRRDRRL",
  },
  {
    id: "tidal-post-07",
    rows: ["S.w..", "111.0", "b..w.", "##a2#", "#E.2."],
    solution: "RRWDDDULLRRDDL",
  },
  {
    id: "tidal-post-08",
    rows: ["..0..", ".a.E1", ".0##w", "1b.w.", "0...S"],
    solution: "UUWULLLLDDRUURR",
  },
  {
    id: "tidal-post-09",
    rows: ["#..S2", "2..w.", "a#.#b", ".#.E.", "..w#0"],
    solution: "DWLLLDDDRRURRUDL",
  },
  {
    id: "tidal-post-10",
    rows: ["a.2.#", "0E#S.", ".w0..", ".2w0b", "2.2.."],
    solution: "ULLLRDDWRRRDULLLU",
  },
  {
    id: "tidal-post-11",
    rows: [".S.w", "b11.", "#0#.", "0a.E"],
    solution: "RRWDDDLLUULURRRDDD",
  },
  {
    id: "tidal-post-12",
    rows: ["..0w0", "...1a", "S#2#.", "...#w", "b0w1E"],
    solution: "URRRRDDWDLLLLURRDWRR",
  },
];
export type Board = readonly string[];
export const directions = {
  U: [0, -1],
  D: [0, 1],
  L: [-1, 0],
  R: [1, 0],
  W: [0, 0],
} as const;
export type Move = keyof typeof directions;
export type State = { x: number; y: number; tide: number; stamps: number };
export const moveNames: Record<Move, string> = {
  U: "向上",
  D: "向下",
  L: "向左",
  R: "向右",
  W: "等一拍",
};
export function start(rows: Board): State {
  const y = rows.findIndex((row) => row.includes("S"));
  return { x: rows[y].indexOf("S"), y, tide: 0, stamps: 0 };
}
export function won(rows: Board, s: State): boolean {
  return (
    rows[s.y][s.x] === "E" &&
    (!rows.some((row) => row.includes("a")) || s.stamps === 3)
  );
}
export function move(
  rows: Board,
  s: State,
  action: Move,
): { state: State } | { reason: string } {
  if (won(rows, s)) return { reason: "邮件已经送达。" };
  const tide = (s.tide + 1) % 3;
  if (action === "W")
    return rows[s.y][s.x] === "w"
      ? { state: { ...s, tide } }
      : { reason: "只有停靠台才能等一拍。潮位不变。" };
  const [dx, dy] = directions[action],
    x = s.x + dx,
    y = s.y + dy,
    tile = rows[y]?.[x];
  if (!tile || tile === "#") return { reason: "前方没有路。潮位不变。" };
  if (tile === "b" && !(s.stamps & 1))
    return { reason: "先取 A 邮戳，才能进入 B。潮位不变。" };
  if (/[0-2]/.test(tile) && Number(tile) !== tide)
    return { reason: `这扇门需要潮位 ${tile}，下一拍是 ${tide}。潮位不变。` };
  return {
    state: {
      x,
      y,
      tide,
      stamps: s.stamps | (tile === "a" ? 1 : tile === "b" ? 2 : 0),
    },
  };
}
const moves = Object.keys(directions) as Move[];
export function hint(rows: Board, s: State): Move | null {
  const key = (p: State) => `${p.x}:${p.y}:${p.tide}:${p.stamps}`;
  const seen = new Set([key(s)]),
    queue: Array<{ state: State; first: Move | null }> = [
      { state: s, first: null },
    ];
  // Board cells × tides × reachable stamp masks. Finite by construction.
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    if (won(rows, cur.state)) return cur.first;
    for (const a of moves) {
      const result = move(rows, cur.state, a);
      if ("state" in result && !seen.has(key(result.state))) {
        seen.add(key(result.state));
        queue.push({ state: result.state, first: cur.first ?? a });
      }
    }
  }
  return null;
}
