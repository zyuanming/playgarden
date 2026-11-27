// SPDX-License-Identifier: GPL-3.0-only
export const MAZE_SAVE = 'playgarden.layered-maze.v1';
export const directions = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] } as const;
export type Direction = keyof typeof directions;
export const arrows: Record<Direction, string> = { N: '↑', E: '→', S: '↓', W: '←' };
export const directionNames: Record<Direction, string> = { N: '向上', E: '向右', S: '向下', W: '向左' };
export type Move = Direction | number;
export type MazeBoard = {
  id: string; title: string; width: number; height: number;
  floors: readonly (readonly string[])[]; stairs: readonly (readonly [number, number])[];
  start: number; exit: number; stamps: readonly number[];
};
export type Position = { cell: number; spent: number; stamps: number };
export type Step = { position: Position; move?: Move };
export const floorSize = (b: MazeBoard) => b.width * b.height;
export const floorOf = (b: MazeBoard, c: number) => Math.floor(c / floorSize(b));
export function openCell(b: MazeBoard, c: number) {
  const tile = c % floorSize(b);
  return b.floors[floorOf(b, c)]?.[Math.floor(tile / b.width)]?.[tile % b.width] === '.';
}
export const countBits = (n: number) => n.toString(2).replace(/0/g, '').length;
export const stairAt = (b: MazeBoard, c: number) => b.stairs.findIndex(([a, z]) => a === c || z === c);
export const fullStampMask = (b: MazeBoard) => (1 << b.stamps.length) - 1;
export const won = (b: MazeBoard, p: Position) => p.cell === b.exit && p.stamps === fullStampMask(b);
function collect(b: MazeBoard, cell: number) {
  const i = b.stamps.indexOf(cell);
  return i < 0 ? 0 : 1 << i;
}
export const initialMaze = (b: MazeBoard): Step[] => [{ position: { cell: b.start, spent: 0, stamps: collect(b, b.start) } }];
export function moveMaze(b: MazeBoard, p: Position, move: Move): Position | null {
  if (won(b, p)) return null;
  let cell: number, spent = p.spent;
  if (typeof move === 'number') {
    const s = b.stairs[move];
    if (!s || (spent & (1 << move)) || !s.includes(p.cell)) return null;
    cell = s[0] === p.cell ? s[1] : s[0];
    spent |= 1 << move;
  } else {
    if (!Object.hasOwn(directions, move)) return null;
    const [dx, dy] = directions[move], area = floorSize(b), tile = p.cell % area;
    const x = tile % b.width + dx, y = Math.floor(tile / b.width) + dy;
    if (x < 0 || x >= b.width || y < 0 || y >= b.height) return null;
    cell = floorOf(b, p.cell) * area + y * b.width + x;
    if (!openCell(b, cell)) return null;
  }
  return { cell, spent, stamps: p.stamps | collect(b, cell) };
}
export function mazeHint(b: MazeBoard, start: Position): { move: Move; distance: number } | null {
  const seen = new Set<number>();
  const key = (p: Position) => ((p.cell << b.stairs.length | p.spent) << b.stamps.length) | p.stamps;
  const choices = Object.keys(directions) as Direction[];
  const queue: { p: Position; first?: Move; distance: number }[] = [{ p: start, distance: 0 }];
  seen.add(key(start));
  for (let i = 0; i < queue.length; i++) {
    const { p, first, distance } = queue[i];
    if (first !== undefined && won(b, p)) return { move: first, distance };
    const stair = stairAt(b, p.cell);
    for (const move of stair < 0 ? choices : [...choices, stair]) {
      const next = moveMaze(b, p, move);
      if (!next || seen.has(key(next))) continue;
      seen.add(key(next));
      queue.push({ p: next, first: first ?? move, distance: distance + 1 });
    }
  }
  return null;
}
export function loadMaze(b: MazeBoard, raw: string | null): Step[] {
  const first = initialMaze(b);
  try {
    const save = JSON.parse(raw ?? 'null');
    if (save?.id !== b.id || !Array.isArray(save.moves)) return first;
    const history = [...first];
    for (const move of save.moves) {
      if (typeof move !== 'string' && (typeof move !== 'number' || !Number.isInteger(move))) return first;
      // moveMaze validates direction names and stair indices before changing state.
      const action = move as Move;
      const position = moveMaze(b, history[history.length - 1].position, action);
      if (!position) return first;
      history.push({ position, move: action });
    }
    return history;
  } catch {
    return first;
  }
}
