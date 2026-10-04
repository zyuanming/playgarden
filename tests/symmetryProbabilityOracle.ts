// SPDX-License-Identifier: MIT
/** Test-only independent oracles. Nothing under src imports this file. */
import type {
  SymmetryCell,
  SymmetryLevel,
  SymmetryTransform,
} from "../src/games/symmetryRepairLogic";
import type {
  BagCounts,
  BagEvent,
  ProbabilityBagLevel,
} from "../src/games/probabilityBagLogic";
function imageXY(
  x: number,
  y: number,
  n: number,
  transform: SymmetryTransform,
): [number, number] {
  switch (transform) {
    case "vertical":
      return [n - 1 - x, y];
    case "horizontal":
      return [x, n - 1 - y];
    case "diagonal":
      return [y, x];
    case "antiDiagonal":
      return [n - 1 - y, n - 1 - x];
    case "quarterTurn":
      return [n - 1 - y, x];
    case "halfTurn":
      return [n - 1 - x, n - 1 - y];
  }
}
export function independentSymmetryValid(
  l: SymmetryLevel,
  b: readonly SymmetryCell[],
): boolean {
  if (b.length !== l.size * l.size || b.some((v) => v !== 0 && v !== 1))
    return false;
  let filled = 0,
    cost = 0;
  for (let y = 0; y < l.size; y++)
    for (let x = 0; x < l.size; x++) {
      const i = y * l.size + x;
      filled += b[i] === 1 ? 1 : 0;
      cost += b[i] !== l.initial[i] ? 1 : 0;
      if (l.locked.includes(i) && b[i] !== l.initial[i]) return false;
      for (const t of l.transforms) {
        const [xx, yy] = imageXY(x, y, l.size, t);
        if (b[i] !== b[yy * l.size + xx]) return false;
      }
    }
  return filled === l.filled && cost <= l.budget;
}
export function independentSymmetrySolutions(
  l: SymmetryLevel,
): SymmetryCell[][] {
  // Transitive equality matrix, unlike production's breadth-first orbit walk.
  const n = l.size * l.size,
    eq = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => i === j),
    );
  for (let i = 0; i < n; i++)
    for (const t of l.transforms) {
      const [x, y] = imageXY(i % l.size, Math.floor(i / l.size), l.size, t);
      eq[i][y * l.size + x] = eq[y * l.size + x][i] = true;
    }
  for (let k = 0; k < n; k++)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) eq[i][j] ||= eq[i][k] && eq[k][j];
  const roots = Array.from({ length: n }, (_, i) => eq[i].findIndex(Boolean)),
    distinct = [...new Set(roots)],
    result: SymmetryCell[][] = [];
  const board: SymmetryCell[] = Array(n).fill(0);
  function visit(k: number) {
    if (k === distinct.length) {
      if (independentSymmetryValid(l, board)) result.push([...board]);
      return;
    }
    const indices = roots.flatMap((r, i) => (r === distinct[k] ? [i] : []));
    for (const v of [0, 1] as const) {
      if (indices.some((i) => l.locked.includes(i) && l.initial[i] !== v))
        continue;
      indices.forEach((i) => {
        board[i] = v;
      });
      visit(k + 1);
    }
  }
  visit(0);
  return result;
}
export function independentEventCounts(
  c: BagCounts,
  e: BagEvent,
): [number, number] {
  // Enumerate distinguishable physical tokens, never production algebra.
  const tokens = c.flatMap((count, color) =>
    Array.from({ length: count }, (_, id) => ({ color, id: `${color}:${id}` })),
  );
  if (e.kind !== "pair") {
    const possible =
      e.kind === "conditional"
        ? tokens.filter((t) => e.given.includes(t.color))
        : tokens;
    return [
      possible.filter((t) => e.colors.includes(t.color)).length,
      possible.length,
    ];
  }
  let good = 0,
    total = 0;
  for (const first of tokens)
    for (const second of tokens) {
      if (!e.replacement && first.id === second.id) continue;
      total++;
      const a = first.color,
        b = second.color,
        colors = e.colors ?? [];
      if (
        (e.rule === "same" && a === b) ||
        (e.rule === "different" && a !== b) ||
        (e.rule === "ordered" && a === colors[0] && b === colors[1]) ||
        (e.rule === "atLeastOne" && (a === colors[0] || b === colors[0])) ||
        (e.rule === "oneEach" &&
          ((a === colors[0] && b === colors[1]) ||
            (a === colors[1] && b === colors[0])))
      )
        good++;
    }
  return [good, total];
}
export function independentBagValid(
  l: ProbabilityBagLevel,
  c: BagCounts,
): boolean {
  if (
    c.some(
      (n, i) =>
        !Number.isInteger(n) ||
        n < (l.minimum?.[i] ?? 0) ||
        n > (l.maximum?.[i] ?? l.size),
    ) ||
    c.reduce((a, b) => a + b, 0) !== l.size
  )
    return false;
  if (
    l.costs &&
    l.budget !== undefined &&
    c.reduce((s, n, i) => s + n * l.costs![i], 0) > l.budget
  )
    return false;
  return l.targets.every((t) => {
    const [good, total] = independentEventCounts(c, t.event);
    return total > 0 && good * t.target[1] === total * t.target[0];
  });
}
export function independentBagSolutions(l: ProbabilityBagLevel): BagCounts[] {
  const answers: BagCounts[] = [];
  for (let a = 0; a <= l.size; a++)
    for (let b = 0; b <= l.size - a; b++) {
      const c: BagCounts = [a, b, l.size - a - b];
      if (independentBagValid(l, c)) answers.push(c);
    }
  return answers;
}
