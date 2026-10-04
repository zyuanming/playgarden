/** Independent MIT certificates. Deliberately no runtime engine/helper imports.
 * Hitori branches on complete row masks; Nurikabe chooses connected island shapes.
 */
import type { HitoriLevel } from "../../src/games/hitoriLevels";
import type { NurikabeLevel } from "../../src/games/nurikabeLevels";
function neighbors(n: number, i: number): number[] {
  const result: number[] = [];
  for (let j = 0; j < n * n; j++)
    if (
      Math.abs(Math.floor(i / n) - Math.floor(j / n)) +
        Math.abs((i % n) - (j % n)) ===
      1
    )
      result.push(j);
  return result;
}
function components(n: number, chosen: number[]): number[][] {
  const seen = new Set<number>(),
    result: number[][] = [];
  for (const i of chosen) {
    if (seen.has(i)) continue;
    const group = [i];
    seen.add(i);
    for (let k = 0; k < group.length; k++)
      for (const j of neighbors(n, group[k]))
        if (chosen.includes(j) && !seen.has(j)) {
          seen.add(j);
          group.push(j);
        }
    result.push(group);
  }
  return result;
}
export function oracleHitori(
  level: HitoriLevel,
  board: readonly number[],
): boolean {
  const n = level.size;
  if (board.length !== n * n || board.some((v) => v !== 0 && v !== 1))
    return false;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      if (board[i] === 1) {
        if (neighbors(n, i).some((j) => board[j] === 1)) return false;
      } else
        for (let j = i + 1; j < n * n; j++)
          if (
            board[j] === 0 &&
            level.numbers[i] === level.numbers[j] &&
            (Math.floor(j / n) === y || j % n === x)
          )
            return false;
    }
  return (
    components(
      n,
      board.flatMap((v, i) => (v === 0 ? [i] : [])),
    ).length === 1
  );
}
export function oracleNurikabe(
  level: NurikabeLevel,
  board: readonly number[],
): boolean {
  const n = level.size;
  if (
    board.length !== n * n ||
    board.some((v) => v !== 0 && v !== 1) ||
    level.clues.some((c) => board[c.index] !== 0)
  )
    return false;
  for (const group of components(
    n,
    board.flatMap((v, i) => (v === 0 ? [i] : [])),
  )) {
    const clues = level.clues.filter((c) => group.includes(c.index));
    if (clues.length !== 1 || group.length !== clues[0].area) return false;
  }
  if (
    components(
      n,
      board.flatMap((v, i) => (v === 1 ? [i] : [])),
    ).length !== 1
  )
    return false;
  for (let y = 0; y < n - 1; y++)
    for (let x = 0; x < n - 1; x++)
      if (
        [y * n + x, y * n + x + 1, (y + 1) * n + x, (y + 1) * n + x + 1].every(
          (i) => board[i] === 1,
        )
      )
        return false;
  return true;
}
export function certifyHitori(level: HitoriLevel) {
  const n = level.size,
    rows: number[][] = [];
  for (let y = 0; y < n; y++) {
    const masks: number[] = [];
    for (let mask = 0; mask < 2 ** n; mask++) {
      if (mask & (mask << 1)) continue;
      const values = Array.from({ length: n }, (_, x) => x)
        .filter((x) => !(mask & (1 << x)))
        .map((x) => level.numbers[y * n + x]);
      if (new Set(values).size === values.length) masks.push(mask);
    }
    rows.push(masks);
  }
  const solutions: number[][] = [];
  let nodes = 0;
  function dfs(row: number, masks: number[], columns: Set<number>[]) {
    if (++nodes > 200000)
      throw Error("Independent Hitori certificate exceeded budget");
    if (solutions.length >= 2) return;
    if (row === n) {
      const board = Array.from({ length: n * n }, (_, i) =>
        Number(!!(masks[Math.floor(i / n)] & (1 << (i % n)))),
      );
      if (oracleHitori(level, board)) solutions.push(board);
      return;
    }
    for (const mask of rows[row]) {
      if (row && mask & masks[row - 1]) continue;
      if (
        columns.some(
          (col, x) => !(mask & (1 << x)) && col.has(level.numbers[row * n + x]),
        )
      )
        continue;
      dfs(
        row + 1,
        [...masks, mask],
        columns.map(
          (col, x) =>
            new Set([
              ...col,
              ...(mask & (1 << x) ? [] : [level.numbers[row * n + x]]),
            ]),
        ),
      );
    }
  }
  dfs(
    0,
    [],
    Array.from({ length: n }, () => new Set<number>()),
  );
  return { solutions, nodes };
}
export function certifyNurikabe(level: NurikabeLevel) {
  const n = level.size,
    seeds = level.clues.map((c) => c.index);
  const options = level.clues.map((clue) => {
    let shapes = new Map<string, number[]>([
      [String(clue.index), [clue.index]],
    ]);
    for (let size = 1; size < clue.area; size++) {
      const next = new Map<string, number[]>();
      for (const shape of shapes.values())
        for (const cell of shape)
          for (const candidate of neighbors(n, cell)) {
            if (
              shape.includes(candidate) ||
              seeds.includes(candidate) ||
              neighbors(n, candidate).some(
                (i) => i !== clue.index && seeds.includes(i),
              )
            )
              continue;
            const grown = [...shape, candidate].sort((a, b) => a - b);
            next.set(grown.join(","), grown);
          }
      shapes = next;
    }
    return [...shapes.values()];
  });
  const order = options
      .map((_, i) => i)
      .sort((a, b) => options[a].length - options[b].length),
    solutions: number[][] = [];
  let nodes = 0;
  function dfs(depth: number, land: Set<number>, halo: Set<number>) {
    if (++nodes > 200000)
      throw Error("Independent Nurikabe certificate exceeded budget");
    if (solutions.length >= 2) return;
    if (depth === order.length) {
      const board = Array.from({ length: n * n }, (_, i) =>
        land.has(i) ? 0 : 1,
      );
      if (oracleNurikabe(level, board)) solutions.push(board);
      return;
    }
    for (const shape of options[order[depth]]) {
      if (shape.some((i) => halo.has(i))) continue;
      dfs(
        depth + 1,
        new Set([...land, ...shape]),
        new Set([...halo, ...shape, ...shape.flatMap((i) => neighbors(n, i))]),
      );
    }
  }
  dfs(0, new Set(), new Set());
  return { solutions, nodes };
}
