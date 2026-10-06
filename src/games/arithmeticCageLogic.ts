/** Original GPL-3.0-only arithmetic-cage Latin puzzle. Subtraction/division are unordered two-cell operations. */
import {
  arithmeticHint,
  arithmeticPermutations,
  searchArithmetic,
  type ArithmeticProblem,
} from "./arithmeticConstraintCore";
import {
  arithmeticCageLevels,
  type ArithmeticCage,
  type ArithmeticCageLevel,
} from "./arithmeticCageLevels";
export { arithmeticCageLevels };
export type { ArithmeticCage, ArithmeticCageLevel };
export function cageMatches(
  cage: ArithmeticCage,
  values: readonly number[],
): boolean {
  if (
    values.length !== cage.cells.length ||
    !values.length ||
    values.some((v) => !Number.isInteger(v) || v < 1)
  )
    return false;
  switch (cage.op) {
    case "=":
      return values.length === 1 && values[0] === cage.target;
    case "+":
      return values.reduce((s, v) => s + v, 0) === cage.target;
    case "×":
      return values.reduce((s, v) => s * v, 1) === cage.target;
    case "−":
      return (
        values.length === 2 && Math.abs(values[0] - values[1]) === cage.target
      );
    case "÷": {
      const a = Math.max(...values),
        b = Math.min(...values);
      return values.length === 2 && a % b === 0 && a / b === cage.target;
    }
    default:
      return false;
  }
}
export function validArithmeticCageLevel(level: ArithmeticCageLevel): boolean {
  if (
    !level ||
    !Number.isInteger(level.size) ||
    level.size < 2 ||
    level.size > 5 ||
    !Array.isArray(level.cages) ||
    !level.cages.length ||
    level.cages.length > level.size * level.size
  )
    return false;
  const seen = new Set<number>(),
    n = level.size;
  for (const cage of level.cages) {
    if (
      !cage ||
      !Array.isArray(cage.cells) ||
      cage.cells.length < 1 ||
      cage.cells.length > 4 ||
      !Number.isSafeInteger(cage.target) ||
      cage.target < 0 ||
      cage.target > n ** 4 ||
      !["=", "+", "×", "−", "÷"].includes(cage.op) ||
      (cage.op === "="
        ? cage.cells.length !== 1
        : ["−", "÷"].includes(cage.op)
          ? cage.cells.length !== 2
          : cage.cells.length < 2) ||
      (cage.op !== "−" && cage.target < 1)
    )
      return false;
    for (const i of cage.cells) {
      if (!Number.isInteger(i) || i < 0 || i >= n * n || seen.has(i))
        return false;
      seen.add(i);
    }
    const connected = new Set([cage.cells[0]]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const i of cage.cells)
        if (
          !connected.has(i) &&
          [...connected].some(
            (j) =>
              Math.abs(Math.floor(i / n) - Math.floor(j / n)) +
                Math.abs((i % n) - (j % n)) ===
              1,
          )
        ) {
          connected.add(i);
          changed = true;
        }
    }
    if (connected.size !== cage.cells.length) return false;
  }
  return seen.size === n * n;
}
export function arithmeticCageOptions(
  size: number,
  cage: ArithmeticCage,
): number[][] {
  if (
    !Number.isInteger(size) ||
    size < 2 ||
    size > 5 ||
    !cage ||
    !Array.isArray(cage.cells) ||
    cage.cells.length < 1 ||
    cage.cells.length > 4
  )
    return [];
  const tuples: number[][] = [];
  function visit(prefix: number[]) {
    if (prefix.length === cage.cells.length) {
      if (cageMatches(cage, prefix)) tuples.push(prefix);
      return;
    }
    for (let v = 1; v <= size; v++) {
      const i = cage.cells[prefix.length];
      if (
        prefix.some(
          (other, j) =>
            other === v &&
            (Math.floor(i / size) === Math.floor(cage.cells[j] / size) ||
              i % size === cage.cells[j] % size),
        )
      )
        continue;
      visit([...prefix, v]);
    }
  }
  visit([]);
  return tuples;
}
export function arithmeticCageProblem(
  level: ArithmeticCageLevel,
): ArithmeticProblem | null {
  if (!validArithmeticCageLevel(level)) return null;
  const n = level.size,
    permutations = arithmeticPermutations(n);
  return {
    length: n * n,
    digits: n,
    active: Array.from({ length: n * n }, (_, i) => i),
    tables: [
      ...Array.from({ length: n }, (_, r) => ({
        cells: Array.from({ length: n }, (_, c) => r * n + c),
        tuples: permutations,
        source: `第 ${r + 1} 行（1–${n} 各一次）`,
      })),
      ...Array.from({ length: n }, (_, c) => ({
        cells: Array.from({ length: n }, (_, r) => r * n + c),
        tuples: permutations,
        source: `第 ${c + 1} 列（1–${n} 各一次）`,
      })),
      ...level.cages.map((c, i) => ({
        cells: c.cells,
        tuples: arithmeticCageOptions(n, c),
        source: `第 ${i + 1} 笼（${c.target}${c.op}，${c.cells.length === 1 ? "单格" : `${c.cells.length} 格`}）`,
      })),
    ],
  };
}
export function solveArithmeticCage(
  level: ArithmeticCageLevel,
  values?: readonly number[],
  limit = 2,
  nodeLimit = 30000,
) {
  const problem = arithmeticCageProblem(level);
  return problem
    ? searchArithmetic(
        problem,
        values ?? Array(problem.length).fill(0),
        limit,
        nodeLimit,
      )
    : { solutions: [], nodes: 0, checks: 0, status: "invalid" as const };
}
export function arithmeticCageConflicts(
  level: ArithmeticCageLevel,
  values: readonly number[],
): number[] {
  const problem = arithmeticCageProblem(level);
  if (
    !problem ||
    !Array.isArray(values) ||
    values.length !== problem.length ||
    values.some((v) => !Number.isInteger(v) || v < 0 || v > level.size)
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
export function isArithmeticCageSolved(
  level: ArithmeticCageLevel,
  values: readonly number[],
): boolean {
  if (
    !validArithmeticCageLevel(level) ||
    !Array.isArray(values) ||
    values.length !== level.size ** 2 ||
    values.some((v) => !Number.isInteger(v) || v < 1 || v > level.size)
  )
    return false;
  const n = level.size;
  return (
    Array.from(
      { length: n },
      (_, r) =>
        new Set(values.slice(r * n, (r + 1) * n)).size === n &&
        new Set(Array.from({ length: n }, (_, c) => values[c * n + r])).size ===
          n,
    ).every(Boolean) &&
    level.cages.every((c) =>
      cageMatches(
        c,
        c.cells.map((i) => values[i]),
      ),
    )
  );
}
export function getArithmeticCageHint(
  level: ArithmeticCageLevel,
  values: readonly number[],
  nodeLimit = 12000,
) {
  return arithmeticHint(
    arithmeticCageProblem(level),
    values,
    "先满足笼内运算，再结合行、列各数一次。",
    nodeLimit,
  );
}
