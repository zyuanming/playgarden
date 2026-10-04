// SPDX-License-Identifier: MIT
/** Fixed world directions: x east, y south. Face tuple is top, bottom, north, south, west, east. */
export type RollDirection = "N" | "E" | "S" | "W";
export type RollOrientation = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
];
export type RollBoard = {
  x: number;
  y: number;
  faces: RollOrientation;
  plates: number;
};
export type RollPlate = { x: number; y: number; face: number };
export type RollGate = RollPlate & { needs?: number };
export type RollingLevel = {
  id: string;
  title: string;
  lesson: string;
  rows: readonly string[];
  start: readonly [number, number];
  exit: { x: number; y: number; bottom: number; north: number };
  plates: readonly RollPlate[];
  gates: readonly RollGate[];
  certificate: {
    moves: readonly RollDirection[];
    shortest: number;
    visited: number;
  };
};
export type RollState = { board: RollBoard; history: readonly RollBoard[] };
export const ROLL_DIRECTIONS: readonly RollDirection[] = ["N", "E", "S", "W"];
export const ROLL_LABELS = { N: "北 ↑", E: "东 →", S: "南 ↓", W: "西 ←" };
export const ROLL_START: RollOrientation = [0, 5, 1, 4, 2, 3];
export const ROLL_STATE_LIMIT = 5760;
export const rollFaceLabel = (face: number) => "ABCDEF"[face] ?? "?";
export function rotateRoll(
  f: RollOrientation,
  direction: RollDirection,
): RollOrientation {
  const [t, b, n, s, w, e] = f;
  switch (direction) {
    case "N":
      return [s, n, t, b, w, e];
    case "S":
      return [n, s, b, t, w, e];
    case "E":
      return [w, e, n, s, b, t];
    case "W":
      return [e, w, n, s, t, b];
  }
}
export const ROLL_ORIENTATIONS: readonly RollOrientation[] = (() => {
  const queue: RollOrientation[] = [ROLL_START],
    seen = new Set([ROLL_START.join("")]);
  for (let head = 0; head < queue.length; head++)
    for (const d of ROLL_DIRECTIONS) {
      const f = rotateRoll(queue[head], d),
        key = f.join("");
      if (!seen.has(key)) {
        seen.add(key);
        queue.push(f);
      }
    }
  return queue;
})();
export const rollWalkable = (l: RollingLevel, x: number, y: number) =>
  Number.isInteger(x) && Number.isInteger(y) && l.rows[y]?.[x] === ".";
const faceValid = (f: number) => Number.isInteger(f) && f >= 0 && f < 6;
export function validRollingLevel(l: RollingLevel): boolean {
  const width = l.rows[0]?.length ?? 0;
  const count = l.rows
    .join("")
    .split("")
    .filter((c) => c === ".").length;
  return (
    width > 0 &&
    width <= 6 &&
    l.rows.length <= 6 &&
    count >= 2 &&
    count <= 30 &&
    l.rows.every((r) => r.length === width && /^[.#]+$/.test(r)) &&
    rollWalkable(l, ...l.start) &&
    rollWalkable(l, l.exit.x, l.exit.y) &&
    l.plates.length <= 3 &&
    [...l.plates, ...l.gates].every(
      (p) => rollWalkable(l, p.x, p.y) && faceValid(p.face),
    ) &&
    new Set(l.plates.map((p) => `${p.x},${p.y}`)).size === l.plates.length &&
    new Set(l.gates.map((p) => `${p.x},${p.y}`)).size === l.gates.length &&
    l.gates.every(
      (g) =>
        Number.isInteger(g.needs ?? 0) &&
        (g.needs ?? 0) >= 0 &&
        (g.needs ?? 0) < 1 << l.plates.length,
    ) &&
    ROLL_ORIENTATIONS.some(
      (f) => f[1] === l.exit.bottom && f[2] === l.exit.north,
    )
  );
}
export function validRollBoard(l: RollingLevel, b: RollBoard): boolean {
  return (
    validRollingLevel(l) &&
    rollWalkable(l, b.x, b.y) &&
    Number.isInteger(b.plates) &&
    b.plates >= 0 &&
    b.plates < 1 << l.plates.length &&
    ROLL_ORIENTATIONS.some((f) => f.every((v, i) => v === b.faces[i])) &&
    b.faces.length === 6
  );
}
function activate(l: RollingLevel, b: RollBoard): RollBoard {
  let plates = b.plates;
  l.plates.forEach((p, i) => {
    if (p.x === b.x && p.y === b.y && p.face === b.faces[1]) plates |= 1 << i;
  });
  return { ...b, plates };
}
export const initialRollBoard = (l: RollingLevel): RollBoard =>
  activate(l, {
    x: l.start[0],
    y: l.start[1],
    faces: [...ROLL_START],
    plates: 0,
  });
export const createRollState = (l: RollingLevel): RollState => ({
  board: initialRollBoard(l),
  history: [],
});
export function rollingWon(l: RollingLevel, b: RollBoard): boolean {
  return (
    validRollBoard(l, b) &&
    b.x === l.exit.x &&
    b.y === l.exit.y &&
    b.faces[1] === l.exit.bottom &&
    b.faces[2] === l.exit.north &&
    b.plates === (1 << l.plates.length) - 1
  );
}
/** Internal transition skips repeated validation; search has validated its finite domain. */
function step(
  l: RollingLevel,
  b: RollBoard,
  d: RollDirection,
): RollBoard | null {
  const x = b.x + (d === "E" ? 1 : d === "W" ? -1 : 0),
    y = b.y + (d === "S" ? 1 : d === "N" ? -1 : 0);
  if (!rollWalkable(l, x, y)) return null;
  const faces = rotateRoll(b.faces, d),
    gate = l.gates.find((g) => g.x === x && g.y === y);
  if (
    gate &&
    (gate.face !== faces[1] ||
      (b.plates & (gate.needs ?? 0)) !== (gate.needs ?? 0))
  )
    return null;
  return activate(l, { x, y, faces, plates: b.plates });
}
export function rollStep(
  l: RollingLevel,
  b: RollBoard,
  d: RollDirection,
): RollBoard | null {
  if (!ROLL_DIRECTIONS.includes(d) || !validRollBoard(l, b)) return null;
  return step(l, b, d);
}
export function moveRoll(
  l: RollingLevel,
  s: RollState,
  d: RollDirection,
): RollState {
  if (rollingWon(l, s.board)) return s;
  const b = rollStep(l, s.board, d);
  return b ? { board: b, history: [...s.history, s.board] } : s;
}
export function undoRoll(l: RollingLevel, s: RollState): RollState {
  if (!s.history.length || rollingWon(l, s.board)) return s;
  return {
    board: s.history[s.history.length - 1],
    history: s.history.slice(0, -1),
  };
}
const keyRoll = (b: RollBoard) =>
  `${b.x},${b.y}:${b.faces.join("")}:${b.plates}`;
export type RollSearch = {
  status: "solved" | "unreachable" | "invalid";
  moves: RollDirection[];
  visited: number;
};
/** Complete BFS: no heuristic pruning, all <= 30 * 24 * 8 states. */
export function searchRolling(
  l: RollingLevel,
  start = initialRollBoard(l),
): RollSearch {
  if (!validRollBoard(l, start))
    return { status: "invalid", moves: [], visited: 0 };
  const queue = [{ board: start, parent: -1, move: "N" as RollDirection }],
    seen = new Set([keyRoll(start)]);
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head],
      b = node.board;
    if (
      b.x === l.exit.x &&
      b.y === l.exit.y &&
      b.faces[1] === l.exit.bottom &&
      b.faces[2] === l.exit.north &&
      b.plates === (1 << l.plates.length) - 1
    ) {
      const moves: RollDirection[] = [];
      for (let i = head; queue[i].parent >= 0; i = queue[i].parent)
        moves.push(queue[i].move);
      return { status: "solved", moves: moves.reverse(), visited: seen.size };
    }
    for (const d of ROLL_DIRECTIONS) {
      const next = step(l, b, d);
      if (!next) continue;
      const key = keyRoll(next);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ board: next, parent: head, move: d });
    }
  }
  return { status: "unreachable", moves: [], visited: seen.size };
}
export function rollingHint(l: RollingLevel, b: RollBoard): string {
  const result = searchRolling(l, b);
  if (result.status === "invalid") return "局面无效，请重置这一关。";
  if (result.status === "unreachable")
    return `已穷尽 ${result.visited} 个可达状态：当前局面无法完成，请撤销或重置。`;
  if (!result.moves.length) return "全部踏板与出口朝向已经满足。";
  const d = result.moves[0],
    next = step(l, b, d)!;
  return `当前局面的最短续解还有 ${result.moves.length} 步。可先向${ROLL_LABELS[d]}滚一格，落地面将是 ${rollFaceLabel(next.faces[1])}。这是一条最短路线，不表示唯一走法。`;
}
