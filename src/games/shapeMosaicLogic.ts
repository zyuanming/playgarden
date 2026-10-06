// SPDX-License-Identifier: GPL-3.0-only
export type MosaicCell = readonly [number, number];
export type MosaicPiece = {
  label: string;
  cells: readonly MosaicCell[];
  reflect: boolean;
};
export type MosaicPlacement = {
  piece: number;
  orientation: number;
  x: number;
  y: number;
};
export type MosaicBoard = readonly (MosaicPlacement | null)[];
export type MosaicLevel = {
  id: string;
  title: string;
  lesson: string;
  rows: readonly string[];
  pieces: readonly MosaicPiece[];
  certificate: { placements: readonly MosaicPlacement[]; nodes: number };
};
export type MosaicState = {
  board: MosaicBoard;
  history: readonly MosaicBoard[];
};
export const MOSAIC_NODE_LIMIT = 100000;
export function normalizeMosaic(cells: readonly MosaicCell[]): MosaicCell[] {
  const minX = Math.min(...cells.map((c) => c[0])),
    minY = Math.min(...cells.map((c) => c[1]));
  return cells
    .map(([x, y]) => [x - minX, y - minY] as MosaicCell)
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
const cellKey = (cells: readonly MosaicCell[]) =>
  cells.map((c) => c.join(",")).join(";");
export function transformMosaic(
  cells: readonly MosaicCell[],
  turns: number,
  flipped = false,
): MosaicCell[] {
  let next: MosaicCell[] = cells.map(([x, y]) => [flipped ? -x : x, y]);
  for (let n = 0; n < ((turns % 4) + 4) % 4; n++)
    next = next.map(([x, y]) => [-y, x]);
  return normalizeMosaic(next);
}
export function mosaicOrientations(piece: MosaicPiece): MosaicCell[][] {
  const seen = new Set<string>(),
    result: MosaicCell[][] = [];
  for (const flipped of piece.reflect ? [false, true] : [false])
    for (let turns = 0; turns < 4; turns++) {
      const cells = transformMosaic(piece.cells, turns, flipped),
        key = cellKey(cells);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(cells);
      }
    }
  return result;
}
export function mosaicChangeOrientation(
  piece: MosaicPiece,
  orientation: number,
  flip: boolean,
): number {
  const orientations = mosaicOrientations(piece),
    current = orientations[orientation];
  if (!current || (flip && !piece.reflect)) return orientation;
  const next = cellKey(transformMosaic(current, flip ? 0 : 1, flip));
  return orientations.findIndex((c) => cellKey(c) === next);
}
export function mosaicRegion(l: MosaicLevel): MosaicCell[] {
  return l.rows.flatMap((r, y) =>
    [...r].flatMap((c, x) => (c === "." ? [[x, y] as MosaicCell] : [])),
  );
}
function connected(cells: readonly MosaicCell[]): boolean {
  if (!cells.length) return false;
  const all = new Set(cells.map((c) => c.join(","))),
    seen = new Set<string>(),
    stack = [cells[0]];
  while (stack.length) {
    const [x, y] = stack.pop()!,
      key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      if (all.has(`${x + dx},${y + dy}`) && !seen.has(`${x + dx},${y + dy}`))
        stack.push([x + dx, y + dy]);
  }
  return seen.size === all.size;
}
export function validMosaicLevel(l: MosaicLevel): boolean {
  const cells = mosaicRegion(l),
    width = l.rows[0]?.length ?? 0;
  return (
    width > 0 &&
    width <= 7 &&
    l.rows.length <= 7 &&
    l.rows.every((r) => r.length === width && /^[.#]+$/.test(r)) &&
    cells.length >= 4 &&
    cells.length <= 36 &&
    connected(cells) &&
    l.pieces.length >= 2 &&
    l.pieces.length <= 9 &&
    new Set(l.pieces.map((p) => p.label)).size === l.pieces.length &&
    l.pieces.every(
      (p) =>
        /^[A-Z]$/.test(p.label) &&
        p.cells.length >= 2 &&
        p.cells.length <= 6 &&
        p.cells.every((c) => c.length === 2 && c.every(Number.isInteger)) &&
        new Set(p.cells.map((c) => c.join(","))).size === p.cells.length &&
        connected(p.cells),
    ) &&
    l.pieces.reduce((sum, p) => sum + p.cells.length, 0) === cells.length
  );
}
/** Anchor = first occupied cell in the topmost row, always marked with a star in the preview. */
export function mosaicPlacementCells(
  l: MosaicLevel,
  p: MosaicPlacement,
): MosaicCell[] {
  const piece = l.pieces[p.piece];
  if (!piece) return [];
  const cells = mosaicOrientations(piece)[p.orientation];
  if (!cells) return [];
  return cells.map(([x, y]) => [p.x + x - cells[0][0], p.y + y - cells[0][1]]);
}
export function validMosaicBoard(l: MosaicLevel, b: MosaicBoard): boolean {
  if (!validMosaicLevel(l) || b.length !== l.pieces.length) return false;
  const used = new Set<string>();
  for (let i = 0; i < b.length; i++) {
    const p = b[i];
    if (!p) continue;
    if (
      p.piece !== i ||
      ![p.piece, p.orientation, p.x, p.y].every(Number.isInteger) ||
      p.orientation < 0
    )
      return false;
    const cells = mosaicPlacementCells(l, p);
    if (cells.length !== l.pieces[i].cells.length) return false;
    for (const [x, y] of cells) {
      const key = `${x},${y}`;
      if (l.rows[y]?.[x] !== "." || used.has(key)) return false;
      used.add(key);
    }
  }
  return true;
}
export const createMosaicState = (l: MosaicLevel): MosaicState => ({
  board: l.pieces.map(() => null),
  history: [],
});
export const mosaicWon = (l: MosaicLevel, b: MosaicBoard) =>
  validMosaicBoard(l, b) && b.every(Boolean);
export function placeMosaic(
  l: MosaicLevel,
  s: MosaicState,
  p: MosaicPlacement,
): MosaicState {
  if (
    mosaicWon(l, s.board) ||
    !Number.isInteger(p.piece) ||
    p.piece < 0 ||
    p.piece >= l.pieces.length
  )
    return s;
  const board = s.board.map((old, i) => (i === p.piece ? { ...p } : old));
  if (
    !validMosaicBoard(l, board) ||
    JSON.stringify(board) === JSON.stringify(s.board)
  )
    return s;
  return { board, history: [...s.history, s.board] };
}
export function removeMosaic(
  l: MosaicLevel,
  s: MosaicState,
  piece: number,
): MosaicState {
  if (mosaicWon(l, s.board) || !s.board[piece] || !Number.isInteger(piece))
    return s;
  return {
    board: s.board.map((p, i) => (i === piece ? null : p)),
    history: [...s.history, s.board],
  };
}
export function undoMosaic(l: MosaicLevel, s: MosaicState): MosaicState {
  if (!s.history.length || mosaicWon(l, s.board)) return s;
  return {
    board: s.history[s.history.length - 1],
    history: s.history.slice(0, -1),
  };
}
export type MosaicSearch = {
  status: "solved" | "unreachable" | "limit" | "invalid";
  board: MosaicBoard | null;
  nodes: number;
};
export function searchMosaic(
  l: MosaicLevel,
  fixed: MosaicBoard = createMosaicState(l).board,
  budget = MOSAIC_NODE_LIMIT,
  excluded?: MosaicPlacement,
): MosaicSearch {
  if (!validMosaicBoard(l, fixed) || !Number.isInteger(budget) || budget < 0)
    return { status: "invalid", board: null, nodes: 0 };
  budget = Math.min(budget, MOSAIC_NODE_LIMIT);
  const region = mosaicRegion(l),
    cellIds = new Map(region.map((c, i) => [c.join(","), i]));
  type Domain = { placement: MosaicPlacement; cells: number[] };
  const domains: Domain[][] = l.pieces.map((piece, i) =>
    fixed[i]
      ? []
      : mosaicOrientations(piece).flatMap((_, orientation) =>
          region.flatMap(([x, y]) => {
            const placement = { piece: i, orientation, x, y };
            if (
              excluded &&
              JSON.stringify(placement) === JSON.stringify(excluded)
            )
              return [];
            const cells = mosaicPlacementCells(l, placement).map((c) =>
              cellIds.get(c.join(",")),
            );
            return cells.every((c) => c !== undefined)
              ? [{ placement, cells: cells as number[] }]
              : [];
          }),
        ),
  );
  const board = [...fixed],
    occupied = new Set<number>();
  fixed.forEach((p) => {
    if (p)
      mosaicPlacementCells(l, p).forEach((c) =>
        occupied.add(cellIds.get(c.join(","))!),
      );
  });
  let nodes = 0,
    limited = false;
  function visit(): MosaicBoard | null {
    if (nodes >= budget) {
      limited = true;
      return null;
    }
    nodes++;
    if (board.every(Boolean)) return [...board];
    let options: Domain[] | null = null;
    const available = domains.map((ds, i) =>
      board[i] ? [] : ds.filter((d) => d.cells.every((c) => !occupied.has(c))),
    );
    if (available.some((a, i) => !board[i] && !a.length)) return null;
    for (let cell = 0; cell < region.length; cell++)
      if (!occupied.has(cell)) {
        const candidates = available.flatMap((ds) =>
          ds.filter((d) => d.cells.includes(cell)),
        );
        if (!candidates.length) return null;
        if (!options || candidates.length < options.length)
          options = candidates;
      }
    for (const d of options ?? []) {
      board[d.placement.piece] = d.placement;
      d.cells.forEach((c) => occupied.add(c));
      const found = visit();
      if (found) return found;
      board[d.placement.piece] = null;
      d.cells.forEach((c) => occupied.delete(c));
      if (limited) return null;
    }
    return null;
  }
  const answer = visit();
  return {
    status: answer ? "solved" : limited ? "limit" : "unreachable",
    board: answer,
    nodes,
  };
}
export type MosaicHint = {
  text: string;
  placement: MosaicPlacement | null;
  forced: boolean;
  status: MosaicSearch["status"];
  nodes: number;
};
export function mosaicHint(
  l: MosaicLevel,
  board: MosaicBoard,
  budget = MOSAIC_NODE_LIMIT,
): MosaicHint {
  const found = searchMosaic(l, board, budget);
  const base = {
    placement: null,
    forced: false,
    status: found.status,
    nodes: found.nodes,
  };
  if (found.status === "invalid")
    return { ...base, text: "局面无效，请重置这一关。" };
  if (found.status === "limit")
    return {
      ...base,
      text: `搜索达到 ${found.nodes} 节点预算，暂未找到可靠续解；这不代表无解。`,
    };
  if (found.status === "unreachable")
    return {
      ...base,
      text: `已穷尽 ${found.nodes} 个搜索节点：保留现有拼片无法铺满。请撤销或取回一片。`,
    };
  const placement = found.board!.find((p, i) => p && !board[i]) ?? null;
  if (!placement)
    return { ...base, text: "每片都恰好使用一次，区域已经铺满。" };
  const alternate = searchMosaic(
    l,
    board,
    Math.max(0, Math.min(budget, MOSAIC_NODE_LIMIT) - found.nodes),
    placement,
  );
  const forced = alternate.status === "unreachable";
  return {
    placement,
    forced,
    status: "solved",
    nodes: found.nodes + alternate.nodes,
    text: `${forced ? "已排除其他摆法，这片的落位是必然的" : "找到一条可行续解，此落位不声称必然"}：选 ${l.pieces[placement.piece].label}，使用预览朝向，在 ${placement.y + 1} 行 ${placement.x + 1} 列放下星标锚点。${alternate.status === "limit" ? "替代方案检查达到预算，尚未证明唯一。" : ""}`,
  };
}
