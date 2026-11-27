// SPDX-License-Identifier: GPL-3.0-only
export type Pole = "N" | "S";
type Magnet = Readonly<{ cell: number; pole: Pole; label: string }>;
export type Board = Readonly<{ id: string; title: string; width: number; height: number; tiles: string; start: number; exit: number; pole: Pole; magnets: readonly Magnet[] }>;
export type Position = Readonly<{ cell: number; pole: Pole }>;
export type Move = number | "flip";
type Step = { position: Position; move?: Move };
export type Slide = { kind: "slide"; cells: number[]; end: number; arrow: string; matching: boolean };
type Blocked = { kind: "axis" | "screen" | "stalled" };

export const magneticSave = "playgarden.magnetic-maze.v1";
const opposite = (pole: Pole): Pole => pole === "N" ? "S" : "N";

export function makeBoard(id: string, rows: string[], pole: Pole, title: string): Board {
  const width = rows[0]?.length ?? 0;
  const tiles = rows.join("");
  if (!width || rows.some(row => row.length !== width || /[^.oPENS#]/.test(row)) ||
      [...tiles].filter(t => t === "P").length !== 1 || [...tiles].filter(t => t === "E").length !== 1) {
    throw new Error("Invalid magnetic maze board: " + id);
  }
  const magnets: Magnet[] = [];
  [...tiles].forEach((t, cell) => {
    if (t === "N" || t === "S") magnets.push({ cell, pole: t, label: String.fromCharCode(65 + magnets.length) });
  });
  return { id, title, width, height: rows.length, tiles, start: tiles.indexOf("P"), exit: tiles.indexOf("E"), pole, magnets };
}

export function inspectPulse(b: Board, p: Position, index: number): Slide | Blocked {
  const magnet = b.magnets[index];
  if (!magnet) return { kind: "axis" };
  const x = p.cell % b.width, y = Math.floor(p.cell / b.width);
  const mx = magnet.cell % b.width, my = Math.floor(magnet.cell / b.width);
  if (x !== mx && y !== my) return { kind: "axis" };
  const sx = Math.sign(mx - x), sy = Math.sign(my - y);
  const ray = sx + sy * b.width;
  if (!ray) return { kind: "stalled" };
  const blocked = (cell: number) => "#NS".includes(b.tiles[cell]);
  for (let cell = p.cell + ray; cell !== magnet.cell; cell += ray)
    if (blocked(cell)) return { kind: "screen" };
  const matching = p.pole === magnet.pole, sign = matching ? -1 : 1;
  const dx = sx * sign, dy = sy * sign;
  const cells: number[] = [];
  for (let xx = x + dx, yy = y + dy; xx >= 0 && xx < b.width && yy >= 0 && yy < b.height; xx += dx, yy += dy) {
    const cell = xx + yy * b.width;
    if (blocked(cell)) break;
    cells.push(cell);
  }
  if (!cells.length) return { kind: "stalled" };
  return { kind: "slide", cells, end: cells[cells.length - 1], arrow: dx < 0 ? "←" : dx > 0 ? "→" : dy < 0 ? "↑" : "↓", matching };
}

export function moveCart(b: Board, p: Position, move: Move): Position | null {
  if (p.cell === b.exit) return null;
  if (move === "flip") return b.tiles[p.cell] === "o" ? { cell: p.cell, pole: opposite(p.pole) } : null;
  const plan = inspectPulse(b, p, move);
  return plan.kind === "slide" ? { cell: plan.end, pole: p.pole } : null;
}

export function restoreCart(b: Board, raw?: string | null): Step[] {
  const initial: Step = { position: { cell: b.start, pole: b.pole } };
  try {
    const record = JSON.parse(raw ?? "null");
    if (record?.id !== b.id || !Array.isArray(record.moves)) return [initial];
    const history = [initial];
    for (const move of record.moves) {
      if (move !== "flip" && !Number.isInteger(move)) return [initial];
      const position = moveCart(b, history[history.length - 1].position, move);
      if (!position) return [initial];
      history.push({ position, move });
    }
    return history;
  } catch { return [initial]; }
}

export function cartHint(b: Board, start: Position) {
  const key = (p: Position) => p.cell * 2 + Number(p.pole === "S");
  const seen = new Set([key(start)]);
  const actions: Move[] = [...b.magnets.map((_, i) => i), "flip"];
  const queue: { position: Position; distance: number; first?: Move }[] = [{ position: start, distance: 0 }];
  for (let i = 0; i < queue.length; i++) {
    const { position, distance, first } = queue[i];
    if (position.cell === b.exit && first !== undefined) return { move: first, distance };
    for (const move of actions) {
      const next = moveCart(b, position, move);
      if (!next || seen.has(key(next))) continue;
      seen.add(key(next));
      queue.push({ position: next, distance: distance + 1, first: first ?? move });
    }
  }
  return null;
}
