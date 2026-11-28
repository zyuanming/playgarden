// SPDX-License-Identifier: GPL-3.0-only
export type Move = "L" | "W" | "R";
export const moves = ["L", "W", "R"] as const;
export const impulse: Record<Move, number> = { L: -1, W: 0, R: 1 };
export const moveNames: Record<Move, string> = {
  L: "向左推",
  W: "等一拍",
  R: "向右推",
};
export type Gate = readonly [beat: number, min: number, max: number];
export type SpringBoard = {
  id: string;
  title: string;
  start: readonly [number, number];
  stock: readonly [number, number];
  beats: number;
  gates: readonly Gate[];
  goal: readonly [number, number];
};
export type Frame = {
  beat: number;
  x: number;
  v: number;
  left: number;
  right: number;
};
type Projection = { frame: Frame; gate?: Gate; error?: "stock" | "gate" };

export function initialFrame(board: SpringBoard): Frame {
  const [x, v] = board.start;
  const [left, right] = board.stock;
  return { beat: 0, x, v, left, right };
}

export function project(
  board: SpringBoard,
  s: Frame,
  move: Move,
): Projection | null {
  if (s.beat >= board.beats) return null;
  const beat = s.beat + 1;
  const x = s.v + impulse[move],
    v = -s.x || 0;
  const gate = board.gates.find((g) => g[0] === beat);
  const frame = {
    beat,
    x,
    v,
    left: s.left - Number(move === "L"),
    right: s.right - Number(move === "R"),
  };
  if (frame.left < 0 || frame.right < 0) return { frame, gate, error: "stock" };
  if (gate && (x < gate[1] || x > gate[2]))
    return { frame, gate, error: "gate" };
  return { frame, gate };
}

export function wins(board: SpringBoard, s: Frame) {
  return (
    s.beat === board.beats && s.x === board.goal[0] && s.v === board.goal[1]
  );
}

export function findMove(board: SpringBoard, s: Frame): Move | null {
  const dead = new Set<string>();
  const consider = (start: Frame): boolean => {
    if (start.beat === board.beats) return wins(board, start);
    const key = [start.beat, start.x, start.v, start.left, start.right].join(
      ",",
    );
    if (dead.has(key)) return false;
    for (const move of moves) {
      const draft = project(board, start, move);
      if (draft && !draft.error && consider(draft.frame)) return true;
    }
    dead.add(key);
    return false;
  };
  for (const move of moves) {
    const draft = project(board, s, move);
    if (draft && !draft.error && consider(draft.frame)) return move;
  }
  return null;
}
