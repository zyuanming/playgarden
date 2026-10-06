/** Original GPL-3.0-only Shikaku rules. Search and hints depend only on public clues and current rectangles. */
import {
  shikakuLevels,
  type ShikakuLevel,
  type ShikakuRect,
} from "./shikakuLevels";
export { shikakuLevels };
export type { ShikakuLevel, ShikakuRect, ShikakuClue } from "./shikakuLevels";
export const SHIKAKU_NODE_LIMIT = 50000;
export const REGION_HISTORY_LIMIT = 300;
export type ShikakuState = {
  rectangles: ShikakuRect[];
  history: ShikakuRect[][];
};
export type ShikakuSearch = {
  solutions: ShikakuRect[][];
  nodes: number;
  status: "complete" | "limit" | "budget" | "invalid";
};
export type ShikakuHint =
  | { kind: "deduction"; rectangle: ShikakuRect; reason: string }
  | { kind: "repair"; index: number; reason: string }
  | { kind: "unavailable"; reason: string };
export function validShikakuLevel(level: ShikakuLevel): boolean {
  return (
    !!level &&
    Number.isInteger(level.size) &&
    level.size >= 3 &&
    level.size <= 7 &&
    Array.isArray(level.clues) &&
    level.clues.length > 0 &&
    level.clues.length <= level.size ** 2 &&
    new Set(level.clues.map((c) => c?.index)).size === level.clues.length &&
    level.clues.every(
      (c) =>
        !!c &&
        Number.isInteger(c.index) &&
        c.index >= 0 &&
        c.index < level.size ** 2 &&
        Number.isInteger(c.area) &&
        c.area >= 1 &&
        c.area <= level.size ** 2,
    ) &&
    level.clues.reduce((s, c) => s + c.area, 0) === level.size ** 2
  );
}
export function validShikakuRect(
  size: number,
  rect: readonly number[],
): boolean {
  return (
    Number.isInteger(size) &&
    size >= 3 &&
    size <= 7 &&
    Array.isArray(rect) &&
    rect.length === 4 &&
    rect.every(Number.isInteger) &&
    rect[0] >= 0 &&
    rect[1] >= 0 &&
    rect[2] < size &&
    rect[3] < size &&
    rect[0] <= rect[2] &&
    rect[1] <= rect[3]
  );
}
export function shikakuCells(size: number, rect: readonly number[]): number[] {
  if (
    !Number.isInteger(size) ||
    size < 3 ||
    size > 7 ||
    !validShikakuRect(size, rect)
  )
    return [];
  const cells: number[] = [];
  for (let y = rect[0]; y <= rect[2]; y++)
    for (let x = rect[1]; x <= rect[3]; x++) cells.push(y * size + x);
  return cells;
}
export function shikakuRectangleFromCorners(
  size: number,
  a: number,
  b: number,
): ShikakuRect | null {
  if (
    !Number.isInteger(size) ||
    size < 3 ||
    size > 7 ||
    ![a, b].every((i) => Number.isInteger(i) && i >= 0 && i < size ** 2)
  )
    return null;
  return [
    Math.min(Math.floor(a / size), Math.floor(b / size)),
    Math.min(a % size, b % size),
    Math.max(Math.floor(a / size), Math.floor(b / size)),
    Math.max(a % size, b % size),
  ];
}
export function shikakuRectClue(
  level: ShikakuLevel,
  rect: readonly number[],
): number {
  if (!validShikakuLevel(level) || !validShikakuRect(level.size, rect))
    return -1;
  const cells = shikakuCells(level.size, rect),
    clues = level.clues.flatMap((c, i) => (cells.includes(c.index) ? [i] : []));
  return clues.length === 1 && level.clues[clues[0]].area === cells.length
    ? clues[0]
    : -1;
}
export function validShikakuPlacement(
  level: ShikakuLevel,
  rectangles: readonly ShikakuRect[],
): boolean {
  if (
    !validShikakuLevel(level) ||
    !Array.isArray(rectangles) ||
    rectangles.length > level.clues.length
  )
    return false;
  const occupied = new Set<number>();
  return rectangles.every((rect) => {
    if (shikakuRectClue(level, rect) < 0) return false;
    const cells = shikakuCells(level.size, rect);
    if (cells.some((i) => occupied.has(i))) return false;
    cells.forEach((i) => occupied.add(i));
    return true;
  });
}
export function isShikakuSolved(
  level: ShikakuLevel,
  rectangles: readonly ShikakuRect[],
): boolean {
  return (
    validShikakuPlacement(level, rectangles) &&
    rectangles.reduce((s, r) => s + shikakuCells(level.size, r).length, 0) ===
      level.size ** 2
  );
}
export function createShikakuState(): ShikakuState {
  return { rectangles: [], history: [] };
}
export function placeShikakuRectangle(
  state: ShikakuState,
  level: ShikakuLevel,
  rect: ShikakuRect,
  paused = false,
): ShikakuState {
  if (paused || !validShikakuPlacement(level, [...state.rectangles, rect]))
    return state;
  return {
    rectangles: [...state.rectangles, [...rect]],
    history: [
      ...state.history,
      state.rectangles.map((r) => [...r] as ShikakuRect),
    ].slice(-REGION_HISTORY_LIMIT),
  };
}
export function removeShikakuRectangle(
  state: ShikakuState,
  index: number,
  paused = false,
): ShikakuState {
  if (
    paused ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= state.rectangles.length
  )
    return state;
  return {
    rectangles: state.rectangles.filter((_, i) => i !== index),
    history: [
      ...state.history,
      state.rectangles.map((r) => [...r] as ShikakuRect),
    ].slice(-REGION_HISTORY_LIMIT),
  };
}
export function undoShikaku(state: ShikakuState, paused = false): ShikakuState {
  return paused || !state.history.length
    ? state
    : {
        rectangles: state.history.at(-1)!.map((r) => [...r]),
        history: state.history.slice(0, -1),
      };
}
export function shikakuCandidates(level: ShikakuLevel): ShikakuRect[][] {
  if (!validShikakuLevel(level)) return [];
  const n = level.size;
  return level.clues.map((clue) => {
    const out: ShikakuRect[] = [],
      y = Math.floor(clue.index / n),
      x = clue.index % n;
    for (let h = 1; h <= n; h++) {
      if (clue.area % h) continue;
      const w = clue.area / h;
      if (w > n) continue;
      for (let a = Math.max(0, y - h + 1); a <= Math.min(y, n - h); a++)
        for (let b = Math.max(0, x - w + 1); b <= Math.min(x, n - w); b++) {
          const r: ShikakuRect = [a, b, a + h - 1, b + w - 1];
          if (shikakuRectClue(level, r) >= 0) out.push(r);
        }
    }
    return out;
  });
}
/** Exact-cover search branches on an uncovered cell, not a stored answer. */
export function solveShikaku(
  level: ShikakuLevel,
  rectangles: readonly ShikakuRect[] = [],
  limit = 2,
  nodeLimit = SHIKAKU_NODE_LIMIT,
): ShikakuSearch {
  const result: ShikakuSearch = { solutions: [], nodes: 0, status: "complete" };
  if (
    !validShikakuPlacement(level, rectangles) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 128 ||
    !Number.isInteger(nodeLimit) ||
    nodeLimit < 1 ||
    nodeLimit > SHIKAKU_NODE_LIMIT
  )
    return { ...result, status: "invalid" };
  const candidates = shikakuCandidates(level).flatMap((list, clue) =>
    list.map((rect) => ({ rect, clue, cells: shikakuCells(level.size, rect) })),
  );
  const occupied = new Set(
      rectangles.flatMap((r) => shikakuCells(level.size, r)),
    ),
    used = new Set(rectangles.map((r) => shikakuRectClue(level, r))),
    chosen = rectangles.map((r) => [...r] as ShikakuRect);
  function visit() {
    if (result.status !== "complete") return;
    if (result.nodes >= nodeLimit) {
      result.status = "budget";
      return;
    }
    result.nodes++;
    if (occupied.size === level.size ** 2) {
      result.solutions.push(
        chosen
          .map((r) => [...r] as ShikakuRect)
          .sort(
            (a, b) => shikakuRectClue(level, a) - shikakuRectClue(level, b),
          ),
      );
      if (result.solutions.length >= limit) result.status = "limit";
      return;
    }
    let best: typeof candidates | undefined;
    for (let i = 0; i < level.size ** 2; i++)
      if (!occupied.has(i)) {
        const options = candidates.filter(
          (c) =>
            !used.has(c.clue) &&
            c.cells.includes(i) &&
            c.cells.every((j) => !occupied.has(j)),
        );
        if (!options.length) return;
        if (!best || options.length < best.length) best = options;
      }
    for (const c of best ?? []) {
      c.cells.forEach((i) => occupied.add(i));
      used.add(c.clue);
      chosen.push(c.rect);
      visit();
      chosen.pop();
      used.delete(c.clue);
      c.cells.forEach((i) => occupied.delete(i));
      if (result.status !== "complete") return;
    }
  }
  visit();
  return result;
}
const sameRect = (a: readonly number[], b: readonly number[]) =>
  a.every((v, i) => v === b[i]);
export function getShikakuHint(
  level: ShikakuLevel,
  rectangles: readonly ShikakuRect[],
  nodeLimit = SHIKAKU_NODE_LIMIT,
): ShikakuHint | null {
  if (isShikakuSolved(level, rectangles)) return null;
  const found = solveShikaku(level, rectangles, 128, nodeLimit);
  if (found.status !== "complete")
    return {
      kind: "unavailable",
      reason:
        found.status === "invalid"
          ? "棋盘数据需要检查。"
          : "本次搜索已到安全上限，还不能确认唯一的一步。请先结合面积继续推理。",
    };
  if (!found.solutions.length) {
    let remaining = nodeLimit - found.nodes;
    for (
      let index = rectangles.length - 1;
      index >= 0 && remaining > 0;
      index--
    ) {
      const repaired = solveShikaku(
        level,
        rectangles.filter((_, i) => i !== index),
        1,
        remaining,
      );
      remaining -= repaired.nodes;
      if (repaired.solutions.length)
        return {
          kind: "repair",
          index,
          reason:
            "当前区域有矛盾；移除这块后，其余矩形存在完整划分。先撤回这块，再继续规划。",
        };
    }
    return rectangles.length
      ? {
          kind: "repair",
          index: rectangles.length - 1,
          reason:
            "当前这些矩形无法组成完整划分。先撤回最近的一块逐步排查；它不一定是唯一的错误。",
        }
      : { kind: "unavailable", reason: "这些面积线索没有完整解。" };
  }
  const rectangle = found.solutions[0].find(
    (r) =>
      !rectangles.some((p) => sameRect(p, r)) &&
      found.solutions.every((s) => s.some((p) => sameRect(p, r))),
  );
  return rectangle
    ? {
        kind: "deduction",
        rectangle: [...rectangle],
        reason: `完整枚举当前局面后，所有可行划分都包含从第 ${rectangle[0] + 1} 行第 ${rectangle[1] + 1} 列到第 ${rectangle[2] + 1} 行第 ${rectangle[3] + 1} 列的矩形。`,
      }
    : {
        kind: "unavailable",
        reason: "当前仍有不同的可行划分，还没有共同的整块矩形可以确认。",
      };
}
export const shikakuSolutions = shikakuLevels.map((l) =>
  l.solution.map((r) => [...r] as ShikakuRect),
);
