/** Original GPL-3.0-only implementation of standard Kakuro rules. */
import {
  arithmeticHint,
  searchArithmetic,
  type ArithmeticProblem,
} from "./arithmeticConstraintCore";
import { kakuroLevels, type KakuroLevel } from "./kakuroLevels";
export { kakuroLevels };
export type { KakuroLevel };
export type KakuroRun = {
  cells: number[];
  direction: "across" | "down";
  sum: number;
};
export function kakuroTopology(
  rows: readonly string[],
): Omit<KakuroRun, "sum">[] {
  const w = rows[0]?.length ?? 0,
    runs: Omit<KakuroRun, "sum">[] = [];
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < w; c++) {
      if (rows[r][c] !== ".") continue;
      if (c === 0 || rows[r][c - 1] === "#") {
        const cells: number[] = [];
        for (let x = c; x < w && rows[r][x] === "."; x++) cells.push(r * w + x);
        runs.push({ cells, direction: "across" });
      }
      if (r === 0 || rows[r - 1][c] === "#") {
        const cells: number[] = [];
        for (let y = r; y < rows.length && rows[y][c] === "."; y++)
          cells.push(y * w + c);
        runs.push({ cells, direction: "down" });
      }
    }
  return runs;
}
export function validKakuroLevel(level: KakuroLevel): boolean {
  if (
    !level ||
    !Array.isArray(level.rows) ||
    level.rows.length < 2 ||
    level.rows.length > 7 ||
    typeof level.rows[0] !== "string"
  )
    return false;
  const w = level.rows[0].length;
  if (
    w < 2 ||
    w > 7 ||
    level.rows.some(
      (r) => typeof r !== "string" || r.length !== w || !/^[.#]+$/.test(r),
    )
  )
    return false;
  const runs = kakuroTopology(level.rows);
  return (
    runs.length > 0 &&
    Array.isArray(level.sums) &&
    runs.length === level.sums.length &&
    runs.every(
      (run, i) =>
        run.cells.length >= 2 &&
        run.cells.length <= 5 &&
        Number.isInteger(level.sums[i]) &&
        level.sums[i] >= (run.cells.length * (run.cells.length + 1)) / 2 &&
        level.sums[i] <= (run.cells.length * (19 - run.cells.length)) / 2,
    )
  );
}
export function kakuroRuns(level: KakuroLevel): KakuroRun[] {
  return validKakuroLevel(level)
    ? kakuroTopology(level.rows).map((run, i) => ({
        ...run,
        sum: level.sums[i],
      }))
    : [];
}
const cache = new Map<string, number[][]>();
export function kakuroRunOptions(length: number, sum: number): number[][] {
  if (
    !Number.isInteger(length) ||
    length < 2 ||
    length > 5 ||
    !Number.isInteger(sum) ||
    sum < (length * (length + 1)) / 2 ||
    sum > (length * (19 - length)) / 2
  )
    return [];
  const key = `${length}:${sum}`,
    cached = cache.get(key);
  if (cached) return cached.map((p) => p.slice());
  const tuples: number[][] = [];
  function visit(prefix: number[], remaining: number) {
    if (prefix.length === length) {
      if (remaining === 0) tuples.push(prefix);
      return;
    }
    const available = Array.from({ length: 9 }, (_, i) => i + 1).filter(
      (v) => !prefix.includes(v),
    );
    const slots = length - prefix.length;
    if (
      remaining < available.slice(0, slots).reduce((a, b) => a + b, 0) ||
      remaining > available.slice(-slots).reduce((a, b) => a + b, 0)
    )
      return;
    for (const value of available) visit([...prefix, value], remaining - value);
  }
  visit([], sum);
  cache.set(key, tuples);
  return tuples.map((p) => p.slice());
}
export function kakuroProblem(level: KakuroLevel): ArithmeticProblem | null {
  if (!validKakuroLevel(level)) return null;
  return {
    length: level.rows.length * level.rows[0].length,
    digits: 9,
    active: level.rows
      .join("")
      .split("")
      .flatMap((v, i) => (v === "." ? [i] : [])),
    tables: kakuroRuns(level).map((run) => ({
      cells: run.cells,
      tuples: kakuroRunOptions(run.cells.length, run.sum),
      source:
        (run.direction === "across"
          ? `第 ${Math.floor(run.cells[0] / level.rows[0].length) + 1} 行第 ${(run.cells[0] % level.rows[0].length) + 1}–${(run.cells.at(-1)! % level.rows[0].length) + 1} 列横段`
          : `第 ${(run.cells[0] % level.rows[0].length) + 1} 列第 ${Math.floor(run.cells[0] / level.rows[0].length) + 1}–${Math.floor(run.cells.at(-1)! / level.rows[0].length) + 1} 行竖段`) +
        `（和 ${run.sum}，段内不重复）`,
    })),
  };
}
export function solveKakuro(
  level: KakuroLevel,
  values?: readonly number[],
  limit = 2,
  nodeLimit = 30000,
) {
  const problem = kakuroProblem(level);
  return problem
    ? searchArithmetic(
        problem,
        values ?? Array(problem.length).fill(0),
        limit,
        nodeLimit,
      )
    : { solutions: [], nodes: 0, checks: 0, status: "invalid" as const };
}
export function kakuroConflicts(
  level: KakuroLevel,
  values: readonly number[],
): number[] {
  const problem = kakuroProblem(level);
  if (
    !problem ||
    !Array.isArray(values) ||
    values.length !== problem.length ||
    values.some(
      (v, i) =>
        !Number.isInteger(v) ||
        v < 0 ||
        v > 9 ||
        (!problem.active.includes(i) && v !== 0),
    )
  )
    return problem?.active ?? [];
  return [
    ...new Set(
      problem.tables.flatMap((t) =>
        t.tuples.some((p) =>
          p.every((v, j) => !values[t.cells[j]] || values[t.cells[j]] === v),
        )
          ? []
          : t.cells,
      ),
    ),
  ].sort((a, b) => a - b);
}
export function isKakuroSolved(
  level: KakuroLevel,
  values: readonly number[],
): boolean {
  if (
    !validKakuroLevel(level) ||
    !Array.isArray(values) ||
    values.length !== level.rows.length * level.rows[0].length
  )
    return false;
  return (
    values.every((v, i) =>
      level.rows[Math.floor(i / level.rows[0].length)][
        i % level.rows[0].length
      ] === "#"
        ? v === 0
        : Number.isInteger(v) && v >= 1 && v <= 9,
    ) &&
    kakuroRuns(level).every(
      (run) =>
        new Set(run.cells.map((i) => values[i])).size === run.cells.length &&
        run.cells.reduce((s, i) => s + values[i], 0) === run.sum,
    )
  );
}
export function getKakuroHint(
  level: KakuroLevel,
  values: readonly number[],
  nodeLimit = 12000,
) {
  return arithmeticHint(
    kakuroProblem(level),
    values,
    "横段和竖段的和数、段内不重复相互交叉。",
    nodeLimit,
  );
}
