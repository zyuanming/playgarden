/** Original MIT Nurikabe: numbered connected islands in a connected sea with no 2×2 sea. */
import { nurikabeLevels, type NurikabeLevel } from "./nurikabeLevels";
import {
  createIslandState,
  cycleIslandCell,
  islandComponents,
  islandHint,
  islandNeighbors,
  searchIsland,
  setIslandCell,
  undoIsland,
  validIslandBoard,
  type IslandCell,
  type IslandHint,
  type IslandSearch,
  type IslandState,
} from "./islandEliminationCore";
export { nurikabeLevels, undoIsland as undoNurikabe };
export type { NurikabeLevel } from "./nurikabeLevels";
export type {
  IslandCell as NurikabeCell,
  IslandState as NurikabeState,
  IslandHint as NurikabeHint,
} from "./islandEliminationCore";
export function validNurikabeLevel(level: NurikabeLevel): boolean {
  return (
    !!level &&
    Number.isInteger(level.size) &&
    level.size >= 2 &&
    level.size <= 6 &&
    Array.isArray(level.clues) &&
    level.clues.length > 0 &&
    level.clues.length < level.size ** 2 &&
    level.clues.every(
      (c) =>
        !!c &&
        Number.isInteger(c.index) &&
        c.index >= 0 &&
        c.index < level.size ** 2 &&
        Number.isInteger(c.area) &&
        c.area >= 1 &&
        c.area < level.size ** 2,
    ) &&
    new Set(level.clues.map((c) => c.index)).size === level.clues.length &&
    level.clues.reduce((sum, c) => sum + c.area, 0) < level.size ** 2
  );
}
export function validNurikabeBoard(
  level: NurikabeLevel,
  board: readonly number[],
): boolean {
  return (
    validNurikabeLevel(level) &&
    validIslandBoard(
      level.size,
      board,
      level.clues.map((c) => c.index),
    )
  );
}
export function createNurikabeState(level: NurikabeLevel): IslandState {
  return validNurikabeLevel(level)
    ? createIslandState(
        level.size,
        level.clues.map((c) => c.index),
      )
    : createIslandState(0);
}
export function setNurikabeCell(
  state: IslandState,
  level: NurikabeLevel,
  index: number,
  value: IslandCell,
  paused = false,
): IslandState {
  return setIslandCell(
    state,
    index,
    value,
    level.clues.map((c) => c.index),
    paused,
  );
}
export function cycleNurikabeCell(
  state: IslandState,
  level: NurikabeLevel,
  index: number,
  paused = false,
): IslandState {
  return cycleIslandCell(
    state,
    index,
    level.clues.map((c) => c.index),
    paused,
  );
}
function squares(n: number): number[][] {
  return Array.from({ length: n * n }, (_, i) => i)
    .filter((i) => Math.floor(i / n) < n - 1 && i % n < n - 1)
    .map((i) => [i, i + 1, i + n, i + n + 1]);
}
export function nurikabeConflicts(
  level: NurikabeLevel,
  board: readonly number[],
): number[] {
  if (!validNurikabeBoard(level, board)) return [];
  const bad = new Set<number>(),
    n = level.size;
  for (const square of squares(n))
    if (square.every((i) => board[i] === 1)) square.forEach((i) => bad.add(i));
  for (const group of islandComponents(
    n,
    board.flatMap((v, i) => (v === 0 ? [i] : [])),
  )) {
    const clues = level.clues.filter((c) => group.includes(c.index));
    if (
      clues.length > 1 ||
      (clues.length === 1 && group.length > clues[0].area) ||
      (!board.includes(-1) &&
        (clues.length !== 1 || group.length !== clues[0]?.area))
    )
      group.forEach((i) => bad.add(i));
  }
  if (
    islandComponents(
      n,
      board.flatMap((v, i) => (v !== 0 ? [i] : [])),
    ).filter((g) => g.some((i) => board[i] === 1)).length > 1
  )
    board.forEach((v, i) => {
      if (v === 1) bad.add(i);
    });
  return [...bad].sort((a, b) => a - b);
}
export function isNurikabeSolved(
  level: NurikabeLevel,
  board: readonly number[],
): boolean {
  return (
    validNurikabeBoard(level, board) &&
    !board.includes(-1) &&
    nurikabeConflicts(level, board).length === 0 &&
    islandComponents(
      level.size,
      board.flatMap((v, i) => (v === 1 ? [i] : [])),
    ).length === 1
  );
}
export function solveNurikabe(
  level: NurikabeLevel,
  board: readonly number[] = createNurikabeState(level).board,
  maxSolutions = 2,
  nodeLimit = 50000,
): IslandSearch {
  if (!validNurikabeBoard(level, board))
    return { solutions: [], nodes: 0, status: "invalid" };
  const n = level.size,
    boxes = squares(n),
    target = level.clues.reduce((a, c) => a + c.area, 0);
  const priority = board
    .map((_, i) => i)
    .sort(
      (a, b) =>
        Math.min(
          ...level.clues.map(
            (c) =>
              Math.abs(Math.floor(a / n) - Math.floor(c.index / n)) +
              Math.abs((a % n) - (c.index % n)),
          ),
        ) -
          Math.min(
            ...level.clues.map(
              (c) =>
                Math.abs(Math.floor(b / n) - Math.floor(c.index / n)) +
                Math.abs((b % n) - (c.index % n)),
            ),
          ) || a - b,
    );
  return searchIsland({
    board,
    maxSolutions,
    nodeLimit,
    priority,
    accept: (b) => isNurikabeSolved(level, b),
    propagate: (b) => {
      let changed = true;
      const put = (i: number, value: IslandCell) => {
        if (b[i] === value) return true;
        if (b[i] !== -1) return false;
        b[i] = value;
        changed = true;
        return true;
      };
      while (changed) {
        changed = false;
        const land = b.filter((v) => v === 0).length,
          unknown = b.filter((v) => v === -1).length;
        if (land > target || land + unknown < target) return false;
        if (land === target || land + unknown === target)
          for (let i = 0; i < b.length; i++)
            if (b[i] === -1) put(i, land === target ? 1 : 0);
        for (const box of boxes) {
          const sea = box.filter((i) => b[i] === 1).length;
          if (sea === 4) return false;
          if (sea === 3) {
            const i = box.find((i) => b[i] !== 1)!;
            if (!put(i, 0)) return false;
          }
        }
        const groups = islandComponents(
          n,
          b.flatMap((v, i) => (v === 0 ? [i] : [])),
        );
        const owner = new Map<number, number>();
        for (const group of groups) {
          const clues = level.clues.filter((c) => group.includes(c.index));
          if (
            clues.length > 1 ||
            (clues.length === 1 && group.length > clues[0].area)
          )
            return false;
          if (clues.length === 1) {
            group.forEach((i) => owner.set(i, clues[0].index));
            if (group.length === clues[0].area)
              for (const i of group)
                for (const j of islandNeighbors(n, i))
                  if (!group.includes(j) && !put(j, 1)) return false;
          }
        }
        // A candidate island cannot touch any already anchored different island.
        for (const clue of level.clues) {
          const reachable = [clue.index],
            seen = new Set(reachable);
          for (let k = 0; k < reachable.length; k++)
            for (const j of islandNeighbors(n, reachable[k])) {
              if (
                seen.has(j) ||
                b[j] === 1 ||
                (owner.has(j) && owner.get(j) !== clue.index) ||
                islandNeighbors(n, j).some(
                  (q) => owner.has(q) && owner.get(q) !== clue.index,
                )
              )
                continue;
              if (
                Math.abs(Math.floor(j / n) - Math.floor(clue.index / n)) +
                  Math.abs((j % n) - (clue.index % n)) >=
                clue.area
              )
                continue;
              seen.add(j);
              reachable.push(j);
            }
          if (reachable.length < clue.area) return false;
          if (reachable.length === clue.area)
            for (const i of reachable) if (!put(i, 0)) return false;
        }
        // Every land fragment must still be able to reach some numbered clue.
        for (const component of islandComponents(
          n,
          b.flatMap((v, i) => (v !== 1 ? [i] : [])),
        ))
          if (
            component.some((i) => b[i] === 0) &&
            !level.clues.some((c) => component.includes(c.index))
          )
            return false;
        const seaPaths = islandComponents(
          n,
          b.flatMap((v, i) => (v !== 0 ? [i] : [])),
        );
        if (
          !seaPaths.length ||
          seaPaths.filter((g) => g.some((i) => b[i] === 1)).length > 1
        )
          return false;
      }
      return true;
    },
  });
}
export function getNurikabeHint(
  level: NurikabeLevel,
  board: readonly number[],
  nodeLimit = 12000,
): IslandHint | null {
  const fallback = islandHint(
    board,
    (b, budget) => solveNurikabe(level, b, 2, budget),
    isNurikabeSolved(level, board),
    ["岛屿", "海水"],
    nodeLimit,
  );
  // Preserve feasibility, budget and repair semantics before explaining a rule.
  if (fallback?.kind !== "deduction") return fallback;
  const n = level.size,
    position = (i: number) =>
      `第 ${Math.floor(i / n) + 1} 行第 ${(i % n) + 1} 列`,
    groups = islandComponents(
      n,
      board.flatMap((v, i) => (v === 0 ? [i] : [])),
    ),
    owner = new Map<number, number>();
  for (const group of groups) {
    const clue = level.clues.find((c) => group.includes(c.index));
    if (!clue) continue;
    group.forEach((i) => owner.set(i, clue.index));
    if (group.length !== clue.area) continue;
    const index = group
      .flatMap((i) => islandNeighbors(n, i))
      .find((i) => board[i] === -1);
    if (index !== undefined)
      return {
        kind: "deduction",
        index,
        value: 1,
        reason: `小岛封边：${position(clue.index)}的数字是 ${clue.area}，这座岛已连成 ${group.length} 格，面积刚好。它旁边这格必须是海水，否则岛会变大。`,
      };
  }
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== -1) continue;
    const neighbors = islandNeighbors(n, i),
      clues = [
        ...new Set(
          neighbors.flatMap((j) => (owner.has(j) ? [owner.get(j)!] : [])),
        ),
      ];
    if (clues.length >= 2)
      return {
        kind: "deduction",
        index: i,
        value: 1,
        reason: `双岛分隔：这格紧邻分别连到${position(clues[0])}和${position(clues[1])}数字的岛。它若是岛屿，就会把两个数字连在同一座岛上，所以必须是海水。`,
      };
  }
  for (const box of squares(n)) {
    const index = box.find((i) => board[i] === -1);
    if (index !== undefined && box.filter((i) => board[i] === 1).length === 3)
      return {
        kind: "deduction",
        index,
        value: 0,
        reason: `避免水池：以${position(box[0])}为左上角的 2 × 2 方块里，已有三格海水。最后这格必须是岛屿，才不会形成全海水方块。`,
      };
  }
  for (const group of groups) {
    const clue = level.clues.find((c) => group.includes(c.index));
    if (!clue || group.length >= clue.area) continue;
    const exits = [
      ...new Set(
        group
          .flatMap((i) => islandNeighbors(n, i))
          .filter((i) => board[i] === -1),
      ),
    ];
    if (exits.length === 1)
      return {
        kind: "deduction",
        index: exits[0],
        value: 0,
        reason: `小岛出口：${position(clue.index)}的岛需要 ${clue.area} 格，现在只有 ${group.length} 格。这格是它唯一未定的出口，必须留作岛屿才能继续长大。`,
      };
  }
  return fallback;
}
